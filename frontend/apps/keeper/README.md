# Casino Keeper

The keeper retries received casino results, refunds expired unreceived VRF requests,
voids received results that can never be booked once GameHub allows it, indexes NFT
liquidity deposits and the governance timelock queue, observes pool accounting and
claims player payables on the players' behalf. It uses the current generated contract
ABIs from `@ssot/ssot/abis` and the addresses in `KEEPER_RELEASE_PATH`.

This repository does not contain a live deployment configuration. Supply a
validated release for the deployment being operated; test fixtures are not
operational release files.

## Build and run

```bash
pnpm -C frontend keeper:build
pnpm -C frontend keeper:start
```

Set these environment variables before starting:

| Variable                         | Purpose                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `KEEPER_RELEASE_PATH`            | Current release JSON: timelock, GameHub, VRFHub, PoolRegistry, pools and deployment block   |
| `KEEPER_RPC_HTTP`                | HTTP RPC endpoint                                                                           |
| `KEEPER_PRIVATE_KEY`             | Transaction signer key                                                                      |
| `KEEPER_RPC_WS`                  | Optional websocket endpoint; HTTP recovery remains active                                   |
| `KEEPER_ROLE`                    | `primary` or `backup`                                                                       |
| `KEEPER_BACKUP_DELAY_SECONDS`    | Delay before a backup processes queued work or voids a newly eligible bet                   |
| `KEEPER_HEALTH_PATH`             | Optional path for the atomic health JSON snapshot                                           |
| `KEEPER_VOID_GAS_LIMIT`          | Gas limit of every `voidBet` simulation and transaction; default 11,000,000                 |
| `KEEPER_FINALIZED_STALL_SECONDS` | Degrade finalized-head scans when finalized has not advanced this long; default 3600, 0 off |
| `BET_INDEX_WRITE_ENABLED`        | Enable durable event, ledger, governance and recovery storage                               |
| `BET_INDEX_DATABASE_URL`         | PostgreSQL connection string                                                                |
| `BET_INDEX_SSL`                  | Enable SSL for PostgreSQL                                                                   |

`KEEPER_CHAIN_ID`, when provided, must match the release. Local wrappers select
a file under `frontend/deploy/casino-keeper/` using `KEEPER_ENV_FILE`; they do not
read repo-root or web-app environment files. `keeper:dev`, `dev:with-keeper`,
and `dev:with-keepers` use those selected local configurations.

## Casino settlement and NFT liquidity

With `KEEPER_RPC_WS` configured, contract watchers use `eth_subscribe` (`poll: false`).
`GameHub.BetRandomReady` (using its `positionId` field) and canonical VRFHub
`ResultReceived` / `CallbackAttempt` wake the recovery queue. The VRF events are
resolved through `getRequest`, restricted to this GameHub, so even failure of the
entire Hub delivery can be recovered without a Hub event. Queue deduplication and the serialized
write path prevent the two events from sending duplicate transactions. A ready event
also brings forward a position that was waiting for its PendingVRF refund deadline.
The 500 ms queue timer handles deferred work; normal ready delivery does not wait for
the HTTP scan interval.

The runtime recreates the socket and all watchers after a subscription error or socket
close, with one shared retry timer. Retries continue after a prolonged provider outage;
shutdown cancels retries and closes the owned socket. HTTP lifecycle recovery remains
enabled because a new WS subscription cannot replay events missed during an outage.
The transport does not expose a socket before its initial handshake resolves. A peer
that never completes that handshake can stall WS setup; it does not block HTTP recovery
or CLI shutdown. No overlapping connection attempts are created, and any connection
that resolves after shutdown is closed. Restart a persistently stalled instance only
after checking the provider and authorizing the operational action.

