# Casino Keeper

Permissionless casino settlement worker for v1.3 `GameHub.finalize(betId)`.

Normal player UX signs only approval and `placeBet`. This worker listens for
`RandomReady` bets and settles them automatically.

## Build

```bash
pnpm -C frontend keeper:build
```

## Run

```bash
KEEPER_PRIVATE_KEY=0x... \
KEEPER_CHAIN_ID=84532 \
KEEPER_RPC_HTTP=https://... \
KEEPER_RPC_WS=wss://... \
KEEPER_RELEASE_PATH=frontend/packages/ssot/src/release/embedded/chain-84532.json \
KEEPER_START_BLOCK=41562978 \
KEEPER_SCAN_CHUNK_BLOCKS=10 \
KEEPER_HEALTH_PATH=frontend/apps/web/public/ops/casino-keeper-health.json \
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

`KEEPER_SCAN_CHUNK_BLOCKS` defaults to `10` so Base Sepolia free RPC providers
with tight `eth_getLogs` range limits can still catch delayed events. Increase it
only for providers with a documented larger logs range.

When `KEEPER_HEALTH_PATH` is set, the keeper writes an atomic JSON health
snapshot with queue depth, last scan, and last finalize success/failure. The
local web app can serve the recommended path at `/ops/casino-keeper-health.json`
so `/ops` can show keeper health beside indexer health.
