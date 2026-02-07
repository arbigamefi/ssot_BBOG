# Protocol Constitution (SSOT) v1.2 — Charged VRF Fee (Native) Parity

This document is **normative**. Keywords **MUST / MUST NOT / SHOULD / MAY** are used as defined in RFC 2119.

v1.2 supersedes v1.1 by specifying **native-token VRF fee charging** at bet placement time, matching the
refactored v0.7.8 user experience (**"多退少补"**) while preserving SSOT liveness and minimal trust surface.

Everything in v1.1 remains in force unless explicitly extended here.

## 0. Additive axioms (v1.2)

6. **Charged VRF fee (native):** each bet MUST pay a VRF fee denominated in the chain's native token
   (e.g., ETH) at placement time. The fee MUST be quoted deterministically from public parameters and
   MUST be at least fully paid ("少补"). Any overpayment MUST be refunded best-effort ("多退") without
   expanding the trusted surface or blocking the request.

7. **No oracle-fee backdoor:** charged VRF fees MUST NOT be withdrawable by governance or any privileged
   role via a generic "sweep" mechanism. (Production adapters MAY independently sweep fees as part of an
   external oracle contract, but the SSOT protocol itself MUST NOT introduce a privileged withdrawal.)

8. **Refund credit is debt-out:** if an overpayment refund transfer fails (payer cannot receive native token),
   the protocol MUST accrue a per-payer refund credit that can be claimed later. Claiming this credit MUST
   be a debt-out operation: it MUST remain live regardless of risk-in pause.

## 1. VRF fee model

### 1.1 Quoting

- The protocol MUST expose a public quote endpoint for the per-bet fee:
  - `Hub.quoteVRFFee(betCount)` returning `(fee, callbackGasLimit)`.
  - The quote MUST mirror the exact callback-gas policy used by `placeBet`.

### 1.2 Charging

- `Hub.placeBet(...)` MUST be `payable`.
- For a bet with stake spec `(amountPerRoll, betCount, stopGain, stopLoss)`, Hub MUST:
  1) compute `(fee, cbGas) = quoteVRFFee(betCount)`
  2) require `msg.value >= fee` (otherwise revert)
  3) forward the payment to `VRFHub.requestRandomWords(..., payer=player)`

### 1.3 Overpayment refunds

- If `msg.value > fee`, the protocol MUST attempt to refund `msg.value - fee` to `payer`.
- The refund attempt MUST NOT block the VRF request (best-effort).
- If refund transfer fails, the protocol MUST accrue a claimable refund credit for the payer.

### 1.4 Auditability

Each bet record MUST snapshot (at minimum):
- `vrfFeePaid` (native token provided)
- `vrfFeeCharged` (native token charged)
- `vrfCallbackGasLimit` (cbGas used in request)
