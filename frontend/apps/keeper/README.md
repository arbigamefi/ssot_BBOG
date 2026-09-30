# Casino Keeper

The keeper finalizes casino results, refunds expired pending VRF bets, activates
eligible Bank redemption queues, monitors historical recovery and claims player payables
on the players' behalf. It uses the current generated contract ABIs
from `@ssot/ssot/abis` and the addresses in `KEEPER_RELEASE_PATH`.

This repository does not contain a live deployment configuration. Supply a
validated release for the deployment being operated; test fixtures are not
operational release files.

## Build and run

```bash
pnpm -C frontend keeper:build
pnpm -C frontend keeper:start
```

Set these environment variables before starting:

| Variable                      | Purpose                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `KEEPER_RELEASE_PATH`         | Current release JSON, including contract and active pool addresses and deployment block |
| `KEEPER_RPC_HTTP`             | HTTP RPC endpoint                                                                       |
| `KEEPER_PRIVATE_KEY`          | Transaction signer key                                                                  |
| `KEEPER_RPC_WS`               | Optional websocket endpoint; HTTP recovery remains active                               |
| `KEEPER_ROLE`                 | `primary` or `backup`                                                                   |
| `KEEPER_BACKUP_DELAY_SECONDS` | Delay before a backup processes queued work                                             |
| `KEEPER_HEALTH_PATH`          | Optional path for the atomic health JSON snapshot                                       |
| `BET_INDEX_WRITE_ENABLED`     | Enable durable event, ledger and recovery storage                                       |
| `BET_INDEX_DATABASE_URL`      | PostgreSQL connection string                                                            |
| `BET_INDEX_SSL`               | Enable SSL for PostgreSQL                                                               |

`KEEPER_CHAIN_ID`, when provided, must match the release. Local wrappers select
a file under `frontend/deploy/casino-keeper/` using `KEEPER_ENV_FILE`; they do not
read repo-root or web-app environment files. `keeper:dev`, `dev:with-keeper`,
and `dev:with-keepers` use those selected local configurations.

## Casino settlement and LP pricing

Before every transaction, the keeper reads `GameHub.getBet`:

- `RandomReady` calls `finalize` using **3,050,000 transaction gas** for both
  simulation and send: the admitted 3,000,000 execution budget plus intrinsic
  gas/calldata allowance. Additional modules, assets or referral configurations
  require their own gas qualification.
- `PendingVRF` stays queued until the current on-chain
  `placedAt + refundTimeoutSeconds` is reached, then calls public `refund`.
  The timeout and chain timestamp are reread on retries. A callback racing a
  refund triggers another state read; a known result goes through finalization.
- Terminal bets need no new transaction. Retryable errors use bounded backoff
  without an attempt-count cutoff.

Every distinct Bank in the current release pools is reconciled at a single numbered
block. The keeper reads `currentEpoch`, `redeemBatch(currentEpoch)`, and `riskInPaused`.
An eligible nonempty queue on an unpaused Bank permits `activateBatch`; the keeper verifies
that the epoch advanced. A race with another caller or a pause triggers a fresh read.
Historical open positions never gate activation. Activation prices liquid assets immediately
and retains the old reserve and recovery rights under that epoch.

Historical recovery monitoring discovers `RedeemBatchActivated` events from the release origin
through finalized blocks and polls at most 50 known epochs per turn at that finalized block.
Unvisited old alerts are retained; incomplete discovery reports degraded health rather than claiming
complete coverage. Alerts can lag by chain finality; latest head and the finalized target are exposed
separately. Finalized terminal epochs can be removed safely. This monitor does not gate betting or
later exits; batch activation still reconciles the latest numbered block.

Player payables are discovered from `PlayerPayableCreated` events from the release origin through
finalized blocks, using a monotonic bounded cursor. Small budgets resume the unfinished range; there
is no moving-head overlap that can age out a replacement event. Health exposes the latest head and
finalized discovery target; `caughtUp` refers to that finalized target. Newly created debts may wait
for chain finality before automatic discovery. Players can always trigger their own on-chain claim.

Known debts are read at the latest numbered block and paid with `claimPlayerPayable`, which always
pays the player's own address. A successful claim or observed zero remains tracked until a zero at a
finalized block at or beyond that observation confirms it. Until then the keeper retries debt restored
by a reorg. An unavailable or regressing finality response reports a discovery failure.

Only a recognized refused-transfer result from simulation is treated as an expected refusal. It leaves
the debt owed and uses exponential backoff from 5 minutes to 6 hours. Unknown reverts, RPC, funding,
send and receipt failures require attention: they degrade `payables` health and remain visible during
backoff until a successful reconciliation clears them. An issuer rejection that cannot be identified
narrowly also remains actionable; the keeper does not suppress arbitrary errors based on their text.

Casino finalization, timeout refunds, batch activation and payable claims share a serialized write
path. Pausing a Bank does not block settlement/refund debt-out or payable claims. The keeper does
not request or cancel LP redemptions, claim LP funds, or set operators.
Shutdown stops scheduling, waits for in-flight scans and writes, then closes the
database and marks health stopped.

## Storage and event recovery

`BetIndexStore.initializeSchema()` creates the current schema and indexes.
Initialization is idempotent; a transaction-scoped advisory lock serializes
concurrent worker startup. There is no schema upgrade or data migration path.
Bets are identified by chain, GameHub and bet ID. LP ledger reads require Bank
identity; pool display IDs cannot substitute for it.

