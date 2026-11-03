#!/usr/bin/env bash
set +xv # a trace or echoed input would print a secret unredacted (an inherited SHELLOPTS, bash -x): both off first
set -uo pipefail

# Package a signed v1.6 release again for a later source commit, with a signed governance checkpoint refresh. The
# image import replays governance from the checkpoint its bundle signs, one public-RPC page per 200 blocks: about an
# hour more for each day since signing, so a bundle stops building images about two days after it was signed. The
# record cannot be signed again once the release has launched (signing needs the pre-launch state), and its digest
# pins the deployment everywhere. A refresh leaves the record as signed: the release signer replays the deployed
# release in live mode from the record's checkpoint (or the bundle's earlier refresh) to now and signs that later
# checkpoint for the same record digest (SignCheckpointRefreshV16). The new bundle carries both checkpoints; its
# imports replay from the refresh.
#
# The Owner runs it from a clean checkout of the new commit, through the operator RPC wrapper:
#
#   RELEASE_BUNDLE=<signed bundle> RELEASE_BUNDLE_SHA256=<its approved SHA-256> RELEASE_SOURCE_REVISION=<its commit> \
#   RELEASE_SIGNER=0x... RELEASE_ACCOUNT=<keystore name> TAG_NAME=<new tag> \
#     bash script/tools/with-ops-rpc.sh infura base-sepolia bash script/release/repackage_release_v16.sh
#
# The contracts and their build inputs must be the same at both commits, so the bundle's ABIs and runtime code still
# match this checkout. The bundle is unpacked to the default deployments/ paths, which must not exist yet. The
# keystore is unlocked once, after the record verifies and the replay succeeds; three wrong passwords end the run with
# nothing signed. Output: the new archive under dist/, named by TAG_NAME and the unchanged record digest.

fail() {
  printf 'repackage-v16: %s\n' "$*" >&2
  exit 1
}

root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "run inside the repository"
cd "$root" || fail "cannot enter $root"
. script/release/operator-functions.sh || fail "cannot load script/release/operator-functions.sh"
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || fail "the working tree is not clean"
head_sha=$(git rev-parse HEAD)

