#!/usr/bin/env bash
set -euo pipefail

# Validates the v1.3 SportsHub Phase 1 public-testnet closeout state.
#
# Usage:
#   bash script/ci/v13_sports_phase1_closeout.sh [env-file]

fail() {
  echo "error: $*" >&2
  exit 1
}

need_file() {
  local path="$1"
  [[ -s "$path" ]] || fail "missing or empty file: $path"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

cast_call() {
  cast call "$@" --rpc-url "$RPC_URL"
}

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
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

need_cmd jq
need_cmd cast

[[ -n "${RPC_URL:-}" ]] || fail "missing env: RPC_URL"
[[ -n "${GOV:-}" ]] || fail "missing env: GOV"
[[ -n "${SPORTS_ODDS_SIGNER:-}" ]] || fail "missing env: SPORTS_ODDS_SIGNER"
[[ -n "${SPORTS_RESULT_REPORTER:-}" ]] || fail "missing env: SPORTS_RESULT_REPORTER"
[[ -n "${SPORTS_RESULT_CHALLENGER:-}" ]] || fail "missing env: SPORTS_RESULT_CHALLENGER"
[[ -n "${SPORTS_RESULT_ARBITRATOR:-}" ]] || fail "missing env: SPORTS_RESULT_ARBITRATOR"

SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v13.json}"
REHEARSAL_DOC="${SPORTS_REHEARSAL_DOC:-docs/deploy/base-sepolia-v13-sports-rehearsal-2026-05-13.md}"
READINESS_DOC="${SPORTS_READINESS_DOC:-docs/plan/Milestone-3.1-SportsHub-Readiness.md}"
CONTROLS_DOC="${SPORTS_CONTROLS_DOC:-docs/ops/sportsbook-production-controls.md}"

need_file "$SNAPSHOT_PATH"
need_file "$REHEARSAL_DOC"
need_file "$READINESS_DOC"
need_file "$CONTROLS_DOC"

SPORTS_HUB="$(jq -r '.sportsHub // empty' "$SNAPSHOT_PATH")"
SPORTS_BANK="$(jq -r '.poolBank_1 // empty' "$SNAPSHOT_PATH")"
POOL_DOMAIN="$(jq -r '.poolDomain_1 // empty' "$SNAPSHOT_PATH")"
SPORTS_ENABLED="$(jq -r '.sportsEnabled // empty' "$SNAPSHOT_PATH")"
REPORTER_THRESHOLD="$(jq -r '.sportsResultReporterThreshold // empty' "$SNAPSHOT_PATH")"
CHALLENGE_TIMEOUT="$(jq -r '.sportsResultChallengeTimeoutSeconds // empty' "$SNAPSHOT_PATH")"

[[ "$SPORTS_HUB" =~ ^0x[0-9a-fA-F]{40}$ ]] || fail "snapshot sportsHub is not an address: $SPORTS_HUB"
[[ "$SPORTS_BANK" =~ ^0x[0-9a-fA-F]{40}$ ]] || fail "snapshot poolBank_1 is not an address: $SPORTS_BANK"
[[ "$POOL_DOMAIN" == "2" ]] || fail "snapshot pool 2 row must be Sports domain"
[[ "$SPORTS_ENABLED" == "1" ]] || fail "snapshot sportsEnabled must be 1"
[[ "$REPORTER_THRESHOLD" == "1" ]] || fail "Phase 1 closeout expects reporter threshold 1"
[[ "$CHALLENGE_TIMEOUT" =~ ^[0-9]+$ ]] || fail "snapshot sportsResultChallengeTimeoutSeconds must be numeric"
(( CHALLENGE_TIMEOUT >= 600 )) || fail "snapshot sportsResultChallengeTimeoutSeconds must be >= 600"

hub_code="$(cast code "$SPORTS_HUB" --rpc-url "$RPC_URL")"
bank_code="$(cast code "$SPORTS_BANK" --rpc-url "$RPC_URL")"
[[ "$hub_code" != "0x" ]] || fail "SportsHub has no bytecode: $SPORTS_HUB"
[[ "$bank_code" != "0x" ]] || fail "Sports Bank has no bytecode: $SPORTS_BANK"

