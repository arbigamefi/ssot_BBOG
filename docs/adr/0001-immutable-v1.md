# ADR-0001: Immutable v1.0 (no upgrades)

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

Upgradability increases the proof surface area: correctness depends on governance and upgrade processes, not only code.

## Decision

v1.0 is deployed as immutable contracts (no upgrade hooks). Configuration is limited to parameter setting (fees, thresholds, pause) and game registration.

## Consequences

- Stronger auditability and a smaller TCB.
- Changes require redeploy + migration.
- Governance powers are narrower and easier to reason about.

## Alternatives considered

- Proxy/upgrade patterns with timelock.
- Upgradeable beacons per module.
These were rejected for v1.0 to reduce complexity.
