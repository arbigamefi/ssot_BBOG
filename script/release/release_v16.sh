#!/usr/bin/env bash
set +xv # a trace or echoed input would print a secret unredacted (an inherited SHELLOPTS, bash -x): both off first
set -uo pipefail

# Sign and package one v1.6 release. The Owner runs it from a clean checkout of the release commit, through the
# operator RPC wrapper (or as `make release-v16` inside it):
#
#   SNAPSHOT_PATH=deployments/latest-v16.json RELEASE_SIGNER=0x... RELEASE_ACCOUNT=<keystore name> TAG_NAME=<tag> \
#     bash script/tools/with-ops-rpc.sh infura base-sepolia bash script/release/release_v16.sh
#
# Steps, in order; the run stops at the first failure:
#   release-governance-check, release-domain-check  read the chain; retried, but only after a transport failure
#   signing                                          ReleaseDigestV16, the only step that unlocks the keystore
#   release-notes, release-frontend-manifest, release-golden-vectors, release-abis   local and deterministic
#   release-verify, release-package                  read the chain; retried, but only after a transport failure
#
# The governance check verifies the pre-launch release state (verify_governance.py, release mode: the wiring executed,
# the activation not yet) and writes its checkpoint. The record signs that checkpoint too: GOVERNANCE_CHECKPOINT_PATH
# (default deployments/governance-checkpoint-latest-v16.json) receives it when a record is signed, and the package ships
# it, so the Release Gate, the image import and the drift monitor replay from the signed block instead of deployment.
#
# Signing. The password is read from the terminal itself, so the prompt shows even though the wrapper's redacting
# pipe holds output back until a line ends. It must unlock RELEASE_SIGNER in `cast wallet address` before anything is
# signed: forge's own prompt reports a wrong password only as "vm.sign: no wallets available". Three wrong passwords
# end the run with nothing signed. Forge reads the password from a private temporary file that is removed on exit.
# A release record (RELEASE_PATH) that VerifyReleaseV16 accepts, that is RELEASE_SIGNER's signature over this
# snapshot's digest, is kept: a rerun after a later failure neither asks for the password nor signs again. A record
# that does not verify is never overwritten.
#
# Inputs: SNAPSHOT_PATH; RELEASE_SIGNER; RELEASE_ACCOUNT (keystore name in ~/.foundry/keystores) or RELEASE_KEYSTORE
# (keystore file); the RPC as OPS_RPC_URL (set by the wrapper; it wins) or RPC_URL. Optional: TAG_NAME, GIT_SHA (must be
# HEAD), RELEASE_PATH (default deployments/release-latest-v16.json), GOVERNANCE_CHECKPOINT_PATH (see above),
# RELEASE_LOG_DIR (default dist/release-run-<UTC time>), RELEASE_STEP_ATTEMPTS (8), RELEASE_RETRY_SECONDS (3, times the
# attempt number).
# Each step's output goes to its own log in RELEASE_LOG_DIR with the RPC URL and its key replaced; the directory must
# be new or empty.