The regular `gamehub-events` cursor serves recent indexing and settlement.
Independent full lifecycle recovery starts at the release block, inclusive,
under `casino-open-bets-v1:<origin>`. `KEEPER_CASINO_RECOVERY_START_BLOCK` may
widen this history range but cannot move past the deployment block.
`KEEPER_START_BLOCK` and the regular event cursor cannot advance lifecycle
coverage. Events are persisted before each recovery checkpoint. Failed writes
leave the range retryable.

Startup and periodic recovery page through indexed nonterminal `BetPlaced` and
`BetRandomReady` IDs numerically, scoped by chain and GameHub. Recorded terminal
events are excluded, and chain state is reread before sending. This also repairs
the crash window between persisting events and processing the in-memory queue.
Without PostgreSQL, casino recovery replays bounded release history on restart.
Lifecycle reconciliation continues when ordinary event scanning is disabled.

`KEEPER_POLL_INTERVAL_SECONDS` controls ordinary HTTP scanning.
`KEEPER_SCAN_CHUNK_BLOCKS` defaults to 10 and
`KEEPER_SCAN_MAX_CHUNKS_PER_PASS` defaults to 50. These bound each historical
pass. `casino.keeper.scan_capped` reports remaining backlog; do not fast-forward
recovery cursors to suppress it. Adjust limits to the RPC provider and allow
catch-up to complete. `KEEPER_RPC_MIN_INTERVAL_MS` spaces tracked RPC calls
within a process; it does not coordinate separate workers or the web app.

Bank `Deposit`/`Withdraw`/`RecoveryClaimed` cash-flow indexing runs independently at
`KEEPER_BANK_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS` (default 60). Set it to zero
only when provider-ledger indexing is intentionally disabled. It scans monotonically from the release
origin through finalized blocks under `bank-provider-ledger-finalized`; an unrelated GameHub cursor
cannot skip ledger history. Rows are persisted before the cursor advances. An unavailable or regressing
finalized target fails the scan. Indexed cash flows can therefore lag on-chain claims by finality.
Each casino scan and each Bank-ledger scan combines its event types into one log request per chunk;
block timestamps and contract reads add RPC work.

## Sports recovery

Sports indexing and terminalization are separately enabled by
`KEEPER_SPORTS_TICKET_INDEX_ENABLED` and
`KEEPER_SPORTS_TERMINALIZER_ENABLED`. They require durable writes, a reachable
database and a SportsHub in the release. Missing configuration or failed schema
initialization aborts startup before workers send transactions.

Market events are persisted as pending work before advancing their cursor.
Independent `TicketPlaced` history builds the recovery ticket index, scoped by
chain and SportsHub. The market and ticket checkpoints include their coverage
origin; widening that origin invalidates narrower page progress. Neither a
casino cursor nor a partial public ticket feed proves complete ticket coverage.

Settlement waits for ticket-history coverage through the market event block,
then reads finality and current ticket state. Resolved markets finalize and
settle held tickets; voided markets refund them. Writes are simulated first.
`KEEPER_SPORTS_TERMINALIZER_MAX_TICKETS_PER_MARKET` is a page size, not a total
limit. Pending pages survive restart and retry, and stale workers cannot
acknowledge a newer work revision. `KEEPER_SPORTS_TICKET_SCAN_MAX_BLOCKS` bounds
history per pass. Manual `KEEPER_SPORTS_TERMINALIZER_MARKET_IDS` use the same
coverage checks.

## Health

Health JSON includes queue depth, scan progress, transaction outcomes, RPC
usage, each Bank's current queue and pause state, and historical recovery epochs,
remaining holds, backing and age. The
existing health service consumes this file; the keeper does not deliver alerts.
Keep the file outside the web app's public directory.

Each failure is cleared only by success on its own path:

| `degradedBy`      | Meaning                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| `scan` / `ledger` | Event or provider-ledger scan failed                                            |
| `finalize`        | Casino terminalization failed                                                   |
| `recovery`        | Lifecycle coverage is incomplete or persistence/read failed                     |
| `redemption`      | Bank read or queue-activation reconciliation failed                             |
| `pocket-recovery` | Historical epoch discovery is incomplete or failed                              |
| `pocket`          | Historical recovery read failed or unresolved holds exceeded the age threshold  |
| `payables`        | Finalized payable discovery incomplete, or state/finality/claim delivery failed |
| `stalled`         | Scan progress or lifecycle reconciliation stopped advancing                     |

Historical recovery age uses chain timestamp minus activation time, including while
paused. An overdue unactivated queue is not a historical recovery alert. Restart
and unrelated successful settlements cannot reset historical age. Lifecycle
reconciliation stalled for five minutes degrades health even if normal event
scanning still works. Logs and health errors redact RPC URLs and credentials.

## Local checks

```bash
pnpm -C frontend/apps/keeper test
pnpm -C frontend/apps/keeper typecheck
pnpm -C frontend/apps/keeper build
pnpm -C frontend/packages/bet-index test
```

Enable real SQL integration with a disposable local PostgreSQL database:

```bash
KEEPER_TEST_POSTGRES_URL=postgres://user:password@127.0.0.1:5432/test_db \
  pnpm -C frontend/packages/bet-index test
```

These tests refuse remote hosts and create/remove isolated schemas. They cover
concurrent initialization, rollback/replay, chain/contract isolation, numeric
pagination, stale acknowledgements, financial receipts and pending-bet recovery.
Without the explicit URL, SQL integration tests are skipped.

For local durable indexing, `pnpm -C frontend bet-index:db:up` starts the local
Compose database. `pnpm -C frontend keeper:backfill --help` describes the bounded
historical event ingestion command; this is event recovery, not a schema upgrade.
