#!/usr/bin/env bash
# Read-only Base Denim check on Base Sepolia (launch candidate plan A13 and section 13):
#
#   script/ops/denim-activation-check.sh <new output directory>
#
# Through the Alchemy operator endpoint (script/tools/with-ops-rpc.sh; the key is never shown):
#   1. script/ops/denim_activation_check.py at the head block: check.json and check.log;
#   2. the direct-wrapper fork test at that block with the certified wrapper, USDC and callback gas, through the test's
#      explicit fork target: direct-wrapper.log.
# RUN.txt names the commit and the times. Exits non-zero when either step fails; both always run.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:?usage: $0 <new output directory>}
[ ! -e "$out" ] || { echo "exists: $out" >&2; exit 1; }
mkdir -p "$out"
out=$(cd "$out" && pwd)
cd "$root"
{ echo "commit $(git rev-parse HEAD)"; echo "started $(date -u +%Y-%m-%dT%H:%M:%SZ)"; } > "$out/RUN.txt"

status=0
script/tools/with-ops-rpc.sh alchemy base-sepolia python3 script/ops/denim_activation_check.py "$out/check.json" \
  > "$out/check.log" 2>&1 || status=1
cat "$out/check.log"
block=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["cadence"]["head"])' "$out/check.json")
read -r wrapper usdc gas < <(python3 -c 'import json; d = json.load(open("script/release/first-callback-domain-84532.json")); print(d["providerReference"]["wrapper"], d["token"]["proxy"], d["consumerCallbackGasLimit"])')
script/tools/with-ops-rpc.sh alchemy base-sepolia env NFT_DIRECT_WRAPPER_FORK=true NFT_FORK_BLOCK_NUMBER="$block" \
  NFT_FORK_CHAIN_ID=84532 NFT_FORK_WRAPPER="$wrapper" NFT_FORK_USDC="$usdc" NFT_FORK_CALLBACK_GAS="$gas" \
  FOUNDRY_PROFILE=pr bash -c 'NFT_FORK_RPC_URL="$OPS_RPC_URL" forge test --match-path test/fork/NftDirectWrapperFork.t.sol -vv' \
  > "$out/direct-wrapper.log" 2>&1 || status=1
grep -E 'fork target mode|Suite result' "$out/direct-wrapper.log" | sort -u
echo "finished $(date -u +%Y-%m-%dT%H:%M:%SZ) status $status" >> "$out/RUN.txt"
exit "$status"
