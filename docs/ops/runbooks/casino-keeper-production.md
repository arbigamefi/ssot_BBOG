# Casino Keeper Production Runbook

| Owner | Frontend Lead + SRE |
| Status | Accepted |
| Last Updated | 2026-05-18 |
| Depends-on | `../../frontend/casino-keeper-v1.md`, `../../design/durable-bet-index.md`, `./bet-index-production.md` |
| Scope | Casino `RandomReady -> GameHub.finalize -> Settled/Refunded` automation; optional sportsbook result and ticket terminalization |

This runbook installs and operates the casino keeper as two independent
instances: primary and backup. The keeper is an operational convenience, not a
settlement authority. `GameHub.finalize(betId)`, `SportsHub.finalizeResult`,
`SportsHub.settleTicket`, and `SportsHub.refundTicket` remain permissionless.

## 1. Preconditions

- The release JSON is present on the host:
  `frontend/packages/ssot/src/release/embedded/chain-84532.json` for Base
  Sepolia, or `frontend/packages/ssot/src/release/embedded/chain-8453.json`
  for Base mainnet.
- Keeper EOAs have enough native gas token for at least 24 hours of expected
  settlement traffic.
- Primary and backup use different EOAs, RPC providers, and hosts or regions.
- Managed Postgres is provisioned for the durable bet index, or
  `BET_INDEX_WRITE_ENABLED=false` is explicitly accepted for a canary.
- Sportsbook terminalization is enabled only after the active release exposes
  `SportsHub` and sportsbook result canaries have passed.
- The web app reads keeper health from a path outside `apps/web/public` through
  `/ops/casino-keeper-health.json`.

## 2. Build

Run from the repo root on each keeper host:

```bash
corepack enable
pnpm -C frontend install --frozen-lockfile
pnpm -C frontend keeper:build
pnpm -C frontend/apps/keeper test
```

The systemd unit executes `apps/keeper/dist/cli.js`, so the build step is
required before starting or restarting the service after a code deploy.

## 3. Environment Files

Templates live under:

```text
frontend/deploy/casino-keeper/primary.env.example
frontend/deploy/casino-keeper/backup.env.example
frontend/deploy/casino-keeper/primary.base-mainnet.env.example
frontend/deploy/casino-keeper/backup.base-mainnet.env.example
```

Install them as root-owned files:

```bash
sudo install -d -m 0750 /etc/arbigamefi/casino-keeper
sudo install -d -m 0750 /var/lib/arbigamefi/casino-keeper
sudo cp frontend/deploy/casino-keeper/primary.env.example \
  /etc/arbigamefi/casino-keeper/primary.env
sudo cp frontend/deploy/casino-keeper/backup.env.example \
  /etc/arbigamefi/casino-keeper/backup.env
sudo chmod 0600 /etc/arbigamefi/casino-keeper/*.env
```

Edit the real files and set:

| Variable | Production rule |
| --- | --- |
| `KEEPER_PRIVATE_KEY` | Dedicated bounded-balance keeper EOA. Never reuse deployer or governance keys. |
| `KEEPER_RPC_HTTP` / `KEEPER_RPC_WS` | Use provider-specific endpoints; primary and backup should differ. |
| `KEEPER_START_BLOCK` | Use the active release block or a recent canary block after backfill is complete. |
| `KEEPER_ROLE` | `primary` or `backup`. |
| `KEEPER_BACKUP_DELAY_SECONDS` | `0` for primary, `5` for backup. |
| `KEEPER_HEALTH_PATH` | Role-specific file under `/var/lib/arbigamefi/casino-keeper`. |
| `KEEPER_SPORTS_TERMINALIZER_ENABLED` | `true` only when the keeper should auto-finalize sportsbook results and settle/refund held tickets. |
| `KEEPER_SPORTS_TERMINALIZER_SCAN_CHUNK_BLOCKS` | Sports result/void event scan chunk size. Defaults to `KEEPER_SCAN_CHUNK_BLOCKS`; raise it only after the RPC provider allows wider filtered ranges. |
| `KEEPER_SPORTS_TERMINALIZER_MARKET_IDS` | Optional comma-separated recovery/canary markets to process once at startup. Leave empty in steady-state production. |
| `KEEPER_SPORTS_TERMINALIZER_MAX_TICKETS_PER_MARKET` | Safety cap for tickets processed per market scan. Start at `200` unless the approved launch memo says otherwise. |
| `KEEPER_SPORTS_TICKET_ENUMERATION_MAX` | Bounded `nextTicketId` fallback scan size when Postgres has no held tickets for a terminal market. |
| `KEEPER_SPORTS_TICKET_SCAN_CHUNK_BLOCKS` | Last-resort `TicketPlaced` log-scan chunk size. Defaults to `KEEPER_SCAN_CHUNK_BLOCKS`; raise it only after the RPC provider allows wider filtered ranges. |
| `KEEPER_SPORTS_TICKET_SCAN_START_BLOCK` | Optional lower bound for `TicketPlaced` scans. Leave empty to use the active release block, or set to the sportsbook canary start block after backfill. |
| `BET_INDEX_DATABASE_URL` | Managed Postgres connection string. |
| `BET_INDEX_SSL` | `true` for managed Postgres unless the provider documents otherwise. |

For Base mainnet, start from the `*.base-mainnet.env.example` files and replace
`KEEPER_START_BLOCK` with the accepted release block. Do not reuse the Base
Sepolia chain id, release path, start block, or RPC endpoints.

## 4. Install systemd Unit

```bash
sudo install -m 0644 \
  frontend/deploy/casino-keeper/arbigamefi-casino-keeper@.service \
  /etc/systemd/system/arbigamefi-casino-keeper@.service
sudo systemctl daemon-reload
```

Start the primary:

```bash
sudo systemctl enable --now arbigamefi-casino-keeper@primary
sudo journalctl -u arbigamefi-casino-keeper@primary -f
```

Start the backup on the backup host:

```bash
sudo systemctl enable --now arbigamefi-casino-keeper@backup
sudo journalctl -u arbigamefi-casino-keeper@backup -f
```

## 5. Health Wiring

For a single-host staging deployment, point the web route to the primary health
file:

```bash
KEEPER_HEALTH_PATH=/var/lib/arbigamefi/casino-keeper/primary-health.json
```

For multi-host production, publish the primary health snapshot to the web
runtime through the deployment platform's secret volume, object store, or
authenticated internal fetch. Do not copy it to `apps/web/public`.

Expected route:

```bash
curl -fsS https://<ops-host>/ops/casino-keeper-health.json | jq .
```

The route should show:

- `status: "running"`;
- `role: "primary"` for the primary health file;
- a fresh `updatedAt`;
- non-decreasing `lastScannedBlock`;
- `lastFinalizeFailureAt` absent or older than the most recent recovery.

## 6. Canary

### 6.1 Casino

Before mainnet or after keeper deploy:

1. Open `/casino/dice`.
2. Place a minimal stake canary bet.
3. Confirm the frontend reaches `Randomness ready`.
4. Confirm the keeper logs one enqueue and one terminal verification:

```bash
sudo journalctl -u arbigamefi-casino-keeper@primary --since "10 minutes ago" \
  | rg "casino.keeper.enqueued|casino.keeper.finalize"
```

5. Confirm `/portfolio/activity/<betId>` or the result modal shows a terminal
   chain proof.
6. Record bet id, place tx, VRF request, finalize tx, and health snapshot age in
   `docs/deploy/` when the canary is part of a release rehearsal.

### 6.2 Sportsbook

Before enabling `KEEPER_SPORTS_TERMINALIZER_ENABLED=true` in production:

1. Create or reuse a sportsbook canary market with at least one held ticket.
2. Propose a result and wait until `finalizesAt`.
3. Confirm the primary logs a sportsbook terminalizer schedule and terminal
   outcome:

```bash
sudo journalctl -u arbigamefi-casino-keeper@primary --since "30 minutes ago" \
  | rg "sports.terminalizer.scheduled|sports.terminalizer.outcome"
```

