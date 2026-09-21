# Runbook: Pause + config drift + governance safety

This runbook covers operational and security incidents related to **pause toggles**, **parameter changes**,
**module registry updates**, and **governance transfers**.

It maps to the metrics in `docs/ops/metrics.md` section **E**.

---

## Scope

**In-scope symptoms**

- Unexpected `risk_in_paused` toggles (`E1`)
- Unexpected `refund_timeout_seconds` changes (`E2`)
- `GameRegistered` / module registry changes (`E3`)
- `GovernanceTransferStarted/Transferred` events (`E4`)
- Unexpected pricing/referral parameter changes (read-based checks)

**Out-of-scope**

- VRF liveness and refundCredit accounting (see runbook: [VRF + refundCredit](vrf-refundcredit.md))
- Bank reserve anomalies (see runbook: [Bank solvency](bank-solvency.md))

---

## Prerequisites

### Addresses

Take them from the embedded release snapshot the frontend actually consumes,
`frontend/packages/ssot/src/release/embedded/chain-<chainId>.json`. Prefer it
over the top-level `deployments/latest-*.json` pointers, whose chain ownership
is ambiguous — `latest-v13.json` points at mainnet 8453 while `latest-v14.json`
points at Sepolia 84532 (audit AGF-03).

Shell variables used throughout this runbook:

- `GAME_HUB` — `contracts.gameHub`
- `POOL_REGISTRY` — `contracts.poolRegistry`
- `BANK` — `pools[i].bank`, **per pool**; most pause actions are per Bank
- `VRF_HUB` / `ADAPTER` — `contracts.vrfHub` / `contracts.adapter`
- `SPORTS_HUB` — `contracts.sportsHub`; `0x0` where sports is not deployed,
  which is the case on mainnet today

### Tools

- `cast` for reads and event queries
- Explorer / block analytics for signer attribution

### Who can pause

Pausing is per pool and the switch is on that pool's **Bank**, not on the
GameHub. There is no pause-everything call: to freeze several pools, send one
transaction per Bank.

| Action                                | v1.4 (deployed today) | v1.5                       |
| ------------------------------------- | --------------------- | -------------------------- |
| Pause `Bank.setRiskInPaused(true)`    | governance only       | governance **or** guardian |
| Unpause `Bank.setRiskInPaused(false)` | governance only       | governance only            |

From v1.5 the Bank carries a `guardian` address whose only power is to decline
new risk. The asymmetry is deliberate: pausing is the safe direction and is
made fast so it does not wait on a multisig quorum, while unpausing re-admits
risk and stays behind full governance. Read the configured guardian with
`cast call $BANK "guardian()(address)"`; zero means the role is disabled. On
v1.4 that call reverts, because the role does not exist yet.

Pausing never blocks payouts. Debt-Out (`settleBet` / `refundBet`) does not
consult `nav()`, and `finalize` / `refund` are permissionless, so a paused pool
still pays out and players can settle their own bets.

### Governance actions available (onlyGov)

- Pause risk-in per pool: `Bank.setRiskInPaused(bool)` on that pool's Bank.
- Update refund timeout: `GameHub.setRefundTimeout(seconds)` where applicable.
- Update module registry: `GameHub.registerGame(gameId, module)`
- Update bank risk reserve: `Bank.setRiskReserveBps(bps)`
- Update bank withdrawal buffer: `Bank.setWithdrawalBufferBps(bps)`
- Set or revoke the pause guardian (v1.5+): `Bank.setGuardian(address)`, zero to disable
- Transfer governance (two-step): `GovernanceTransferStarted/Transferred`

**Guardrail**
Any governance parameter change should be accompanied by:

- A change ticket / approval reference
- A release artifact digest (`deployments/release-*.json` digest)
- A post-change verification checklist (see below)

---

## Quick triage checklist (5 minutes)

### 1) Determine if this is expected change control or suspicious activity

- Identify the transaction(s) that emitted the event(s)
- Confirm the signer matches your expected gov/timelock multisig
- If signer is unknown or the change is outside an approved window → treat as **security incident**

### 2) Snapshot current critical parameters

```bash
cast call $GAME_HUB "refundTimeoutSeconds()(uint256)" --rpc-url $RPC
cast call $GAME_HUB "defaultHouseEdgeBps()(uint16)" --rpc-url $RPC
cast call $GAME_HUB "maxAffiliateDeltaBps()(uint16)" --rpc-url $RPC
cast call $GAME_HUB "activeReferralConfigId()(uint32)" --rpc-url $RPC
```

Pools are addressed by **id**, not by asset, and the pool -> bank -> asset
mapping lives in the PoolRegistry rather than the GameHub:

```bash
cast call $POOL_REGISTRY "listPoolIds()(uint64[])" --rpc-url $RPC

# then per pool id
cast call $GAME_HUB      "riskInPaused(uint64)(bool)"  $POOL_ID --rpc-url $RPC
cast call $POOL_REGISTRY "bankFor(uint64)(address)"    $POOL_ID --rpc-url $RPC
cast call $POOL_REGISTRY "assetFor(uint64)(address)"   $POOL_ID --rpc-url $RPC
```

The GameHub view is a convenience that reads through to the pool's Bank. The
Bank is the authority and can be read directly:

```bash
cast call $BANK "riskInPaused()(bool)" --rpc-url $RPC
```

### 3) Validate module registry sanity

Pick the canonical gameIds you expect to be registered and verify they map to known modules:

```bash
cast call $GAME_HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
```

---

## Incident playbooks

### Playbook A — Unexpected pause toggle (E1)

**Trigger**

- `RiskInPausedSet` emitted without an approved incident/maintenance window

**Goal**

- Determine whether this is legitimate ops action or an unauthorized change

**Steps**