`wsEnabled` and `websocket_watchers_registered` only describe configuration and local
watcher registration. A `running` health snapshot does not prove WS delivery. Verify
provider subscription acknowledgements separately, then correlate a real ready event,
an enqueue with `source=gameHub` or `source=vrfHub`, and the final transaction receipt.
An enqueue with `source=scan` proves HTTP discovery, but the queued item retains its
original source when a later WS event wakes it. Attribute settlement using the event
and enqueue timeline, not the finalizer's source alone. Test this with an authorized
testnet bet; a read-only `newHeads` probe alone does not prove settlement.

Normal callbacks settle the full Hub/Router/Bank/Vault accounting and acknowledge the
canonical seed in the same transaction. The keeper reads the current Hub state first;
already terminal positions need no keeper transaction.

For open positions, `getRequest` on the canonical VRFHub must bind the same Hub,
Bank and bet ID. A `Received` request calls public `GameHub.finalize` using the same
first seed, including when Hub delivery failed while its state stayed `PendingVRF`.
A known seed is never turned into a timeout refund. Only canonical `Awaiting` plus
Hub `PendingVRF` and chain time at or beyond the stored `refundDeadline` may call
`refund`. Later timeout configuration changes do not alter that deadline. A race
with callback or another caller is reconciled against the new on-chain state.
Unavailable or inconsistent canonical data fails closed and retries with bounded
backoff. A healthy Awaiting request remains queued and is checked at least once a minute.

Public retry transactions currently use a 3,050,000 gas envelope for both simulation
and submission. This setting is not proof of all-history tree gas sufficiency; further
modules, assets, referral configurations and tree histories need their own qualification.
`voidBet` uses `KEEPER_VOID_GAS_LIMIT` instead.

Every release pool must supply immutable Bank and Vault addresses. Read-only
health checks verify their mutual binding, the asset, the two cash balances, L/P/R/K/G
and PF/XP/PP buckets, `accountingValid`, `openHolds`, capacity and canonical LP status at
one numbered block. NFT withdrawal maturity is enforced on chain. The keeper never
advances an LP batch, withdraws an NFT, or holds user approval authority.

Player payables are discovered from `PlayerPayableCreated` events from the release origin through
finalized blocks, using a monotonic bounded cursor. Small budgets resume the unfinished range; there
is no moving-head overlap that can age out a replacement event. Health exposes the latest head and
finalized discovery target; `caughtUp` refers to that finalized target. Newly created debts may wait
for chain finality before automatic discovery. Players can always trigger their own on-chain claim.

Known debts are read at the latest numbered block and paid with `claimPlayerPayable`, which always
pays the player's own address. A successful claim or observed zero remains tracked until a zero at a
finalized block at or beyond that observation confirms it. Until then the keeper retries debt restored
by a reorg. An unavailable finality response reports a discovery failure.

Base never moves its finalized block back, but load-balanced HTTP RPC nodes can disagree. Every
finalized-head scan (payables, Vault ledger, governance timelock) keeps a monotonic cursor: a read
below it scans nothing, is reported as `finalizedBehindBy` in that scan's health and logged once per
occurrence as `casino.keeper.head_behind`, and scanning resumes from the cursor once the provider
catches up, so no event is skipped. Such a read is not an error. The event scan treats a latest block
below its cursor the same way (`scanHeadBehindBy`); its stall check still degrades health if progress
stops. Independently, when the highest finalized block a scan has read has not advanced for
`KEEPER_FINALIZED_STALL_SECONDS` (default one hour), that scan reports `finalizedStalledSince` and
degrades `payables`, `ledger` or `governance` until it advances.

Reads pinned to a block number (pool accounting, payable balances, governance event block times) can
also reach a node that does not have that block yet and answer `header not found` or "unknown block".
Those failures are transient: they show as `transientError` / `transientReadError` and degrade health
only after five consecutive minutes without a successful read. Every other failure degrades at once.

Only a recognized refused-transfer result from simulation is treated as an expected refusal. It leaves
the debt owed and uses exponential backoff from 5 minutes to 6 hours. Unknown reverts, RPC, funding,
send and receipt failures require attention: they degrade `payables` health and remain visible during
backoff until a successful reconciliation clears them. An issuer rejection that cannot be identified
narrowly also remains actionable; the keeper does not suppress arbitrary errors based on their text.

