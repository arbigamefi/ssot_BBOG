#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v16.json}"

if [[ ! -f "$SNAPSHOT_PATH" ]]; then
  echo "missing snapshot: $SNAPSHOT_PATH"
  echo "hint: supply the digest-verified release bundle to the Release Gate workflow."
  exit 1
fi

# The workflow authenticates the signed bundle before this entrypoint. This
# fixture covers the first single-USDC casino release, not arbitrary pool sets.
jq -e '.architectureVersion == "v1.6-nft-liquidity" and
  .numPools == 1 and .poolDomain_0 == 1 and
  .poolAssetDecimals_0 == 6 and .poolAssetSymbol_0 == "USDC" and .gameMaxBetCount_COIN_TOSS >= 1 and
  .gameCallbackGasLimit_COIN_TOSS >= 200000 and
  .gameCallbackGasLimit_COIN_TOSS <= 2447746' "$SNAPSHOT_PATH" >/dev/null || {
  echo "fork gate requires the current single-USDC casino snapshot and explicit game admission"
  exit 1
}

CHAIN_ID=$(jq -r '.chainId // empty' "$SNAPSHOT_PATH")
VRF_WRAPPER_FROM_SNAPSHOT=$(jq -r '.vrfWrapper // empty' "$SNAPSHOT_PATH")

if [[ -z "$CHAIN_ID" || "$CHAIN_ID" == "null" ]]; then
  echo "failed to parse chainId from $SNAPSHOT_PATH"
  exit 1
fi

if [[ -z "$VRF_WRAPPER_FROM_SNAPSHOT" || "$VRF_WRAPPER_FROM_SNAPSHOT" == "null" ]]; then
  echo "failed to parse vrfWrapper from $SNAPSHOT_PATH"
  exit 1
fi

# The Base public RPCs serve the gate: governance replay pages and retries within their limits. FORK_RPC_URL
# overrides them, for example with an operator endpoint from script/tools/with-ops-rpc.sh.
case "$CHAIN_ID" in
  8453) NETWORK="base"; RPC_URL="${FORK_RPC_URL:-https://mainnet.base.org}" ;;
  84532) NETWORK="base_sepolia"; RPC_URL="${FORK_RPC_URL:-https://sepolia.base.org}" ;;
  *)
    echo "unsupported chainId=$CHAIN_ID; the release gate covers Base and Base Sepolia"
    exit 1 ;;
esac

# A release gate cannot silently substitute a reference wrapper or historical
# block. Use the release address and the fresh block checked by governance.
if [[ -n "${FORK_VRF_WRAPPER:-}" || -n "${FORK_BLOCK_NUMBER:-}" ]]; then
  echo "release fork target overrides are forbidden; use the standalone reference fork for historical checks"
  exit 1
fi
WRAPPER="$VRF_WRAPPER_FROM_SNAPSHOT"
if [[ -z "$WRAPPER" || "$WRAPPER" == "0x0000000000000000000000000000000000000000" ]]; then
  echo "missing wrapper address (snapshot=$VRF_WRAPPER_FROM_SNAPSHOT)"
  exit 1
fi

echo "[fork gate] network=$NETWORK chainId=$CHAIN_ID wrapper=$WRAPPER"

GOVERNANCE_RESULT=$(SNAPSHOT_PATH="$SNAPSHOT_PATH" RPC_URL="$RPC_URL" "${PYTHON:-python3}" script/release/verify_governance.py)
BLOCK_NUMBER=$(jq -er --argjson chain "$CHAIN_ID" \
  'select(.status == "verified" and .chainId == $chain and .blockNumber > 0) | .blockNumber' <<<"$GOVERNANCE_RESULT")

# Deployed core runtimes, immutable wiring and the certified domain, at the same governance block (audit F-01).
SNAPSHOT_PATH="$SNAPSHOT_PATH" RPC_URL="$RPC_URL" CALLBACK_FORK_BLOCK="$BLOCK_NUMBER" CALLBACK_REQUIRE_FORK=1 \
  forge script script/release/VerifyCallbackDomainV16.s.sol:VerifyCallbackDomainV16 -vvv

export NFT_DIRECT_WRAPPER_FORK=true
export NFT_FORK_RPC_URL="$RPC_URL"
export NFT_FORK_CHAIN_ID="$CHAIN_ID"
export NFT_FORK_BLOCK_NUMBER="$BLOCK_NUMBER"
export NFT_FORK_WRAPPER="$WRAPPER"
export NFT_FORK_USDC
NFT_FORK_USDC=$(jq -er '.poolAsset_0' "$SNAPSHOT_PATH")
export NFT_FORK_CALLBACK_GAS
NFT_FORK_CALLBACK_GAS=$(jq -er '.gameCallbackGasLimit_COIN_TOSS' "$SNAPSHOT_PATH")

REPORT_DIR="${FORK_REPORT_DIR:-dist/fork-gate}"
mkdir -p "$REPORT_DIR"
printf '%s\n' "$GOVERNANCE_RESULT" > "$REPORT_DIR/governance.json"
echo "[fork gate] frozen block=$BLOCK_NUMBER; single-round wrapper/USDC integration only"
forge test --match-path test/fork/NftDirectWrapperFork.t.sol --json > "$REPORT_DIR/tests.json"

# Forge exits zero for skipped tests too. Require actual execution of every case.
RPC_URL="$RPC_URL" "${PYTHON:-python3}" - "$REPORT_DIR/tests.json" "$REPORT_DIR/governance.json" <<'PY'
import json, os, sys
sys.path.insert(0, 'script/release')
from verify_governance import Rpc
with open(sys.argv[1]) as source:
    suites = json.load(source)
tests = [result for suite in suites.values() for result in suite['test_results'].values()]
if len(tests) != 4 or any(result['status'] != 'Success' for result in tests):
    raise SystemExit('fork gate rejected: expected four executed passing tests, no skips')
with open(sys.argv[2]) as source:
    frozen = json.load(source)
block = Rpc(os.environ['RPC_URL'])('eth_getBlockByNumber', [hex(frozen['blockNumber']), False])
if block['hash'] != frozen['blockHash']:
    raise SystemExit('fork gate rejected: governance block changed; retry complete verification')
print('[fork gate] 4 executed tests passed; maximum-complexity gas qualification remains separate')
PY
