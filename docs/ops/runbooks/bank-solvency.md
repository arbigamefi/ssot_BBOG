# Runbook: Bank solvency / reserve anomalies

This runbook covers incidents where a **Bank(asset)** may be approaching its solvency boundary, or operators observe
abnormal behavior in reserve accounting (NAV / reserved / risk reserve / withdrawal buffer).

It maps to the metrics in `docs/ops/metrics.md` section **D** (and partially **A**).

---

## Scope

**In-scope symptoms**
- `bank_total_assets` drops sharply (`D1`) without an expected exogenous reason
- `bet_reserved_total` approaches `bank_total_assets` (`D2`) (liquidity crunch)
- New bets start reverting with `SolvencyViolation()` (holdBet cannot reserve)
- Withdrawals / XP claims fail broadly due to OptionalOutflowDomain caps
- Spikes in refunds (`A4`) after long finalize delays

**Out-of-scope**
- VRF backlog / refundCredit incidents (see runbook: [VRF + refundCredit](vrf-refundcredit.md))
- Governance compromise / config drift (see runbook: [Pause + config drift](pause-config-drift.md))

---

## Prerequisites

### Addresses
Use `deployments/latest-v13.json` (or the release snapshot under `deployments/release/`) as the source of truth.
You will need:
- `gameHub` / `sportsHub`
- `poolRegistry`
- `bank` for the affected `poolId`

To find a bank address:
```bash
cast call $POOL_REGISTRY "bankFor(uint64)(address)" $POOL_ID --rpc-url $RPC
```

### Tools
- `cast` (Foundry) for reads and event queries
- An indexer / logs pipeline for derived metrics (`D2`, `A5`) is recommended

### Governance actions available
- Pause risk-in for affected pool(s): use the relevant vertical hub pool pause controls.
- Tighten new-risk intake by raising the risk reserve:
  - `Bank.setRiskReserveBps(bps)` (per bank)
  - `Bank.setMinLiquidityBps(bps)` remains a legacy alias for risk reserve.
- Tighten optional outflows (withdrawals/XP/protocol-fee claims) by raising the withdrawal buffer:
  - `Bank.setWithdrawalBufferBps(bps)` (per bank)

**Guardrail**
- Pausing a bank blocks: deposit/mint/withdraw/redeem and XP claims.
- Pausing does **not** block: `settleBet` / `refundBet` (Debt-Out remains live by design).

---

## Quick triage checklist (5 minutes)

### 1) Is this an accounting boundary (R + risk reserve / withdrawal buffer ≈ NAV) or a deeper anomaly?
Fetch the SSOT state from the bank:
```bash
cast call $BANK "getSSOT()((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,uint256,uint256,uint256))" --rpc-url $RPC
```
Interpretation (from the returned struct):
- `NAV` = `B - PF - XP`
- `R` = totalReserved
- `riskReserve` = `NAV * riskReserveBps`
- `riskFree` = `NAV - R - riskReserve` (floored)
- `withdrawalBuffer` = `NAV * withdrawalBufferBps`
- `withdrawable` = `NAV - R - withdrawalBuffer` (floored)

If `riskFree` is near 0 and `R` is rising quickly, you are likely in a **new-risk liquidity crunch** regime.
If `withdrawable` is near 0, LP exits and claim outflows are intentionally constrained by the withdrawal buffer.

### 2) Are new bets failing with `SolvencyViolation()`?
Check the last 5–20 minutes of failed `placeBet` transactions and extract the revert reason.
If reverts are frequent, proceed to **Playbook A**.

### 3) Is NAV dropping unexpectedly?
Compare:
- `Bank.totalAssets()`
- asset token balance `ERC20.balanceOf(bank)`
- recent large `BetSettled` payouts and withdrawals

If `totalAssets` drops without corresponding expected outflows, proceed to **Playbook B**.

---

## Incident playbooks

### Playbook A — Liquidity crunch (D2) / SolvencyViolation on new bets

**Trigger**
- `D2 (reserved)` approaches `D1 (totalAssets)`
- or new bets revert with `SolvencyViolation()`

**Goal**
- Stop new risk-in immediately
- Preserve solvency for existing in-flight bets
- Maintain clean audit trail (snapshot + rationale)

