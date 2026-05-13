# ADR-0007: Fee-on-Payout House Edge (Net Settlement)

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

The protocol needs a deterministic, mechanically verifiable way to apply house edge
that does not rely on external transfers and does not compromise debt-out liveness.

Two common models are:

1. **Fee-on-stake** (charge at bet entry)
2. **Fee-on-payout** (charge only on wins)

We choose fee-on-payout to keep `stake` semantics simple and to preserve the property that
the worst-case gross payout remains bounded by the game module reserve.

## Decision

House edge is applied at `Hub.finalize` as:

- `feeOnPayout = payoutGross * effectiveHouseEdgeBps / 10_000`
- `payoutNet = payoutGross - feeOnPayout`

The Hub passes both `payoutGross` and `payoutNet` into `Bank.settleBet`.

The Bank MUST:

- enforce `payoutNet <= payoutGross` and `payoutGross + refundAmount <= reserved`
- pay the player **only** `payoutNet + refundAmount`
- accrue the fee amounts as protocol fees (`PF`) (directly or via the Hub's fee accrual)

## Consequences

- Settlement is fully deterministic and publicly recomputable from on-chain state.
- No external transfers are required for settlement.
- The player-facing payout is explicit (`payoutNet`) and cannot be retroactively changed.

## Links

- Constitution: `docs/constitution/SSOT.v1.0.md` (§3.3.1)
- Current implementation after ADR-0029: `src/core/GameHub.sol`, `src/core/SettlementRouter.sol`,
  `src/core/Bank.sol`
