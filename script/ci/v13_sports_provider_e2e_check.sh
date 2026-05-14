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

python3 - \
  "$odds_out" \
  "$evidence_out" \
  "$SPORTS_HUB" \
  "$CHAIN_ID" \
  "$next_market_id" \
  "$FOOTBALL_EVENT_ID" \
  "$FOOTBALL_POOL_ID" \
  "$FOOTBALL_MARKET_VERSION" \
  "$FOOTBALL_RULEBOOK_HASH" \
  "$FOOTBALL_STAKE" \
  "$FOOTBALL_MAX_PAYOUT" \
  "$reporter_set_hash" \
  "$reporter_threshold" \
  "$reporter_address" <<'PY'
import json
import pathlib
import sys
from datetime import datetime, timezone

(
    odds_dir,
    evidence_dir,
    sports_hub,
    chain_id,
    market_id,
    event_id,
    pool_id,
    market_version,
    rulebook_hash,
    stake_raw,
    max_payout_raw,
    reporter_set_hash,
    reporter_threshold,
    reporter_address,
) = sys.argv[1:]

odds_dir = pathlib.Path(odds_dir)
evidence_dir = pathlib.Path(evidence_dir)

odds_summary = json.loads((odds_dir / "odds-proposal.json").read_text())
odds_snapshot = json.loads((odds_dir / "odds-snapshot.json").read_text())
odds_source = json.loads((odds_dir / "odds-source.json").read_text())
result_summary = json.loads((evidence_dir / "result-proposal.json").read_text())
result_source = json.loads((evidence_dir / "result-source.json").read_text())
result_evidence = json.loads((evidence_dir / "result-evidence.json").read_text())


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def expect(label: str, actual, expected) -> None:
    if str(actual).lower() != str(expected).lower():
        fail(f"{label} mismatch: {actual} != {expected}")


def parse_iso8601(value: str) -> int:
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).timestamp())


expect("sportsHub", odds_snapshot["sportsHub"], sports_hub)
expect("evidence sportsHub", result_evidence["sportsHub"], sports_hub)
expect("chainId", odds_snapshot["chainId"], chain_id)
expect("evidence chainId", result_evidence["chainId"], chain_id)
expect("marketId odds/result", odds_summary["marketId"], result_summary["marketId"])
expect("marketId context", odds_summary["marketId"], market_id)
expect("eventId odds/result", odds_summary["eventId"], result_summary["eventId"])
expect("eventId context", odds_summary["eventId"], event_id)
expect("poolId odds/result", odds_summary["poolId"], result_summary["poolId"])
expect("poolId context", odds_summary["poolId"], pool_id)
expect("marketVersion", odds_snapshot["marketVersion"], market_version)
expect("evidence marketVersion", result_evidence["marketVersion"], market_version)
expect("rulebookHash odds/evidence", odds_summary["rulebookHash"], result_evidence["rulebookHash"])
expect("rulebookHash context", odds_summary["rulebookHash"], rulebook_hash)
expect("providerEventId odds/result", odds_summary["providerEventId"], result_summary["providerEventId"])
expect(
    "providerEventId source",
    odds_source["provider"]["providerEventId"],
    result_source["provider"]["providerEventId"],
)
expect("reporterSetHash", result_evidence["reporter"]["reporterSetHash"], reporter_set_hash)
expect("reporterThreshold", result_evidence["reporter"]["threshold"], reporter_threshold)
if reporter_address.lower() not in {signer.lower() for signer in result_evidence["reporter"]["signers"]}:
    fail("reporter signer missing from result evidence")

if int(odds_summary["requiredMaxPayoutRaw"]) > int(max_payout_raw):
    fail("provider odds require a payout above FOOTBALL_MAX_PAYOUT")
expect("maxPayoutRaw", odds_summary["maxPayoutRaw"], max_payout_raw)
expect("stakeRaw", odds_snapshot["limits"]["stakeRaw"], stake_raw)

odds_mapping = odds_source["outcomeMapping"]
result_mapping = result_source["outcomeMapping"]
for key in ("homeOutcomeId", "drawOutcomeId", "awayOutcomeId"):
    expect(f"outcomeMapping.{key}", odds_mapping[key], result_mapping[key])

outcome_ids = {int(row["outcomeId"]) for row in odds_snapshot["outcomes"]}
if int(result_summary["winningOutcomeId"]) not in outcome_ids:
    fail("result winning outcome is not present in odds snapshot outcomes")
commence_at = parse_iso8601(odds_source["event"]["commenceTime"])
if int(odds_summary["oddsObservedAt"]) > commence_at:
    fail("odds observation must not be after event commence time")
if int(result_summary["observedAt"]) < commence_at:
    fail("result observation must not be before event commence time")
if int(result_summary["observedAt"]) <= int(odds_summary["oddsObservedAt"]):
    fail("result observation must be after odds observation")

manifest = {
    "schemaVersion": "sportsbook.provider-e2e-rehearsal.v1",
    "sportsHub": sports_hub,
    "chainId": int(chain_id),
    "marketId": int(market_id),
    "eventId": int(event_id),
    "poolId": int(pool_id),
    "providerEventId": odds_summary["providerEventId"],
    "bookmakerKey": odds_summary["bookmakerKey"],
    "marketKey": odds_summary["marketKey"],
    "rulebookHash": odds_summary["rulebookHash"],
    "oddsSourceHash": odds_summary["oddsSourceHash"],
    "resultSourceHash": result_summary["resultSourceHash"],
    "evidenceHash": result_summary["evidenceHash"],
    "winningOutcomeId": result_summary["winningOutcomeId"],
    "observedAt": result_summary["observedAt"],
    "requiredMaxPayoutRaw": odds_summary["requiredMaxPayoutRaw"],
    "maxPayoutRaw": odds_summary["maxPayoutRaw"],
    "reporterSetHash": reporter_set_hash,
    "reporter": reporter_address,
}
(evidence_dir / "provider-e2e-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")

print("provider E2E evidence consistency validated:")
print(f"  providerEventId: {manifest['providerEventId']}")
print(f"  marketId: {manifest['marketId']}")
print(f"  oddsSourceHash: {manifest['oddsSourceHash']}")
print(f"  resultSourceHash: {manifest['resultSourceHash']}")
print(f"  evidenceHash: {manifest['evidenceHash']}")
print(f"  manifest: {evidence_dir / 'provider-e2e-manifest.json'}")
PY

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