Casino finalization, timeout refunds, voids and payable claims share a serialized write
path. Pausing a Bank does not block settlement, refund or void debt-out, or payable claims. The
keeper does not deposit or withdraw LP funds, transfer NFTs, or set operators.
Shutdown stops scheduling, waits for in-flight scans and writes, then closes the
database and marks health stopped.

## Void of unbookable results

A received result whose settlement can never be booked, for example because its module reverts
or the asset issuer froze the Vault, keeps the pool's LP fence closed (ADR-0037 §7). `GameHub.voidBet`
ends such a bet: it tries the settlement once more with exactly `VOID_SETTLEMENT_GAS` and only if
that fails books the stake as a player payable, which the payable claimer then pays. The keeper is
the operator's void executor (ADR-0037 §7.3, operating rule 3):

- Finalization comes first. A bet becomes a void candidate only when the `finalize` simulation of
  its received result (`RandomReady`, or `PendingVRF` with a canonical `Received` request) fails in
  the settlement: a revert, or an execution error such as "out of gas" that the node reports instead
  of a revert. `voidBet` retries the settlement with 10,000,000 gas first, so a bet that only needed
  more than the 3,050,000 finalize gas settles there. A transport failure, or a GameHub precondition
  such as `BadState`, stays an ordinary finalize failure.
- Eligibility comes from the bet's `vrfRequestedAt`, `voidCohortEnd(bank)` and the GameHub
  constants `VOID_DELAY` (24 hours inside a void window) and `PUBLIC_VOID_DELAY` (7 days), read
  once, against the latest block timestamp. No `voidBet` is sent before that time. Until then the
  bet stays queued, its settlement is retried at least once a minute, and the last check is
  scheduled exactly at eligibility.
- Eligible candidates are attempted one at a time in ascending `vrfRequestedAt` order, bet ID
  breaking ties, each after the previous receipt, so in consecutive blocks. After a start, no bet is
  voided until every earlier candidate can be known: lifecycle recovery must reach the head it read
  first and, with the bet index, the indexed open bets must have been requeued once
  (`voids.startupRecoveryComplete`). A lower bet the keeper has not examined yet holds back later
  ones. A backup leaves a newly eligible bet to the primary for `KEEPER_BACKUP_DELAY_SECONDS`.
- Each attempt rereads the bet, simulates `finalize` again (a result that books again goes back to
  finalization), simulates `voidBet` and sends it with the explicit `KEEPER_VOID_GAS_LIMIT`. The
  receipt's GameHub events decide the outcome: `BetVoided` means voided, `BetFinalized` means it
  settled inside `voidBet`. The bet index row is written from that receipt.
- `KEEPER_VOID_GAS_LIMIT` must be at least `VOID_SETTLEMENT_GAS` + `VOID_RESERVE_GAS` +
  `VOID_CALL_OVERHEAD` + 150,000 (10,755,000 with the current constants) and at most 16,000,000,
  below Base's per-transaction cap of 16,777,216. Startup reads the constants and stops on a value
  outside that range; if GameHub cannot be read then, the check runs before the first void. The
  default, 11,000,000, equals the SDK's `VOID_BET_GAS_LIMIT`. A `VoidGasTooLow` revert is reported
  as a configuration error and nothing is sent.
- Health `voids` lists the candidates with their eligibility time and settlement revert, counts
  attempts by outcome (voided, settled, failed) and keeps the last outcome with its transaction
  hash. Logs: `casino.void.candidate`, `casino.void.broadcast`, `casino.void.mined`,
  `casino.void.failed` and `casino.void.configuration_error`.

