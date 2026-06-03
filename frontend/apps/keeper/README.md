# Casino Keeper

Permissionless casino settlement worker for v1.3 `GameHub.finalize(betId)`.

Normal player UX signs only approval and `placeBet`. This worker listens for
`RandomReady` bets and settles them automatically.

## Build

```bash
pnpm -C frontend keeper:build
```

## Run

Start from `frontend/deploy/casino-keeper/primary.env.example` or
`frontend/deploy/casino-keeper/backup.env.example`, copy it to a local
gitignored file in that same directory, and fill in the real values. The local
wrappers read only `frontend/deploy/casino-keeper/${KEEPER_ENV_FILE:-primary.env}`;
they do not read repo-root `.env`, frontend web `.env.local`, or legacy sports
env files.

For local Base Sepolia development, this starts Next.js and the keeper together,
writes the health snapshot, and lets the casino room auto-settle after VRF
fulfills:

```bash
pnpm -C frontend dev:with-keeper -- --port 3002
```

The local wrapper writes chain-specific health snapshots under
`frontend/.runtime/` unless `KEEPER_HEALTH_PATH` is explicitly provided in the
shell. This keeps local status checks aligned with the production multi-chain
layout.

For local multi-chain health checks, run both the Base mainnet and Base Sepolia
primary keepers next to the web app:

```bash
pnpm -C frontend dev:with-keepers -- --port 3002
```

This uses `primary.base-mainnet.env` for chain `8453` and `primary.env` for
chain `84532`. Each keeper writes a chain-specific snapshot:

```text
frontend/.runtime/casino-keeper-health-8453.json
frontend/.runtime/casino-keeper-health-84532.json
```

The web app receives matching `KEEPER_HEALTH_PATH_8453` and
`KEEPER_HEALTH_PATH_84532` values, so `/status?chainId=8453` and
`/status?chainId=84532` report the actual keeper for each chain. The single
`dev:with-keeper` command remains useful when you only want the default Base
Sepolia keeper.

The dev wrapper resolves relative keeper paths from the repo root and derives
`KEEPER_START_BLOCK` from the current chain head when it is not set, rewinding
2,000 blocks by default. Override with `KEEPER_DEV_REWIND_BLOCKS` or an explicit
`KEEPER_START_BLOCK` when you need a longer catch-up window.

Keeper-only local run:

```bash
pnpm -C frontend keeper:dev
```

Keeper-only multi-chain local run:

```bash
pnpm -C frontend keeper:dev:all
```

Use another deploy env file by selecting a file inside
`frontend/deploy/casino-keeper/`:

```bash
KEEPER_ENV_FILE=backup.env pnpm -C frontend keeper:dev
```

Use a custom multi-keeper list by selecting comma-separated files inside
`frontend/deploy/casino-keeper/`:

```bash
KEEPER_ENV_FILES=primary.base-mainnet.env,primary.env pnpm -C frontend keeper:dev:all
```

Backup instance:

```bash
KEEPER_ENV_FILE=backup.env pnpm -C frontend keeper:dev
```

## Production

Production deployment templates live in:

```text
frontend/deploy/casino-keeper/
```

Use `arbigamefi-casino-keeper@.service` with separate `primary.env` and
`backup.env` files. The full procedure is documented in:

```text
docs/ops/runbooks/casino-keeper-production.md
```

Local wrappers use the same deploy-env boundary: they read only
`frontend/deploy/casino-keeper/${KEEPER_ENV_FILE:-primary.env}` and do not fall
back to repo-root `.env` or `apps/web/.env.local`.

Primary and backup should run on different hosts or regions, with different
keeper EOAs and RPC providers. Build before starting the systemd unit:

```bash
pnpm -C frontend install --frozen-lockfile
pnpm -C frontend keeper:build
pnpm -C frontend/apps/keeper test
```

The keeper always re-reads `getBet(betId)` before broadcasting and only calls
`finalize` when the bet state is `RandomReady`.

Sportsbook automatic terminalization is opt-in:

Set `KEEPER_SPORTS_TERMINALIZER_ENABLED=true` and the sports scan limits in the
selected deploy env file only after the sportsbook Phase 2 packet records GO.

When enabled and the active release exposes `SportsHub`, the keeper listens for
`ResultProposed`, `ResultFinalized`, `MarketVoided`, and challenge resolution
events. It waits until result finality, calls `SportsHub.finalizeResult`, then
settles held tickets for resolved markets or refunds held tickets for voided
markets. Every write is simulated first; player-side ticket actions remain a
fallback path.

Held ticket discovery is Postgres-first. If the durable bet index has not
backfilled a market yet, the keeper falls back to a bounded `nextTicketId` /
`getTicket` enumeration, then to a last-resort `TicketPlaced` log scan. Use
`KEEPER_SPORTS_TERMINALIZER_MARKET_IDS=1,2` only for recovery or canary replay
when an already-terminal market must be processed at startup.

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

## Local Postgres

Use Docker Compose for local durable index development:

```bash
pnpm -C frontend bet-index:db:up
```

The default local connection string is:

```text
postgres://arbigamefi:arbigamefi_dev_only@127.0.0.1:54329/arbigamefi
```

Run a no-risk one-block write canary against the local database:

```bash
BET_INDEX_FROM_BLOCK=1 \
BET_INDEX_TO_BLOCK=1 \
pnpm -C frontend bet-index:backfill:local
```

Operational commands:

```bash
pnpm -C frontend bet-index:db:ps
pnpm -C frontend bet-index:db:logs
pnpm -C frontend bet-index:db:down
pnpm -C frontend bet-index:db:reset
```

Compose is for local development and staging canaries. For mainnet production,
prefer managed Postgres with backups, point-in-time restore, disk monitoring,
and upgrade automation. A self-hosted Docker Postgres is only acceptable if
those controls are explicitly owned and tested.

One-shot durable index backfill or canary run:

```bash
KEEPER_ENV_FILE=primary.base-mainnet.env \
BET_INDEX_DATABASE_URL=postgres://... \
BET_INDEX_FROM_BLOCK=41562978 \
BET_INDEX_TO_BLOCK=41570000 \
pnpm -C frontend keeper:backfill
```

Show the no-side-effect usage summary:

```bash
pnpm -C frontend keeper:backfill --help
```

The wrapper reads the selected file in `frontend/deploy/casino-keeper/`, builds
the keeper, scans `BetPlaced`, `BetRandomReady`, `BetFinalized`, and
`BetRefunded`, writes idempotent rows, and prints a JSON summary with the block
range and recent rows. Use
`BET_INDEX_DRY_RUN=true` to verify RPC/event access without writing Postgres.

`KEEPER_SCAN_CHUNK_BLOCKS` defaults to `10` so Base Sepolia free RPC providers
with tight `eth_getLogs` range limits can still catch delayed events. Increase it
only for providers with a documented larger logs range.

When `KEEPER_HEALTH_PATH` is set, the keeper writes an atomic JSON health
snapshot with queue depth, last scan, and last finalize success/failure. The
local web app reads that file through the route
`/ops/casino-keeper-health.json`, so the health file must stay outside
`apps/web/public` to avoid a public-file / route conflict.
