# ADR-0014: Player Equals Receiver (No Recipient Separation)

- **Status:** Accepted
- **Date:** 2026-01-09

## Context

Some legacy implementations allow `player` (the bettor) to differ from `receiver` (the payout recipient).
While useful for relayers and delegation, recipient separation increases:

- signature/authorization complexity (EIP-712 domains, replay protection, allowance semantics)
- fraud and compliance surface (who is the true counterparty)
- proof scope (turnover attribution vs payout recipient)

The protocol’s near-term goal is institution-grade correctness with minimal trusted surface.

## Decision

In v1.1, the protocol fixes:

- `player == receiver` for all bets and payouts.

Consequently:

- `Bank.settleBet` and `Bank.refundBet` pay the recorded `player` only.
- Referral/turnover attribution is unambiguous.
- Any future recipient separation requires a new constitution version and a dedicated ADR.

## Acceptance

- No public entrypoint accepts a separate `receiver` for bet settlement or refund.
- Unit + invariant tests assume payout recipient equals player.

## Alternatives considered

1. Support receiver via signed permit at v1.1:
   - Rejected: expands proof surface and is unnecessary for parity migration.

2. Support receiver only for XP claims:
   - Rejected: still complicates accounting semantics; postpone to a future version if needed.

## Links

- Constitution: `docs/constitution/SSOT.v1.1.md`
