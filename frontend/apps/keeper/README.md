# Casino Keeper

Permissionless casino settlement worker for v1.3 `GameHub.finalize(betId)`.

Normal player UX signs only approval and `placeBet`. This worker listens for
`RandomReady` bets and settles them automatically.

## Build

```bash
pnpm -C frontend keeper:build
```

## Run

Start from `frontend/apps/keeper/.env.example` and keep the real file local.

For local Base Sepolia development, the repo root `.env` can be reused. This
starts Next.js and the keeper together, writes the health snapshot, and lets the
casino room auto-settle after VRF fulfills:

```bash
pnpm -C frontend dev:with-keeper -- --port 3002
```

The dev wrapper resolves relative keeper paths from the repo root and derives
`KEEPER_START_BLOCK` from the current chain head when it is not set, rewinding
2,000 blocks by default. Override with `KEEPER_DEV_REWIND_BLOCKS` or an explicit
`KEEPER_START_BLOCK` when you need a longer catch-up window.

Keeper-only local run:

```bash
pnpm -C frontend keeper:dev
```

```bash
KEEPER_PRIVATE_KEY=0x... \
KEEPER_CHAIN_ID=84532 \
KEEPER_RPC_HTTP=https://... \
KEEPER_RPC_WS=wss://... \
KEEPER_RELEASE_PATH=frontend/packages/ssot/src/release/embedded/chain-84532.json \
KEEPER_START_BLOCK=41562978 \
KEEPER_SCAN_CHUNK_BLOCKS=10 \
KEEPER_HEALTH_PATH=frontend/.runtime/casino-keeper-health.json \
pnpm -C frontend keeper:start
```

Backup instance:

```bash
KEEPER_ROLE=backup \
KEEPER_BACKUP_DELAY_SECONDS=5 \
pnpm -C frontend keeper:start
```

The keeper always re-reads `getBet(betId)` before broadcasting and only calls
`finalize` when the bet state is `RandomReady`.

Durable bet-feed indexing can be enabled with:

```bash
BET_INDEX_WRITE_ENABLED=true \
BET_INDEX_DATABASE_URL=postgres://... \
pnpm -C frontend keeper:start
```

When enabled, the keeper runs the Postgres migration, writes `GameHub` lifecycle
events, and resumes scan windows from the persisted `gamehub-events` cursor when
that cursor is ahead of `KEEPER_START_BLOCK`. Index writes are best-effort:
failures are logged and do not block `finalize`.

One-shot durable index backfill or canary run:

```bash
BET_INDEX_DATABASE_URL=postgres://... \
BET_INDEX_FROM_BLOCK=41562978 \
BET_INDEX_TO_BLOCK=41570000 \
pnpm -C frontend keeper:backfill
```

The wrapper reads the repo root `.env`, builds the keeper, scans `BetPlaced`,
`BetRandomReady`, `BetFinalized`, and `BetRefunded`, writes idempotent rows, and
prints a JSON summary with the block range and recent rows. Use
`BET_INDEX_DRY_RUN=true` to verify RPC/event access without writing Postgres.

`KEEPER_SCAN_CHUNK_BLOCKS` defaults to `10` so Base Sepolia free RPC providers
with tight `eth_getLogs` range limits can still catch delayed events. Increase it
only for providers with a documented larger logs range.

When `KEEPER_HEALTH_PATH` is set, the keeper writes an atomic JSON health
snapshot with queue depth, last scan, and last finalize success/failure. The
local web app reads that file through the route
`/ops/casino-keeper-health.json`, so the health file must stay outside
`apps/web/public` to avoid a public-file / route conflict.
