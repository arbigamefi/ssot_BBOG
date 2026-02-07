# ADR-0013: Multi-Roll Semantics (Refund + stopGain/stopLoss) and Canonical RNG Expansion

- **Status:** Accepted
- **Date:** 2026-01-09

## Context

Legacy refactors provide multi-roll games (Dice/Roulette/Keno) with:
- a single VRF word used as a **seed**
- deterministic per-roll RNG derived from that seed
- early stopping via `stopGain` / `stopLoss`
- partial refunds of unused escrow

To reach full feature parity while staying institution-grade proof-friendly, we need a single,
cross-game definition of:

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

## Implementation plan (PR-sized chunks)

1. Update module interface to return (at minimum) `(payoutGross, usedTurnover)` and optionally `(rollsExecuted, trace)`.
2. Update Hub finalize path to compute `refundAmount = stake - usedTurnover` and pass it to Bank settlement.
3. Update B3/B5 invariants and add E2E tests:
   - refund correctness (`usedTurnover + refund == stake`)
   - early stop triggers for stopGain and stopLoss
4. Update reference model + diff tests to use the canonical RNG expansion.

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

- Constitution: `docs/constitution/SSOT.v1.1.md`
- Executable SSOT: `docs/constitution/ExecutableSSOT.v1.1.md`
