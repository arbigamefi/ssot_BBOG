# ADR-0027: Extract shared StopLogic library for multi-roll stop conditions

## Context

ADR-0013 standardized `stopGain`/`stopLoss` semantics across all multi-roll games
and explicitly rejected per-game stop logic ("increases proof burden and creates
semantic drift").

Despite this intent, the implementation contains an identical `_shouldStop` function
duplicated in 4 production modules (CoinTossModule, DiceModule, RouletteModule,
KenoModule) and 2 diff test reference models (DiffCoinToss, DiffRoulette). Any
future behavioral change (e.g., adding a `stopOnZero` condition) requires 6
synchronized edits.

## Decision

1. Create `src/libs/StopLogic.sol` containing a single `shouldStop` function with
   the canonical stop semantics from ADR-0013.
2. Replace `_shouldStop` in all 4 modules with `StopLogic.shouldStop`.
3. Replace `_shouldStop` in diff test reference models with the same import.

Modules import from `src/libs/` which is permitted by the module boundary rules
(CONTRIBUTING.md: "modules/* MUST NOT import core/*" — `libs` are not `core`).

## Consequences

- Single source of truth for stop logic, aligned with ADR-0013's intent.
- Future stop-condition changes require editing one file + one test.
- No behavioral change: the function body is identical.
- Diff tests can import the same library, reducing test-production drift.

## Alternatives considered

1. **Abstract base contract for modules.**
   Rejected: modules are `IGameModule` implementations using composition, not
   inheritance (ADR-0011).
2. **Add to existing `RNG.sol`.**
   Rejected: stop logic is unrelated to randomness; separate concerns.
