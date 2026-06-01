# Bet Index Production Runbook

| Owner | Frontend Lead + SRE |
| Status | Accepted |
| Last Updated | 2026-05-23 |
| Depends-on | `../../design/indexing-strategy.md`, `../../design/adr/0005-postgres-durable-bet-index.md`, `./casino-keeper-production.md` |
| Scope | Managed Postgres for `@ssot/bet-index`; backup, restore, and backfill evidence for public traffic |

The durable bet index is a read model. It supports recent feeds, player
activity, affiliate dashboards, and sportsbook ticket lookup. It is not a
settlement authority. Contracts remain the source of truth, and the keeper must
continue settling even if Postgres is degraded.

## 1. Preconditions

- Base mainnet release bundle has been synced into
  `frontend/packages/ssot/src/release/embedded/chain-8453.json`.
- Managed Postgres is provisioned with encrypted storage, automated backups,
  point-in-time restore, disk monitoring, and upgrade automation.
- `BET_INDEX_DATABASE_URL` is stored as a deployment secret, not in git.
- `BET_INDEX_SSL=true` unless the provider's private networking layer documents
  a different TLS policy.
- At least one keeper has `BET_INDEX_WRITE_ENABLED=true`.
- Web API routes use read-only or least-privilege database credentials when the
  provider supports separate roles.

## 2. Schema And Migration

The keeper creates the schema through `@ssot/bet-index` on startup. Before
public traffic, run a bounded migration/backfill canary:

```bash
KEEPER_CHAIN_ID=8453 \
KEEPER_RELEASE_PATH=frontend/packages/ssot/src/release/embedded/chain-8453.json \
KEEPER_RPC_HTTP=$BASE_MAINNET_RPC_HTTP \
BET_INDEX_DATABASE_URL=$BET_INDEX_DATABASE_URL \
BET_INDEX_SSL=true \
BET_INDEX_FROM_BLOCK=$RELEASE_BLOCK \
BET_INDEX_TO_BLOCK=$RELEASE_BLOCK \
pnpm -C frontend keeper:backfill
```

Expected result:

- command exits 0;
- `gamehub_events`, `bets`, `sport_tickets`, and `indexer_cursors` exist;
- summary JSON prints `chainId: 8453`;
- no secrets appear in logs.

## 3. Backfill

Run an initial backfill from the release block to the latest confirmed block:

```bash
KEEPER_CHAIN_ID=8453 \
KEEPER_RELEASE_PATH=frontend/packages/ssot/src/release/embedded/chain-8453.json \
KEEPER_RPC_HTTP=$BASE_MAINNET_RPC_HTTP \
BET_INDEX_DATABASE_URL=$BET_INDEX_DATABASE_URL \
BET_INDEX_SSL=true \
BET_INDEX_FROM_BLOCK=$RELEASE_BLOCK \
BET_INDEX_CONFIRMATIONS=6 \
BET_INDEX_SCAN_CHUNK_BLOCKS=2000 \
pnpm -C frontend keeper:backfill
```

If the RPC provider rejects the log range, lower `BET_INDEX_SCAN_CHUNK_BLOCKS`
and rerun. Backfill is idempotent because event tables use
`(chain_id, tx_hash, log_index)` as the primary key and bet/ticket rows are
folded by chain id plus id.

## 4. Backup

Before public traffic, record the managed provider's backup policy and run one
manual logical backup:

```bash
pg_dump "$BET_INDEX_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="bet-index-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Store the dump in the approved encrypted backup bucket. The release packet must
record:

- backup provider and region;
- retention period;
- encryption owner;
- restore target RPO and RTO;
- last successful backup timestamp;
- owner who can perform restore.

## 5. Restore Drill

Restore into a disposable database, never into production:

```bash
createdb "$BET_INDEX_RESTORE_DATABASE"
pg_restore \
  --dbname="$BET_INDEX_RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  bet-index-<timestamp>.dump
```

Then run read checks:

```bash
psql "$BET_INDEX_RESTORE_DATABASE_URL" -c "select count(*) from gamehub_events;"
psql "$BET_INDEX_RESTORE_DATABASE_URL" -c "select count(*) from bets;"
psql "$BET_INDEX_RESTORE_DATABASE_URL" -c "select count(*) from indexer_cursors;"
```

The restore drill is accepted only when the restored database can serve recent
bet reads and the keeper can resume from `indexer_cursors` without replaying
from genesis.

## 6. Monitoring

Alert on:

- database unavailable for more than 2 minutes;
- disk usage above 80%;
- failed automated backup;
- no keeper cursor advancement for 10 minutes while chain head advances;
- web API `/api/bets/recent` returns 5xx for more than 2 minutes.
- web API `/api/healthz` returns `checks.betIndex.status != "ok"` for more
  than 2 minutes on chain `8453`.

Public read routes must keep per-client rate limits configured:

- `BETS_RECENT_RATE_LIMIT_PER_MINUTE`
- `BETS_PLAYER_RATE_LIMIT_PER_MINUTE`
- `BETS_AFFILIATE_RATE_LIMIT_PER_MINUTE`
- `SPORTSBOOK_PLAYER_TICKETS_RATE_LIMIT_PER_MINUTE`

Postgres degradation should not block settlement. If connection failures create
keeper instability, set `BET_INDEX_WRITE_ENABLED=false`, restart the keeper, and
backfill the missing window after the database is healthy.

## 7. Acceptance Checklist

- [ ] Managed Postgres owner, region, and plan recorded.
- [ ] TLS/SSL setting recorded.
- [ ] Production credentials stored as secrets and not committed.
- [ ] Migration/backfill canary exits 0 on chain `8453`.
- [ ] Initial backfill range recorded.
- [ ] Automated backups enabled.
- [ ] Manual `pg_dump` backup created and stored in encrypted storage.
- [ ] Restore drill into disposable database completed.
- [ ] Cursor advancement and `/api/bets/recent` monitors configured.
- [ ] `/api/healthz` monitor configured and showing `checks.betIndex.status: "ok"`.
- [ ] Public read API rate limits configured for recent bets, player bets,
      affiliate bets, and sportsbook tickets.
- [ ] Keeper restart with `BET_INDEX_WRITE_ENABLED=false` rehearsed or accepted
      as the degraded-mode fallback.

## 8. Don'ts

- Do not run production Postgres from the local Docker Compose file.
- Do not put database URLs in frontend-readable environment variables.
- Do not make Postgres availability a condition for contract settlement.
- Do not restore a dump over production without a separate incident approval.
- Do not backfill from genesis when a release-block or cursor-based replay is
  sufficient.
