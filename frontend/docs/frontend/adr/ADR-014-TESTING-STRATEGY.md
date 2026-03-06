# ADR-014: Testing Strategy (Golden Vectors + Critical Paths)

## Context
The most expensive failures are silent mismatches between UI encoding and contract decoding (game params, stakeSpec), and regressions in transaction UX.

## Decision
- Use **Vitest** for unit tests in `@ssot/ssot` and `apps/web`.
- Add **golden vectors** (JSON fixtures produced by the contract repo) for:
  - game params encoding
  - stakeSpec encoding
  - custom error selectors (mapping tests)
- Add a minimal **Playwright** suite later for critical paths:
  - approve -> placeBet -> receipt -> event reconcile

## Alternatives
- No golden vectors (rejected): roundtrip tests cannot catch layout drift.

## Consequences
We need a stable `fixtures/` schema and a sync workflow to keep fixtures aligned with releases.

## Status
Accepted
