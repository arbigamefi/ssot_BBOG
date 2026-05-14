#!/usr/bin/env bash
set -euo pipefail

# Runs a provider-driven football 1X2 local rehearsal:
# provider odds fixture -> provider result evidence fixture -> SportsHub canary local resolve.
#
# This is simulation-only. It forks the configured deployment through RPC_URL and never broadcasts.

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [env-file]" >&2
  exit 2
fi

if [[ $# -eq 1 ]]; then
  ENV_FILE="$1"
  [[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -n "${ROLE_ENV_FILE:-}" ]]; then
  [[ -f "$ROLE_ENV_FILE" ]] || fail "role env file not found: $ROLE_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ROLE_ENV_FILE"
  set +a
fi

command -v python3 >/dev/null 2>&1 || fail "missing command: python3"
command -v cast >/dev/null 2>&1 || fail "missing command: cast"
command -v forge >/dev/null 2>&1 || fail "missing command: forge"

[[ -n "${RPC_URL:-}" ]] || fail "missing env: RPC_URL"
[[ -n "${PRIVATE_KEY:-}" ]] || fail "missing env: PRIVATE_KEY"

SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v13.json}"
[[ -f "$SNAPSHOT_PATH" ]] || fail "snapshot not found: $SNAPSHOT_PATH"

read_snapshot_field() {
  local field="$1"
  python3 - "$SNAPSHOT_PATH" "$field" <<'PY'
import json
import sys

path, field = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    value = json.load(fh).get(field)
if value is None:
    raise SystemExit(f"missing snapshot field: {field}")
print(value)
PY
}

SPORTS_HUB="${SPORTS_HUB:-$(read_snapshot_field sportsHub)}"
CHAIN_ID="${CHAIN_ID:-$(cast chain-id --rpc-url "$RPC_URL")}"
FOOTBALL_POOL_ID="${FOOTBALL_POOL_ID:-2}"
FOOTBALL_EVENT_ID="${FOOTBALL_EVENT_ID:-2026061101}"
FOOTBALL_MARKET_VERSION="${FOOTBALL_MARKET_VERSION:-1}"
FOOTBALL_STAKE="${FOOTBALL_STAKE:-100000}"
FOOTBALL_MAX_PAYOUT="${FOOTBALL_MAX_PAYOUT:-500000}"
FOOTBALL_RULEBOOK_HASH="${FOOTBALL_RULEBOOK_HASH:-0x1111111111111111111111111111111111111111111111111111111111111111}"

next_market_id="$(cast call "$SPORTS_HUB" "nextMarketId()(uint64)" --rpc-url "$RPC_URL")"
reporter_set_hash="$(cast call "$SPORTS_HUB" "resultReporterSetHash()(bytes32)" --rpc-url "$RPC_URL")"
reporter_threshold="$(cast call "$SPORTS_HUB" "resultReporterThreshold()(uint8)" --rpc-url "$RPC_URL")"

reporter_private_key="${FOOTBALL_RESULT_REPORTER_PRIVATE_KEY:-${CANARY_RESULT_REPORTER_PRIVATE_KEY:-$PRIVATE_KEY}}"
reporter_address="$(cast wallet address --private-key "$reporter_private_key")"

odds_out="${SPORTS_PROVIDER_E2E_ODDS_DIR:-tmp/sports-provider-e2e-odds}"
evidence_out="${SPORTS_PROVIDER_E2E_EVIDENCE_DIR:-tmp/sports-provider-e2e-evidence}"
rm -rf "$odds_out" "$evidence_out"

python3 script/ops/sports_provider_odds.py \
  --fixture test/fixtures/sports/the-odds-api-football-h2h-odds.json \
  --sport-key soccer_fifa_world_cup \
  --provider-event-id odds-api-event-mexico-south-africa-2026 \
  --bookmaker-key draftkings \
  --out-dir "$odds_out" \
  --chain-id "$CHAIN_ID" \
  --sports-hub "$SPORTS_HUB" \
  --market-id "$next_market_id" \
  --event-id "$FOOTBALL_EVENT_ID" \
  --pool-id "$FOOTBALL_POOL_ID" \
  --market-version "$FOOTBALL_MARKET_VERSION" \
  --stake-raw "$FOOTBALL_STAKE" \
  --max-payout-raw "$FOOTBALL_MAX_PAYOUT" \
  --rulebook-hash "$FOOTBALL_RULEBOOK_HASH" \
  --ttl-seconds 120 \
  --generated-at 1781193600 \
  --expires-at 1781193720

set -a
# shellcheck disable=SC1090
source "$odds_out/odds-snapshot.env"
set +a

# The rehearsal generates result evidence before the local canary creates the market on the fork, so
# disable the evidence tool's optional on-chain hashResultPayload read for this step.
RPC_URL="" python3 script/ops/sports_provider_evidence.py \
  --fixture test/fixtures/sports/the-odds-api-football-completed-score.json \
  --sport-key soccer_fifa_world_cup \
  --provider-event-id odds-api-event-mexico-south-africa-2026 \
  --out-dir "$evidence_out" \
  --chain-id "$CHAIN_ID" \
  --sports-hub "$SPORTS_HUB" \
  --market-id "$next_market_id" \
  --event-id "$FOOTBALL_EVENT_ID" \
  --pool-id "$FOOTBALL_POOL_ID" \
  --market-version "$FOOTBALL_MARKET_VERSION" \
  --market-key "$FOOTBALL_MARKET_KEY" \
  --rulebook-hash "$FOOTBALL_RULEBOOK_HASH" \
  --reporter-set-hash "$reporter_set_hash" \
  --reporter-threshold "$reporter_threshold" \
  --reporter-signer "$reporter_address"

set -a
# shellcheck disable=SC1090
source "$evidence_out/result-proposal.env"
set +a

export SNAPSHOT_PATH
export SPORTS_HUB
export FOOTBALL_CANARY_MODE=local-resolve
export FOOTBALL_POOL_ID
export FOOTBALL_EVENT_ID
export FOOTBALL_MARKET_VERSION
export FOOTBALL_STAKE
export FOOTBALL_ODDS_WAD="$FOOTBALL_HOME_ODDS_WAD"
export FOOTBALL_MAX_PAYOUT
export FOOTBALL_RESULT_FINALITY_SECONDS="${FOOTBALL_RESULT_FINALITY_SECONDS:-600}"
export BROADCAST=0

bash script/ci/v13_worldcup_football_canary.sh

echo "v1.3 Sports provider-driven football E2E rehearsal validated:"
echo "  sportsHub: $SPORTS_HUB"
echo "  marketId: $next_market_id"
echo "  oddsOut: $odds_out"
echo "  evidenceOut: $evidence_out"
echo "  oddsSourceHash: $FOOTBALL_ODDS_SOURCE_HASH"
echo "  resultSourceHash: $FOOTBALL_RESULT_SOURCE_HASH"
echo "  evidenceHash: $FOOTBALL_EVIDENCE_HASH"
