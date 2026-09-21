# Runbook: Game finalization stalls / diff anomalies

This runbook covers incidents where bets reach **RandomReady** but do not reliably reach **Finalized**, or operators
observe suspicious discrepancies between expected outcomes and observed settlement patterns.

It maps to the metrics in `docs/ops/metrics.md` sections **A** and **D**.

---

## Scope

**In-scope symptoms**

- `bets_in_flight` rising (`A5`) while `bets_random_ready_total` grows but `bets_finalized_total` stalls
- Users report `GameHub.finalize(betId)` reverting
- Large spikes in `bets_refunded_total` (`A4`), distinguishing PendingVRF
  timeout refunds from refunds performed inside finalization
- Reconciliation anomalies between GameHub and Bank settlement events (indexer mismatch or unexpected state)

**Out-of-scope**

- VRF backlog and callback failures (`B4`) — see runbook: [VRF + refundCredit](vrf-refundcredit.md)
- Bank solvency boundary conditions — see runbook: [Bank solvency](bank-solvency.md)

---

## Prerequisites

### Addresses

Use `frontend/packages/ssot/src/release/embedded/chain-<chainId>.json` and
verify its chain and deployed addresses:

- `GAME_HUB` — `contracts.gameHub`
- `POOL_REGISTRY` — `contracts.poolRegistry`
- `SETTLEMENT_ROUTER` — read `GameHub.settlementRouter()`
- `POOL_ID` — the position’s `poolId` from `SettlementRouter.getPosition(betId)`
  or the matching `BetPlaced` event; `getBet` itself has no `poolId` field.
  Resolve its Bank with `PoolRegistry.bankFor(poolId)`; multiple pools may
  share an asset.
- the module address for the affected `gameId` (via `GameHub.gameModule(gameId)`)

### Tools

- `cast` for reads and event queries
- A fork-capable RPC for reproduction (recommended)

### Governance actions available

- Pause each affected pool Bank with `Bank.setRiskInPaused(true)` after
  resolving it through `PoolRegistry.bankFor(poolId)`. There is no global pause call.
- Update module registry (if the root cause is misregistration): `GameHub.registerGame(gameId, module)`
- Adjust refund timeout with `GameHub.setRefundTimeout(seconds)` only for
  eligible `PendingVRF` bets; it cannot resolve a `RandomReady` stall.