fail() {
  printf 'release-v16: %s\n' "$*" >&2
  exit 1
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "run inside the repository"
cd "$root" || fail "cannot enter $root"
. script/release/operator-functions.sh || fail "cannot load script/release/operator-functions.sh"
clean() { [[ -z "$(git status --porcelain --untracked-files=normal)" ]]; }
clean || fail "the working tree is not clean; release only committed source"
head_sha=$(git rev-parse HEAD)
[[ -z "${GIT_SHA:-}" || "$(lower "$GIT_SHA")" == "$head_sha" ]] || fail "GIT_SHA $GIT_SHA is not HEAD $head_sha"

[[ -n "${SNAPSHOT_PATH:-}" && -f "$SNAPSHOT_PATH" ]] || fail "set SNAPSHOT_PATH to the deployment snapshot"
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
attempts=${RELEASE_STEP_ATTEMPTS:-8}
backoff=${RELEASE_RETRY_SECONDS:-3}
[[ "$attempts" =~ ^[1-9][0-9]*$ && "$backoff" =~ ^[0-9]+$ ]] ||
  fail "RELEASE_STEP_ATTEMPTS and RELEASE_RETRY_SECONDS must be whole numbers"
profile=${VERIFY_PROFILE:-default}

# ReleaseDigestV16 writes RELEASE_OUTPUT_PATH; VerifyReleaseV16 and the package read RELEASE_PATH.
RELEASE_PATH=${RELEASE_PATH:-deployments/release-latest-v16.json}
GOVERNANCE_CHECKPOINT_PATH=${GOVERNANCE_CHECKPOINT_PATH:-deployments/governance-checkpoint-latest-v16.json}
export SNAPSHOT_PATH RPC_URL RELEASE_SIGNER RELEASE_PATH RELEASE_OUTPUT_PATH="$RELEASE_PATH" GIT_SHA="$head_sha"
export GOVERNANCE_CHECKPOINT_PATH GOVERNANCE_VERIFY_MODE=release

log_dir=${RELEASE_LOG_DIR:-dist/release-run-$(date -u +%Y%m%dT%H%M%SZ)}
[[ ! -e "$log_dir" || -z "$(ls -A "$log_dir" 2>/dev/null)" ]] ||
  fail "$log_dir is not empty; logs are never overwritten"
mkdir -p "$log_dir" || fail "cannot create $log_dir"
printf 'commit %s\nsnapshot %s\nsigner %s\nstarted %s\n' "$head_sha" "$SNAPSHOT_PATH" "$RELEASE_SIGNER" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$log_dir/run.txt"
# The package step needs a clean tree, so the logs must be ignored by git or live outside the repository.
clean || fail "$log_dir is inside the repository and not ignored"

password_dir=
cleanup() { [[ -z "$password_dir" ]] || rm -rf "$password_dir"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Step logs are files, which the wrapper cannot redact: replace the URL and every long piece of it (the key).
logged() { # log, command...: run the command with its redacted output in the log; return its status
  redacted "$1" "$RPC_URL" "${@:2}"
}

# Transport failures only: verify_governance.py's own retries exhausted on a transient class, or a dropped connection
# in forge. Anything else is a finding and is never retried.
transport='RPC [A-Za-z_]+ failed: (HTTP (408|425|429|5[0-9][0-9])|connection error|JSON-RPC error -32(000|005|603))'
transport+='|RPC transport error|tls handshake|error sending request|client error \(connect\)'
transport+='|could not instantiate forked environment'

show_failure() { # step, log
  echo "$1: FAILED (log: $2)"
  tail -n 20 "$2" | sed 's/^/  | /'
}

chain_step() { # make target that reads the chain
  local target=$1 k log
  for ((k = 1; k <= attempts; k++)); do
    log="$log_dir/$target.$k.log"
    if logged "$log" make "$target"; then
      echo "$target: pass (attempt $k)"
      step_log=$log
      return 0
    fi
    grep -qiE "$transport" "$log" || { show_failure "$target" "$log"; return 1; }
    echo "$target: transport failure on attempt $k of $attempts"
    ((k == attempts)) || sleep $((k * backoff))
  done
  show_failure "$target" "$log"
  return 1
}

local_step() { # make target that needs no chain access
  local log="$log_dir/$1.log"
  logged "$log" make "$1" || { show_failure "$1" "$log"; return 1; }
  echo "$1: pass"
}

# The digest of the checkpoint the governance step of this run wrote, from its result line.
checkpoint_sha() {
  python3 -I -c '
import json, re, sys
for line in reversed(open(sys.argv[1]).read().splitlines()):
    if line.startswith("{"):
        result = json.loads(line)
        if result.get("status") == "verified" and re.fullmatch(r"[0-9a-f]{64}", result.get("checkpointSha256", "")):
            print(result["checkpointSha256"]); sys.exit(0)
sys.exit(1)' "$1"
}

sign_once() {
  local log="$log_dir/signing.log" check="$log_dir/signing-existing-record.log" status reason sha
  if [[ -e "$RELEASE_PATH" ]]; then
    if logged "$check" env FOUNDRY_PROFILE="$profile" \
      forge script script/release/VerifyReleaseV16.s.sol:VerifyReleaseV16; then
      echo "signing: $RELEASE_PATH already holds $RELEASE_SIGNER's signature over this snapshot; not signing again"
      return 0
    fi
    echo "signing: $RELEASE_PATH exists but does not verify against this snapshot and signer; it is never overwritten"
    reason=$(grep -E '^Error' "$check" | tail -n 1)
    echo "signing: ${reason:-VerifyReleaseV16 failed} (log: $check)"
    return 1
  fi
  # The record signs the checkpoint this run verified; a checkpoint left by an earlier unsigned attempt is replaced.
  sha=$(checkpoint_sha "$governance_log") || { echo "signing: the governance check reported no checkpoint"; return 1; }
  cp "$log_dir/governance-checkpoint.json" "$GOVERNANCE_CHECKPOINT_PATH" || return 1
  password_dir=$(mktemp -d "${TMPDIR:-/tmp}/release-v16.XXXXXX") || return 1 # created 0700
  unlock_keystore signing RELEASE_SIGNER "$RELEASE_SIGNER" "nothing was signed" "$password_dir" "$wallet_name" \
    "${wallet[@]}" || return 1
  echo "signing: the keystore unlocks $RELEASE_SIGNER; signing once"
  logged "$log" env FOUNDRY_PROFILE="$profile" GOVERNANCE_CHECKPOINT_SHA256="0x$sha" \
    forge script script/release/ReleaseDigestV16.s.sol:ReleaseDigestV16 \
    "${wallet[@]}" --password-file "$password_dir/password" -vvv
  status=$?
  rm -rf "$password_dir"
  password_dir=
  ((status == 0)) || { show_failure signing "$log"; return 1; }
  grep -E '^ *(digest|wrote):' "$log" | sed 's/^ */signing: /' || true
}

echo "release-v16: commit $head_sha, snapshot $SNAPSHOT_PATH, logs in $log_dir"
export GOVERNANCE_CHECKPOINT_OUT="$log_dir/governance-checkpoint.json"
chain_step release-governance-check || exit 1
unset GOVERNANCE_CHECKPOINT_OUT
governance_log=$step_log
chain_step release-domain-check || exit 1
sign_once || exit 1
for target in release-notes release-frontend-manifest release-golden-vectors release-abis; do
  local_step "$target" || exit 1
done
chain_step release-verify || exit 1
chain_step release-package || exit 1
archive=$(sed -n 's/^wrote: //p' "$log_dir"/release-package.*.log | tail -n 1)
[[ -n "$archive" && -f "$archive" ]] || fail "release-package did not report its archive"
echo "release-v16 complete: $archive sha256 $(shasum -a 256 "$archive" | cut -d ' ' -f 1)"