1. Identify the emitting transaction and its sender, then classify it. From
   v1.5 there are **two** legitimate senders, so an unrecognised one is not
   automatically the governance key:

   ```bash
   cast tx $TX_HASH from --rpc-url $RPC
   cast call $BANK "governance()(address)" --rpc-url $RPC
   cast call $BANK "guardian()(address)"   --rpc-url $RPC
   ```

2. **Sender is the guardian, pausing.** Working as designed — that is the whole
   point of the role. Confirm the operator meant it. Note that the guardian
   cannot unpause, so recovery always needs governance regardless.

3. **Sender is the guardian, but the pause was not intended.** Treat the
   guardian key as compromised. Its blast radius is bounded to refusing new
   bets: it cannot unpause, move funds, or change any other parameter. Respond
   with governance, in this order — revoke first, so it cannot re-pause behind
   you:

   ```bash
   cast send $BANK "setGuardian(address)" 0x0000000000000000000000000000000000000000 \
     --rpc-url $RPC --private-key $GOV_PK
   cast send $BANK "setRiskInPaused(bool)" false --rpc-url $RPC --private-key $GOV_PK
   ```

   Then rotate to a fresh guardian address. Payouts were never affected.

4. **Sender is unknown, or governance itself looks compromised.** Freeze every
   active pool. There is no pause-everything call — one transaction per Bank:

   ```bash
   for POOL_ID in $(cast call $POOL_REGISTRY "listPoolIds()(uint64[])" --rpc-url $RPC | tr -d '[]' | tr ',' ' '); do
     BANK=$(cast call $POOL_REGISTRY "bankFor(uint64)(address)" $POOL_ID --rpc-url $RPC)
     cast send $BANK "setRiskInPaused(bool)" true --rpc-url $RPC --private-key $GOV_PK
   done
   ```

   Freeze all further operational change until governance is secured, and
   escalate as a security incident. If governance is a multisig, the quorum is
   the containment boundary; if it is still a single EOA, assume every
   `onlyGov` power is exposed, including `claimProtocolFees`.

5. **Sender is the expected governance signer.** Confirm the intended scope
   (which pools) and the stated reason, and make sure a rollback plan exists
   with explicit unpause conditions.

---

### Playbook B — Unexpected parameter change (E2 + read-based)

**Trigger**

- `RefundTimeoutSet` changed unexpectedly
- House edge / referral parameters changed unexpectedly (detected by periodic reads)

**Goal**

- Prevent users from entering a regime that violates the intended risk policy

**Steps**

1. Identify the transaction and signer.
2. Compare the new values against the release snapshot (digest-locked) and change policy.
3. If suspicious:
   - Pause affected assets (or all)
   - Capture before/after values and tx hashes
   - Prepare a corrective governance action in a new, verified release
4. If legitimate:
   - Record the approval reference and update your operational registry
   - Confirm the change did not invalidate your public commitments (SLA, refund policy)

**Common pitfalls**

- Setting refund timeout too low can increase refund churn and user confusion.
- Setting house edge too high may violate front-end max constraints and cause reverts.

---

### Playbook C — Module registry change (E3)

**Trigger**

- `GameRegistered(gameId, module)` emitted

**Goal**

- Ensure the new module is the intended one and does not break finalize/refund liveness

**Steps**

1. Identify signer and approvals.
2. Validate the module address against your source-of-truth (release artifact / deployment plan).
3. Run a fork validation:
   - Place a minimal bet for the affected gameId
   - Ensure it reaches `RandomReady` and `Finalized` on the fork
4. Only after fork validation should the change be considered safe.

**Guardrail**
Do not register unreviewed modules on production. Treat registry updates as releases.

---

### Playbook D — Governance transfer events (E4)

**Trigger**

- `GovernanceTransferStarted` or `GovernanceTransferred` emitted

**Goal**

- Treat as critical until proven legitimate

**Steps**

1. Page immediately.
2. If unexpected:
   - Pause all assets
   - Validate governance address on every core contract (GameHub, SportsHub, VRFHub, Banks, Adapter)
3. If expected:
   - Verify the final governance address matches the pre-approved target
   - Execute a post-transfer checklist:
     - confirm governance can still pause/unpause
     - confirm release digest signing keys are updated

---

## Evidence collection template

Capture:

- chainId, release tag, `deployments/release-*.json` digest
- the exact emitting tx hashes
- signer addresses and attribution
- before/after values for:
  - riskInPaused, refundTimeoutSeconds
  - defaultHouseEdgeBps, maxAffiliateDeltaBps
  - activeReferralConfigId
  - any changed gameId → module mapping
- any mitigations executed (pause toggles, corrective actions)

---

## Appendix: commonly used calls

```bash
# GameHub governance-related reads
cast call $GAME_HUB "refundTimeoutSeconds()(uint256)" --rpc-url $RPC
cast call $GAME_HUB "defaultHouseEdgeBps()(uint16)" --rpc-url $RPC
cast call $GAME_HUB "maxAffiliateDeltaBps()(uint16)" --rpc-url $RPC
cast call $GAME_HUB "activeReferralConfigId()(uint32)" --rpc-url $RPC

# Pause one pool. The switch lives on that pool's Bank, not on the GameHub,
# and there is no pause-everything call -- repeat per Bank.
cast send $BANK "setRiskInPaused(bool)" true --rpc-url $RPC --private-key $GOV_PK

# Unpause (governance only, even where a guardian is configured)
cast send $BANK "setRiskInPaused(bool)" false --rpc-url $RPC --private-key $GOV_PK

# refund timeout (gov)
cast send $GAME_HUB "setRefundTimeout(uint256)" 900 --rpc-url $RPC --private-key $GOV_PK

# verify module for a gameId
cast call $GAME_HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
```
