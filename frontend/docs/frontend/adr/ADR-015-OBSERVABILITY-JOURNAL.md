# ADR-015: Observability and Local Tx Journal

## Context
We need supportable, auditable user experiences ("why did my bet fail?", "which release was I on?") without relying on external logs.

## Decision
- Maintain a local **TxJournal** in IndexedDB with:
  - chainId, releaseDigest, actionType, txHash, createdAt
  - paramsSummary (safe)
  - simulateResult (ok/fail + DomainError code)
  - status (submitted/confirmed/failed)
- Report only **DomainError code** and coarse metadata to telemetry (e.g., Sentry).

## Alternatives
- No journal (rejected): support becomes guesswork.

## Consequences
We must define a stable schema early and keep it backwards compatible.

## Status
Accepted