4. Confirm `SportsHub.getMarket(marketId)` reaches `Resolved` or `Voided`.
5. Confirm every held canary ticket reaches `Settled` or `Refunded` without the
   player-side fallback button.
6. Record market id, ticket ids, result tx, finalize tx, terminal ticket txs,
   and health snapshot age in `docs/deploy/`.

## 7. Failure Handling

| Symptom | First check | Action |
| --- | --- | --- |
| `RandomReady` bets stay unfinalized | `journalctl` for enqueue/finalize errors | Restart primary once; if still failing, start or promote backup and manually finalize stuck ids. |
| Sportsbook result stays finality-ready | `journalctl` for `sports.terminalizer.*`, `getResult(marketId)`, and `getMarket(marketId)` | Restart primary once; if still failing, promote backup or manually call `finalizeResult`. |
| Sportsbook held tickets stay terminalizable | ticket state, market state, and `sports.terminalizer.outcome` counts | Manually call `settleTicket` for resolved markets or `refundTicket` for voided markets; then inspect keeper ticket scan start block and cap. |
| Health route stale | `KEEPER_HEALTH_PATH`, file permissions, unit status | Fix path/ownership; do not treat missing health as healthy. |
| RPC errors | provider dashboard and keeper logs | Switch primary RPC endpoint; backup should already use a different provider. |
| Postgres unavailable | keeper logs `bet_index_*_failed` | Settlement should continue. Disable `BET_INDEX_WRITE_ENABLED` only if connection churn threatens process stability. |
| Repeated finalize revert | inspect `getBet(betId)` and contract state | If state is already terminal, mark as raced success. Otherwise escalate as protocol incident. |

Manual fallback remains permissionless:

```bash
cast send $GAME_HUB "finalize(uint256)" $BET_ID --rpc-url $RPC --private-key $KEEPER_PK
cast send $SPORTS_HUB "finalizeResult(uint64)" $MARKET_ID --rpc-url $RPC --private-key $KEEPER_PK
cast send $SPORTS_HUB "settleTicket(uint256)" $TICKET_ID --rpc-url $RPC --private-key $KEEPER_PK
cast send $SPORTS_HUB "refundTicket(uint256)" $TICKET_ID --rpc-url $RPC --private-key $KEEPER_PK
```

## 8. Rollback

Rollback means reverting the keeper process, not the contracts.

```bash
sudo systemctl stop arbigamefi-casino-keeper@primary
sudo systemctl start arbigamefi-casino-keeper@backup
```

If both automated keepers are down, the frontend exposes manual `Settle result`
after the keeper delay threshold, and operators can use the `cast send` fallback
above.

## 9. Acceptance Checklist

- [ ] Primary keeper unit starts and writes a fresh health snapshot.
- [ ] Backup keeper unit starts with `KEEPER_BACKUP_DELAY_SECONDS=5`.
- [ ] Primary and backup use different EOAs and RPC providers.
- [ ] Durable bet index migration succeeds when `BET_INDEX_WRITE_ENABLED=true`.
- [ ] Durable bet index backup and restore drill is recorded per
      `docs/ops/runbooks/bet-index-production.md`.
- [ ] A minimal canary bet reaches terminal state without player manual settle.
- [ ] If sportsbook terminalization is enabled, a canary market finalizes and
      all held canary tickets settle/refund without player manual action.
- [ ] `/ops/casino-keeper-health.json` reports a fresh primary snapshot.
- [ ] Stuck `RandomReady` alert owner and escalation channel are documented.
- [ ] Sportsbook finality-ready and terminalizable-ticket alert owners are documented.

## 10. Don'ts

- Do not run primary and backup with the same private key.
- Do not write keeper health snapshots under `apps/web/public`.
- Do not make Postgres availability a precondition for settlement.
- Do not restart from the release block on every production restart after the
  durable cursor has been seeded.
- Do not hide manual fallback; it is the emergency path when both keepers fail.
- Do not enable sportsbook terminalization against a release without `SportsHub`
  or before the sportsbook canary has passed.
