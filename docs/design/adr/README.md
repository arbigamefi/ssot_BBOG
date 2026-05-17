# ADR Index — Frontend

Architecture Decision Records for the ArbiGameFi frontend. Numbering is
monotonic across the directory. See
[`../../frontend/31-governance.md §2`](../../frontend/31-governance.md) for the
ADR process.

| ID                                                              | Title                                         | Status   | Date       |
| --------------------------------------------------------------- | --------------------------------------------- | -------- | ---------- |
| [0000](./0000-template.md)                                      | Template                                      | n/a      | 2026-05-14 |
| [0001](./0001-no-per-game-color-family.md)                      | No per-game brand color family                | Accepted | 2026-05-14 |
| [0002](./0002-prototype-routes-out-of-production-app-router.md) | Prototype routes out of production App Router | Accepted | 2026-05-14 |
| [0003](./0003-single-design-token-source.md)                    | Single design-token source                    | Accepted | 2026-05-14 |
| [0004](./0004-no-subgraph-for-mvp-indexing.md)                  | No subgraph for MVP indexing                  | Accepted | 2026-05-17 |
| [0005](./0005-postgres-durable-bet-index.md)                    | Postgres durable bet index                    | Accepted | 2026-05-17 |

## Conventions

- ADRs are numbered 4-digit, monotonic.
- Once `Status: Accepted`, an ADR is never edited substantively; supersede
  it with a new ADR instead.
- Each ADR lists the SSOT documents it affects so reviewers can see
  downstream impact.
- Each ADR includes Acceptance Criteria checkable from `main`.
