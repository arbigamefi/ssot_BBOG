#!/usr/bin/env bash
set -euo pipefail

# Runs the v1.3 World Cup football 1X2 MVP canary.
#
# Usage:
#   bash script/ci/v13_worldcup_football_canary.sh [env-file]
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

if [[ -n "${ROLE_ENV_FILE:-}" ]]; then
  [[ -f "$ROLE_ENV_FILE" ]] || fail "role env file not found: $ROLE_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ROLE_ENV_FILE"
  set +a
fi

command -v forge >/dev/null 2>&1 || fail "missing command: forge"

[[ -n "${RPC_URL:-}" ]] || fail "missing env: RPC_URL"
[[ -n "${PRIVATE_KEY:-}" ]] || fail "missing env: PRIVATE_KEY"

args=(script/ops/WorldCupFootballCanaryV13.s.sol:WorldCupFootballCanaryV13 --rpc-url "$RPC_URL" -vvv)
if [[ "${BROADCAST:-0}" == "1" ]]; then
  args+=(--broadcast)
fi

forge script "${args[@]}"
