#!/usr/bin/env bash
set -euo pipefail

# Post-release guard: prove the core v1.3 release artifacts are present and
# tracked by git. This catches the repo-level `deployments/` ignore rule before
# a release tag or frontend sync is treated as reproducible.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "error: $*" >&2
  exit 1
}

require_tracked_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "missing release artifact: $path"
  git ls-files --error-unmatch "$path" >/dev/null 2>&1 ||
    fail "release artifact is not tracked by git: $path (use git add -f)"
}

require_tracked_glob() {
  local pattern="$1"
  local label="$2"
  local matches
  matches="$(git ls-files -- "$pattern")"
  [[ -n "$matches" ]] || fail "no tracked $label matching $pattern (use git add -f)"
}

require_tracked_file deployments/latest-v13.json
require_tracked_file deployments/release-latest-v13.json
require_tracked_file deployments/release-notes-latest-v13.md

require_tracked_glob "deployments/snapshots/deploy-*-v13.json" "immutable deployment snapshot"
require_tracked_glob "deployments/release/release-*-v13.json" "immutable release lock"
require_tracked_glob "deployments/release/release-notes-*-v13.md" "immutable release notes"

echo "v1.3 release artifacts are tracked by git"
