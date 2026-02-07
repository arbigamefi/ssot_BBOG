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
Use `deployments/release/release-*.json` (preferred) or `deployments/latest.json`:
- `hub`
- per-asset `bank` addresses
- `adapter` / `vrfHub` (for VRF-related config checks)

### Tools
- `cast` for reads and event queries
- Explorer / block analytics for signer attribution

### Governance actions available (onlyGov)
- Pause per asset or all: `Hub.setRiskInPaused(asset, true)` / `setRiskInPausedAll(true)`
- Update refund timeout: `Hub.setRefundTimeout(seconds)`
- Update module registry: `Hub.registerGame(gameId, module)`
- Update bank minLiquidity: `Bank.setMinLiquidityBps(bps)`
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
cast call $HUB "refundTimeoutSeconds()(uint256)" --rpc-url $RPC
cast call $HUB "defaultHouseEdgeBps()(uint16)" --rpc-url $RPC
cast call $HUB "maxAffiliateDeltaBps()(uint16)" --rpc-url $RPC
cast call $HUB "activeReferralConfigId()(uint32)" --rpc-url $RPC
```
For each affected asset:
```bash
cast call $HUB "riskInPaused(address)(bool)" $ASSET --rpc-url $RPC
cast call $HUB "bankFor(address)(address)" $ASSET --rpc-url $RPC
```

### 3) Validate module registry sanity
Pick the canonical gameIds you expect to be registered and verify they map to known modules:
```bash
cast call $HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
```

---

## Incident playbooks

### Playbook A — Unexpected pause toggle (E1)

**Trigger**
- `RiskInPausedSet` emitted without an approved incident/maintenance window

**Goal**
- Determine whether this is legitimate ops action or an unauthorized change

**Steps**
1) Identify the emitting transaction and signer.
2) If signer is unknown or governance appears compromised:
   - **Pause all assets immediately**: `Hub.setRiskInPausedAll(true)`
   - Freeze any further operational changes until governance is secured
   - Escalate as security incident (communications + incident commander)
3) If signer is expected:
   - Confirm the intended scope (which assets) and the stated reason
   - Ensure a post-incident rollback plan exists (unpause conditions)

---

### Playbook B — Unexpected parameter change (E2 + read-based)

**Trigger**
- `RefundTimeoutSet` changed unexpectedly
- House edge / referral parameters changed unexpectedly (detected by periodic reads)

**Goal**
- Prevent users from entering a regime that violates the intended risk policy

**Steps**
1) Identify the transaction and signer.
2) Compare the new values against the release snapshot (digest-locked) and change policy.
3) If suspicious:
   - Pause affected assets (or all)
   - Capture before/after values and tx hashes
   - Prepare a corrective governance action in a new, verified release
4) If legitimate:
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
1) Identify signer and approvals.
2) Validate the module address against your source-of-truth (release artifact / deployment plan).
3) Run a fork validation:
   - Place a minimal bet for the affected gameId
   - Ensure it reaches `RandomReady` and `Finalized` on the fork
4) Only after fork validation should the change be considered safe.

**Guardrail**
Do not register unreviewed modules on production. Treat registry updates as releases.

---

### Playbook D — Governance transfer events (E4)

**Trigger**
- `GovernanceTransferStarted` or `GovernanceTransferred` emitted

**Goal**
- Treat as critical until proven legitimate

**Steps**
1) Page immediately.
2) If unexpected:
   - Pause all assets
   - Validate governance address on every core contract (Hub, VRFHub, Banks, Adapter)
3) If expected:
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
# Hub governance-related reads
cast call $HUB "refundTimeoutSeconds()(uint256)" --rpc-url $RPC
cast call $HUB "defaultHouseEdgeBps()(uint16)" --rpc-url $RPC
cast call $HUB "maxAffiliateDeltaBps()(uint16)" --rpc-url $RPC
cast call $HUB "activeReferralConfigId()(uint32)" --rpc-url $RPC

# Pause per asset (gov)
cast send $HUB "setRiskInPaused(address,bool)" $ASSET true --rpc-url $RPC --private-key $GOV_PK

# Pause all assets (gov)
cast send $HUB "setRiskInPausedAll(bool)" true --rpc-url $RPC --private-key $GOV_PK

# refund timeout (gov)
cast send $HUB "setRefundTimeout(uint256)" 900 --rpc-url $RPC --private-key $GOV_PK

# verify module for a gameId
cast call $HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
```
