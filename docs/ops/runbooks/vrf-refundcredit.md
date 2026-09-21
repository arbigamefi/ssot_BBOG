# Runbook: VRF + refundCredit

This runbook covers incidents involving **VRF request/fulfillment liveness** and **refundCredit accounting** in SSOT
(Chainlink VRF v2.5 Wrapper via adapter).

It maps directly to the metrics defined in `docs/ops/metrics.md` (sections **B** and **C**).

---

## Scope

**In-scope symptoms**

- Elevated VRF latency or a growing backlog of pending requests (`B3`, `B6`)
- `HubCallbackFailed` events from `VRFHub` (`B5`)
- VRF fee refund failures (`C4`) and growing refundCredit outstanding (`C6`)
- Players reporting “bet stuck PendingVRF” or “refund claim failing”

**Out-of-scope**

- Bank solvency / reserve anomalies (see runbook: [Bank solvency](bank-solvency.md))
- Module/game logic disputes (see runbook: [Game finalization / diff anomalies](game-finalization-diffs.md))

---

## Prerequisites

### Addresses

Use the chain-specific release consumed by the frontend,
`frontend/packages/ssot/src/release/embedded/chain-<chainId>.json`, and verify
the selected chain and deployed addresses:

- `GAME_HUB` — `contracts.gameHub`
- `VRFHUB` — `contracts.vrfHub`
- `ADAPTER` — `contracts.adapter`
- `POOL_REGISTRY` — `contracts.poolRegistry`
- `POOL_ID` and `BANK` — the affected pool ID and `pools[i].bank`
- Confirm the Chainlink wrapper with `Adapter.wrapper()`.

### Tools

- `cast` (Foundry) for reads and event queries
- An indexer / logs pipeline for metric aggregation (recommended)

### Governance actions available (onlyGov)

- Pause each affected Bank with `Bank.setRiskInPaused(true)`, resolving
  `PoolRegistry.bankFor(poolId)` first. There is no global pause call.
- Adjust refund timeout: `GameHub.setRefundTimeout(seconds)`
- Adjust wrapper fee estimation gas price: `Adapter.setRequestGasPriceWei(weiPerGas)`