gov_onchain="$(cast_call "$SPORTS_HUB" 'governance()(address)')"
[[ "$(lower "$gov_onchain")" == "$(lower "$GOV")" ]] || fail "SportsHub governance mismatch: $gov_onchain != $GOV"

odds_hash="$(cast_call "$SPORTS_HUB" 'oddsSignerSetHash()(bytes32)')"
reporter_hash="$(cast_call "$SPORTS_HUB" 'resultReporterSetHash()(bytes32)')"
threshold_onchain="$(cast_call "$SPORTS_HUB" 'resultReporterThreshold()(uint8)')"
challenge_timeout_onchain="$(cast_call "$SPORTS_HUB" 'resultChallengeTimeoutSeconds()(uint64)')"

[[ "$odds_hash" != "0x0000000000000000000000000000000000000000000000000000000000000000" ]] \
  || fail "odds signer set hash is zero"
[[ "$reporter_hash" != "0x0000000000000000000000000000000000000000000000000000000000000000" ]] \
  || fail "result reporter set hash is zero"
[[ "$threshold_onchain" == "1" ]] || fail "on-chain reporter threshold must be 1"
[[ "$challenge_timeout_onchain" == "$CHALLENGE_TIMEOUT" ]] \
  || fail "on-chain challenge timeout mismatch: $challenge_timeout_onchain != $CHALLENGE_TIMEOUT"

[[ "$(cast_call "$SPORTS_HUB" 'oddsSigner(address)(bool)' "$SPORTS_ODDS_SIGNER")" == "true" ]] \
  || fail "dedicated odds signer not allowlisted"
[[ "$(cast_call "$SPORTS_HUB" 'resultReporter(address)(bool)' "$SPORTS_RESULT_REPORTER")" == "true" ]] \
  || fail "dedicated result reporter not allowlisted"
[[ "$(cast_call "$SPORTS_HUB" 'resultChallenger(address)(bool)' "$SPORTS_RESULT_CHALLENGER")" == "true" ]] \
  || fail "dedicated result challenger not allowlisted"
[[ "$(cast_call "$SPORTS_HUB" 'resultArbitrator(address)(bool)' "$SPORTS_RESULT_ARBITRATOR")" == "true" ]] \
  || fail "dedicated result arbitrator not allowlisted"

[[ "$(cast_call "$SPORTS_HUB" 'oddsSigner(address)(bool)' "$GOV")" == "false" ]] \
  || fail "GOV must not remain odds signer for Phase 1 closeout"
[[ "$(cast_call "$SPORTS_HUB" 'resultReporter(address)(bool)' "$GOV")" == "false" ]] \
  || fail "GOV must not remain result reporter for Phase 1 closeout"

bank_reserved="$(cast_call "$SPORTS_BANK" 'totalReserved()(uint256)')"
[[ "$bank_reserved" == "0" ]] || fail "Sports Bank reserved must be zero after rehearsals: $bank_reserved"

grep -q "Role-separated challenge + arbitration void broadcast" "$REHEARSAL_DOC" \
  || fail "rehearsal doc missing role-separated arbitration evidence"
grep -qi "Phase 1 closeout" "$CONTROLS_DOC" || fail "controls doc missing Phase 1 closeout section"
grep -qi "public frontend controls" "$CONTROLS_DOC" || fail "controls doc missing public frontend controls"

echo "v1.3 Sports Phase 1 closeout passed:"
echo "  snapshot: $SNAPSHOT_PATH"
echo "  sportsHub: $SPORTS_HUB"
echo "  sportsBank: $SPORTS_BANK"
echo "  oddsSignerSetHash: $odds_hash"
echo "  resultReporterSetHash: $reporter_hash"
echo "  resultReporterThreshold: $threshold_onchain"
echo "  resultChallengeTimeoutSeconds: $challenge_timeout_onchain"
echo "  sportsBankReserved: $bank_reserved"
echo "  docs: $REHEARSAL_DOC, $READINESS_DOC, $CONTROLS_DOC"