An unbooked result stays visible (ADR-0037 §7.3 rule 4): once any candidate's result was received
more than one hour ago, health degrades `unbookedResult`, and `voids.oldestUnbooked` gives that
bet's receipt time, age and eligibility. The receipt time is the block of the `ResultReceived` or
`BetRandomReady` event that queued the bet (`receivedFrom: result`); a bet queued without one, for
example from the index after a restart, uses its VRF request time (`request`), which can only
overstate the age. `pools` also stays degraded through the canonical LP status while a result is
unbooked. Accepted bets of a disabled game are finalized, refunded and voided like any other.

## Storage and event recovery

`BetIndexStore.initializeSchema()` creates the current schema and indexes.
Initialization is idempotent; a transaction-scoped advisory lock serializes
concurrent worker startup. It does not migrate an older database: before launch a
schema change means recreating the database (`pnpm -C frontend bet-index:db:reset` locally).
Runbook: the void columns of `bets` and the governance tables of this build need a recreated
database wherever an earlier bet index exists (dev, testnet, the old production host).
Bets are identified by chain, GameHub and bet ID. LP ledger reads require Vault
identity; Bank is retained as custodian metadata and pool display IDs cannot substitute for it.

A bet ends `finalized`, `refunded` or `voided`. GameHub `BetVoided` makes the row `voided` with
`refundAmount` equal to the stake, zero payouts, the void transaction, its caller and the first 32
bytes of the settlement revert; a void counts as settled with neither turnover nor award. A
terminal row never returns to an open state when a ready event of the same transaction is written
later. `VoidWindowOpened` and `GameDisabled` are stored with the other GameHub events, and
`getGameHubOperatorEvents` lists them newest first for the operations page.

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

Vault `DepositAdded` / `DepositWithdrawn` cash-flow and ERC-721 `Transfer` ownership indexing runs independently at
`KEEPER_VAULT_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS` (default 60). Set it to zero
only when provider-ledger indexing is intentionally disabled. It scans monotonically from the release
origin through finalized blocks under `vault-provider-ledger-finalized`; an unrelated GameHub cursor
cannot skip ledger history. Rows are persisted before the cursor advances. An unavailable finalized
target fails the scan; a lagging one scans nothing (`vaultProviderLedger.finalizedBehindBy`). Indexed
cash flows can therefore lag on-chain claims by finality.
Mint/burn `Transfer` logs are excluded from ledger rows to avoid duplicating cash events. Ordinary
transfers record ownership without inventing a payment. Each recent casino range uses one Hub log
query and one canonical VRF receipt/delivery query; each Vault-ledger scan combines its event
types into one log request per chunk;
block timestamps and contract reads add RPC work.

## Governance timelock

One `GovernanceTimelock` governs PoolRegistry, GameHub and every Bank, and admissions wait in it for
72 hours (ADR-0037 §2), so LPs read its queue from the index. With the bet index enabled, the keeper
takes the timelock from the release `contracts.governanceTimelock` and refuses to index unless
PoolRegistry, GameHub and every Bank of the release report it as their governance. It rechecks this
hourly; a mismatch degrades `governance`. In the lifecycle pass it indexes `CallScheduled`,
`CallSalt`, `CallExecuted`, `Cancelled` and `MinDelayChange` through finalized blocks from the release
origin, with the usual chunking, under `governance-timelock-finalized` keyed by the timelock.

There is one row per chain, timelock, operation id and batch index, with target, value, data,
predecessor, salt, delay, the schedule block, transaction and time, `readyAt` (schedule block time
plus delay) and the execution or cancellation block and transaction. An operation scheduled again
after a cancellation shows its latest schedule. `getGovernanceTimelockOperations` lists rows in
schedule order, optionally only those neither executed nor cancelled, with the state `waiting`,
`ready` (by the query clock), `executed` or `cancelled`. `getGovernanceTimelockDelayChanges` lists
delay changes.

