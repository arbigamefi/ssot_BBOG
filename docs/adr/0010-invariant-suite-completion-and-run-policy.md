# ADR-0010: Invariant Suite Completion and Run Policy

- **Status:** Accepted
- **Date:** 2026-01-09

## Context

The protocol is built around an **Executable SSOT**: a set of invariants that MUST hold under
arbitrary, adversarial sequences of actions.

We already have a strong baseline (A/B4/C1/C2/D1/E1/P1), but several institution-grade guarantees
must be enforced mechanically to avoid “hand-wavy” correctness:

- **D2**: no privileged backdoor can extract `ASSET` in a way that violates solvency
- **E2**: XP bucket moves preserve XP_total (unlock/sync are internal moves, not outflows)
- **E3**: claims are optional outflows and MUST obey the optional-outflow domain and pause gates
- **B3**: settlement is bounded by `reserved` and `payoutNet <= payoutGross`
- **P3**: budgets are bounded and conserved (no “leaking” between buckets)

In addition, “it passes once” is not a proof. We need a **run policy** (PR vs nightly) that creates a
stable, repeatable bar.

## Decision

### Invariant completion scope

We will extend the Foundry invariant suite to include the missing hard guarantees:

1. **D2 — No backdoor on ASSET**
   - Any privileged function that can move tokens MUST NOT be able to move `ASSET` in a way that
     violates A3/A4.
   - Emergency recovery is limited to non-`ASSET` tokens or explicitly allowed buckets.

2. **E2 — XP bucket move conservation**
   - `unlockXPLocked` and `syncXPHoldback` MUST preserve `XP_total`.

3. **E3 — Claims are optional outflows**
   - Claim is blocked by `riskInPaused`.
   - Claim MUST satisfy optional-outflow domain A4.

4. **B3 — Bounded settlement**
   - `payoutGross + refundAmount <= reserved`
   - `payoutNet <= payoutGross`
   - Checked both in Bank (hard) and as an invariant across the handler’s active bet set.

5. **P3 — Budget bounds and conservation**
   - `baseBudget <= baseHEAmt` and `deltaBudget <= deltaHEAmt`
   - `protocolFeeAccrual` equals the sum of non-budget + sink amounts (by construction)

### Run policy (Proof Gates)

We define the following **gates**:

- **PR gate (fast):**
  - unit tests
  - invariants with ~256 runs / ~128k calls (default)
  - diff tests (ADR-0009) with small step counts

- **Nightly gate (deep):**
  - invariants with ≥ 5,000 runs (or equivalent calls)
  - diff tests with ≥ 5,000 steps across multiple seeds

Any flake is treated as a bug: either the protocol is wrong, the harness is wrong, or assumptions
are missing from SSOT.

## Implementation plan (PR-sized)

1. Add missing invariant functions in `test/invariants/Invariants.t.sol`:
   - `invariant_B3_bounded_settlement()`
   - `invariant_E2_bucket_moves_preserve_XP_total()`
   - `invariant_E3_claim_is_optional_outflow_and_pause_gated()`
   - `invariant_D2_no_asset_backdoor()`
   - `invariant_P3_budget_bounds_and_conservation()`

2. Extend `Handler`:
   - track per-bet `payoutGross/payoutNet/refund` outcomes for B3
   - track XP_total deltas before/after unlock/sync for E2
   - record whether pause has ever been successfully toggled and validate behavior under paused
     sequences (avoid dead-code coverage)

3. Add CI config:
   - PR: invariants default runs
   - nightly: invariants high runs + multiple seeds

## Acceptance

- `forge test --match-path test/invariants/*` passes reliably.
- New invariants (D2/E2/E3/B3/P3) pass in PR gate and nightly gate.
- Paused and unpaused states are both exercised in invariants (no “always revert” pause actions).

## Consequences

- Stronger, mechanically enforced guarantees.
- Higher CI runtime cost; mitigated by splitting PR vs nightly.

## Alternatives considered

1. Only unit tests: insufficient coverage of adversarial interleavings.
2. Only nightly invariants: PR feedback loop becomes too slow.

## Links

- Executable SSOT: `docs/constitution/ExecutableSSOT.v1.0.md`
- Invariants map: `docs/audit/invariants-map.md`