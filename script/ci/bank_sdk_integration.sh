#!/usr/bin/env bash
set -euo pipefail
# Always build the current source; never reuse an unrelated node or live chain.
cd "$(dirname "$0")/../.."
forge build src test/mocks/MockERC20.sol test/mocks/BlacklistToken.sol
PORT="${BANK_TEST_PORT:-18549}"
LOG=$(mktemp)
anvil --host 127.0.0.1 --port "$PORT" --chain-id 84532 --silent >"$LOG" 2>&1 &
NODE_PID=$!
cleanup() { kill "$NODE_PID" 2>/dev/null || true; wait "$NODE_PID" 2>/dev/null || true; rm -f "$LOG"; }
trap cleanup EXIT
export BANK_ANVIL_RPC="http://127.0.0.1:$PORT"
for attempt in {1..50}; do
  if ! kill -0 "$NODE_PID" 2>/dev/null; then cat "$LOG"; exit 1; fi
  if cast chain-id --rpc-url "$BANK_ANVIL_RPC" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
# A failed bind must not attach this suite to a node owned by another process.
kill -0 "$NODE_PID"
pnpm -C frontend/packages/ssot test src/sdk/__tests__/bankAsync.anvil.test.ts
