# ADR-0003: Hub is the only bet authority (Bank trusts only Hub)

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

Allowing many game contracts to call Bank increases the authorization surface and complicates proof and audit.

## Decision

Bank exposes bet funds API only to a single Hub address. Hub is the SSOT for bet lifecycle and is the only component allowed to call hold/settle/refund.

## Consequences

- Minimizes access control complexity.
- Enforces a single betId namespace.
- Makes invariants easier to prove and maintain.

## Alternatives considered

- Granting GAME_ROLE to multiple game contracts.
- Per-game Bank adapters.
Rejected due to larger attack surface and betId namespace issues.
