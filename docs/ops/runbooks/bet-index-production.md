# Bet-index startup and replay

The bet index is a disposable read model of chain events. Contracts remain the settlement authority.
Use a fresh PostgreSQL database and the current application build with a verified release. The
[Docker deployment guide](../../../frontend/deploy/docker/README.md) provides the environment files;
a managed database is also supported.

## First startup

Set `BET_INDEX_DATABASE_URL`, the appropriate `BET_INDEX_SSL` transport policy and
`BET_INDEX_WRITE_ENABLED=true` for the writer. Keep database secrets out of frontend-readable
variables and source control. Configure storage monitoring and backups before public traffic.

The keeper calls `BetIndexStore.initializeSchema()`, which creates the current tables and indexes.
Initialization is idempotent and serialized by a transaction-scoped advisory lock. There is no old
schema upgrade path. Start the keeper with `KEEPER_RELEASE_PATH` and `KEEPER_RPC_HTTP` for the intended
chain; when present, `KEEPER_CHAIN_ID` must match that release.

Confirm that the worker starts, checkpoints advance, expected events can be read and the health
endpoint reports the intended chain and release. The index identifies casino bets by chain, GameHub
and bet ID; LP ledger queries also require the actual Bank address. Preserve these identities in
operational queries.

## Historical replay

To ingest a bounded casino/Bank event range, set the release and RPC/database environment above and
run:

```bash
BET_INDEX_FROM_BLOCK="$RELEASE_BLOCK" \
BET_INDEX_TO_BLOCK="$CONFIRMED_END_BLOCK" \
BET_INDEX_CONFIRMATIONS=6 \
BET_INDEX_SCAN_CHUNK_BLOCKS=100 \
pnpm -C frontend keeper:backfill
```

Set `RELEASE_BLOCK` and `CONFIRMED_END_BLOCK` to the intended block numbers first. Omitting
`BET_INDEX_TO_BLOCK` selects the latest confirmed block; range size must fit the RPC provider's log limits. `BET_INDEX_DRY_RUN=true` uses
memory instead of persisting. Repeated event ingestion is idempotent; reorg reconciliation may
replace affected indexed data.

The running keeper also maintains independent unresolved-bet recovery from the release block.
Ordinary event cursors and `KEEPER_START_BLOCK` cannot skip that history. Persist events before
advancing coverage, and let failed writes retry. Sports history has its own coverage and durable
storage requirements; a casino backfill alone does not establish complete Sports coverage.

## Failure and recovery

Track database availability/capacity, oldest unresolved work, cursor lag against confirmed chain
head and public read-route errors. Keep the existing per-client rate limits configured for recent,
player, affiliate and Sports ticket reads. A failed index query must not become an empty successful
history response.

Repair a database outage without bypassing recovery checkpoints. Already-queued permissionless
casino work is distinct from durable indexing; Sports recovery explicitly requires a healthy store.
Restarted workers replay and re-read current contract state before sending transactions. Do not
advance a cursor just to make health green.

Use [backup and recovery](bet-index-backup.zh-CN.md) for self-hosted PostgreSQL. Restore first into a
disposable target and validate it. Any replacement of an active database requires coordinated writer
shutdown, explicit target verification and incident authorization. After recovery, reconcile history
and open obligations before reopening public traffic.
