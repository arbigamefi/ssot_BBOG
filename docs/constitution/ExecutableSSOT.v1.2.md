# Executable SSOT (Invariants) v1.2 — Charged VRF Fee (Native) + Adapter ETH/Credit Gates

This document defines the **machine-checkable** proof obligations for SSOT v1.2.

v1.2 **extends** ExecutableSSOT v1.1. All v1.1 statements remain in force.
This file adds the additional proof surface introduced by:

- **Charged VRF fee (native):** payable `placeBet`, deterministic fee quoting, best-effort overpay refund.
- **Refund credit (debt-out):** failed overpay refunds accrue to `refundCredit` and are claimable later.
- **Adapter mode (Chainlink Wrapper):** charged fee is forwarded to the provider wrapper; Hub/Adapter do not retain ETH.

> Related ADRs (v1.2 additions):
> - ADR-0020 (charged VRF fee in native token)
> - ADR-0021 (Chainlink Wrapper adapter)
> - ADR-0022 (adapter ETH/credit invariants)

## Scope & implementation

The authoritative enforcement points are:

- Invariants (stateful):
  - `test/invariants/Invariants.t.sol` (default mode)
  - `test/invariants/InvariantsAdapter.t.sol` (adapter mode)
- Targeted unit/E2E tests:
  - `test/unit/VRFFee.t.sol`
  - `test/unit/VRFFeeCreditClaim.t.sol`
  - `test/unit/ChainlinkAdapter.t.sol`

The intent is **not** to restate the Constitution; it is to enumerate what MUST be proven
in fuzzed execution and in deterministic unit tests.

## Notation (additive)

Native-token quantities:

- `ETH(X)` = `address(X).balance`
- `Credit[p]` = `VRFHub.refundCreditOf(p)`

Per-request quantities (by `requestId`):

- `feePaid(requestId)` = `VRFHub.getRequest(requestId).feePaid`
- `feeCharged(requestId)` = `VRFHub.getRequest(requestId).feeCharged`
- `payer(requestId)` = `VRFHub.getRequest(requestId).payer`

Per-bet snapshot quantities (by `betId`):

- `betFeePaid(betId)` = `Hub.getBet(betId).vrfFeePaid`
- `betFeeCharged(betId)` = `Hub.getBet(betId).vrfFeeCharged`

---

## V — Charged VRF fee (native) + refundCredit

These obligations correspond to SSOT v1.2 axioms 6–8.

### V1. Fee charging lower bound ("少补")
**Statement:** for every successful `placeBet`, `betFeePaid(betId) >= betFeeCharged(betId)`.

- Owner: Hub + VRFHub
- Enforced by: `VRFHub.requestRandomWords` (reverts if `msg.value < required`)
- Proof:
  - Unit: `test/unit/VRFFee.t.sol` (underpay reverts; overpay allowed)
  - Unit: `test/unit/ChainlinkAdapter.t.sol` (adapter mode path)

### V2. Overpay refund best-effort ("多退")
**Statement:** if `betFeePaid > betFeeCharged`, the protocol attempts to refund `betFeePaid - betFeeCharged` to the payer
without blocking the VRF request.

- Owner: VRFHub
- Proof:
  - Unit: `test/unit/VRFFee.t.sol::test_vrf_fee_overpay_refunds_best_effort` (gasPrice=0)
  - Unit: `test/unit/ChainlinkAdapter.t.sol::test_chainlink_adapter_overpay_refund_still_works` (adapter mode)

### V3. Refund credit accrual on failed refund
**Statement:** if the refund transfer fails, the refund amount is added to `Credit[payer]`.

- Owner: VRFHub
- Proof:
  - Unit: `test/unit/VRFFeeCreditClaim.t.sol::test_vrf_refundCredit_claimable_when_refund_fails`

### V4. Claim refund credit is debt-out (pause-independent)
**Statement:** `VRFHub.claimRefund()` MUST NOT be pause-gated.
If the receiver can accept ETH, a claim clears `Credit[payer]` and transfers exactly that amount.

- Owner: VRFHub
- Proof:
  - Unit: `test/unit/VRFFeeCreditClaim.t.sol` (claim clears credit and transfers amount)
  - Adapter invariants also assert claim attempts do not fail when credit exists and receiver accepts.

### V5. Failed claim preserves credit (safety)
**Statement:** if `claimRefund()` reverts due to receiver refusing ETH, `Credit[payer]` MUST remain unchanged.

- Owner: VRFHub
- Proof:
  - Unit: `test/unit/VRFFeeCreditClaim.t.sol` (failed claim restores credit)

---

## Z — Adapter-mode ETH/Credit accounting (Chainlink Wrapper)

These obligations apply when VRFHub is configured with a Chainlink Wrapper adapter (ADR-0021/0022).

### Z1. No Hub/Adapter ETH retention
**Statement:** in adapter mode, `ETH(Hub) == 0` and `ETH(Adapter) == 0` at all times.

- Owner: Hub + Adapter
- Proof:
  - Invariant: `test/invariants/InvariantsAdapter.t.sol::invariant_Z1_adapter_eth_accounting`

### Z2. Wrapper retains exactly the charged fees
**Statement:** in adapter mode, the provider wrapper retains exactly `Σ betFeeCharged(bet)` across all successful bets.

- Owner: Adapter + Wrapper
- Proof:
  - Invariant: `test/invariants/InvariantsAdapter.t.sol::invariant_Z1_adapter_eth_accounting`
  - Diff: `test/diff/StatefulSystemDiffAdapter.t.sol` (stateful cross-check)

### Z3. VRFHub retains only refund credits
**Statement:** in adapter mode, `ETH(VRFHub) == Σ Credit[p]` across tracked actors.

- Owner: VRFHub
- Proof:
  - Invariant: `test/invariants/InvariantsAdapter.t.sol::invariant_Z1_adapter_eth_accounting`

### Z4. Claim liveness under adapter mode
**Statement:** if `Credit[p] > 0` and `p` can accept ETH, then `claimRefund()` MUST succeed.

- Owner: VRFHub
- Proof:
  - Invariant: `test/invariants/InvariantsAdapter.t.sol::invariant_Z1_adapter_eth_accounting`

---

## Proof gates (run policy)

v1.2 adds **unit tests** (V-class) and **adapter-mode** proof gates (Z-class) on top of v1.1.

- **PR gate:** unit + diff + invariants (fast profiles)
- **Nightly gate:** deep invariants/diff
- **Release gate:** `STRICT=1 make release-check` plus fork tests (ADR-0023)

Run profiles live in `foundry.toml` and CI workflows.
