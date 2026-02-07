# ADR-0022: Adapter-mode ETH/Credit Accounting Invariants

## Context

Milestone 2.4 introduces a Chainlink VRF v2.5+ Wrapper adapter (native payment). In adapter mode:

- `Hub.placeBet` is payable and forwards `msg.value` to `VRFHub.requestRandomWords`.
- `VRFHub` charges a deterministic `feeCharged` and forwards it to the adapter, which forwards it to the wrapper.
- Any overpayment (`msg.value - feeCharged`) is refunded best-effort to the payer. If the refund transfer fails, the amount is stored as `refundCredit` and can be claimed later via `claimRefund()`.

This creates an additional ETH accounting surface that must be kept aligned with SSOT principles:

- No hidden fee accumulation in privileged contracts (no backdoor).
- Debt-out liveness for `refundCredit`.
- Clear separation of custody responsibilities.

## Decision

Add an adapter-mode invariant suite (`test/invariants/InvariantsAdapter.t.sol`) that enforces:

1) `Hub` retains no ETH.
2) Adapter retains no ETH.
3) Wrapper retains exactly the sum of `vrfFeeCharged` across successfully accepted bets.
4) `VRFHub` retains only `refundCredit` (its ETH balance equals the sum of per-payer credits).
5) If `claimRefund()` is attempted when a credit exists, it must not fail.

The suite uses a `ToggleReceiver` (rejecting ETH) plus deliberate overpayment to force credit creation, ensuring the credit path is continuously exercised.

## Consequences

- Adapter-mode ETH behavior becomes part of the PR and nightly proof gates.
- Regressions that accidentally accumulate ETH in Hub/adapter, or mis-account for credits, are detected early.

## Alternatives considered

- Rely only on unit tests + stateful system diff:
  - Rejected because invariants provide continuous guardrails and are cheaper to run than long diff traces.
- Add ETH accounting to the main invariant suite:
  - Rejected to keep the non-adapter suite minimal and to avoid introducing wrapper-only concerns into the default configuration.