**Steps**
1) **Pause risk-in for the affected asset**
   - Prefer per-asset pause:
     - `GameHub or SportsHub pool pause`
   - If multi-asset stress, use `setRiskInPausedAll(true)`.
2) **Confirm the solvency boundary**
   - Re-read `Bank.getSSOT()` and record `NAV/R/riskReserve/riskFree/withdrawalBuffer/withdrawable`.
3) **If withdrawals/XP claims are draining liquidity, tighten optional outflows**
   - Raise `Bank.withdrawalBufferBps` for the affected bank (governance):
     - This reduces `_optionalOutflowCap()` and limits withdrawals/claims.
   - Do not oscillate values; apply a conservative step, then reassess.
4) **Let the system clear outstanding bets**
   - Finalize/refund remain permissionless.
   - Monitor `A5 (bets_in_flight)` and `D2 (reserved)` until it decays.
5) **Recovery**
   - Once `riskFree` is comfortably positive and reserved stabilizes, unpause risk-in.
   - Postmortem: record parameter changes and timelines.

---

### Playbook B — Unexpected NAV drop (D1)

**Trigger**
- `D1 (bank_total_assets)` drops sharply without expected corresponding outflows

**Goal**
- Contain the incident as a potential protocol/security issue
- Identify whether the drop is explainable by legitimate flows

**Steps**
1) **Pause risk-in immediately** for the affected asset(s).
2) **Reconcile explainable outflows**
   - From logs, compute sums over the drop window:
     - Withdrawals/redeems (Bank transfers to users)
     - `BetSettled` payouts (`payoutNet + refundAmount`)
     - XP claims (`XPAcruedClaimed`)
3) **Check for non-standard outflows**
   - There should be no admin “asset rescue”. `Bank.rescueToken` forbids rescuing the asset.
   - If you see transfers of the asset that do not correspond to known flows, treat as **critical**.
4) **Validate invariants locally on a fork**
   - Use the failing betIds/tx hashes as repro inputs.
   - A release must not proceed until unit/diff/invariants and fork release gate pass.

---

### Playbook C — Optional outflow blocked / user withdrawals failing

**Trigger**
- Users report withdraw/redeem failing broadly
- `maxWithdraw/maxRedeem` are near 0 for many users

**Key fact**
Withdrawals are gated by `_optionalOutflowCap()` which depends on `NAV - R - withdrawalBuffer`.
This can be expected during high reserved regimes.

**Steps**
1) Confirm whether the bank is paused (`riskInPaused == true`).
2) If not paused, read `withdrawable` from `getSSOT()`.
   - If `withdrawable == 0`: this is expected; communicate that withdrawals are temporarily constrained.
3) If `withdrawable` is healthy but withdrawals still fail:
   - treat as anomaly; pause risk-in and investigate transaction revert reasons.

---

## Evidence collection template

Capture:
- chainId, release tag, `deployments/release-*.json` digest
- affected `asset`, `bank` address
- SSOT snapshot: `B/PF/XP/NAV/R/riskReserve/riskFree/withdrawalBuffer/withdrawable/riskInPaused`
- time window and block range
- derived `reserved` and large outflow events in the window
- all governance actions taken (pause, risk reserve / withdrawal buffer changes)

---

## Appendix: commonly used calls

```bash
# Bank for an asset
cast call $GAME_HUB "bankFor(address)(address)" $ASSET --rpc-url $RPC

# Bank SSOT snapshot
cast call $BANK "getSSOT()((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,uint256,uint256,uint256))" --rpc-url $RPC

# Bank total assets (NAV proxy)
cast call $BANK "totalAssets()(uint256)" --rpc-url $RPC

# Pause risk-in for an asset (gov)
cast send $GAME_HUB "setRiskInPaused(address,bool)" $ASSET true --rpc-url $RPC --private-key $GOV_PK

# Tighten new-risk intake (gov)
cast send $BANK "setRiskReserveBps(uint256)" 2000 --rpc-url $RPC --private-key $GOV_PK

# Tighten optional outflows (gov)
cast send $BANK "setWithdrawalBufferBps(uint256)" 2000 --rpc-url $RPC --private-key $GOV_PK
```