Use the [EOA/Safe execution procedure](pause-config-drift.md#execute-a-governance-action-eoa-or-safe)
for governance changes on each target. A verified guardian can pause a Bank
whose deployed version supports that role; it cannot change GameHub/adapter
parameters or unpause. Pause blocks new holds, deposit/mint, LP withdraw/redeem,
protocol-fee claims and accrued XP claims. Held-bet settlement/refund remains
available subject to hub state and timeout/result conditions.

**Guardrail: do NOT “swap adapter addresses” in-place.**  
`VRFHub.coordinator` is **immutable** and must match the adapter that calls `VRFHub.fulfillRandomWords`. If you need a new adapter address, you must redeploy `VRFHub` (and then `GameHub`) for that release.

---

## Quick triage checklist (5 minutes)

### 1) Is the system failing to accept new bets?

Symptom: users report `placeBet` revert.

Actions:

- Check recent transaction failures for `InsufficientVRFFee(paid, required)` or `InvalidConfig()`.
- If failures are widespread, **pause risk-in immediately**:
  - Inventory `PoolRegistry.listPoolIds()` and `isPoolActive(poolId)`, resolve
    each affected `bankFor(poolId)`, then pause and verify each Bank through
    the linked governance/guardian procedure.

Likely causes:

- Wrong wrapper address configured (deployment/config drift)
- Adapter/GameHub addresses mismatch (misconfiguration)
- Downstream VRF provider issue (rare for quote path)

### 2) Is VRF fulfillment slow/stalled?

Symptom: `vrf_pending_requests` rising (`B6`), p95/p99 latency exceeds SLA (`B3`).

Actions:

- Identify a few sample `requestId`s from the last 15–60 minutes.
- For each, check request status:
  ```bash
  cast call $VRFHUB "getRequest(uint256)((address,uint256,address,uint256,uint256,bool))" $REQUEST_ID --rpc-url $RPC
  ```
- Look for `Requested` without `Fulfilled` / `Ignored` / `Detached` over the window.

### 3) Are callbacks failing?

Symptom: `HubCallbackFailed` increments (`B5`).

Actions:

- Pull the last few `HubCallbackFailed` events; capture `requestId` and `revertData`.
- Decode common revert formats:
  - `0x08c379a0…` → `Error(string)`
  - `0x4e487b71…` → `Panic(uint256)`
  - otherwise likely a custom error selector

---

## Incident playbooks

### Playbook A — VRF backlog / provider delay (B3/B6)

**Trigger**

- `vrf_pending_requests` keeps increasing for > N blocks/minutes (your SLA)
- p99 latency exceeds SLA for sustained interval

**Goal**

- Protect new users from stuck PendingVRF
- Enable safe refunds for affected bets
- Preserve auditability (snapshot + timeline)

**Steps**

1. **Pause new risk-in**
   - Pause each affected pool Bank via the linked procedure; verify
     `riskInPaused()` on every target. There is no single all-pools transaction
     unless separately assembled and approved as a Safe batch.
2. **Confirm configuration sanity**
   ```bash
   cast call $GAME_HUB    "vrfHub()(address)" --rpc-url $RPC
   cast call $VRFHUB "coordinator()(address)" --rpc-url $RPC
   cast call $VRFHUB "adapter()(address)" --rpc-url $RPC
   cast call $ADAPTER "vrfHub()(address)" --rpc-url $RPC
   cast call $ADAPTER "wrapper()(address)" --rpc-url $RPC
   ```
   Expectations:
   - `GameHub.vrfHub == VRFHub`
   - `VRFHub.coordinator == <adapter address>`
   - `Adapter.vrfHub == VRFHub`
   - `Adapter.wrapper == expected wrapper` (see `docs/deploy/networks.ts`)
3. **Estimate user impact**
   - Count bets in `PendingVRF` (from your BetState table; or `BetPlaced` minus `BetRandomReady/Finalized/Refunded`).
4. **Adjust refund timeout (optional)**
   - If provider outage is ongoing, consider reducing `refundTimeoutSeconds` so users can exit earlier.
   - Keep a minimum floor aligned with your risk policy (avoid knee-jerk to extremely low values).
5. **Communicate**
   - Publish a status message: “VRF delay; new bets paused; refunds available after <timeout>”.
6. **Recovery**
   - Once VRF catches up and backlog drains, governance unpauses each affected
     Bank through the linked EOA/Safe procedure and verifies the resulting state.
   - Postmortem: record start/end blocks, peak pending, and any parameter changes.

**Notes**

- Refunds are permissionless via `GameHub.refund(betId)` only while the bet
  remains `PendingVRF` and its timeout has passed. `RandomReady` must use
  finalization; lowering the timeout does not make it eligible for `refund`.
- `GameHub.refund` will attempt `VRFHub.detach(requestId)` best-effort to stop late fulfill processing.

---

### Playbook B — HubCallbackFailed (B5)

**Trigger**

- `HubCallbackFailed` > 0 or trending upward

**Goal**

- Stop creating bets that cannot progress
- Identify whether it is configuration drift vs. genuine bug

**Steps**

1. **Pause new risk-in immediately**
2. **Classify the revert**
   - If revert is `NotVRFHub()`: configuration drift between `GameHub.vrfHub` and the deployed `VRFHub`.
   - If revert indicates out-of-gas: callback gas limit insufficient (should be rare; `GameHub.quoteVRFFee` scales with betCount).
   - Otherwise treat as a bug until proven otherwise.
3. **Confirm configuration sanity** (same as Playbook A step 2)
4. **Containment**
   - Keep paused until root cause is fixed and verified on a fork.
5. **User remediation**
   - Affected bets will remain `PendingVRF` until they are refunded after timeout.
   - Consider lowering refund timeout if impact is broad.
6. **Fix and validate**
   - Reproduce on a fork using the failing `requestId` and decoded revert.
   - Ship a new release only after:
     - unit/diff/invariants pass
     - **fork release gate** passes on the target chain(s)

---

### Playbook C — refundCredit growing / refund claims failing (C4/C6)

**Trigger**

- `vrf_fee_refund_failed_total` > 0 (warn)
- `refund_credit_outstanding_estimate` growing faster than expected (warn/critical per threshold)
- Users report `claimRefund()` revert

**Key fact**
Refund failures are most commonly caused by **payers that are smart contracts rejecting ETH**. In SSOT this is expected and safely routed to `refundCredit`.

**Steps**

1. **Confirm the pattern**
   - Sample a few `VRFFeeCharged` events where `refundSucceeded == false`.
   - Identify whether payers are EOAs or contracts (most explorers show “Contract”).
2. **Validate solvency of credits**
   - Compare:
     - `cast balance $VRFHUB`
     - your `refund_credit_outstanding_estimate`
   - VRFHub should have enough ETH to cover outstanding credits (design has no admin drains).
   - If the balance is unexpectedly low → treat as **critical incident** (pause + investigate).
3. **If users cannot claim**
   - `claimRefund()` can only succeed if the caller can receive ETH.
   - For contracts without a payable receive/fallback, the credit is effectively non-claimable.
   - Support response: advise using an EOA as the payer/receiver for bets.
4. **Operational guidance**
   - High refundCredit outstanding is not a protocol failure, but it ties up ETH in `VRFHub`.
   - Set alert thresholds based on your treasury/risk appetite.
5. **Optional mitigation: reduce refund frequency**
   - If refund failures cause noisy alerts, you can:
     - keep monitoring but lower alert severity
     - or adjust operational policy to treat contract payers as “expected refundCredit”
   - Do **not** change contract behavior just to “force refunds through”; it breaks SSOT guarantees.

---

## Evidence collection template (for postmortems)

Capture the following:

- chainId, release tag, `deployments/release-*.json` digest
- start/end block numbers
- peak `vrf_pending_requests`, p99 latency
- sample `requestId`s and corresponding `getRequest` output
- any `HubCallbackFailed` revertData samples (raw hex + decoded form if possible)
- counts of `refundSucceeded=false` and estimated outstanding credit
- any governance actions taken:
  - pause toggles (assets + timestamps)
  - refundTimeout changes
  - `setRequestGasPriceWei` changes

---

## Appendix: commonly used calls

For governance calldata, set `ACTION_TARGET` to the Bank, GameHub or adapter
as indicated and use the linked EOA/Safe procedure. Read back the changed
state; encoding calldata alone performs no on-chain action.

```bash
# GameHub + VRFHub addresses
cast call $GAME_HUB "vrfHub()(address)" --rpc-url $RPC

# Request status
cast call $VRFHUB "getRequest(uint256)((address,uint256,address,uint256,uint256,bool))" $REQUEST_ID --rpc-url $RPC

# refundCredit for a payer
cast call $VRFHUB "refundCreditOf(address)(uint256)" $PAYER --rpc-url $RPC

# claim refund (as payer)
cast send $VRFHUB "claimRefund()(uint256)" --rpc-url $RPC --private-key $PAYER_PK

# Resolve the affected pool Bank, then encode its pause action
cast call $POOL_REGISTRY "bankFor(uint64)(address)" $POOL_ID --rpc-url $RPC
cast calldata "setRiskInPaused(bool)" true

# adjust refund timeout (gov)
cast calldata "setRefundTimeout(uint256)" 900

# adjust wrapper estimate gas price (gov)
cast calldata "setRequestGasPriceWei(uint256)" 1000000000
```
