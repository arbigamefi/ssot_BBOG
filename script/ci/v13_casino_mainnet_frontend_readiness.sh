#!/usr/bin/env bash
set -euo pipefail

# No-broadcast frontend readiness gate for a Base mainnet casino launch.
# It validates production web env shape, strict embedded Base mainnet release
# presence, and read-only chain smoke against the embedded release.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
DEFAULT_WEB_ENV_FILE="frontend/apps/web/.env.local"

fail() {
  echo "error: $*" >&2
  exit 1
}

ENV_FILE="${1:-${ENV_FILE:-$DEFAULT_WEB_ENV_FILE}}"
[[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE"

echo "[casino-mainnet-frontend] validating production web env"
bash script/ci/v13_casino_web_env_check.sh "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "[casino-mainnet-frontend] validating embedded Base mainnet release"
pnpm -C frontend check:mainnet-release

echo "[casino-mainnet-frontend] running read-only Base mainnet release smoke"
pnpm -C frontend smoke:release-readonly -- --chain-id 8453

echo "[casino-mainnet-frontend] OK"
