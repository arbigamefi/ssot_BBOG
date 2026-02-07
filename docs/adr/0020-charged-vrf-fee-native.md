# ADR-0020: Charged VRF Fee in Native Token (refactored parity)

## Status
Accepted

## Context
The refactored v0.7.8 implementation charges a per-bet VRF fee (paid in native token) at bet placement time,
with **"多退少补"** behavior: the user must pay at least a quoted fee; overpayment is refunded.

SSOT v1.1 intentionally kept VRFHub minimal (transport + fulfill-never-revert). To reach full parity and
production readiness, the protocol needs an explicit VRF fee model while preserving the SSOT constitution:

- Risk-in may fail; debt-out must remain live.
- No privileged ETH withdrawal backdoor.
- fulfillRandomWords must never revert.

## Decision
We implement a **deterministic quote + charged fee** in `VRFHub` and require `Hub.placeBet` to be payable:

- `Hub.quoteVRFFee(betCount)` exposes the fee and callback gas policy.
- `Hub.placeBet` requires `msg.value >= fee` and passes the payment to `VRFHub.requestRandomWords`.
- `VRFHub` refunds any overpayment **best-effort**. If the refund transfer fails, it accrues a per-payer
  credit and can be claimed later via `VRFHub.claimRefund()`.
- `VRFHub` does **not** expose any privileged withdrawal for charged oracle fees.

## Consequences
- PlaceBet becomes `payable` and all callers/tests must supply an appropriate `msg.value`.
- Bet records snapshot `vrfFeePaid/vrfFeeCharged/vrfCallbackGasLimit` for auditability.
- The system-level diff suite can pay the exact quote (no ETH modelling required) while retaining parity.
