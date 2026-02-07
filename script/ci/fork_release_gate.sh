#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest.json}"

if [[ ! -f "$SNAPSHOT_PATH" ]]; then
  echo "missing snapshot: $SNAPSHOT_PATH"
  echo "hint: run a deploy (writes deployments/latest.json) and include the artifacts in the release commit/tag."
  exit 1
fi

# Snapshot JSON is written under the root key "ssot" by Deploy.s.sol.
CHAIN_ID=$(jq -r '.ssot.chainId // .chainId // empty' "$SNAPSHOT_PATH")
VRF_WRAPPER_FROM_SNAPSHOT=$(jq -r '.ssot.vrfWrapper // .vrfWrapper // empty' "$SNAPSHOT_PATH")

if [[ -z "$CHAIN_ID" || "$CHAIN_ID" == "null" ]]; then
  echo "failed to parse chainId from $SNAPSHOT_PATH"
  exit 1
fi

if [[ -z "$VRF_WRAPPER_FROM_SNAPSHOT" || "$VRF_WRAPPER_FROM_SNAPSHOT" == "null" ]]; then
  echo "failed to parse vrfWrapper from $SNAPSHOT_PATH"
  exit 1
fi

# Prefer explicit overrides, otherwise map chainId to a configured RPC secret.
RPC_URL="${FORK_RPC_URL:-}"
if [[ -z "$RPC_URL" ]]; then
  case "$CHAIN_ID" in
    8453)
      RPC_URL="${FORK_RPC_URL_BASE:-}"; NETWORK="base";;
    84532)
      RPC_URL="${FORK_RPC_URL_BASE_SEPOLIA:-}"; NETWORK="base_sepolia";;
    42161)
      RPC_URL="${FORK_RPC_URL_ARBITRUM_ONE:-}"; NETWORK="arbitrum_one";;
    421614)
      RPC_URL="${FORK_RPC_URL_ARBITRUM_SEPOLIA:-}"; NETWORK="arbitrum_sepolia";;
    *)
      echo "unknown chainId=$CHAIN_ID. Set FORK_RPC_URL explicitly.";
      exit 1;;
  esac
else
  NETWORK="custom"
fi

if [[ -z "$RPC_URL" ]]; then
  echo "missing fork RPC URL for chainId=$CHAIN_ID (network=$NETWORK)"
  echo "set one of: FORK_RPC_URL (override) or secrets/env vars:"
  echo "  - FORK_RPC_URL_BASE (8453)"
  echo "  - FORK_RPC_URL_BASE_SEPOLIA (84532)"
  echo "  - FORK_RPC_URL_ARBITRUM_ONE (42161)"
  echo "  - FORK_RPC_URL_ARBITRUM_SEPOLIA (421614)"
  exit 1
fi

# Use wrapper from snapshot unless explicitly overridden.
WRAPPER="${FORK_VRF_WRAPPER:-$VRF_WRAPPER_FROM_SNAPSHOT}"
if [[ -z "$WRAPPER" || "$WRAPPER" == "0x0000000000000000000000000000000000000000" ]]; then
  echo "missing wrapper address (snapshot=$VRF_WRAPPER_FROM_SNAPSHOT)"
  exit 1
fi

export FORK_REQUIRED=1
export FORK_RPC_URL="$RPC_URL"
export FORK_VRF_WRAPPER="$WRAPPER"
export FORK_EXPECT_CHAIN_ID="$CHAIN_ID"

echo "[fork gate] network=$NETWORK chainId=$CHAIN_ID wrapper=$WRAPPER"

# Optional: allow pinning a fork block.
if [[ -n "${FORK_BLOCK_NUMBER:-}" ]]; then
  echo "[fork gate] blockNumber=$FORK_BLOCK_NUMBER"
fi

forge test --match-path "test/fork/*" -vvv
