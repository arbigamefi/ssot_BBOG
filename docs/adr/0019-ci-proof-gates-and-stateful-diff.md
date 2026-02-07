# ADR-0019: CI proof gates tiers + stateful system-level diff

## Context

SSOT v1.1+ has:
- a strong invariant suite (A/B/C/D/E/P/X classes) that continuously checks safety and liveness properties
- module-level differential fuzz tests (e.g., CoinToss and Roulette) that detect semantic drift at the module boundary

As the codebase grows (multi-asset + multi-game + multi-roll + budgets), we need two additional properties:
1) A *system-level* differential test that validates end-to-end accounting deltas across Bank ↔ Hub ↔ modules ↔ referral logic.
2) A CI policy that provides fast feedback on PRs while keeping higher-coverage gates running regularly.

## Decision

1) Introduce a deterministic, stateful *system-level* diff test (`test/diff/StatefulSystemDiff.t.sol`) that:
   - executes realistic bet lifecycles across multiple assets and games
   - computes expected deltas using an independent reference accounting model for:
     - reserve changes (R)
     - fee-on-payout outcomes
     - referral budgets and XP bucket allocation (accrued/locked/holdback) incl. holdback vesting release
     - protocol fee accrual (PF)
     - player turnover updates
   - asserts that on-chain state matches the reference model after each lifecycle.

2) Split CI runs into two tiers:
   - PR-tier: `CI` workflow runs unit tests + diff tests + invariants with default coverage.
   - Nightly-tier: `Nightly Proof Gates` workflow runs the same suites with increased fuzz coverage.

## Consequences

- The system-level diff test provides a high-signal regression detector for cross-contract wiring mistakes that may not violate invariants immediately (or may be hard to localize).
- PR feedback remains fast; nightly runs raise coverage without slowing PR iteration.
- The reference model is intentionally limited to SSOT accounting and settlement effects; ERC4626 share math is out of scope and remains covered by unit tests.

## Alternatives considered

- Only invariants: rejected because invariants alone can miss cross-contract accounting regressions until a specific state is reached.
- Full formal verification first: deferred; the chosen approach provides practical, incremental proof gates that support institutional audits.

## References

- SSOT constitution: `docs/constitution/SSOT.v1.1.md`
- Executable SSOT: `docs/constitution/ExecutableSSOT.v1.1.md`
- Test: `test/diff/StatefulSystemDiff.t.sol`
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/nightly.yml`