Use the [EOA/Safe governance procedure](pause-config-drift.md#execute-a-governance-action-eoa-or-safe)
for every governance action. A configured guardian can only pause its Bank.
Pause blocks new holds, deposit/mint, LP withdraw/redeem, protocol-fee claims
and accrued XP claims; held-bet Debt-Out remains available subject to hub
state and timeout/result conditions.

**Guardrail**
Treat module registry updates as releases. They must pass unit/diff/invariants and (for the target chain) fork release gate.

---

## Quick triage checklist (5 minutes)

### 1) Is the stall at RandomReady → Finalize?

Pick a recent `betId` that has `BetRandomReady` but no `BetFinalized`/`BetRefunded`.

Read the raw return data, then decode it using the verified deployed release
ABI (for example with the explorer contract reader). Match the ABI to the
deployed version before interpreting the fields:

```bash
cast call $GAME_HUB "getBet(uint256)" $BET_ID --rpc-url $RPC
```

Validate:

- `state == RandomReady`
- `randomHash != 0x0`
- `resolvedAt == 0` (or not set yet)

### 2) Does `finalize(betId)` revert (via eth_call)?

Capture revert data:

```bash
cast call $GAME_HUB "finalize(uint256)" $BET_ID --rpc-url $RPC
```

- If it reverts, capture the raw revert data and classify it.
- If it succeeds as `eth_call` but user transactions fail, check gas limits / mempool policies.

### 3) Verify module registry for the bet’s `gameId`

```bash
cast call $GAME_HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
```

If module is zero or unexpected, proceed to **Playbook B**.

---

## Incident playbooks

### Playbook A — finalize() reverting broadly

**Trigger**

- Multiple finalize attempts revert for distinct betIds

**Goal**

- Stop creating new bets that will likely stall
- Determine whether this is configuration drift vs. a module bug

**Steps**

1. **Pause each affected pool Bank** via the linked governance/guardian procedure.
   Inventory `listPoolIds()` and `isPoolActive(poolId)` if the scope is unclear,
   then verify `riskInPaused()` on every selected Bank.
2. **Classify the revert**
   - `BadState(...)`: users calling finalize too early, or state machine regression.
   - Module-specific custom error: likely module logic issue.
   - `UnknownGame(gameId)` or `gameModule == 0x0`: registry misconfiguration.
3. **Validate configuration sanity**
   - Bank mapping:
     ```bash
     cast call $POOL_REGISTRY "bankFor(uint64)(address)" $POOL_ID --rpc-url $RPC
     cast call $POOL_REGISTRY "assetFor(uint64)(address)" $POOL_ID --rpc-url $RPC
     ```
   - Module mapping:
     ```bash
     cast call $GAME_HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
     ```
4. **User remediation**
   - `GameHub.refund(betId)` accepts only `PendingVRF` after its timeout.
     A `RandomReady` bet cannot use that path, regardless of timeout changes.
   - Current `GameHub.finalize` handles specified invalid module outcomes by
     refunding internally; reproduce the actual failing state and deployed
     version before promising an exit path. Escalate unresolved finalization
     failures with the captured revert evidence.
5. **Reproduce on a fork (institutional workflow)**
   - Collect:
     - `GameHub.getBet(betId)`
     - `GameHub.getBetParams(betId)`
     - `betRandomHash` / `randomWords` source (from stored data)
   - Run your local diff harness against the fork state.
6. **Recovery**
   - Only unpause after root cause is fixed and validated (unit/diff/invariants + fork gate).

---

### Playbook B — module registry misconfiguration

**Trigger**

- `gameModule(gameId)` is zero or unexpected

**Goal**

- Restore correct module mapping without introducing a hidden behavior change

**Steps**

1. Pause each affected pool Bank via the linked governance/guardian procedure.
2. Identify the intended module address from the release snapshot / deployment plan.
3. Validate on a fork:
   - place a minimal bet for the gameId
   - ensure it reaches `RandomReady` and `Finalized` in the fork simulation
4. Apply governance change:
   - Execute `GameHub.registerGame(gameId, module)` on the verified GameHub
     through the linked EOA/Safe procedure; read back the mapping afterwards.
5. Verify:
   - new bets progress to Finalized
   - no spike in refunds or callback failures

---

### Playbook C — reconciliation anomalies (GameHub vs Bank)

**Trigger**

- Your indexer shows inconsistent event join between `GameHub` and the expected `Bank`

**Goal**

- Disambiguate indexer bugs from protocol inconsistency

**Steps**

1. Confirm you are indexing the correct Bank for the bet’s router position.
2. For a sample betId:
   - fetch the bet from GameHub and decode it with the verified deployment ABI
   - fetch `SettlementRouter.getPosition(betId)`; casino `betId` is the router
     `positionId`, and the position carries `poolId`, `bank`, `asset` and `ownerHub`
   - verify `ownerHub` is the expected GameHub, then read
     `PoolRegistry.bankFor(position.poolId)` and `assetFor(position.poolId)`
   - compare them with the position and bet’s recorded Bank/asset and emitting Bank
3. If you suspect protocol inconsistency:
   - pause risk-in
   - reproduce on a fork and escalate as critical

---

## Evidence collection template

Capture:

- chainId, release tag, `deployments/release-*.json` digest
- affected `gameId`, `asset`, `bank`, `module`
- sample betIds + tx hashes of failed finalize attempts
- revert data samples (raw + decoded)
- counts: `A1/A2/A3/A4/A5` over the incident window
- any emergency governance actions (pause toggles, refund timeout changes, module registry updates)

---

## Appendix: commonly used calls

The governance calldata examples only encode actions. Set `ACTION_TARGET`
to the verified Bank or GameHub and use the linked EOA/Safe procedure, then
read back state.

```bash
# Bet returns raw bytes here; decode against the verified deployment ABI
cast call $GAME_HUB "getBet(uint256)" $BET_ID --rpc-url $RPC
cast call $GAME_HUB "getBetParams(uint256)(bytes)" $BET_ID --rpc-url $RPC

# Router position provides poolId (getBet does not)
cast call $GAME_HUB "settlementRouter()(address)" --rpc-url $RPC
cast call $SETTLEMENT_ROUTER "getPosition(uint256)((uint256,address,uint64,address,address,address,uint256,uint256,bytes32,uint8))" $BET_ID --rpc-url $RPC

# module registry
cast call $GAME_HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC

# finalize simulation (capture revert)
cast call $GAME_HUB "finalize(uint256)" $BET_ID --rpc-url $RPC

# Pause this pool Bank (governance, or a configured guardian)
cast call $POOL_REGISTRY "bankFor(uint64)(address)" $POOL_ID --rpc-url $RPC
cast calldata "setRiskInPaused(bool)" true

# refund timeout (gov)
cast calldata "setRefundTimeout(uint256)" 900
```
