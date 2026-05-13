#!/usr/bin/env bash
set -euo pipefail

# Configures v1.3 SportsHub operational roles on an existing deployment.
#
# Usage:
#   bash script/ci/v13_sports_roles.sh [env-file]
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
[[ -n "${SPORTS_ODDS_SIGNER:-}" ]] || fail "missing env: SPORTS_ODDS_SIGNER"
[[ -n "${SPORTS_RESULT_REPORTER:-}" ]] || fail "missing env: SPORTS_RESULT_REPORTER"
[[ -n "${SPORTS_RESULT_CHALLENGER:-}" ]] || fail "missing env: SPORTS_RESULT_CHALLENGER"
[[ -n "${SPORTS_RESULT_ARBITRATOR:-}" ]] || fail "missing env: SPORTS_RESULT_ARBITRATOR"

args=(script/ops/SportsRolesV13.s.sol:SportsRolesV13 --rpc-url "$RPC_URL" -vvv)
if [[ "${BROADCAST:-0}" == "1" ]]; then
  args+=(--broadcast)
fi

forge script "${args[@]}"
