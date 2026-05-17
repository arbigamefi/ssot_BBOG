# ADR-0005 · Postgres Durable Bet Index

| Status | Accepted |
| Date | 2026-05-17 |
| Owner | Frontend Lead + SRE |
| Reviewers | Protocol Lead |
| Supersedes | None |
| Superseded by | None |
| Affects | `docs/design/indexing-strategy.md`, `docs/design/durable-bet-index.md`, `docs/frontend/casino-keeper-v1.md` |

## 1. Context

ADR-0004 rejected a The Graph subgraph for MVP indexing and shipped lightweight
RPC-window API routes for recent and player bet feeds. Those routes are useful
but not durable: each server instance must replay recent logs and cache in
memory.

The next phase needs a durable store shared by keeper and web API processes.
The candidate stores are SQLite, Redis, and Postgres.

## 2. Decision

We will use Postgres as the production durable store for indexed casino bet
events and folded bet rows.

## 3. Rationale

- The core data is a relational event ledger plus a folded `bets` table.
- Reads need indexes by `player`, `gameId`, `updatedBlock`, and `state`.
- Keeper and web API may run as separate processes or instances, so local
  SQLite files are not a durable deployment boundary.
- Redis is useful for cache and queues, but it is not the right canonical
  history store for replayable ledger data.
- Postgres supports idempotent ingestion, backups, migrations, and future
  analytics without introducing a subgraph.

## 4. Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
| --- | --- | --- | --- |
| SQLite | simple, file-based, excellent local dev | hard to share across web and keeper deployments; backup/HA story weak | local/dev only |
| Redis | fast cache, pub/sub, queues | awkward for historical ledger queries and durable audit recovery | optional acceleration layer only |
| Postgres | durable relational indexes, shared by processes, mature backup/restore | requires DB provisioning and migrations | best production tradeoff |

## 5. Consequences

Positive:

- Stable source for `/api/bets/recent` and `/api/bets/player/[address]`.
- Lower RPC load once seeded.
- Replayable recovery from raw events.

Negative:

- Adds a production database dependency.
- Requires migration and connection-string management.

Neutral:

- Browser Dexie replay stays as the user-verifiable layer.
- API routes keep RPC-window fallback for cold start and outages.

## 6. Migration / Rollout Plan

1. Add `docs/design/durable-bet-index.md`.
2. Add a Node-only `@ssot/bet-index` package with schema and store adapters.
3. Add optional keeper ingestion controlled by `BET_INDEX_WRITE_ENABLED`.
4. Add optional API reads controlled by `BET_INDEX_READ_ENABLED`.
5. Run Base Sepolia canary with DB enabled before mainnet.

## 7. SSOT Documents Affected

- `docs/design/indexing-strategy.md` — Phase 3 now names Postgres.
- `docs/design/durable-bet-index.md` — new durable index contract.
- `docs/frontend/casino-keeper-v1.md` — keeper may write index telemetry but
  settlement must not depend on it.

## 8. Acceptance Criteria

- [x] Postgres selection documented.
- [x] `@ssot/bet-index` package implemented and tested.
- [x] Keeper write path is optional and does not block finalize.
- [x] Web API read path falls back to RPC-window aggregation.
- [ ] Canaried on Base Sepolia before mainnet.

## 9. References

- ADR-0004: `./0004-no-subgraph-for-mvp-indexing.md`
- Durable strategy: `../durable-bet-index.md`
