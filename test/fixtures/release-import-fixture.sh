#!/usr/bin/env bash
set -euo pipefail

# Deploys test/fixtures/ReleaseImportFixture.s.sol to an empty loopback node and signs its release, in the order of
# ADR-0037 §9 (decision D1):
#
#   bash test/fixtures/release-import-fixture.sh <rpc-url> <directory> [deploy|release]
#
#   deploy   the mocks, the deployment and the Safe's scheduled wiring: a release whose wiring has not executed;
#   release  (default) then moves the node's clock past the 72-hour delay, executes the wiring, verifies the pre-launch
#            release state with verify_governance.py and signs the bundle over the checkpoint it wrote:
#            <directory>/bundle and <directory>/wrong-precision/bundle.
#
# Run from the repository root. <directory> must lie below deployments/, the only place Forge scripts write. The node
# must fund the fixture's public test key (0xBEEF).

[[ $# -eq 2 || $# -eq 3 ]] || { echo "usage: $0 <rpc-url> <directory> [deploy|release]" >&2; exit 2; }
rpc=$1
directory=$2
stage=${3:-release}
[[ $stage == deploy || $stage == release ]] || { echo "stage must be deploy or release" >&2; exit 2; }
key=0x$(printf '%064x' 48879)

phase() {
  # --slow broadcasts one transaction at a time and waits for its receipt. Concurrent broadcast can leave Anvil
  # holding the next nonce as "queued" with automine never including it (seen 2026-10-09).
  RELEASE_IMPORT_FIXTURE_DIR=$directory RELEASE_IMPORT_PHASE=$1 \
    forge script test/fixtures/ReleaseImportFixture.s.sol:ReleaseImportFixture --rpc-url "$rpc" --broadcast --slow \
    --private-key "$key" --non-interactive
}

mkdir -p "$directory"
phase deploy
[[ $stage == release ]] || exit 0
cast rpc --rpc-url "$rpc" evm_increaseTime 259200 > /dev/null
cast rpc --rpc-url "$rpc" evm_mine > /dev/null
phase wire
SNAPSHOT_PATH=$directory/snapshot.json RPC_URL=$rpc GOVERNANCE_VERIFY_MODE=release \
  GOVERNANCE_CHECKPOINT_OUT=$directory/checkpoint.json python3 script/release/verify_governance.py \
  > "$directory/governance.json"
sha=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["checkpointSha256"])' "$directory/governance.json")
GOVERNANCE_CHECKPOINT_PATH=$directory/checkpoint.json GOVERNANCE_CHECKPOINT_SHA256=0x$sha phase bundle
