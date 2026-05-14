#!/usr/bin/env bash
set -euo pipefail

# Validates SportsHub monitoring and keeper-coverage records before public-money risk-in.
#
# Usage:
#   bash script/ci/v13_sports_ops_coverage_check.sh [memo-json]
#   REQUIRE_APPROVED=1 bash script/ci/v13_sports_ops_coverage_check.sh <approved-memo-json>

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [memo-json]" >&2
  exit 2
fi

MEMO="${1:-${OPS_COVERAGE_FILE:-docs/ops/templates/sportsbook-ops-coverage.example.json}}"
[[ -s "$MEMO" ]] || fail "missing or empty file: $MEMO"

command -v python3 >/dev/null 2>&1 || fail "missing command: python3"

REQUIRE_APPROVED="${REQUIRE_APPROVED:-0}" python3 - "$MEMO" <<'PY'
import json
import os
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    memo = json.load(fh)


def fail(message: str) -> None:
    raise SystemExit(f"error: {message}")


def require(container, key, label):
    if not isinstance(container, dict) or key not in container:
        fail(f"missing field: {label}")
    return container[key]


def require_filled(value, label):
    if not isinstance(value, str) or not value or value == "TBD":
        fail(f"{label} must be filled for approved ops coverage")


def is_address(value):
    return isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value)


schema = require(memo, "schemaVersion", "schemaVersion")
if schema != "sportsbook.ops-coverage.v1":
    fail(f"unsupported schemaVersion: {schema}")

status = require(memo, "status", "status")
if status not in {"draft", "approved"}:
    fail("status must be draft or approved")
require_approved = os.environ.get("REQUIRE_APPROVED") == "1"
if require_approved and status != "approved":
    fail("REQUIRE_APPROVED=1 requires status=approved")

sports_hub = require(memo, "sportsHub", "sportsHub")
if not is_address(sports_hub) or sports_hub.lower() == "0x0000000000000000000000000000000000000000":
    fail("sportsHub must be a non-zero EVM address")

monitoring = require(memo, "monitoring", "monitoring")
coverage = require(monitoring, "coverage", "monitoring.coverage")
required_alerts = [
    "G1_SPORTS_ODDS_REJECT_SPIKE",
    "G2_SPORTS_RISK_CAP_REVERT_SPIKE",
    "G3_SPORTS_EXPOSURE_NEAR_CAP",
    "G3A_SPORTS_MARKET_VOIDED",
    "G4_SPORTS_RESULT_FINALITY_STUCK",
    "G5_SPORTS_RESULT_CHALLENGED",
    "G6_SPORTS_ORACLE_CONFIG_CHANGED",
    "G7_SPORTS_RISK_LIMITS_CHANGED",
]
for alert in required_alerts:
    if coverage.get(alert) is not True:
        fail(f"monitoring.coverage.{alert} must be true")

channels = require(monitoring, "alertChannels", "monitoring.alertChannels")
if not isinstance(channels, list) or not channels:
    fail("monitoring.alertChannels must be a non-empty list")

keeper = require(memo, "keeper", "keeper")
keeper_address = require(keeper, "address", "keeper.address")
if not is_address(keeper_address) or keeper_address.lower() == "0x0000000000000000000000000000000000000000":
    fail("keeper.address must be a non-zero EVM address")

can_call = require(keeper, "canCall", "keeper.canCall")
required_calls = ["finalizeResult", "settleTickets", "refundTickets", "voidTickets"]
for call_name in required_calls:
    if can_call.get(call_name) is not True:
        fail(f"keeper.canCall.{call_name} must be true")

max_batch = require(keeper, "maxBatchSize", "keeper.maxBatchSize")
if not isinstance(max_batch, int) or max_batch <= 0 or max_batch > 100:
    fail("keeper.maxBatchSize must be between 1 and 100")

if require_approved:
    require_filled(require(monitoring, "owner", "monitoring.owner"), "monitoring.owner")
    for i, channel in enumerate(channels):
        require_filled(channel, f"monitoring.alertChannels[{i}]")
    require_filled(require(monitoring, "marketWindowCoverage", "monitoring.marketWindowCoverage"), "monitoring.marketWindowCoverage")
    require_filled(require(monitoring, "escalationPolicy", "monitoring.escalationPolicy"), "monitoring.escalationPolicy")
    require_filled(require(keeper, "owner", "keeper.owner"), "keeper.owner")
    require_filled(require(keeper, "retryShrinkProcedure", "keeper.retryShrinkProcedure"), "keeper.retryShrinkProcedure")
    rehearsals = require(memo, "rehearsals", "rehearsals")
    for field in ["finalizeResultTx", "settleTicketsTx", "refundTicketsTx", "voidTicketsTx", "lastCheckedAt"]:
        require_filled(require(rehearsals, field, f"rehearsals.{field}"), f"rehearsals.{field}")

print("v1.3 Sports monitoring/keeper coverage memo validated:")
print(f"  memo: {path}")
print(f"  status: {status}")
print(f"  sportsHub: {sports_hub}")
print(f"  keeper: {keeper_address}")
print(f"  maxBatchSize: {max_batch}")
print(f"  alerts: {len(required_alerts)}")
PY
