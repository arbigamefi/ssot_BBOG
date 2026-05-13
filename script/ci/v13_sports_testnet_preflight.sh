#!/usr/bin/env bash
set -euo pipefail

# Preflight for public testnet v1.3 Casino+Sports rehearsals.
#
# Usage:
#   bash script/ci/v13_sports_testnet_preflight.sh [env-file]
#
# The env file, when provided, is sourced with `set -a` so values become exported for Foundry scripts.
# This script does not broadcast transactions.

fail() {
  echo "error: $*" >&2
  exit 1
}

warn() {
  echo "warn: $*" >&2
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [env-file]" >&2
  exit 2
fi

need_cmd git
ROOT_DIR="$(git rev-parse --show-toplevel)"

if [[ $# -eq 1 ]]; then
  ENV_FILE="$1"
  [[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

need_var() {
  local name="$1"
  local value="${!name-}"
  [[ -n "$value" ]] || fail "missing env: $name"
}

is_address() {
  [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]
}

is_bytes32() {
  [[ "$1" =~ ^0x[0-9a-fA-F]{64}$ ]]
}

is_positive_decimal() {
  [[ "$1" =~ ^[0-9]+$ ]] && [[ "${1//0/}" != "" ]]
}

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

need_address() {
  local name="$1"
  need_var "$name"
  local value="${!name}"
  is_address "$value" || fail "$name must be an address: $value"
  [[ "$(lower "$value")" != "0x0000000000000000000000000000000000000000" ]] || fail "$name is zero address"
}

need_bytes32() {
  local name="$1"
  need_var "$name"
  local value="${!name}"
  local value_lc
  is_bytes32 "$value" || fail "$name must be bytes32: $value"
  value_lc="$(lower "$value")"
  [[ "$value_lc" != "0x0000000000000000000000000000000000000000000000000000000000000000" ]] || fail "$name is zero hash"
  [[ "$value_lc" != "0x1111111111111111111111111111111111111111111111111111111111111111" ]] || fail "$name still uses dry-run dummy hash"
  [[ "$value_lc" != "0x2222222222222222222222222222222222222222222222222222222222222222" ]] || fail "$name still uses dry-run dummy hash"
}

need_positive_decimal() {
  local name="$1"
  need_var "$name"
  local value="${!name}"
  is_positive_decimal "$value" || fail "$name must be a positive integer: $value"
}

need_contract_code() {
  local label="$1"
  local address="$2"
  local code
  code="$(cast code "$address" --rpc-url "$RPC_URL")"
  [[ "$code" != "0x" ]] || fail "$label has no code at $address on chain $CHAIN_ID"
}

need_cmd cast

need_var RPC_URL
need_var PRIVATE_KEY
need_address GOV
need_address VRF_WRAPPER
need_positive_decimal REQUEST_GAS_PRICE_WEI
need_positive_decimal NUM_POOLS
POOL_COUNT=$((10#$NUM_POOLS))
if (( POOL_COUNT > 32 )); then
  fail "NUM_POOLS out of range: $NUM_POOLS"
fi

DERIVED_GOV="$(cast wallet address --private-key "$PRIVATE_KEY")"
[[ "$(lower "$DERIVED_GOV")" == "$(lower "$GOV")" ]] || {
  fail "PRIVATE_KEY derives $DERIVED_GOV, not GOV=$GOV"
}

CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
[[ -n "$CHAIN_ID" ]] || fail "could not read chain id from RPC_URL"
case "$CHAIN_ID" in
  84532|421614) ;;
  *) warn "chain id $CHAIN_ID is not a documented testnet target for this repo" ;;
esac

need_contract_code "VRF_WRAPPER" "$VRF_WRAPPER"

has_casino=0
has_sports=0
for ((i = 0; i < POOL_COUNT; ++i)); do
  pool_id_var="POOL_ID_${i}"
  pool_asset_var="POOL_ASSET_${i}"
  pool_domain_var="POOL_DOMAIN_${i}"

  need_var "$pool_id_var"
  need_var "$pool_asset_var"
  need_var "$pool_domain_var"

  pool_id="${!pool_id_var}"
  pool_domain="${!pool_domain_var}"
  pool_asset="${!pool_asset_var}"

  is_positive_decimal "$pool_id" || fail "$pool_id_var must be a positive integer: $pool_id"
  is_address "$pool_asset" || fail "$pool_asset_var must be an address: $pool_asset"
  [[ "$(lower "$pool_asset")" != "0x0000000000000000000000000000000000000000" ]] || fail "$pool_asset_var is zero address"
  need_contract_code "$pool_asset_var" "$pool_asset"

  case "$pool_domain" in
    1) has_casino=1 ;;
    2) has_sports=1 ;;
    3) warn "$pool_domain_var is Future; no FutureHub risk-in path exists yet" ;;
    *) fail "$pool_domain_var must be 1=Casino, 2=Sports, or 3=Future: $pool_domain" ;;
  esac
done

[[ "$has_casino" == "1" ]] || fail "at least one Casino pool is required for the v1.3 rehearsal topology"
[[ "$has_sports" == "1" ]] || fail "at least one Sports pool is required for the SportsHub rehearsal topology"

need_positive_decimal SPORTS_MAX_STAKE
need_positive_decimal SPORTS_MAX_PAYOUT
need_positive_decimal SPORTS_MAX_MARKET_RESERVED
need_positive_decimal SPORTS_MAX_OUTCOME_RESERVED
need_positive_decimal SPORTS_MAX_EVENT_RESERVED
need_bytes32 SPORTS_ODDS_SIGNER_SET_HASH
need_bytes32 SPORTS_RESULT_REPORTER_SET_HASH
need_positive_decimal SPORTS_RESULT_REPORTER_THRESHOLD
SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS="${SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS:-604800}"
need_positive_decimal SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS

if [[ "$SPORTS_RESULT_REPORTER_THRESHOLD" =~ ^[0-9]+$ ]]; then
  result_reporter_threshold=$((10#$SPORTS_RESULT_REPORTER_THRESHOLD))
  if (( result_reporter_threshold > 255 )); then
    fail "SPORTS_RESULT_REPORTER_THRESHOLD must fit uint8"
  fi
fi

if [[ "$SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]]; then
  result_challenge_timeout=$((10#$SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS))
  if (( result_challenge_timeout < 600 )); then
    fail "SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS must be >= 600"
  fi
fi

case "${SPORTS_DERIVE_ROLE_SET_HASHES:-false}" in
  true|false) ;;
  *) fail "SPORTS_DERIVE_ROLE_SET_HASHES must be true or false when set" ;;
esac

need_address SPORTS_ODDS_SIGNER
need_address SPORTS_RESULT_REPORTER
need_address SPORTS_RESULT_CHALLENGER
need_address SPORTS_RESULT_ARBITRATOR

(
  cd "$ROOT_DIR"
  bash script/ci/check_deps.sh
)

echo "v1.3 Sports testnet preflight passed:"
echo "  chainId: $CHAIN_ID"
echo "  gov: $GOV"
echo "  vrfWrapper: $VRF_WRAPPER"
echo "  pools: $POOL_COUNT"
echo "  sportsResultReporterThreshold: $SPORTS_RESULT_REPORTER_THRESHOLD"
echo "  sportsResultChallengeTimeoutSeconds: $SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS"
echo "  sportsDeriveRoleSetHashes: ${SPORTS_DERIVE_ROLE_SET_HASHES:-false}"
