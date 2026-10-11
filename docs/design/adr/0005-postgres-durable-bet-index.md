# ADR-0005 · Postgres Durable Bet Index

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

| Status | Accepted |
| Date | 2026-05-17 |
| Owner | Frontend Lead + SRE |
| Reviewers | Protocol Lead |
| Supersedes | None |
| Superseded by | None |
| Affects | `docs/design/durable-bet-index.md`, `frontend/apps/keeper/README.md` |

## 1. Context

[ADR-0004](./0004-no-subgraph-for-mvp-indexing.md) keeps shared feeds independent
of a The Graph subgraph. RPC-window API aggregation alone is not durable:
each server instance must replay logs and cache in memory. Keeper and web API
processes therefore share a durable event store.

## 2. Decision

Use Postgres for durable indexed events, folded bet rows, and recovery cursors.
Initialize a fresh database with the current `BetIndexStore.initializeSchema()`;
the database must use the current schema.

## 3. Rationale

- The core data is a relational event ledger plus a folded `bets` table.
- Reads need indexes by `player`, `gameId`, `updatedBlock`, and `state`.
- Keeper and web API may run as separate processes or instances, so local
  SQLite files are not a durable deployment boundary.
- Redis is useful for cache and queues, but it is not the right canonical
  history store for replayable ledger data.
- Postgres supports idempotent ingestion, backups, and relational queries
  without introducing a subgraph.

## 4. Alternatives Considered

| Alternative | Pros                                                                   | Cons                                                                  | Why not chosen                   |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------- |
| SQLite      | simple, file-based, excellent local dev                                | hard to share across web and keeper deployments; backup/HA story weak | local/dev only                   |
| Redis       | fast cache, pub/sub, queues                                            | awkward for historical ledger queries and durable audit recovery      | optional acceleration layer only |
| Postgres    | durable relational indexes, shared by processes, mature backup/restore | requires DB provisioning and connection management                    | best production tradeoff         |

## 5. Consequences

Positive:

- Stable source for `/api/bets/recent` and `/api/bets/player/[address]`.
- Lower RPC load once seeded.
- Replayable recovery from raw events.

Negative:

- Adds a production database dependency.
- Requires fresh-schema initialization and connection-string management.

Neutral:

- Browser Dexie replay stays as the user-verifiable layer.
- API routes keep RPC-window fallback for cold start and outages.

## 6. Fresh Schema Initialization

`@ssot/bet-index` defines the current tables and indexes in
`BET_INDEX_SCHEMA_SQL`. The Postgres `initializeSchema()` implementation runs
that SQL inside a transaction protected by `pg_advisory_xact_lock`, serializing
concurrent initialization calls. `CREATE ... IF NOT EXISTS` permits repeated
initialization of the same current schema; it does not convert older tables.

Keeper ingestion remains controlled by `BET_INDEX_WRITE_ENABLED`, and API reads
by `BET_INDEX_READ_ENABLED`. Configure a fresh database, initialize the current
schema, and seed it through the existing event backfill. Index availability must
not become a dependency of casino settlement.

## 7. SSOT Documents Affected

- [Durable bet index](../durable-bet-index.md) — event and row contract.
- [Keeper](../../../frontend/apps/keeper/README.md) — optional index writes and
  fresh schema initialization.

## 8. Acceptance Criteria

- Fresh initialization creates the current event, bet, per-NFT Vault cash-ledger/ownership, bet-recovery and
  cursor tables and indexes. Bet recovery means missed or unresolved lifecycle work; no LP
  redemption batch, historical recovery entitlement or compatibility schema is retained.
  Vault/deposit identity and payer/current-owner/recipient roles are distinct; ERC-721 Transfer
  changes ownership but is not asset cashflow. Reorg replay replaces both cash and ownership facts.
- Repeated and concurrent `initializeSchema()` calls preserve the current schema.
- Keeper index writes remain optional; callback settlement and public retry do not depend on them.
- Web API reads can fall back to RPC-window aggregation.
- Backfill uses public chain reads and does not require a keeper signing key.

Same-transaction RandomReady/terminal logs, out-of-order subscriptions and HTTP replay must
converge without regressing terminal state or double-counting a receipt. Actual RPC logIndex
identifies indexed events; a receipt-array position only delimits payment evidence. These are
implementation acceptance criteria, not a claim of deployment or database verification.

## 9. References

- [Store and schema implementation](../../../frontend/packages/bet-index/src/index.ts)
- [Schema coverage](../../../frontend/packages/bet-index/src/schema.test.ts)
- [Concurrent initialization coverage](../../../frontend/packages/bet-index/src/recovery.postgres.test.ts)
