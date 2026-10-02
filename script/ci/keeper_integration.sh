#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
forge build src test/mocks/BlacklistToken.sol
pnpm -C frontend/apps/keeper build
PORT="${KEEPER_TEST_PORT:-18569}"
CONTAINER="agf-keeper-test-$(uuidgen | tr '[:upper:]' '[:lower:]')"
NODE_PID=""
cleanup() {
  if [ -n "$NODE_PID" ]; then kill "$NODE_PID" 2>/dev/null || true; wait "$NODE_PID" 2>/dev/null || true; fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT
DB_PASSWORD="$(uuidgen)"
docker run --rm -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$DB_PASSWORD" -e POSTGRES_DB=keeper_test -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
for attempt in {1..60}; do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
DB_PORT=$(docker port "$CONTAINER" 5432/tcp | cut -d: -f2)
export KEEPER_TEST_POSTGRES_URL="postgres://postgres:$DB_PASSWORD@127.0.0.1:$DB_PORT/keeper_test"
export KEEPER_TEST_ANVIL_RPC="http://127.0.0.1:$PORT"
RUST_LOG=error anvil --host 127.0.0.1 --port "$PORT" --chain-id 84532 --silent >/dev/null 2>&1 &
NODE_PID=$!
for attempt in {1..50}; do
  kill -0 "$NODE_PID"
  if cast chain-id --rpc-url "$KEEPER_TEST_ANVIL_RPC" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
kill -0 "$NODE_PID"
node frontend/apps/keeper/integration/casino.mjs
pnpm -C frontend/packages/bet-index exec vitest run src/recovery.postgres.test.ts src/financial-aggregates.test.ts src/house-edge.test.ts