Runbook and A11: the timelock constructor emits the first `MinDelayChange` (0 to 259,200). It is
indexed only if the release origin (`meta.blockNumber`, or `KEEPER_CASINO_RECOVERY_START_BLOCK`) is
at or before the timelock's deployment block. D1 deploys the timelock first, so the release origin
must be that block or earlier for the index to hold the full delay history; `getMinDelay()` on chain
always gives the current delay.

## Health

Health JSON includes queue depth, scan progress, transaction outcomes, RPC usage,
`pools` snapshots of Bank/Vault accounting, capacity and pause state, outstanding
player-payable reconciliation, `voids`, `vaultProviderLedger` and `governance` progress.
`finalizedBehindBy` and `scanHeadBehindBy` are informational and never degrade health.
The existing health service consumes this file;
the keeper does not deliver alerts. Keep the file outside the web app's public directory.

Each failure is cleared only by success on its own path. Finalization errors are retained
per bet: another bet settling cannot clear them. The same bet settling, being observed
terminal, or returning to a verified wait clears its error. A verified wait means either
canonical Awaiting status, its stored deadline and chain clock were read successfully and the
deadline has not passed, or a settlement revert whose void eligibility was read successfully;
the bet remains queued and is not yet terminal. A skipped/unknown state does
not clear an error. Void failures are retained per bet the same way. Queue depth alone is not
an error because healthy bets can be waiting for randomness.

| `degradedBy`      | Meaning                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `scan` / `ledger` | Event or provider-ledger scan failed, or the ledger's finalized head stalled             |
| `finalize`        | Casino terminalization failed                                                            |
| `void`            | A void attempt failed, `voidBet` ran out of gas, or a void pass could not read the chain |
| `unbookedResult`  | A received result that cannot be booked is more than one hour old                        |
| `recovery`        | Lifecycle coverage is incomplete or persistence/read failed                              |
| `pools`           | Bank/Vault identity, invariant or canonical LP-state read failed                         |
| `payables`        | Payable discovery incomplete, finalized head stalled, or state/claim delivery failed     |
| `governance`      | Release governance mismatch, timelock indexing failed, or its finalized head stalled     |
| `stalled`         | Scan progress or lifecycle reconciliation stopped advancing                              |

Lifecycle reconciliation stalled for five minutes degrades health even if normal event
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
concurrent initialization, replay, chain/contract isolation, numeric pagination,
atomic ledger replacement, financial receipts, pending-bet recovery, voided bets and
the governance timelock queue, each against the in-memory store too.
Without the explicit URL, SQL integration tests are skipped.

For local durable indexing, `pnpm -C frontend bet-index:db:up` starts the local
Compose database. `pnpm -C frontend keeper:backfill --help` describes the bounded
historical event ingestion command.

Local integration: `bash script/ci/keeper_integration.sh` uses disposable Anvil and
PostgreSQL. Its process-recovery case starts the compiled keeper CLI, waits for a durable
PendingVRF row/cursor, kills that OS process with SIGKILL, persists a canonical seed using a deliberately underfunded local diagnostic callback while it is
offline (the Hub remains PendingVRF), then starts a different PID against the same database. After terminal recovery,
a third distinct PID replays the durable state; the test requires one terminal event,
one broadcast and exactly one nonzero Bank-to-player payment across the restarts.

The subsequent in-process runtime case checks a normally funded callback completes with zero
keeper broadcasts, then separately checks the stored refund deadline
after a timeout configuration change, refund while paused, refused transfer becoming
player payable debt, later payment to that player after the transfer is allowed, and ignored late callback after cancellation.
It then freezes the Vault so a delivered result cannot be booked, checks that no `voidBet` is sent
before eligibility, opens a void window, moves time 24 hours and requires one keeper `voidBet` with
the configured gas, the stake as a player payable and a `voided` row. Finally it hands PoolRegistry,
GameHub and the Bank to a `GovernanceTimelock` through its own queue and requires a keeper restarted
with a release naming that timelock to index the executed and cancelled operations.
These checks are not additional OS-process restart evidence. The script owns and removes
its test processes/container and never uses deployment wallets or an existing database.
