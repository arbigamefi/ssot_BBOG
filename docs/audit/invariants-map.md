# Invariant-to-Code Map (v1.8+)

This file links the **SSOT Constitution / ExecutableSSOT** statements to the concrete code and tests
that enforce them.

> Tip: the authoritative lists of invariants are in `test/invariants/Invariants.t.sol` (default) and `test/invariants/InvariantsAdapter.t.sol` (adapter mode).

## A — Accounting (per-asset Bank SSOT)

### A1[a]: `totalAssets() == NAV == B - PF - XP`
- Code:
  - `src/core/Bank.sol::totalAssets` (returns `AccountingLib.nav(B,PF,XP)`)
  - `src/core/Bank.sol::getSSOT` (reports `B/PF/XP/NAV/...`)
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_A1_totalAssets_equals_NAV_per_asset`

### A2[a]: `B >= PF + XP`
- Code:
  - `src/core/Bank.sol::totalAssets/getSSOT` via `AccountingLib.nav` (reverts on underflow)
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_A2_A3_per_asset` (A2 portion)

### A3[a]: `NAV >= R` (reserve coverage)
- Code:
  - `src/core/Bank.sol::holdBet` (rejects risk-in if post-state violates solvency)
  - `src/core/Bank.sol::settleBet/refundBet` (release reserve first)
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_A2_A3_per_asset` (A3 portion)

### A4[a]: Optional outflow domain `NAV - R >= MinLiq(NAV)`
- Code:
  - `src/core/Bank.sol::_checkOptionalOutflowDomain`
  - used by `withdraw/redeem/claimXPAcrued` (optional outflows)
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_A4_optional_outflow_domain`

## B — Bets (reserve safety)

### B3: `payoutGross + refundAmount <= reserved` and `refundAmount <= stake`
- Code:
  - `src/core/Bank.sol::settleBet` (hard checks)
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_B3_bounded_settlement_outcome`

### B4[a]: `totalReserved == Σ reserved(open holds)`
- Code:
  - `src/core/Bank.sol::totalReserved` updates in `holdBet/settleBet/refundBet`
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_B4_totalReserved_matches_active_reserves`

## C — VRF transport safety

### C1/C2: request mapping is active **only** for `PendingVRF`
- Code:
  - `src/core/Hub.sol::requestToBetId` (cleared on finalize/refund and onRandomWords)
  - `src/core/VRFHub.sol` (detach + fulfill-never-revert)
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_C1_request_mapping_consistency_sampled`

## D — Pause semantics

### D2: No ASSET backdoor
- Code:
  - `src/core/Bank.sol::rescueToken` must forbid rescuing the Bank's own `ASSET`
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_D2_no_asset_backdoor`

### LIVE: Debt-out liveness (finalize/refund must stay live)
- Code:
  - `src/core/Hub.sol::finalize/refund` (no pause gating)
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_LIVE_debt_out_must_succeed`

## E — Referral / XP buckets

### E2: bucket moves preserve `XP_total`
- Code:
  - `src/core/Bank.sol::unlockXPLocked`
  - `src/core/Bank.sol::syncXPHoldback`
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_E2_bucket_moves_preserve_total`

### E3: claim is optional outflow + pause gated
- Code:
  - `src/core/Bank.sol::claimXPAcrued`
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_E3_claim_pause_gated`

## P — Skyline pricing / budgets

### P3: budget conservation (`ΔPF + ΔXP == expected house-edge accrual`)
- Code:
  - `src/core/Hub.sol::finalize` (computes base/delta budgets and sinks)
  - `src/engines/referral/DefaultReferralEngine.sol`
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_P3_budget_conservation`

## X — Cross-asset isolation

### X1: no cross-asset custody leakage
- Code:
  - `src/core/Bank.sol` holds only its configured `ASSET`
- Tests:
  - `test/invariants/Invariants.t.sol::invariant_X1_no_cross_asset_custody_leakage`

## Diff tests (orthogonal proof technique)

- Module-level diff:
  - `test/diff/DiffCoinToss.t.sol`
  - `test/diff/DiffRoulette.t.sol`
- System-level stateful diff:
  - `test/diff/StatefulSystemDiff.t.sol`


## Adapter-mode ETH/Credit proof gates (Chainlink Wrapper)

These gates apply when VRFHub is configured with a Chainlink Wrapper adapter (ADR-0021, ADR-0022).

### Adapter diff (system-level)
- `test/diff/StatefulSystemDiffAdapter.t.sol`
  - Enforces: wrapper ETH collected == sum(vrfFeeCharged), VRFHub ETH == sum(refundCredit), and claimRefund liveness.

### Adapter invariants
- `test/invariants/InvariantsAdapter.t.sol`
  - Enforces: Hub/adaptor retain no ETH, wrapper retains only charged fees, VRFHub retains only refund credits, and credit claims do not fail.


## Charged VRF fee (native) proof obligations (SSOT v1.2)

These obligations correspond to **ExecutableSSOT v1.2 (V-class)** and the SSOT v1.2 axioms.

### V1/V2: underpay reverts; overpay best-effort refund
- Code:
  - `src/core/Hub.sol::quoteVRFFee/placeBet` (payable fee path)
  - `src/core/VRFHub.sol::quote/requestRandomWords` (required fee + best-effort refund)
- Tests:
  - `test/unit/VRFFee.t.sol::test_vrf_fee_underpay_reverts`
  - `test/unit/VRFFee.t.sol::test_vrf_fee_overpay_refunds_best_effort`
  - `test/unit/ChainlinkAdapter.t.sol::test_chainlink_adapter_overpay_refund_still_works`

### V3/V4/V5: refundCredit debt-out + claim semantics
- Code:
  - `src/core/VRFHub.sol::_refundCredit/refundCreditOf/claimRefund`
- Tests:
  - `test/unit/VRFFeeCreditClaim.t.sol::test_vrf_refundCredit_claimable_when_refund_fails`
  - `test/unit/VRFFeeCreditClaim.t.sol::test_vrf_refundCredit_failed_claim_preserves_credit`
