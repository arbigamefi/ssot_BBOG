# ADR-0013: Multi-Roll Semantics (Refund + stopGain/stopLoss) and Canonical RNG Expansion

- **Status:** Accepted
- **Date:** 2026-01-09

## Context

Multi-roll games (Dice/Roulette/Keno) use:

- a single VRF word used as a **seed**
- deterministic per-roll RNG derived from that seed
- early stopping via `stopGain` / `stopLoss`
- partial refunds of unused escrow

Games share one definition of:

- stake specification (`amountPerRoll`, `betCount`)
- `usedTurnover` vs `refundAmount`
- stopGain/stopLoss profit semantics
- canonical RNG expansion

## Decision

We standardize multi-roll as a **stake specification** carried by every bet:

- `amountPerRoll` (token units)
- `betCount` (number of rolls requested)
- `stopGain` (token units; `0` disables)
- `stopLoss` (token units; `0` disables)

GameHub checks `amountPerRoll >= Bank.minBetAmount()` and
`1 <= betCount <= gameMaxBetCount <= 25` before collecting funds or requesting randomness.
The selected USDC minimum is 10,000 raw units (0.01 USDC) per round: 25 minimum-size
rounds require 0.25 USDC total. There is no separate position-total minimum.

Define:

- `stake := amountPerRoll * betCount` (escrowed at hold time)
- `usedTurnover` = total wagered amount actually consumed during resolution
- `refundAmount := stake - usedTurnover`

All turnover-based logic (budgets, XP turnover gating) uses `usedTurnover`, not `stake`.

### stopGain / stopLoss semantics

During resolution, after each roll updates totals:

- `profitSoFar := payoutGrossSoFar - usedTurnoverSoFar`

Stop conditions (evaluated after each roll):

- stop if `stopGain > 0` and `profitSoFar >= stopGain`
- stop if `stopLoss > 0` and `profitSoFar <= -stopLoss`

If stopped early, remaining escrow is refunded.

### Canonical RNG expansion

Let:

- `seed := randomWords[0]`
- `domain := "SSOT_RNG_V1"`

Per-roll randomness:

- `r[i] := uint256(keccak256(abi.encodePacked(domain, betId, i, seed)))`

If a module needs multiple independent random values per roll:

- `r[i,j] := uint256(keccak256(abi.encodePacked(domain, betId, i, j, seed)))`

Modules MUST NOT use external state (timestamp, blockhash, etc.) as randomness.

## Implementation

[IGameModule.resolve](../../src/core/interfaces/IGameModule.sol) returns exactly
`(payoutGross, refundAmount)`. GameHub rejects refunds exceeding the accepted stake
and total gross payout plus refund exceeding the reserve, then derives
`usedTurnover = stake - refundAmount` for turnover allocation and Bank settlement.
Modules use the shared [RNG](../../src/libs/RNG.sol) and
[StopLogic](../../src/libs/StopLogic.sol); module differential and end-to-end tests
check deterministic results, early stops and conservation of used and refunded stake.

## Acceptance

- Multi-roll bets produce deterministic results across:
  - on-chain module resolve
  - reference model resolve
  - diff tests
- Refund and turnover accounting are correct and invariant-protected.
- stopGain/stopLoss semantics are identical across games.

## Alternatives considered

1. Let each game define its own stop logic:
   - Rejected: increases proof burden and creates semantic drift.

2. Require multiple VRF words proportional to betCount:
   - Rejected: cost-inefficient and unnecessary; seed expansion is sufficient and auditable.

## Links

- [Constitution](../constitution/SSOT.v1.6.md)
- [Executable SSOT](../constitution/ExecutableSSOT.v1.6.md)
