# ADR-0005: Referral liabilities as XP buckets; permissionless unlock + rolling linear vesting

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

Referral systems introduce long-lived liabilities. They must not be treated as LP backing and must not block settlement.

## Decision

Model referral liabilities as XP buckets (accrued/locked/holdback). Unlock and vesting are permissionless bucket moves. Holdback uses rolling linear vesting (O(1) per payee) to avoid tranche explosion.

## Consequences

- Settlement never depends on referral transfers.
- XP is auditable and included in NAV identity.
- Permissionless mechanics improve liveness.
- Rolling vesting is scalable and deterministic.

## Alternatives considered

- Per-bet tranche vesting (unbounded storage growth).
- Admin-controlled holdback release.
Rejected due to scalability and proof requirements.
