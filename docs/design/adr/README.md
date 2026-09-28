# ADR Index — Frontend

Architecture Decision Records for the ArbiGameFi frontend. Numbering is
monotonic across the directory. Use the [template](./0000-template.md) and
the repository's [contribution rules](../../../CONTRIBUTING.md).

| ID                                                              | Title                                         | Status   | Date       |
| --------------------------------------------------------------- | --------------------------------------------- | -------- | ---------- |
| [0000](./0000-template.md)                                      | Template                                      | n/a      | 2026-05-14 |
| [0001](./0001-no-per-game-color-family.md)                      | No per-game brand color family                | Accepted | 2026-05-14 |
| [0003](./0003-single-design-token-source.md)                    | Single design-token source                    | Accepted | 2026-05-14 |
| [0004](./0004-no-subgraph-for-mvp-indexing.md)                  | No subgraph for shared indexing               | Accepted | 2026-05-17 |
| [0005](./0005-postgres-durable-bet-index.md)                    | Postgres durable bet index                    | Accepted | 2026-05-17 |
| [0006](./0006-casino-terminal-receipt-view.md)                  | Casino terminal receipt view                  | Accepted | 2026-05-17 |

## Conventions

- ADRs are numbered 4-digit, monotonic.
- Once `Status: Accepted`, an ADR is never edited substantively; supersede
  it with a new ADR instead.
- Each ADR lists the SSOT documents it affects so reviewers can see
  downstream impact.
- Each ADR includes Acceptance Criteria checkable from `main`.
