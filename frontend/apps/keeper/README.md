# Casino Keeper

Permissionless casino settlement worker for v1.5 `GameHub.finalize(betId)`.

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

Sports recovery requires `BET_INDEX_WRITE_ENABLED=true`, a reachable
`BET_INDEX_DATABASE_URL`, and a `sportsHub` address in the release. Missing
configuration or a failed database migration aborts startup before event watchers,
workers, or transactions start. Casino-only mode still supports running without
a database. This is an intentional change from the old database-free sports fallback.

The keeper adds `keeper_sports_work` and `keeper_sports_tickets` through the normal
idempotent migration. Both isolate data by chain and SportsHub. A bounded
`TicketPlaced` history scan builds the recovery ticket IDs independently of the
public `sport_tickets` feed. Each sports scanner keeps its own durable checkpoint
in `indexer_cursors`, keyed by SportsHub with sources
`sports-markets-v1:<start-block>` and `sports-tickets-v1:<start-block>`.
Changing the casino `KEEPER_START_BLOCK` or its cursor does not advance sports
coverage. Pending page checkpoints bind to the coverage origin and reset when it
is widened. Configure the same origin on primary and backup; a worker with a
narrower origin leaves wider-history work for the matching worker. Sports history starts at the release block by default; a configured
sports start must include that block. Widening the range starts a new coverage
checkpoint.

Market events are saved as pending work before advancing the event cursor.
Pending work survives restarts, RPC errors and more than eight failed attempts.
Settlement reads require complete ticket coverage through the durable market
event block (after ticket placement closes), rather than a moving chain head, and process at most `KEEPER_SPORTS_TERMINALIZER_MAX_TICKETS_PER_MARKET` IDs per page.
This setting is a page size, not a market total. The next page is retained as
work; already terminal tickets are skipped using their on-chain state. A crash
after a transaction but before its checkpoint therefore safely rereads the page.
Work is removed only after the last covered page completes. A stale worker cannot
acknowledge a newer job revision.

`KEEPER_SPORTS_TICKET_INDEX_ENABLED` separately enables the public sportsbook
feed's four event types on the independent history scanner. It is not required
for terminalization's recovery ID index. The old
`KEEPER_SPORTS_TICKET_ENUMERATION_MAX` is accepted for environment compatibility
but no longer supplies a recent-ID sample as a complete market list.
Use `KEEPER_SPORTS_TERMINALIZER_MARKET_IDS=1,2` for recovery when an already
terminal market must be queued at startup. It does not bypass coverage checks.

Durable bet-feed indexing can be enabled with:

```bash
BET_INDEX_WRITE_ENABLED=true \
BET_INDEX_DATABASE_URL=postgres://... \
pnpm -C frontend keeper:start
```

When enabled, the keeper runs the Postgres migration, writes `GameHub` lifecycle
events, and resumes scan windows from the persisted `gamehub-events` cursor when
that cursor is ahead of `KEEPER_START_BLOCK`. Index failures stop that scan before
its cursor advances, and the next pass retries the failed range. Ready casino bets
are queued before index writes, so an index outage does not suppress their
settlement. Websocket index errors are recovered by the historical scanner when
`KEEPER_SCAN_INDEX_EVENTS_ENABLED=true`. Existing gaps created by an older binary
still need an audited backfill; upgrading does not prove an old cursor's history.
Concurrent migrations take one transaction-scoped PostgreSQL advisory lock.

At startup and each scan, the keeper requeues up to 50 indexed `BetRandomReady`
IDs by chain and GameHub. A numeric keyset advances past stale or repeatedly
failing IDs and wraps at the end. This closes the crash window between persisting
a scan cursor and draining the in-memory settlement queue. If RPC scanning is
disabled, a database-only recovery pass runs every 300 seconds. Recorded terminal
events are excluded; any stale rows are checked against on-chain `getBet` before
writing. Durable recovery cannot recover events that were never indexed and were
already skipped by an older cursor.

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
bank-ledger chunk costs two per configured pool (`Deposit` and `Withdraw`),
plus block timestamp reads when needed. Sports recovery costs one ticket event
request per chunk, or four when the public ticket feed is enabled, plus four
market event requests. Budget each independent scanner accordingly.

At the 10-block chunk size a 300s pass needs only ~15 chunks to keep pace with
Base's 2s blocks, so the default leaves roughly 3x headroom and still drains a
short outage quickly. When a pass is capped the keeper logs
`casino.keeper.scan_capped` with the remaining block count. Occasional entries
after a restart are normal. Sustained capping requires a bounded recovery plan
with a provider budget and an audit of outstanding bets. **Do not fast-forward
`gamehub-events` to suppress this log**: it also finds missed `BetRandomReady`
events, so advancing it can skip unsettled bets. Repair and verify the skipped
range before changing a settlement cursor.

`KEEPER_SPORTS_TICKET_SCAN_MAX_BLOCKS` defaults to `50000` and now limits the
number of history blocks in a single pass, in addition to the chunk-count cap.
Every successful chunk persists progress; a months-old release resumes over
bounded passes instead of failing forever because of its age. A failed RPC or
index write cannot advance coverage over its range. Do not move the sports start
forward to exclude unresolved history. No casino cursor or partial public index
is accepted as proof that recovery has all tickets.

The periodic sports scan uses `KEEPER_POLL_INTERVAL_SECONDS` (300 seconds if that
interval is disabled); durable due work is checked once per second, one bounded
market page at a time. Websocket market events can trigger a bounded catch-up
scan immediately. Finality-pending jobs retain their due time; transient failures
back off to 30 seconds and remain recoverable until they succeed.

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

## Recovery regression checks

Run `pnpm -C frontend/apps/keeper test` and `pnpm -C frontend/packages/bet-index test`.
The PostgreSQL integration suite additionally needs a disposable local database:

```bash
KEEPER_TEST_POSTGRES_URL=postgres://user:password@127.0.0.1:5432/test_db \
  pnpm -C frontend/packages/bet-index test
```

The SQL suite refuses remote hosts, creates and removes its own schema, and checks
concurrent fresh migrations, rollback/replay, scope isolation, numeric pages,
stale acknowledgements and casino recovery queries. Without this explicit local
URL it is skipped; memory tests still run.
