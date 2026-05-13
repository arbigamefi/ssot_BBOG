#!/usr/bin/env bash
set -euo pipefail

# Deterministic local v1.3 Casino+Sports deployment/release dry run.
#
# The script runs in a temporary detached worktree so generated deployment artifacts do not dirty the
# caller's working tree. It does not broadcast transactions and does not require an RPC URL.

ROOT_DIR="$(git rev-parse --show-toplevel)"

(
  cd "$ROOT_DIR"
  bash script/ci/check_deps.sh
)

TMP_BASE="${TMPDIR:-/tmp}"
WORKTREE="$(mktemp -d "${TMP_BASE%/}/arbigamefi-v13-sports-dryrun.XXXXXX")"
rmdir "$WORKTREE"

KEEP_DRY_RUN_WORKTREE="${KEEP_DRY_RUN_WORKTREE:-0}"

cleanup() {
  if [[ "$KEEP_DRY_RUN_WORKTREE" == "1" ]]; then
    echo "Keeping dry-run worktree: $WORKTREE" >&2
    return
  fi
  git -C "$ROOT_DIR" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || rm -rf "$WORKTREE"
}
trap cleanup EXIT

git -C "$ROOT_DIR" worktree add --detach "$WORKTREE" HEAD >/dev/null

# Dependencies are intentionally not tracked in normal git worktrees. Reuse the caller's pinned local
# dependency directories without copying them into the temporary worktree.
rm -rf "$WORKTREE/lib"
ln -s "$ROOT_DIR/lib" "$WORKTREE/lib"

cd "$WORKTREE"

export PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
export GOV="${GOV:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
export VRF_WRAPPER="${VRF_WRAPPER:-0x00000000000000000000000000000000000000Ff}"

export NUM_POOLS="${NUM_POOLS:-2}"
export POOL_ID_0="${POOL_ID_0:-1}"
export POOL_DOMAIN_0="${POOL_DOMAIN_0:-1}"
export POOL_ASSET_0="${POOL_ASSET_0:-0x0000000000000000000000000000000000000101}"
export POOL_ID_1="${POOL_ID_1:-2}"
export POOL_DOMAIN_1="${POOL_DOMAIN_1:-2}"
export POOL_ASSET_1="${POOL_ASSET_1:-0x0000000000000000000000000000000000000101}"

export SPORTS_MAX_STAKE="${SPORTS_MAX_STAKE:-100000000}"
export SPORTS_MAX_PAYOUT="${SPORTS_MAX_PAYOUT:-1000000000}"
export SPORTS_MAX_MARKET_RESERVED="${SPORTS_MAX_MARKET_RESERVED:-5000000000}"
export SPORTS_MAX_OUTCOME_RESERVED="${SPORTS_MAX_OUTCOME_RESERVED:-3000000000}"
export SPORTS_MAX_EVENT_RESERVED="${SPORTS_MAX_EVENT_RESERVED:-8000000000}"
export SPORTS_ODDS_SIGNER_SET_HASH="${SPORTS_ODDS_SIGNER_SET_HASH:-0x1111111111111111111111111111111111111111111111111111111111111111}"
export SPORTS_RESULT_REPORTER_SET_HASH="${SPORTS_RESULT_REPORTER_SET_HASH:-0x2222222222222222222222222222222222222222222222222222222222222222}"
export SPORTS_RESULT_REPORTER_THRESHOLD="${SPORTS_RESULT_REPORTER_THRESHOLD:-1}"
export FOUNDRY_PROFILE="${FOUNDRY_PROFILE:-default}"

forge script script/DeployV13.s.sol:DeployV13 -vvv
SNAPSHOT_PATH=deployments/latest-v13.json make release-digest-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-notes-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-frontend-manifest-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-golden-vectors-v13
make release-abis-v13
SNAPSHOT_PATH=deployments/latest-v13.json make release-verify-v13
STRICT=1 make release-check-v13

if command -v jq >/dev/null 2>&1; then
  echo "v1.3 Sports dry run passed:"
  jq -r '
    "  chainId: \(.chainId)",
    "  blockNumber: \(.blockNumber)",
    "  numPools: \(.numPools)",
    "  sportsHub: \(.sportsHub)",
    "  sportsRiskEngine: \(.sportsRiskEngine)",
    "  sportsPoolRiskHash: \(.poolSportsRiskHash_1)"
  ' deployments/latest-v13.json
  jq -r '"  releaseDigest: \(.digest)"' deployments/release-latest-v13.json
else
  echo "v1.3 Sports dry run passed."
fi
