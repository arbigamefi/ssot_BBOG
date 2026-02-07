# ADR-0011: Multi-Game Expansion Without New Trust Surface

- **Status:** Accepted
- **Date:** 2026-01-09

## Context

The protocol architecture is intended to scale to multiple games via **pure game modules**. We must
prove that adding new games does not add new trust surfaces, does not change Bank accounting, and does
not weaken the Executable SSOT.

Historically (in legacy refactors), adding a game often duplicated state, added bespoke settlement
paths, and created inconsistent reserve semantics.

## Decision

We will expand from the baseline game module set by adding **two additional pure modules** while
preserving the same Hub/Bank/VRFHub SSOT invariants.

### Module requirements

Each new game module MUST:

- be a **pure** module: deterministic outcome and payout from `(randomWords, params, stake)`
- produce `payoutGross` bounded by the reserved worst-case agreed at `placeBet`
- not hold funds (no escrow), and not interact with Bank directly
- have a deterministic parameter encoding and a documented reserve upper bound

The Hub remains the sole bet authority.

### Target modules (v1.0)

1. **CoinToss** (binary outcome, simple reserve bound)
2. **Roulette (minimal)** (multi-outcome mapping, non-trivial param decoding)

### Proof strategy

We will not “fork” the invariant suite per game. Instead:

- the handler will randomly select `gameId` and generate valid params
- existing invariants must continue to pass unchanged
- additional per-module E2E tests may be added, but invariants remain global

## Implementation plan (PR-sized)

1. Define `src/games/cointoss/CoinTossModule.sol` and add to Hub registry
2. Add `test/unit/CoinToss.e2e.t.sol` with win/lose and reserve bound cases
3. Define `src/games/roulette/RouletteModule.sol` (minimal mapping) and add to Hub registry
4. Add `test/unit/Roulette.e2e.t.sol` including encoding/decoding and reserve bound cases
5. Extend invariant `Handler`:
   - add random selection among registered games
   - add param generators that respect each game’s domain
6. Run PR gate + nightly gate invariants without changes to the invariant logic

## Acceptance

- Two new modules are registered and usable through `Hub.placeBet`.
- Unit E2E tests for each module pass.
- The invariant suite continues to pass with no SSOT relaxations.
- The Bank/Hub/VRFHub SSOT interfaces are unchanged (only game registry changes).

## Consequences

- Demonstrates the architecture scales without adding new accounting or permission surfaces.
- Adds maintenance burden for module param generators and E2E cases.

## Alternatives considered

1. Add all legacy games at once: higher risk and harder debugging.
2. Separate Hub per game: explicitly rejected (violates SSOT single authority).

## Links

- Architecture overview: `docs/architecture/overview.md`
- Executable SSOT: `docs/constitution/ExecutableSSOT.v1.0.md`