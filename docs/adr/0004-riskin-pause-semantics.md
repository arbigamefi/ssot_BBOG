# ADR-0004: Risk-in pause semantics (freeze risk-in + optional outflows)

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

Emergency mechanisms must stop new risk and optional withdrawals, but must not break settlement/refund liveness.

## Decision

Implement a Risk-In pause that blocks new bets and optional outflows (LP withdraw/redeem, claims, fee withdrawals), while keeping debt-out operations live (finalize/refund).

## Consequences

- Prevents 'pause-to-default' failure modes.
- Ensures accepted obligations can be discharged.
- Requires careful classification of functions by risk-in / debt-out / optional outflow.

## Alternatives considered

- Global pause that blocks everything.
Rejected because it can brick settlement and violate liveness.
