#!/usr/bin/env bash
set -euo pipefail

# Runs the v1.3 GameHub casino canary script.
#
# Usage:
#   bash script/ci/v13_gamehub_canary.sh [env-file]
#
# Defaults to simulation only. Set BROADCAST=1 to send transactions.

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [env-file]" >&2
  exit 2
fi

if [[ $# -eq 1 ]]; then
  ENV_FILE="$1"
  [[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

command -v forge >/dev/null 2>&1 || fail "missing command: forge"

[[ -n "${RPC_URL:-}" ]] || fail "missing env: RPC_URL"
[[ -n "${PRIVATE_KEY:-}" ]] || fail "missing env: PRIVATE_KEY"

args=(script/ops/GameHubCanaryV13.s.sol:GameHubCanaryV13 --rpc-url "$RPC_URL" -vvv)
if [[ "${BROADCAST:-0}" == "1" ]]; then
  args+=(--broadcast)
fi

forge script "${args[@]}"
