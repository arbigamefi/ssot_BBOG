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
Sports ticket indexing is also opt-in via `KEEPER_SPORTS_TICKET_INDEX_ENABLED`;
leave it `false` while the public sportsbook is disabled so the casino keeper
does not spend RPC budget scanning unused `SportsHub` ticket events.

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

LP provider ledger indexing is intentionally decoupled from the high-priority
GameHub scan. `KEEPER_BANK_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS` defaults to
`60`, so Bank `Deposit`/`Withdraw` rows remain durable without forcing every
casino settlement poll to also scan every Bank pool. Set it to `0` only when the
provider ledger is intentionally disabled.

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
only for providers with a documented larger logs range. Alchemy's free tier
rejects anything above 10 with `-32600`; public Base endpoints accept ~900.

`KEEPER_SCAN_MAX_CHUNKS_PER_PASS` defaults to `50` and bounds how much ground one
catch-up pass covers. Without it a cursor that has fallen far behind expands into
one provider request per chunk with no ceiling — a two-month gap at a 10-block
chunk size is ~750k `eth_getLogs` calls, which exhausts a monthly quota in days
and then keeps doing it after every quota reset.

A chunk is not one request. With `KEEPER_SCAN_INDEX_EVENTS_ENABLED=true` a
gamehub chunk costs five (`BetRandomReady`, then the four index events), and a
bank-ledger chunk costs one per configured pool, so budget accordingly.

At the 10-block chunk size a 300s pass needs only ~15 chunks to keep pace with
Base's 2s blocks, so the default leaves roughly 3x headroom and still drains a
short outage quickly. When a pass is capped the keeper logs
`casino.keeper.scan_capped` with the remaining block count. Occasional entries
after a restart are normal; sustained capping means the backlog is too large to
grind through affordably, and the cheap fix is to fast-forward the cursor in
`indexer_cursors` rather than raise the cap.

`KEEPER_SPORTS_TICKET_SCAN_MAX_BLOCKS` defaults to `50000` and bounds the ticket
log fallback used when neither the bet index nor contract enumeration can find a
market's tickets. That fallback has no cursor — it rescans from
`KEEPER_SPORTS_TICKET_SCAN_START_BLOCK` (default: the release block) to the head
on every call, per market, retried up to 8 times — so its cost grows with the age
of the deployment. On Base mainnet the default start is already ~4.5M blocks back,
which is ~450k `eth_getLogs` per call at a 10-block chunk size.

Over the limit, discovery **refuses and throws** rather than scanning a narrower
window. That is deliberate: the terminalizer settles and refunds exactly the
tickets it is handed, and cannot tell a short list from a complete one, so a
partial result would mark the market terminal while leaving the tickets it missed
held forever. Throwing surfaces as a retryable failure instead, which recovers.
For the same reason a failed scan no longer returns what it collected before the
error.

If you hit the limit, the fix is `KEEPER_SPORTS_TICKET_INDEX_ENABLED=true` (the
index keeps a cursor) or moving the start block forward — not raising the bound.

For dedicated keeper RPC provider apps, set `KEEPER_RPC_MIN_INTERVAL_MS=250` in
each keeper env file. The keeper then serializes tracked in-process RPC calls
without adding seconds of avoidable settlement latency after a VRF callback. Use
`1000` to `2000` only when the keeper shares a severely constrained free-tier
RPC app with other traffic. This does not coordinate across separate keeper
processes or the web app, so production should still use separate provider
apps/keys for the browser API, mainnet keeper, and testnet keeper where possible.

When `KEEPER_HEALTH_PATH` is set, the keeper writes an atomic JSON health
snapshot with queue depth, last scan, last finalize success/failure, and RPC
usage counters for the current one-minute window plus process lifetime totals.
The local web app reads that file through the route
`/ops/casino-keeper-health.json`, so the health file must stay outside
`apps/web/public` to avoid a public-file / route conflict.
