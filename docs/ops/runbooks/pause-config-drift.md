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
  verify the selected release and chain before including it in incident actions

### Tools

- `cast` for reads and event queries
- Explorer / block analytics for signer attribution

### Who can pause

Pausing is per pool and the switch is on that pool's **Bank**, not on the
GameHub. There is no global pause call: to freeze several pools, execute one
pause call per Bank, separately or in an approved Safe batch.

| Action                                | historical v1.4 Bank | planned v1.5 Bank          |
| ------------------------------------- | -------------------- | -------------------------- |
| Pause `Bank.setRiskInPaused(true)`    | governance only      | governance **or** guardian |
| Unpause `Bank.setRiskInPaused(false)` | governance only      | governance only            |

The current Bank source adds the planned v1.5 `guardian` role. Confirm the
deployed bytecode and ABI before using it; source presence does not prove a
v1.5 deployment or a completed Safe migration. A guardian can pause the Bank
without waiting for a multisig quorum; unpausing stays behind governance. Read the configured guardian with
`cast call $BANK "guardian()(address)"`; zero means the role is disabled. On
v1.4 that call reverts, because the role does not exist yet.

Pausing blocks new bet holds, `deposit`/`mint`, LP `withdraw`/`redeem`,
`claimProtocolFees`, and `claimXPAccrued`. It does not block held-bet Debt-Out:
Bank `settleBet`/`refundBet` have no pause check and remain callable by the
SettlementRouter. Public hub finalization/refund entry points still enforce
all state, timeout and result requirements; pausing does not bypass them.
In particular, `GameHub.refund` accepts only `PendingVRF` after its timeout,
not `RandomReady`. See `src/core/Bank.sol` and `src/core/GameHub.sol`.

### Execute a governance action: EOA or Safe

Read `governance()` on **each target contract** and compare it with the
approved incident record. A GameHub, Bank and adapter need not have the same
governance. Set the exact target and encode the action without signing:

```bash
ACTION_TARGET="$BANK"
ACTION_DATA=$(cast calldata "setRiskInPaused(bool)" true)
cast chain-id --rpc-url "$RPC"
cast call "$ACTION_TARGET" "governance()(address)" --rpc-url "$RPC"
```

- **EOA governance:** use the authorized EOA's keystore or hardware-wallet
  signer. For an imported Foundry keystore, first verify
  `cast wallet address --account "$GOV_ACCOUNT"` equals the target's current
  governance, then send the reviewed pause action below. For another action,
  substitute its reviewed target, function signature and arguments:

  ```bash
  cast send "$ACTION_TARGET" "setRiskInPaused(bool)" true --rpc-url "$RPC" --account "$GOV_ACCOUNT"
  ```

- **Safe governance:** there is no private key for the Safe address. Create a
  transaction in that Safe's Transaction Builder with the verified chain,
  `to = ACTION_TARGET`, `value = 0`, and `data = ACTION_DATA` (a call to the
  target, not a delegatecall to it). Check the decoded function and arguments,
  Safe address, nonce, owners and threshold; obtain the required owner quorum
  and execute through the Safe. Sending directly from one Safe owner's EOA
  fails `onlyGov`. Record the Safe transaction hash and execution transaction
  hash. Require successful Safe execution, not only a successful outer receipt.

For several actions, record their order in the reviewed Safe transaction. In
particular, revoke a compromised guardian before unpausing. If executing them
separately, verify revocation is mined before submitting unpause. Read back
`guardian()` and `riskInPaused()` on each Bank, or the relevant parameter on
another target, after execution.

A configured guardian EOA can send **only the pause action** using its own
verified signer, e.g. `--account "$GUARDIAN_ACCOUNT"`; it cannot revoke itself,
change parameters or unpause. If governance is compromised, use a separate
trusted guardian where the deployed version supports one; do not assume a
compromised governance signer is a safe containment path.

### Attribute the actual Bank caller

`cast tx "$TX_HASH" from` identifies the transaction envelope sender. For a
Safe action that can be an owner or relayer; Bank sees the Safe as
`msg.sender`. Inspect the receipt and an execution trace (explorer or a node
that supports `debug_traceTransaction`) to locate the call to the emitting
Bank and verify its immediate caller, calldata, success and event. Correlate
Safe calls with the Safe transaction and quorum record. Resolve governance
and guardian at the incident time, including any changes within that
transaction; current values alone cannot establish historical authority.
If a trace is unavailable, record attribution as unresolved instead of
classifying the envelope sender as the Bank caller.

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
- Verify the immediate target caller and, for a Safe, its execution and quorum
  record using the attribution procedure above.
- If authority cannot be established or the change is outside an approved
  window, investigate it as a **security incident**; an unfamiliar relayer
  alone does not prove unauthorized governance.

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

