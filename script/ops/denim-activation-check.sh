#!/usr/bin/env bash
# Read-only Base Denim check on Base Sepolia (launch candidate plan A13 and section 13):
#
#   script/ops/denim-activation-check.sh [new output directory]
#
# Without an argument the output goes to dist/denim-activation-check-<UTC time>, a new directory on every run.
#
# Through the Alchemy operator endpoint (script/tools/with-ops-rpc.sh; the key is never shown):
#   1. script/ops/denim_activation_check.py at one block, named by number and hash: check.json and check.log;
#   2. the direct-wrapper fork test at that block number with the certified wrapper, USDC and callback gas, through the
#      test's explicit fork target: direct-wrapper.log. Skipped, and recorded as such, when step 1 left no block;
#   3. the block number must still name the same hash after the fork test (denim_activation_check.py --confirm):
#      confirm.log.
# RUN.txt names the commit, the block, each step's outcome and, whatever happens, the finish time and status. Exits
# non-zero when any step fails or is skipped.
set -uo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:-$root/dist/denim-activation-check-$(date -u +%Y%m%dT%H%M%SZ)}
[ ! -e "$out" ] || { echo "exists: $out" >&2; exit 1; }
mkdir -p "$out" || exit 1
out=$(cd "$out" && pwd)
echo "output: $out"
cd "$root" || exit 1
status=0
finish() { echo "finished $(date -u +%Y-%m-%dT%H:%M:%SZ) status $status" >> "$out/RUN.txt"; }
trap finish EXIT
trap 'status=130; exit 130' INT
trap 'status=143; exit 143' TERM
{ echo "commit $(git rev-parse HEAD)"; echo "started $(date -u +%Y-%m-%dT%H:%M:%SZ)"; } > "$out/RUN.txt"
step() { echo "$1" | tee -a "$out/RUN.txt"; }

script/tools/with-ops-rpc.sh alchemy base-sepolia python3 script/ops/denim_activation_check.py "$out/check.json" \
  > "$out/check.log" 2>&1 || status=1
cat "$out/check.log"
block=$(python3 -I -c 'import json, re, sys
b = json.load(open(sys.argv[1]))["block"]
assert type(b["number"]) is int and re.fullmatch("0x[0-9a-f]{64}", b["hash"])
print(b["number"], b["hash"])' "$out/check.json" 2> /dev/null)
if [ -z "$block" ]; then
  status=1
  step "check: failed without a report; direct wrapper and confirmation SKIPPED (no block to test)"
  exit "$status"
fi
read -r number hash <<< "$block"
step "check: block $number $hash, exit status $status"

read -r wrapper usdc gas < <(python3 -I -c 'import json; d = json.load(open("script/release/first-callback-domain-84532.json")); print(d["providerReference"]["wrapper"], d["token"]["proxy"], d["consumerCallbackGasLimit"])')
if script/tools/with-ops-rpc.sh alchemy base-sepolia env NFT_DIRECT_WRAPPER_FORK=true NFT_FORK_BLOCK_NUMBER="$number" \
  NFT_FORK_CHAIN_ID=84532 NFT_FORK_WRAPPER="$wrapper" NFT_FORK_USDC="$usdc" NFT_FORK_CALLBACK_GAS="$gas" \
  FOUNDRY_PROFILE=pr bash -c 'NFT_FORK_RPC_URL="$OPS_RPC_URL" forge test --match-path test/fork/NftDirectWrapperFork.t.sol -vv' \
  > "$out/direct-wrapper.log" 2>&1; then
  step "direct wrapper: passed at block $number"
else
  status=1
  step "direct wrapper: FAILED at block $number (direct-wrapper.log)"
fi
grep -E 'fork target mode|Suite result' "$out/direct-wrapper.log" | sort -u || true

if script/tools/with-ops-rpc.sh alchemy base-sepolia python3 script/ops/denim_activation_check.py --confirm \
  "$out/check.json" > "$out/confirm.log" 2>&1; then
  step "confirm: block $number still has hash $hash"
else
  status=1
  step "confirm: block $number no longer has hash $hash, or could not be read (confirm.log): run the check again"
fi
exit "$status"
