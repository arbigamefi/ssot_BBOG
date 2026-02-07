# Milestone 2.1 — Multi-Roll Framework (Parity Substrate)

This plan upgrades the SSOT bet lifecycle to support **multi-roll**, **stopGain/stopLoss**, and
**refund semantics**, per ADR-0013 and SSOT v1.1. It is the minimum framework required for full
feature parity migration from the refactored protocol.

## Scope (in / out)

### In-scope
- Stake specification: `amountPerRoll`, `betCount`, `stopGain`, `stopLoss`.
- Module resolve returns `usedTurnover` in addition to `payoutGross`.
- Refund amount computed as `stake - usedTurnover`.
- Canonical RNG expansion (seed + keccak derivation).
- Reference model + diff tests upgraded to multi-roll.

### Out-of-scope (defer)
- Per-game full parity migration (handled in Milestone 3.x modules).
- Any new “receiver” parameter (explicitly out by ADR-0014).

## Work breakdown (PR-sized)

### PR-2.1.1: Types + bet record extension
- Add `StakeSpec` struct to SSOTTypes:
  - `amountPerRoll`, `betCount`, `stopGain`, `stopLoss`.
- Extend `Hub.placeBet` to accept `StakeSpec` and store it per bet.
- Commit `StakeSpec` into `snapshotHash`.

**Acceptance**
- Unit tests confirm snapshotHash changes when stakeSpec changes.
- Existing single-roll calls can be migrated by passing `betCount=1`, `stopGain=0`, `stopLoss=0`.

### PR-2.1.2: Module interface upgrade (resolve returns usedTurnover)
- Update `IGameModule.resolve(...)` to return `(payoutGross, usedTurnover)` (and optionally trace fields).
- Update Hub finalize to compute:
  - `refundAmount = stake - usedTurnover`
  - turnover/budgets based on `usedTurnover`

**Acceptance**
- Bank settlement B3 holds for all bets: `payoutGross + refund <= reserved`.
- Turnover increments by `usedTurnover` exactly (B5).

### PR-2.1.3: Canonical RNG library
- Implement a small library `RngLib`:
  - `rollSeed(betId, i, seed)` => `r[i]`
  - `rollSeed2(betId, i, j, seed)` => `r[i,j]`
- Enforce that modules use the library (or reproduce exactly).

**Acceptance**
- Unit test: reference model and module derive identical per-roll sequences for fixed betId/seed.

### PR-2.1.4: stopGain/stopLoss canonical semantics
- Implement canonical “profitSoFar” semantics at the module layer.
- Add unit tests for early-stop correctness:
  - stops on gain, stops on loss, and no-stop behavior.

**Acceptance**
- For a constructed scenario, `usedTurnover` decreases when stop triggers and `refundAmount` matches.
- No divergence between module and reference model.

### PR-2.1.5: Diff tests + invariants upgrade
- Upgrade reference model to multi-roll.
- Extend diff tests to compare:
  - `payoutGross`, `usedTurnover`, `refundAmount`, and (optionally) trace.
- Extend invariant handler to generate valid multi-roll stake specs.

**Acceptance**
- PR gate passes with multi-roll enabled.
- Nightly gate remains stable after burn-in.

## Deliverables

- Multi-roll SSOT substrate.
- Canonical RNG expansion implemented and tested.
- stopGain/stopLoss semantics uniform across games.
- Proof gate extended to multi-roll (unit + invariants + diff).

