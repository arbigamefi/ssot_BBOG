# ADR-0009: Reference Model Differential Testing

- **Status:** Accepted
- **Date:** 2026-01-09

## Context

The invariant suite is designed to prevent **catastrophic** violations (e.g., NAV underflow, reserve
coverage, request mapping, bucket identities). However, invariants can still miss:

- **silent drift** bugs (incorrect accounting updates that still satisfy coarse inequalities),
- **order-dependent** bugs that only manifest under specific interleavings,
- **cross-field consistency** bugs where each field is locally plausible but the overall state
  transition is wrong.

To reach an institution-grade bar, we need a second proof technique that checks the protocol against
an independent specification.

## Decision

We will implement a **reference model** (a pure test-side state machine) and run
**differential checks** against on-chain state after every fuzzed action.

### Scope (v1.0)

The reference model mirrors the protocol at the SSOT level:

- Bank SSOT: `B, PF, XP, NAV, R, MinLiq, Free`
- Per-bet SSOT snapshots (reserved, stake, pricing snapshots, request state)
- XP buckets (accrued/locked/holdback) and their permissionless transitions
- Request lifecycle (active only for PendingVRF; cleared on terminalization)

The reference model does **not** try to model gas, reentrancy, or EVM internals.
It focuses on deterministic state transitions implied by SSOT.

### Differential assertions

After each handler action, tests MUST assert:

1. **Exact equalities** (not just inequalities), e.g.
   - `bank.externalPayablesTotal() == model.xpAccrued + model.xpLocked + model.xpHoldback`
   - `bank.totalReserved() == model.totalReserved`
2. **Snapshot immutability** for accepted bets.
3. **Event-consistent accounting** for finalize/refund (when we use event reconstruction).

## Implementation plan (PR-sized)

1. Add `test/diff/ReferenceModel.sol`:
   - structs: `ModelBet`, `ModelXP`, `ModelRequest`, `ModelState`
   - helper math that exactly matches protocol rounding (`mulDiv` rules)
2. Extend the invariant `Handler` with a `ModelState` mirror:
   - update mirror state on successful actions
   - record expected reverts when actions intentionally violate domains
3. Add `test/diff/Diff.t.sol`:
   - run a sequence of handler actions
   - after each step, `assertDiff()` compares model vs chain
4. Add a small fixed-seed suite and a larger randomized suite.
5. Add CI gates:
   - PR: `diff` tests with smaller steps
   - nightly: `diff` tests with large steps

## Acceptance

- `forge test --match-path test/diff/*` passes.
- Differential checks cover at least:
  - `NAV/PF/XP/R` exact relationships
  - XP bucket transitions (unlock/sync/claim)
  - request lifecycle (refund/finalize => cleared)
- Nightly run: ≥ 5,000 steps with no flake across 10 seeds.

## Consequences

- Higher assurance: catches bugs that invariants alone may miss.
- Increased test complexity and runtime; requires disciplined mirror maintenance.
- Forces explicit rounding and conservation semantics to be unambiguous.

## Alternatives considered

1. **Only invariants**: cheaper, but misses drift bugs.
2. **Formal verification (Scribble/Certora)**: high value, but higher setup cost; can be layered after
   the reference model stabilizes.

## Links

- Executable SSOT: `docs/constitution/ExecutableSSOT.v1.0.md` (Proof Gates, A/B/C/D/E/P)
- Invariant harness: `test/invariants/*`