1. Identify the emitting Bank, transaction and **immediate Bank caller** using
   the attribution procedure above. Check historical governance/guardian
   authority and the approved change record. Read current values for recovery:

   ```bash
   cast call "$BANK" "governance()(address)" --rpc-url "$RPC"
   # Only for a deployed Bank whose verified ABI includes guardian():
   cast call "$BANK" "guardian()(address)" --rpc-url "$RPC"
   cast call "$BANK" "riskInPaused()(bool)" --rpc-url "$RPC"
   ```

2. **Caller is the guardian, pausing intentionally.** Confirm the operator's
   reason and scope. Record that new bets, deposits, LP exits and fee/XP claims
   are blocked; eligible held-bet settlement/refund remains available.

3. **Caller is the guardian, but the pause was not intended.** Treat the
   guardian key as compromised. It can block those Bank operations repeatedly,
   but cannot unpause, move funds, or change parameters. Use the EOA or Safe
   governance procedure above with `ACTION_TARGET = BANK`, in this order:

   ```bash
   # First action: revoke the guardian.
   cast calldata "setGuardian(address)" 0x0000000000000000000000000000000000000000
   # Second action: unpause only after revocation and recovery approval.
   cast calldata "setRiskInPaused(bool)" false
   ```

   These commands encode data only. Execute through the verified governance
   authority and confirm `guardian() == address(0)` and `riskInPaused() == false`.
   Appoint any replacement guardian through a separately reviewed governance
   action. Do not describe LP withdrawals or claims as unaffected by the pause.

4. **Caller is unauthorized or governance itself looks compromised.** Inventory
   the registered pools and identify the affected active Banks:

   ```bash
   cast call "$POOL_REGISTRY" "listPoolIds()(uint64[])" --rpc-url "$RPC"
   # Repeat for every returned pool ID; record active state and the Bank.
   cast call "$POOL_REGISTRY" "isPoolActive(uint64)(bool)" "$POOL_ID" --rpc-url "$RPC"
   cast call "$POOL_REGISTRY" "bankFor(uint64)(address)" "$POOL_ID" --rpc-url "$RPC"
   cast call "$POOL_REGISTRY" "assetFor(uint64)(address)" "$POOL_ID" --rpc-url "$RPC"
   cast calldata "setRiskInPaused(bool)" true
   ```

   Execute that pause calldata once per selected Bank using a trusted
   authorized guardian or the verified governance procedure above. There is no
   global pause call. Read `riskInPaused()` on every target afterwards. If no
   trusted authorized signer remains, escalate that containment limit; do not
   claim the pools are frozen. A compromised governance quorum can also
   unpause, so pausing alone does not secure governance.

5. **Caller is the expected governance authority.** Confirm the intended pools,
   Safe quorum where applicable, reason and explicit recovery conditions.

---

### Playbook B — Unexpected parameter change (E2 + read-based)

**Trigger**

- `RefundTimeoutSet` changed unexpectedly
- House edge / referral parameters changed unexpectedly (detected by periodic reads)

**Goal**

- Prevent users from entering a regime that violates the intended risk policy

**Steps**

1. Identify the transaction and immediate target caller using the attribution procedure above.
2. Compare the new values against the release snapshot (digest-locked) and change policy.
3. If suspicious:
   - Pause each affected Bank using the verified EOA/Safe/guardian procedure above
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

1. Identify the immediate target caller and approvals, including Safe execution/quorum where applicable.
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
   - Inventory and pause the affected Banks through a remaining trusted authorized signer
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
- envelope sender, immediate target caller, and attribution evidence
- Safe address, nonce, transaction hash and quorum/execution record where applicable
- before/after values for:
  - riskInPaused, refundTimeoutSeconds
  - defaultHouseEdgeBps, maxAffiliateDeltaBps
  - activeReferralConfigId
  - any changed gameId → module mapping
- any mitigations executed (pause toggles, corrective actions)

---

## Appendix: commonly used calls

`cast calldata` only encodes an action. Select the Bank or GameHub target as
indicated and execute via the EOA/Safe procedure above, then read back state.

```bash
# GameHub governance-related reads
cast call $GAME_HUB "refundTimeoutSeconds()(uint256)" --rpc-url $RPC
cast call $GAME_HUB "defaultHouseEdgeBps()(uint16)" --rpc-url $RPC
cast call $GAME_HUB "maxAffiliateDeltaBps()(uint16)" --rpc-url $RPC
cast call $GAME_HUB "activeReferralConfigId()(uint32)" --rpc-url $RPC

# Pause one pool. The switch lives on that pool's Bank, not on the GameHub,
# and there is no pause-everything call -- repeat per Bank.
cast calldata "setRiskInPaused(bool)" true

# Unpause (governance only, even where a guardian is configured)
cast calldata "setRiskInPaused(bool)" false

# refund timeout (gov)
cast calldata "setRefundTimeout(uint256)" 900

# verify module for a gameId
cast call $GAME_HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
```
