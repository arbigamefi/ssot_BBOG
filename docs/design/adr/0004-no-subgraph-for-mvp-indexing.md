# ADR-0004 · No Subgraph For MVP Indexing

| Status | Accepted |
| Date | 2026-05-17 |
| Owner | Frontend Lead + Protocol Lead |
| Reviewers | Product Lead |
| Supersedes | None |
| Superseded by | None |
| Affects | `docs/design/indexing-strategy.md`, `docs/design/14-data-and-state.md`, `docs/frontend/casino-keeper-v1.md` |

## 1. Context

The frontend needs shared recent-bet data for the home page and casino room
feeds. The repository has no The Graph subgraph implementation: no
`subgraph.yaml`, GraphQL schema, mapping handlers, or `@graphprotocol/*`
dependency.

The existing `@ssot/ssot/indexer` is a browser-local Dexie replay indexer. It is
good for user-verifiable local history, but it cannot represent a global feed
until each browser has replayed the relevant chain window.

The Graph hosted service is no longer the default low-friction option. Current
subgraph deployment routes require The Graph Network or self-managed
infrastructure, which adds operational and schema-coupling cost.

## 2. Decision

We will not introduce a The Graph subgraph for MVP casino/sportsbook indexing.

## 3. Rationale

- Current query shapes are simple: recent bets, by-game feeds, by-player
  activity, and terminal proof lookup.
- Shared recent-feed needs can be served with RPC log aggregation and short
  server cache.
- Browser-local Dexie replay should remain as a verification layer, not as the
  source for global product feeds.
- Introducing GraphQL schemas and subgraph deployment before complex query
  requirements exist would increase migration cost without improving protocol
  truth.
- Result proof and critical settlement UI must remain chain-log backed.

## 4. Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
| --- | --- | --- | --- |
| The Graph subgraph | familiar indexed GraphQL API, third-party queryability | new schema, deployment, lag, fallback, and network/self-hosting operations | overbuilt for current query shapes |
| Browser Dexie only | already implemented, replayable | not global, cold-start dependent, inconsistent across devices | cannot power product-wide feeds |
| Next.js API + short cache | small surface, uses existing RPC/release facts | cache is not durable across serverless instances | best MVP tradeoff |
| Keeper-backed durable cache | production-friendly shared feed | needs storage choice and ops runbook | Phase 3 after API contract stabilizes |

## 5. Consequences

Positive:

- Fewer moving parts before mainnet.
- No new third-party trust layer for settlement-facing UI.
- Shared feeds can ship quickly and remain replaceable.

Negative:

- Serverless in-memory cache is not durable.
- Deep historical analytics will need a later storage layer.

Neutral:

- The browser indexer remains in place for local verification.
- A future subgraph remains possible if query volume or third-party API needs
  justify it.

## 6. Migration / Rollout Plan

1. Document the indexing strategy.
2. Add `/api/bets/recent`.
3. Switch home and casino recent feeds to the server API.
4. Add player activity API after the recent-feed contract stabilizes.
5. Evaluate keeper-backed SQLite/Redis/Postgres persistence before production.

## 7. SSOT Documents Affected

- `docs/design/indexing-strategy.md` — new strategy document.
- `docs/design/14-data-and-state.md` — should treat "indexer subgraph" as an
  optional source, not a required source.
- `docs/frontend/casino-keeper-v1.md` — future durable aggregation can reuse the
  keeper event stream.

## 8. Acceptance Criteria

- [x] Strategy document created.
- [x] ADR accepted.
- [x] `/api/bets/recent` implemented and tested.
- [x] Home/casino global feed no longer depends on browser-local `useBets`.
- [ ] Future persistent cache decision documented before mainnet.

## 9. References

- The Graph hosted service sunset: https://thegraph.com/blog/sunsetting-hosted-service/
- The Graph Post-Sunrise FAQ: https://thegraph.com/docs/sv/archived/sunrise/