[[ -n "${RELEASE_BUNDLE:-}" && -f "$RELEASE_BUNDLE" ]] || fail "set RELEASE_BUNDLE to the signed release archive"
[[ "${RELEASE_BUNDLE_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || fail "set RELEASE_BUNDLE_SHA256 to its approved SHA-256"
[[ "${RELEASE_SOURCE_REVISION:-}" =~ ^[0-9a-f]{40}$ ]] || fail "set RELEASE_SOURCE_REVISION to the bundle's full commit"
[[ -n "${TAG_NAME:-}" ]] || fail "set TAG_NAME for the new archive"
RPC_URL=${OPS_RPC_URL:-${RPC_URL:-}}
[[ -n "$RPC_URL" ]] || fail "no RPC: run through script/tools/with-ops-rpc.sh, which sets OPS_RPC_URL, or set RPC_URL"
[[ "${RELEASE_SIGNER:-}" =~ ^0x[0-9a-fA-F]{40}$ ]] || fail "set RELEASE_SIGNER to the approved release signer address"
if [[ -n "${RELEASE_ACCOUNT:-}" && -z "${RELEASE_KEYSTORE:-}" ]]; then
  wallet=(--account "$RELEASE_ACCOUNT")
  wallet_name=$RELEASE_ACCOUNT
elif [[ -n "${RELEASE_KEYSTORE:-}" && -z "${RELEASE_ACCOUNT:-}" ]]; then
  wallet=(--keystore "$RELEASE_KEYSTORE")
  wallet_name=$RELEASE_KEYSTORE
else
  fail "set exactly one of RELEASE_ACCOUNT (keystore name) and RELEASE_KEYSTORE (keystore file)"
fi
git cat-file -e "$RELEASE_SOURCE_REVISION^{commit}" 2>/dev/null || fail "$RELEASE_SOURCE_REVISION is not in this clone"
git diff --quiet "$RELEASE_SOURCE_REVISION" HEAD -- src foundry.toml deps.lock remappings.txt ||
  fail "the contracts or their build inputs changed since $RELEASE_SOURCE_REVISION; this release cannot be repackaged"

export RPC_URL RELEASE_SIGNER FOUNDRY_PROFILE=${VERIFY_PROFILE:-default}
export SNAPSHOT_PATH=deployments/latest-v16.json RELEASE_PATH=deployments/release-latest-v16.json
export GOVERNANCE_CHECKPOINT_PATH=deployments/governance-checkpoint-latest-v16.json
export CHECKPOINT_REFRESH_PATH=deployments/governance-checkpoint-refresh-latest-v16.json
export REFRESHED_CHECKPOINT_PATH=deployments/governance-checkpoint-refreshed-latest-v16.json
log_dir=${RELEASE_LOG_DIR:-dist/repackage-run-$(date -u +%Y%m%dT%H%M%SZ)}
[[ ! -e "$log_dir" ]] || fail "$log_dir exists; logs are never overwritten"
mkdir -p "$log_dir" || fail "cannot create $log_dir"
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || fail "$log_dir is inside the repository and not ignored"

password_dir=
stage=$(mktemp -d) || fail "cannot create a staging directory"
cleanup() {
  [[ -z "$password_dir" ]] || rm -rf "$password_dir"
  rm -rf "$stage"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

step() { # name, command...: run with the redacted output in <name>.log; stop at a failure
  local log="$log_dir/$1.log"
  if redacted "$log" "$RPC_URL" "${@:2}"; then
    echo "$1: pass"
    return 0
  fi
  echo "$1: FAILED (log: $log)"
  tail -n 20 "$log" | sed 's/^/  | /'
  exit 1
}

# The bundle as the image workflow would see it at its own commit, then its files at the default paths.
python3 -I - "$RELEASE_BUNDLE" "$RELEASE_BUNDLE_SHA256" "$stage/input" "$RELEASE_SOURCE_REVISION" << 'PY' ||
import sys
from pathlib import Path
sys.path.insert(0, 'script/release')
from import_release_bundle import unpack
bundle, sha, destination, revision = sys.argv[1:]
try:
    unpack(Path(bundle), sha, Path(destination), revision)
except ValueError as error:
    sys.exit(f'release bundle rejected: {error}')
PY
  fail "the bundle did not import"
input=$stage/input
# Forge reads only inside the project, so an earlier refresh is verified from deployments/ too.
previous_refresh=deployments/governance-checkpoint-refresh-previous-v16.json
previous_checkpoint=deployments/governance-checkpoint-refreshed-previous-v16.json
targets=("$SNAPSHOT_PATH" "$RELEASE_PATH" "$GOVERNANCE_CHECKPOINT_PATH" "$CHECKPOINT_REFRESH_PATH"
  "$REFRESHED_CHECKPOINT_PATH" "$previous_refresh" "$previous_checkpoint" deployments/release-notes-latest-v16.md deployments/frontend-manifest-latest-v16.json
  deployments/golden-vectors-latest-v16.json deployments/abis-v16)
for target in "${targets[@]}"; do
  [[ ! -e "$target" ]] || fail "$target exists; move it away first (nothing is overwritten)"
done
mkdir -p deployments/abis-v16
for name in latest-v16.json release-latest-v16.json governance-checkpoint-latest-v16.json \
  release-notes-latest-v16.md frontend-manifest-latest-v16.json golden-vectors-latest-v16.json; do
  cp "$input/deployments/$name" "deployments/$name"
done
cp "$input"/abis/* deployments/abis-v16/
# An earlier refresh is where this replay starts; the new one replaces it in the new bundle.
start_checkpoint=$GOVERNANCE_CHECKPOINT_PATH signed=$RELEASE_PATH
step release-verify forge script script/release/VerifyReleaseV16.s.sol:VerifyReleaseV16 -vvv
if [[ -f "$input/deployments/governance-checkpoint-refresh-latest-v16.json" ]]; then
  cp "$input/deployments/governance-checkpoint-refresh-latest-v16.json" "$previous_refresh"
  cp "$input/deployments/governance-checkpoint-refreshed-latest-v16.json" "$previous_checkpoint"
  step previous-refresh-verify env CHECKPOINT_REFRESH_PATH="$previous_refresh" \
    REFRESHED_CHECKPOINT_PATH="$previous_checkpoint" \
    forge script script/release/VerifyCheckpointRefreshV16.s.sol:VerifyCheckpointRefreshV16 -vvv
  start_checkpoint=$previous_checkpoint signed=$previous_refresh
fi
start_sha=$(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["checkpointSha256"])' "$signed")

step governance-live env GOVERNANCE_VERIFY_MODE=live GOVERNANCE_CHECKPOINT="$start_checkpoint" \
  GOVERNANCE_CHECKPOINT_SHA256="$start_sha" GOVERNANCE_CHECKPOINT_OUT="$REFRESHED_CHECKPOINT_PATH" \
  python3 script/release/verify_governance.py
sha=$(python3 -I -c '
import json, re, sys
for line in reversed(open(sys.argv[1]).read().splitlines()):
    if line.startswith("{"):
        result = json.loads(line)
        if result.get("status") == "verified" and re.fullmatch(r"[0-9a-f]{64}", result.get("checkpointSha256", "")):
            print(result["checkpointSha256"]); sys.exit(0)
sys.exit(1)' "$log_dir/governance-live.log") || fail "the live replay reported no checkpoint"
grep -E '^note: ' "$log_dir/governance-live.log" | sed 's/^/governance-live: /' || true

password_dir=$(mktemp -d "${TMPDIR:-/tmp}/repackage-v16.XXXXXX") || fail "cannot create a private directory"
unlock_keystore signing RELEASE_SIGNER "$RELEASE_SIGNER" "nothing was signed" "$password_dir" "$wallet_name" \
  "${wallet[@]}" || exit 1
echo "signing: the keystore unlocks $RELEASE_SIGNER; signing the refresh once"
redacted "$log_dir/signing.log" "$RPC_URL" env REFRESHED_CHECKPOINT_SHA256="0x$sha" \
  forge script script/release/SignCheckpointRefreshV16.s.sol:SignCheckpointRefreshV16 \
  "${wallet[@]}" --password-file "$password_dir/password" -vvv
status=$?
rm -rf "$password_dir"
password_dir=
((status == 0)) || { echo "signing: FAILED (log: $log_dir/signing.log)"; tail -n 20 "$log_dir/signing.log"; exit 1; }
grep -E '^ *(digest|checkpoint block|wrote):' "$log_dir/signing.log" | sed 's/^ */signing: /' || true
step refresh-verify forge script script/release/VerifyCheckpointRefreshV16.s.sol:VerifyCheckpointRefreshV16 -vvv

step release-package env PYTHON=python3 TAG_NAME="$TAG_NAME" bash script/release/package_release.sh
archive=$(sed -n 's/^wrote: //p' "$log_dir/release-package.log" | tail -n 1)
[[ -n "$archive" && -f "$archive" ]] || fail "release-package did not report its archive"
echo "repackage-v16 complete: commit $head_sha, $archive sha256 $(shasum -a 256 "$archive" | cut -d ' ' -f 1)"
