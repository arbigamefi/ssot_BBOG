# 14 · Data & State Architecture

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `13-web3-ux.md`, `durable-bet-index.md`, `indexing-strategy.md` |
| Supersedes | Draft v1 data platform spec |

Data architecture should keep truth simple: contracts are truth, release
metadata is configuration truth, indexes are acceleration.

## 1. Truth Hierarchy

| Source               | Role                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| Contracts            | Authoritative balances, bets, tickets, settlements, and payouts.               |
| Release manifest     | Authoritative addresses, game ids, asset metadata, decimals, and chain config. |
| `@ssot/ssot`         | Typed contract/read/write helpers and event reducers.                          |
| Durable bet index    | Postgres read model for recent/player bet feeds.                               |
| Browser Dexie replay | User-verifiable local replay and activity cache.                               |
| TanStack Query       | UI cache only.                                                                 |

Never use an index row as final proof when a direct chain read or terminal log
is required.

## 2. Runtime Boundaries

Keep these boundaries because they represent real runtimes:

- `frontend/apps/web`: Next.js UI and API routes.
- `frontend/apps/keeper`: casino settlement keeper and index writer.
- `frontend/packages/ssot`: release, SDK, encoding, and reducers.
- `frontend/packages/bet-index`: Node-only Postgres read model shared by web
  API routes and keeper/backfill.

Do not collapse these packages only to reduce file count.

## 3. Server And Client

Server code may:

- read release files;
- query Postgres bet-index;
- scan bounded RPC windows as fallback;
- call SDK read helpers.

Client code may:

- render wallet state;
- run feature hooks;
- poll direct chain state for active casino rounds;
- read browser-local preferences or Dexie caches.

Client components must not import `@ssot/bet-index`, database URLs, filesystem
helpers, or private RPC/keeper secrets.

## 4. Query Keys

TanStack keys are tuples:

```text
["ssot", "release"]
["ssot", "bets", "recent", { chainId, gameId, limit }]
["ssot", "bets", "player", { chainId, player, limit }]
["ssot", "casino", "round", betId]
["ssot", "sportsbook", "market", marketId]
```

Rules:

- first segment is always `ssot`;
- scope objects use stable property names;
- pages should use feature hooks, not inline query definitions;
- terminal query data can become effectively static after finality.

## 5. Recent And Player Bets

Recent bet feeds use:

1. `/api/bets/recent`;
2. `/api/bets/player/[address]`;
3. Postgres when `BET_INDEX_DATABASE_URL` is configured and readable;
4. bounded RPC-window fallback when Postgres is unavailable.

The API response must expose source/degraded information so UI and ops can tell
whether data came from Postgres or fallback.

## 6. Active Casino Round

Active rounds prioritize direct chain reads:

- poll `GameHub.getBet(betId)` for round state;
- detect `RandomReady`, `Settled`, refundability, and missing bet separately;
- show final receipt only after terminal readback;
- refetch recent feeds after terminal state, but do not wait on them to show
  the player result.

This avoids the previous failure mode where settlement was complete on-chain
but the UI waited minutes for list/index data.

## 7. Invalidation

After mined writes:

- approval: refresh allowance and balance;
- place bet: refresh active round, recent feeds, player activity, balances;
- finalize/refund: refresh active round first, then recent feeds and balances;
- deposit/withdraw: refresh bank snapshot, position, balance;
- claim: refresh claimable state and activity.

Prefer targeted invalidation over global query clearing.

## 8. Local State

Use local component state for:

- open panels;
- selected tab;
- casino stage animation state;
- temporary form input strings.

Use URL state only when users should be able to share or return to it:

- sportsbook market id;
- list filter;
- pagination cursor.

Use persisted local storage only for preferences and safe drafts. Never store
secrets, signatures, private keys, approval payloads, or stale odds.

## 9. Indexing Strategy

Do not introduce a subgraph for MVP indexing. Current query shapes are recent
feeds, player feeds, and terminal receipts; Postgres plus bounded RPC fallback
covers those needs with less operational surface.

Postgres details live in `durable-bet-index.md`. This document only defines how
the UI consumes that read model.

## 10. Errors And Degradation

Data hooks return explicit degraded state when possible:

- `source: "postgres" | "rpc-window"`;
- `degraded: boolean`;
- `lastIndexedBlock` or equivalent when available;
- stable product error message.

Player UI should keep working when the index is down. Ops UI should surface the
failure clearly.

## 11. Do Not Do

- Do not fetch with ad-hoc `useEffect` when a query hook is appropriate.
- Do not import database packages into client components.
- Do not expose `BET_INDEX_DATABASE_URL` or private RPC URLs to the browser.
- Do not use recent-feed lag as final-result state.
- Do not infer token decimals from ERC-20 calls when release metadata exists.
- Do not add WebSocket/SSE infrastructure before polling and API cache fail real
  usage needs.

## 12. Verification

```bash
rg -nE "BET_INDEX_DATABASE_URL|@ssot/bet-index" frontend/apps/web/src | rg -v "src/server|src/app/api"
rg -nE "useEffect\\(.*fetch|useEffect\\(.*axios" frontend/apps/web/src
rg -nE "queryKey:\\s*['\\\"]" frontend/apps/web/src
pnpm -C frontend test
```
