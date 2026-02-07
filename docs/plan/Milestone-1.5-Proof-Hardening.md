# Milestone 1.5 — Proof Hardening (Institution-grade)

This milestone turns the protocol into an institution-grade **proof-gated** system that auditors can
reason about mechanically:
- **Invariant suite** (A/B/C/D/E/P/X/LIVE classes)
- **Differential tests** (module-level + system-level)
- **CI gates** (PR vs Nightly)

## Entry criteria
- `forge test` passes.
- `forge test --match-path test/invariants/*` passes consistently under the PR profile.

## Exit criteria
- PR gate and Nightly gate are both implemented (Track D).
- Missing invariants (D2/E2/E3/B3/P3 + liveness) are implemented and stable.
- Reference diff tests exist and are stable.
- Multi-game expansion adds games without changing Bank/Hub/VRFHub trust surface.

## Track A — Differential Tests (ADR-0009 + ADR-0019)

**Goal:** catch silent drift bugs by checking observed outcomes against an independent mirror.

### A1. Module-level diffs
- Files:
  - `test/diff/DiffCoinToss.t.sol`
  - `test/diff/DiffRoulette.t.sol`
- Acceptance:
  - `forge test --match-path test/diff/Diff*.t.sol` passes.

### A2. System-level stateful diff
- File:
  - `test/diff/StatefulSystemDiff.t.sol`
- Model scope:
  - per-asset SSOT accounting (B/PF/XP/R/NAV)
  - fee-on-payout and refund/usedTurnover
  - referral budgets -> XP buckets + PF sinks
  - holdback vesting release (time warp)
  - risk-in rejection treated as **legal** (no model drift)
- Acceptance:
  - `forge test --match-path test/diff/StatefulSystemDiff.t.sol` passes.

## Track B — Invariant Suite Completion (ADR-0010)

**Goal:** enforce audit-critical guarantees continuously.

Implemented invariants (see `test/invariants/Invariants.t.sol`):
- A1/A2/A3/A4 (per-asset accounting + optional-outflow domain)
- B3/B4 (bounded settlement + reserve-sum)
- C1 (request mapping consistency)
- D2 (no ASSET backdoor)
- E2/E3 (XP bucket move conservation + claim pause gating)
- P3 (budget conservation)
- X1 (no cross-asset custody leakage)
- LIVE (debt-out must always succeed when ready)

## Track C — Multi-Game Expansion (ADR-0011)
- Dice, CoinToss, Roulette (typed+raw), Keno are implemented as **modules** under v1.1 semantics.

## Track D — CI Proof Gates (PR vs Nightly)
- `.github/workflows/ci.yml` uses `FOUNDRY_PROFILE=pr`
- `.github/workflows/nightly.yml` uses `FOUNDRY_PROFILE=nightly`
- Profiles are defined in `foundry.toml`.

## Deliverable checklist
- [x] Invariant suite completed (ADR-0010)
- [x] Module-level diffs (ADR-0009)
- [x] System-level stateful diff (ADR-0019)
- [x] CI gates (PR + nightly)
