#!/usr/bin/env bash
set -euo pipefail

# No-broadcast GO gate for public Base mainnet casino risk-in.
#
# This intentionally fails until all required deployment, frontend, and access
# evidence exists. It does not broadcast and must not be used as deploy
# authorization by itself.
#
# Required inputs:
#   CASINO_ENV_FILE=.env.base-mainnet-v13-casino
#   WEB_ENV_FILE=.env.web-production
#   FRONTEND_ACCESS_FILE=<approved-casino-frontend-access.json>

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "error: $*" >&2
  exit 1
}

CASINO_ENV_FILE="${CASINO_ENV_FILE:-${ENV_FILE:-.env.base-mainnet-v13-casino}}"
WEB_ENV_FILE="${WEB_ENV_FILE:-.env.web-production}"
FRONTEND_ACCESS_FILE="${FRONTEND_ACCESS_FILE:-}"

[[ -f "$CASINO_ENV_FILE" ]] || fail "casino env file not found: $CASINO_ENV_FILE"
[[ -f "$WEB_ENV_FILE" ]] || fail "web env file not found: $WEB_ENV_FILE"
[[ -n "$FRONTEND_ACCESS_FILE" ]] || fail "missing FRONTEND_ACCESS_FILE"
[[ -f "$FRONTEND_ACCESS_FILE" ]] || fail "frontend access file not found: $FRONTEND_ACCESS_FILE"

echo "[casino-mainnet-gonogo] validating casino contract env and public-network constants"
V13_SPORTS_PREFLIGHT_TARGET=mainnet \
  V13_REQUIRE_SPORTS_POOL=false \
  bash script/ci/v13_sports_testnet_preflight.sh "$CASINO_ENV_FILE"

echo "[casino-mainnet-gonogo] validating approved casino frontend access"
REQUIRE_APPROVED=1 bash script/ci/v13_casino_frontend_access_check.sh "$FRONTEND_ACCESS_FILE"

echo "[casino-mainnet-gonogo] validating production web env, embedded release, and read-only chain smoke"
FRONTEND_ACCESS_FILE="$FRONTEND_ACCESS_FILE" \
  bash script/ci/v13_casino_mainnet_frontend_readiness.sh "$WEB_ENV_FILE"

echo "[casino-mainnet-gonogo] OK"
