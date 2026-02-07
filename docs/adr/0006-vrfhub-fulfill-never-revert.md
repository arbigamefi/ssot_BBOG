# ADR-0006: VRFHub fulfill never reverts (soft-ignore + try/catch)

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

VRF coordinators call fulfill; if fulfill reverts, the callback can be bricked and bets can become unresolvable.

## Decision

VRFHub must never revert on fulfill. Unknown or detached requestIds are soft-ignored. Hub callback is executed via try/catch; failures are recorded as events/counters without reverting.

## Consequences

- Prevents callback bricking.
- Enables robust liveness guarantees.
- Requires observability to detect callback failures.

## Alternatives considered

- Reverting on any invalid requestId.
Rejected because it can brick VRF fulfillment and violate liveness.
