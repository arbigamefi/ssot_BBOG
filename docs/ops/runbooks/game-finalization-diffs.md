# Runbook: Game finalization stalls / diff anomalies

This runbook covers incidents where bets reach **RandomReady** but do not reliably reach **Finalized**, or operators
observe suspicious discrepancies between expected outcomes and observed settlement patterns.

It maps to the metrics in `docs/ops/metrics.md` sections **A** and **D**.

---

## Scope

**In-scope symptoms**
- `bets_in_flight` rising (`A5`) while `bets_random_ready_total` grows but `bets_finalized_total` stalls
- Users report `Hub.finalize(betId)` reverting
- Large spikes in `bets_refunded_total` (`A4`) due to finalize stalls (users wait out refund timeout)
- Reconciliation anomalies between Hub and Bank settlement events (indexer mismatch or unexpected state)

**Out-of-scope**
- VRF backlog and callback failures (`B4`) — see runbook: [VRF + refundCredit](vrf-refundcredit.md)
- Bank solvency boundary conditions — see runbook: [Bank solvency](bank-solvency.md)

---

## Prerequisites

### Addresses
From `deployments/release/` or `deployments/latest.json`:
- `hub`
- `bankRegistry`
- the module address for the affected `gameId` (via `Hub.gameModule(gameId)`)

### Tools
- `cast` for reads and event queries
- A fork-capable RPC for reproduction (recommended)

### Governance actions available
- Pause new risk-in for affected asset(s): `Hub.setRiskInPaused(asset, true)` / `setRiskInPausedAll(true)`
- Update module registry (if the root cause is misregistration): `Hub.registerGame(gameId, module)`
- (Optional UX mitigation) Adjust refund timeout: `Hub.setRefundTimeout(seconds)`

**Guardrail**
Treat module registry updates as releases. They must pass unit/diff/invariants and (for the target chain) fork release gate.

---

## Quick triage checklist (5 minutes)

### 1) Is the stall at RandomReady → Finalize?
Pick a recent `betId` that has `BetRandomReady` but no `BetFinalized`/`BetRefunded`.

If you have build artifacts (recommended), use:
```bash
cast call $HUB "getBet(uint256)" $BET_ID --rpc-url $RPC --abi out/IHub.sol/IHub.json
```

Validate:
- `state == RandomReady`
- `randomHash != 0x0`
- `resolvedAt == 0` (or not set yet)

### 2) Does `finalize(betId)` revert (via eth_call)?
Capture revert data:
```bash
cast call $HUB "finalize(uint256)" $BET_ID --rpc-url $RPC
```
- If it reverts, capture the raw revert data and classify it.
- If it succeeds as `eth_call` but user transactions fail, check gas limits / mempool policies.

### 3) Verify module registry for the bet’s `gameId`
```bash
cast call $HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
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
1) **Pause new risk-in** for affected asset(s).
2) **Classify the revert**
   - `BadState(...)`: users calling finalize too early, or state machine regression.
   - Module-specific custom error: likely module logic issue.
   - `UnknownGame(gameId)` or `gameModule == 0x0`: registry misconfiguration.
3) **Validate configuration sanity**
   - Bank mapping:
     ```bash
     cast call $HUB "bankFor(address)(address)" $ASSET --rpc-url $RPC
     ```
   - Module mapping:
     ```bash
     cast call $HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC
     ```
4) **User remediation**
   - If finalize is stuck but refund timeout is acceptable, users can exit via `Hub.refund(betId)` after timeout.
   - If impact is broad, consider lowering refund timeout as an emergency UX mitigation (record and postmortem).
5) **Reproduce on a fork (institutional workflow)**
   - Collect:
     - `Hub.getBet(betId)`
     - `Hub.getBetParams(betId)`
     - `betRandomHash` / `randomWords` source (from stored data)
   - Run your local diff harness against the fork state.
6) **Recovery**
   - Only unpause after root cause is fixed and validated (unit/diff/invariants + fork gate).

---

### Playbook B — module registry misconfiguration

**Trigger**
- `gameModule(gameId)` is zero or unexpected

**Goal**
- Restore correct module mapping without introducing a hidden behavior change

**Steps**
1) Pause new risk-in for the affected asset(s).
2) Identify the intended module address from the release snapshot / deployment plan.
3) Validate on a fork:
   - place a minimal bet for the gameId
   - ensure it reaches `RandomReady` and `Finalized` in the fork simulation
4) Apply governance change:
   - `Hub.registerGame(gameId, module)`
5) Verify:
   - new bets progress to Finalized
   - no spike in refunds or callback failures

---

### Playbook C — reconciliation anomalies (Hub vs Bank)

**Trigger**
- Your indexer shows inconsistent event join between `Hub` and the expected `Bank`

**Goal**
- Disambiguate indexer bugs from protocol inconsistency

**Steps**
1) Confirm you are indexing the correct bank address for the bet’s `asset`.
2) For a sample betId:
   - fetch the bet from Hub (artifact-backed `cast call`)
   - compute `bank = bankFor(asset)`
3) If you suspect protocol inconsistency:
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

```bash
# bet and params (requires artifacts after `forge build`)
cast call $HUB "getBet(uint256)" $BET_ID --rpc-url $RPC --abi out/IHub.sol/IHub.json
cast call $HUB "getBetParams(uint256)" $BET_ID --rpc-url $RPC --abi out/IHub.sol/IHub.json

# module registry
cast call $HUB "gameModule(bytes32)(address)" $GAME_ID --rpc-url $RPC

# finalize simulation (capture revert)
cast call $HUB "finalize(uint256)" $BET_ID --rpc-url $RPC

# pause risk-in (gov)
cast send $HUB "setRiskInPaused(address,bool)" $ASSET true --rpc-url $RPC --private-key $GOV_PK

# refund timeout (gov)
cast send $HUB "setRefundTimeout(uint256)" 900 --rpc-url $RPC --private-key $GOV_PK
```
