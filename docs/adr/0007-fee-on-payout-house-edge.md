# ADR-0007: Fee-on-Payout House Edge (Net Settlement)

- **Status:** Accepted
- **Date:** 2026-01-08

The fee rule below remains selected. Integration with the accepted
[NFT custody/callback design](../design/lp-accounting-and-callback-implementation.md)
requires fresh implementation and verification.

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

- `feeOnPayout = payoutGross * houseEdgeBps / 10_000`
- `payoutNet = payoutGross - feeOnPayout`

The Hub passes both `payoutGross` and `payoutNet` through SettlementRouter to `Bank.settleBet`.

The Bank MUST:

- enforce `payoutNet <= payoutGross` and `payoutGross + refundAmount <= reserved`
- pay the player **only** `payoutNet + refundAmount`
- enforce the separate turnover-based PF/XP allocation from
  [ADR-0032](0032-fixed-lp-share-operator-funded-referrals.md); the withheld payout fee is not
  itself accrued again to PF
- include the net player cost, unused-stake refund and new PF/XP in total terminal cost C;
  apply `stake−C` to the Vault tree through atomic net custody movement, with the explicit
  empty-root protocol-capital rule from [ADR-0034](0034-nft-liquidity-deposits.md)

## Consequences

- Settlement is fully deterministic and publicly recomputable from on-chain state.
- The fee requires no separate player payment transaction. Settlement still performs the
  required Bank/Vault custody movement and player payment or backed player-payable accounting.
- The player-facing payout is explicit (`payoutNet`) and cannot be retroactively changed.

## Links

- [Current constitution](../constitution/SSOT.v1.6.md)
- Target implementation: GameHub, SettlementRouter, Bank and LiquidityVault, with the
  source and pending verification tracked by the implementation plan above.
