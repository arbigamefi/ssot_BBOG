#!/usr/bin/env bash
set -euo pipefail

# Checks that every deployed V14 Bank uses the same share decimals as its
# underlying asset. This catches misconfigured USDC pools before frontend
# manifests or LP accounting depend on a bad immutable Bank parameter.
#
# Usage:
#   RPC_URL=https://... bash script/ci/v14_bank_decimals_check.sh [snapshot-json]
#   ENV_FILE=.base-sepolia-v14-casino.env bash script/ci/v14_bank_decimals_check.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [snapshot-json]" >&2
  exit 2
fi

if [[ -n "${ENV_FILE:-}" ]]; then
  [[ -f "$ENV_FILE" ]] || fail "ENV_FILE not found: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

SNAPSHOT_PATH="${1:-${SNAPSHOT_PATH:-deployments/latest-v14.json}}"
[[ -f "$SNAPSHOT_PATH" ]] || fail "snapshot not found: $SNAPSHOT_PATH"
[[ -n "${RPC_URL:-}" ]] || fail "RPC_URL is required"

command -v jq >/dev/null 2>&1 || fail "jq is required"
command -v cast >/dev/null 2>&1 || fail "foundry cast is required"

normalize_uint() {
  local raw="$1"
  raw="$(echo "$raw" | tr -d '[:space:]')"
  if [[ "$raw" =~ ^0x[0-9a-fA-F]+$ ]]; then
    printf "%d" "$raw"
  else
    echo "$raw"
  fi
}

normalize_address() {
  echo "$1" | tr '[:upper:]' '[:lower:]'
}

call_uint8() {
  local address="$1"
  local signature="$2"
  normalize_uint "$(cast call "$address" "$signature" --rpc-url "$RPC_URL")"
}

call_address() {
  local address="$1"
  local signature="$2"
  cast call "$address" "$signature" --rpc-url "$RPC_URL" | tr -d '[:space:]'
}

snapshot_chain_id="$(jq -r '.chainId // empty' "$SNAPSHOT_PATH")"
[[ -n "$snapshot_chain_id" ]] || fail "snapshot missing chainId"

rpc_chain_id="$(normalize_uint "$(cast chain-id --rpc-url "$RPC_URL")")"
if [[ "$rpc_chain_id" != "$snapshot_chain_id" ]]; then
  fail "RPC chainId $rpc_chain_id does not match snapshot chainId $snapshot_chain_id"
fi

num_pools="$(jq -r '.numPools // empty' "$SNAPSHOT_PATH")"
[[ "$num_pools" =~ ^[0-9]+$ ]] || fail "snapshot missing numeric numPools"
[[ "$num_pools" -gt 0 ]] || fail "snapshot contains no pools"

errors=0
echo "Checking V14 Bank decimals:"
echo "  snapshot: $SNAPSHOT_PATH"
echo "  chainId:  $snapshot_chain_id"

for ((i = 0; i < num_pools; i += 1)); do
  pool_asset="$(jq -r ".poolAsset_${i} // empty" "$SNAPSHOT_PATH")"
  pool_bank="$(jq -r ".poolBank_${i} // empty" "$SNAPSHOT_PATH")"
  expected_asset_decimals="$(jq -r ".poolAssetDecimals_${i} // empty" "$SNAPSHOT_PATH")"
  expected_bank_decimals="$(jq -r ".poolBankDecimals_${i} // empty" "$SNAPSHOT_PATH")"

  if [[ -z "$pool_asset" || -z "$pool_bank" || -z "$expected_asset_decimals" ]]; then
    echo "  pool_$i: missing poolAsset/poolBank/poolAssetDecimals in snapshot" >&2
    errors=$((errors + 1))
    continue
  fi

  asset_decimals="$(call_uint8 "$pool_asset" "decimals()(uint8)")"
  bank_decimals="$(call_uint8 "$pool_bank" "decimals()(uint8)")"
  bank_asset="$(call_address "$pool_bank" "asset()(address)")"

  echo "  pool_$i:"
  echo "    asset:          $pool_asset"
  echo "    bank:           $pool_bank"
  echo "    asset decimals: snapshot=$expected_asset_decimals chain=$asset_decimals"
  if [[ -n "$expected_bank_decimals" ]]; then
    echo "    bank decimals:  snapshot=$expected_bank_decimals chain=$bank_decimals"
  else
    echo "    bank decimals:  snapshot=<missing> chain=$bank_decimals"
  fi

  if [[ "$(normalize_address "$bank_asset")" != "$(normalize_address "$pool_asset")" ]]; then
    echo "    error: Bank.asset() points to $bank_asset" >&2
    errors=$((errors + 1))
  fi

  if [[ "$asset_decimals" != "$expected_asset_decimals" ]]; then
    echo "    error: poolAssetDecimals_$i does not match asset.decimals()" >&2
    errors=$((errors + 1))
  fi

  if [[ -n "$expected_bank_decimals" && "$bank_decimals" != "$expected_bank_decimals" ]]; then
    echo "    error: poolBankDecimals_$i does not match bank.decimals()" >&2
    errors=$((errors + 1))
  fi

  if [[ "$bank_decimals" != "$asset_decimals" ]]; then
    echo "    error: Bank share decimals must equal asset decimals" >&2
    errors=$((errors + 1))
  fi
done

if [[ "$errors" -gt 0 ]]; then
  fail "V14 Bank decimals check failed with $errors issue(s)"
fi

echo "V14 Bank decimals check passed for $num_pools pool(s)."
