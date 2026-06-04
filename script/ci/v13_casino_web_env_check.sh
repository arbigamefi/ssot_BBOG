#!/usr/bin/env bash
set -euo pipefail

# Validates production web environment shape for a Base mainnet casino deployment.
#
# Usage:
#   bash script/ci/v13_casino_web_env_check.sh [env-file]
#   REQUIRE_SOURCEMAPS=1 bash script/ci/v13_casino_web_env_check.sh [env-file]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
DEFAULT_WEB_ENV_FILE="frontend/apps/web/.env.local"

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [env-file]" >&2
  exit 2
fi

ENV_FILE="${1:-${ENV_FILE:-$DEFAULT_WEB_ENV_FILE}}"
[[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

need_var() {
  local name="$1"
  local value="${!name-}"
  [[ -n "$value" ]] || fail "missing env: $name"
}

need_bool() {
  local name="$1"
  need_var "$name"
  case "${!name}" in
    true|false) ;;
    *) fail "$name must be true or false" ;;
  esac
}

need_url() {
  local name="$1"
  need_var "$name"
  case "${!name}" in
    http://*|https://*) ;;
    *) fail "$name must be an http(s) URL" ;;
  esac
}

need_chain_id() {
  local name="$1"
  need_var "$name"
  [[ "${!name}" == "8453" ]] || fail "$name must be 8453 for Base mainnet casino production"
}

has_browser_rpc() {
  [[ -n "${NEXT_PUBLIC_BASE_RPC_URL-}" ]] ||
    [[ -n "${NEXT_PUBLIC_RPC_URL-}" ]] ||
    [[ -n "${NEXT_PUBLIC_ALCHEMY_API_KEY-}" ]]
}

need_chain_id NEXT_PUBLIC_CHAIN_ID
need_var NEXT_PUBLIC_ENV
[[ "$NEXT_PUBLIC_ENV" == "production" ]] || fail "NEXT_PUBLIC_ENV must be production"

need_var NEXT_PUBLIC_SENTRY_RELEASE
need_url NEXT_PUBLIC_SENTRY_DSN

has_browser_rpc || {
  fail "missing browser RPC: set NEXT_PUBLIC_BASE_RPC_URL, NEXT_PUBLIC_RPC_URL, or NEXT_PUBLIC_ALCHEMY_API_KEY"
}

need_bool NEXT_PUBLIC_CASINO_RISK_IN_ENABLED
need_bool NEXT_PUBLIC_SPORTSBOOK_ENABLED
need_bool BET_RECEIPT_RPC_FALLBACK_ENABLED

if [[ "$BET_RECEIPT_RPC_FALLBACK_ENABLED" != "true" ]]; then
  fail "BET_RECEIPT_RPC_FALLBACK_ENABLED must be true so share receipts can recover while durable indexing catches up"
fi

if [[ "$NEXT_PUBLIC_SPORTSBOOK_ENABLED" == "true" ]]; then
  fail "casino-only production web env must keep NEXT_PUBLIC_SPORTSBOOK_ENABLED=false"
fi

if [[ "$NEXT_PUBLIC_CASINO_RISK_IN_ENABLED" == "true" ]]; then
  need_var FRONTEND_ACCESS_FILE
  REQUIRE_APPROVED=1 bash script/ci/v13_casino_frontend_access_check.sh "$FRONTEND_ACCESS_FILE" >/dev/null
fi

if [[ "${REQUIRE_SOURCEMAPS:-0}" == "1" ]]; then
  need_var SENTRY_AUTH_TOKEN
  need_var SENTRY_ORG
  need_var SENTRY_PROJECT
fi

echo "v1.3 Casino production web env validated:"
echo "  chainId: $NEXT_PUBLIC_CHAIN_ID"
echo "  env: $NEXT_PUBLIC_ENV"
echo "  sentryRelease: $NEXT_PUBLIC_SENTRY_RELEASE"
echo "  casinoRiskInEnabled: $NEXT_PUBLIC_CASINO_RISK_IN_ENABLED"
echo "  sportsbookEnabled: $NEXT_PUBLIC_SPORTSBOOK_ENABLED"
echo "  receiptRpcFallbackEnabled: $BET_RECEIPT_RPC_FALLBACK_ENABLED"
if [[ -n "${NEXT_PUBLIC_BASE_RPC_URL-}" ]]; then
  echo "  browserRpc: NEXT_PUBLIC_BASE_RPC_URL"
elif [[ -n "${NEXT_PUBLIC_RPC_URL-}" ]]; then
  echo "  browserRpc: NEXT_PUBLIC_RPC_URL"
else
  echo "  browserRpc: NEXT_PUBLIC_ALCHEMY_API_KEY"
fi
