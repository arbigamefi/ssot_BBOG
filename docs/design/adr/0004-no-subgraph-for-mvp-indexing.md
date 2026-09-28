# ADR-0004 · No Subgraph For Shared Indexing

| Status | Accepted |
| Date | 2026-05-17 |
| Owner | Frontend Lead + Protocol Lead |
| Reviewers | Product Lead |
| Supersedes | None |
| Superseded by | None |
| Affects | `docs/design/durable-bet-index.md`, `docs/design/14-data-and-state.md`, `frontend/apps/keeper/README.md` |

## 1. Context

The frontend needs shared recent-bet data for the home page and casino room
feeds. The repository has no The Graph subgraph implementation: no
`subgraph.yaml`, GraphQL schema, mapping handlers, or `@graphprotocol/*`
dependency.

The existing `@ssot/ssot/indexer` is a browser-local Dexie replay indexer. It is
good for user-verifiable local history, but it cannot represent a global feed
until each browser has replayed the relevant chain window.

The shared API uses the Postgres index described in
[ADR-0005](./0005-postgres-durable-bet-index.md), with bounded RPC aggregation
available when durable reads are disabled or unavailable.

## 2. Decision

Use the existing API, durable Postgres index, and RPC read paths for shared
casino/sportsbook indexing, without a The Graph subgraph.

## 3. Rationale

- Current query shapes are simple: recent bets, by-game feeds, by-player
  activity, and terminal proof lookup.
- Shared recent-feed needs can be served with RPC log aggregation and short
  server cache.
- Browser-local Dexie replay should remain as a verification layer, not as the
  source for global product feeds.
- Introducing GraphQL schemas and subgraph deployment before complex query
  requirements exist would add operating cost without improving protocol
  truth.
- Result amounts come from terminal contract state; transaction receipts supply
  payment evidence, as defined in [ADR-0006](./0006-casino-terminal-receipt-view.md).

## 4. Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
| --- | --- | --- | --- |
| The Graph subgraph | familiar indexed GraphQL API, third-party queryability | new schema, deployment, lag, fallback, and network/self-hosting operations | overbuilt for current query shapes |
| Browser Dexie only | already implemented, replayable | not global, cold-start dependent, inconsistent across devices | cannot power product-wide feeds |
| Next.js API + short cache | small surface, uses existing RPC/release facts | cache is not durable across serverless instances | bounded RPC read path |
| Keeper-backed Postgres index | shared durable event ledger and feeds | database initialization and operations | adopted in ADR-0005 |

## 5. Consequences

Positive:

- No separate subgraph service to operate.
- No new third-party trust layer for settlement-facing UI.
- Shared feeds reuse the existing API and index package.

Negative:

- Serverless in-memory cache is not durable.
- Durable history requires Postgres availability and complete index coverage.

Neutral:

- The browser indexer remains in place for local verification.
- A future subgraph remains possible if query volume or third-party API needs
  justify it.

## 6. Current Implementation

- `/api/bets/recent` and `/api/bets/player/[address]` provide shared feeds.
- Keeper ingestion and public-read backfill populate the Postgres index.
- API reads use the configured durable store with bounded RPC aggregation as
  their fallback. Browser-local Dexie replay provides an additional local view.
- Index freshness and coverage remain explicit; cache availability does not
  establish settlement or payment completion.

## 7. SSOT Documents Affected

- [Durable bet index](../durable-bet-index.md) — event storage and shared read paths.
- `docs/design/14-data-and-state.md` — should treat "indexer subgraph" as an
  optional source, not a required source.
- [Keeper](../../../frontend/apps/keeper/README.md) — durable aggregation reuses
  the keeper event stream.

## 8. Acceptance Criteria

- Shared recent and player feeds work independently of browser-local history.
- Durable-read failures preserve the documented bounded RPC behavior.
- Portfolio activity can combine API rows with local replay rows.
- Current Postgres schema initialization follows ADR-0005.
- Missing terminal or payment evidence remains explicit under ADR-0006.

## 9. References

- [Shared recent-bet reads](../../../frontend/apps/web/src/server/betting/recent-bets.ts)
- [Durable store implementation](../../../frontend/packages/bet-index/src/index.ts)
