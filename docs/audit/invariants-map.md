# Invariant-to-Code Map (SSOT v1.3)

This file links the **SSOT Constitution / ExecutableSSOT** statements to the concrete code and tests
that enforce them.

> Tip: the current v1.3 proof surfaces are `test/invariants/SettlementRouterInvariants.t.sol`,
> `test/invariants/SportsHubInvariants.t.sol`, and the router-backed stateful diff tests under
> `test/diff/*`.

## A — Accounting (per-asset Bank SSOT)

### A1[a]: `totalAssets() == NAV == B - PF - XP`
- Code:
  - `src/core/Bank.sol::totalAssets` (returns `AccountingLib.nav(B,PF,XP)`)
  - `src/core/Bank.sol::getSSOT` (reports `B/PF/XP/NAV/...`)
- Tests:
  - `test/diff/StatefulSystemDiff.t.sol` (Bank balance/reserve/XP mirror over routed casino flows)

### A2[a]: `B >= PF + XP`
- Code:
  - `src/core/Bank.sol::totalAssets/getSSOT` via `AccountingLib.nav` (reverts on underflow)
- Tests:
  - `test/diff/StatefulSystemDiff.t.sol` (PF/R/XP mirror over routed casino flows)

### A3[a]: `NAV >= R` (reserve coverage)
- Code:
  - `src/core/Bank.sol::holdBet` (rejects risk-in if post-state violates solvency)
  - `src/core/Bank.sol::settleBet/refundBet` (release reserve first)
- Tests:
  - `test/invariants/SettlementRouterInvariants.t.sol::invariant_router_reserved_matches_bank_reserved_by_pool`
  - `test/diff/StatefulSystemDiff.t.sol`

### A4[a]: Optional outflow domain `NAV - R >= MinLiq(NAV)`
- Code:
  - `src/core/Bank.sol::_checkOptionalOutflowDomain`
  - used by `withdraw/redeem/claimXPAcrued` (optional outflows)
- Tests:
  - `test/diff/StatefulSystemDiff.t.sol` keeps routed risk-in/debt-out accounting inside the Bank mirror.
  - Standalone v1.2 named invariant was retired during the v1.3 router proof split.

## B — Bets (reserve safety)

### B3: `payoutGross + refundAmount <= reserved` and `refundAmount <= stake`
- Code:
  - `src/core/Bank.sol::settleBet` (hard checks)
  - `src/core/SettlementRouter.sol::settlePosition` (owner-hub-only route to the snapshotted Bank)
- Tests:
  - `test/diff/StatefulSystemDiff.t.sol`
  - `test/invariants/SettlementRouterInvariants.t.sol`

### B4[a]: `totalReserved == Σ reserved(open holds)`
- Code:
  - `src/core/Bank.sol::totalReserved` updates in `holdBet/settleBet/refundBet`
- Tests:
  - `test/invariants/SettlementRouterInvariants.t.sol::invariant_router_reserved_matches_bank_reserved_by_pool`

## C — VRF transport safety

### C1/C2: request mapping is active **only** for `PendingVRF`
- Code:
  - `src/core/GameHub.sol::requestToBetId` (cleared on finalize/refund and onRandomWords)
  - `src/core/VRFHub.sol` (detach + fulfill-never-revert)
- Tests:
  - `test/diff/StatefulSystemDiff.t.sol`
  - `test/diff/StatefulSystemDiffAdapter.t.sol`

## D — Pause semantics

### D2: No ASSET backdoor
- Code:
  - `src/core/Bank.sol::rescueToken` must forbid rescuing the Bank's own `ASSET`
- Tests:
  - Code-level guard remains in Bank; no standalone v1.3 invariant file carries the old D2 name.

### LIVE: Debt-out liveness (finalize/refund must stay live)
- Code:
  - `src/core/GameHub.sol::finalize/refund` (no pool pause gating)
  - `src/core/SettlementRouter.sol::settlePosition/refundPosition`
  - `src/core/SportsHub.sol::settleTicket/refundTicket/voidTicket`
- Tests:
  - `test/unit/SettlementRouter.t.sol`
  - `test/unit/SportsHubSettlement.t.sol`
  - `test/invariants/SportsHubInvariants.t.sol`

## E — Referral / XP buckets

### E2: bucket moves preserve `XP_total`
- Code:
  - `src/core/Bank.sol::unlockXPLocked`
  - `src/core/Bank.sol::syncXPHoldback`
- Tests:
  - `test/diff/StatefulSystemDiff.t.sol` (XP accrued/locked/holdback totals and per-payee buckets)
  - `test/unit/SecurityFixes.t.sol` (holdback vesting regression)

### E3: claim is optional outflow + pause gated
- Code:
  - `src/core/Bank.sol::claimXPAcrued`
- Tests:
  - Code-level optional-outflow guard remains in Bank; no standalone v1.3 invariant file carries the old E3 name.

## P — Skyline pricing / budgets

### P3: budget conservation (`ΔPF + ΔXP == expected house-edge accrual`)
- Code:
  - `src/core/GameHub.sol::finalize` (computes base/delta budgets and sinks)
  - `src/engines/referral/DefaultReferralEngine.sol`
- Tests:
  - `test/diff/StatefulSystemDiff.t.sol`
  - `test/diff/StatefulSystemDiffAdapter.t.sol`

## X — Cross-asset isolation

### X1: no cross-asset custody leakage
- Code:
  - `src/core/Bank.sol` holds only its configured `ASSET`
- Tests:
  - `test/invariants/SettlementRouterInvariants.t.sol`
  - `test/diff/StatefulSystemDiff.t.sol`

## Diff tests (orthogonal proof technique)

- Module-level diff:
  - `test/diff/DiffCoinToss.t.sol`
  - `test/diff/DiffRoulette.t.sol`
  - `test/diff/DiffSlots.t.sol`
  - `test/diff/DiffBaccarat.t.sol`
  - `test/diff/DiffPlinko.t.sol`
  - `test/diff/DiffSicBo.t.sol`
- System-level stateful diff:
  - `test/diff/StatefulSystemDiff.t.sol`
  - `test/diff/StatefulSystemDiffAdapter.t.sol`


## Adapter-mode ETH/Credit proof gates (Chainlink Wrapper)

These gates apply when VRFHub is configured with a Chainlink Wrapper adapter (ADR-0021, ADR-0022).

### Adapter diff (system-level)
- `test/diff/StatefulSystemDiffAdapter.t.sol`
  - Enforces: wrapper ETH collected == sum(vrfFeeCharged), VRFHub ETH == sum(refundCredit), and claimRefund liveness.

### Adapter invariants
- No separate `InvariantsAdapter.t.sol` exists in the current v1.3 tree.
- Adapter ETH/credit obligations are enforced by `test/diff/StatefulSystemDiffAdapter.t.sol` plus
  `test/unit/VRFFee*.t.sol` and `test/unit/ChainlinkAdapter.t.sol`.


## Charged VRF fee (native) proof obligations (v1.2 carryover into v1.3)

These obligations correspond to **ExecutableSSOT v1.2 (V-class)** and remain binding after the
v1.3 `GameHub -> SettlementRouter -> Bank` migration.

### V1/V2: underpay reverts; overpay best-effort refund
- Code:
  - `src/core/GameHub.sol::quoteVRFFee/placeBet` (payable fee path)
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
