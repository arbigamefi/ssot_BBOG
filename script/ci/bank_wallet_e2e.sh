#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
forge build src/core/Bank.sol test/mocks/MockERC20.sol test/mocks/BlacklistToken.sol
RUN_DIR=$(mktemp -d)
EMBEDDED=frontend/packages/ssot/src/release/embedded/index.ts
cp "$EMBEDDED" "$RUN_DIR/embedded.ts"
NODE_PID=""; WEB_PID=""
cleanup() {
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; wait "$WEB_PID" 2>/dev/null || true; fi
  if [ -n "$NODE_PID" ]; then kill "$NODE_PID" 2>/dev/null || true; wait "$NODE_PID" 2>/dev/null || true; fi
  if [ ! -f "$RUN_DIR/generated.ts" ] || cmp -s "$EMBEDDED" "$RUN_DIR/generated.ts"; then
    cp "$RUN_DIR/embedded.ts" "$EMBEDDED"
    rm -rf "$RUN_DIR"
  else
    echo "Fixture changed externally; preserved it and original at $RUN_DIR/embedded.ts" >&2
  fi
}
trap cleanup EXIT
export BANK_ANVIL_RPC="http://127.0.0.1:${BANK_TEST_PORT:-18559}"
export BANK_E2E_STATE="$RUN_DIR/state.json"
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:${BANK_WEB_PORT:-3159}"
anvil --host 127.0.0.1 --port "${BANK_TEST_PORT:-18559}" --chain-id 84532 --silent >"$RUN_DIR/anvil.log" 2>&1 &
NODE_PID=$!
for attempt in {1..50}; do
  kill -0 "$NODE_PID" || { cat "$RUN_DIR/anvil.log"; exit 1; }
  if cast chain-id --rpc-url "$BANK_ANVIL_RPC" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
kill -0 "$NODE_PID"
node frontend/apps/web/e2e/prepare-bank.mjs
cp "$EMBEDDED" "$RUN_DIR/generated.ts"
export NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL="$BANK_ANVIL_RPC"
export BASE_SEPOLIA_RPC_URL="$BANK_ANVIL_RPC"
export NEXT_PUBLIC_MAINNET_RPC_URL="$BANK_ANVIL_RPC"
export NEXT_PUBLIC_CHAIN_ID=84532
export NEXT_PUBLIC_ENABLE_ENS_LOOKUP=false
export BET_INDEX_READ_ENABLED=false
export BET_INDEX_DATABASE_URL=""
export NEXT_PUBLIC_SENTRY_DSN=""
export SENTRY_DSN=""
# Build and serve the production bundle used by the release money-flow gate.
pnpm -C frontend/apps/web build >"$RUN_DIR/build.log" 2>&1 || { tail -80 "$RUN_DIR/build.log"; exit 1; }
# Next's standalone output excludes public/static assets; package them exactly as in production.
STANDALONE=frontend/apps/web/.next/standalone/apps/web
cp -R frontend/apps/web/public "$STANDALONE/public"
cp -R frontend/apps/web/.next/static "$STANDALONE/.next/static"
# Owned process only; the test never attaches to an existing server.
(HOSTNAME=127.0.0.1 PORT="${BANK_WEB_PORT:-3159}" exec node "$STANDALONE/server.js") >"$RUN_DIR/web.log" 2>&1 &
WEB_PID=$!
for attempt in {1..180}; do
  kill -0 "$WEB_PID" || { cat "$RUN_DIR/web.log"; exit 1; }
  if curl --silent --max-time 3 --fail "$PLAYWRIGHT_BASE_URL/earn" >/dev/null; then break; fi
  sleep 1
done
kill -0 "$WEB_PID"
# Explicit config avoids the ordinary CI server/build hook; the owned fixture server is already live.
pnpm -C frontend/apps/web exec playwright test -c playwright.bank.config.ts || { tail -80 "$RUN_DIR/web.log"; exit 1; }
