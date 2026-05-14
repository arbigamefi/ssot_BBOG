#!/usr/bin/env bash
set -euo pipefail

# Validates a SportsHub bankroll/risk-cap memo before caps are copied into deploy env files.
#
# Usage:
#   bash script/ci/v13_sports_bankroll_caps_check.sh [memo-json]
#   REQUIRE_APPROVED=1 bash script/ci/v13_sports_bankroll_caps_check.sh <approved-memo-json>

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [memo-json]" >&2
  exit 2
fi

MEMO="${1:-${BANKROLL_CAPS_FILE:-docs/ops/templates/sportsbook-bankroll-risk-caps.example.json}}"
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


def require(path_parts):
    value = memo
    label = ".".join(path_parts)
    for part in path_parts:
        if not isinstance(value, dict) or part not in value:
            fail(f"missing field: {label}")
        value = value[part]
    return value


def as_int(path_parts):
    label = ".".join(path_parts)
    value = require(path_parts)
    if isinstance(value, bool):
        fail(f"{label} must be an integer string or integer")
    if isinstance(value, int):
        parsed = value
    elif isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        parsed = int(value)
    else:
        fail(f"{label} must be an integer string or integer")
    return parsed


schema = require(["schemaVersion"])
if schema != "sportsbook.bankroll-risk-caps.v1":
    fail(f"unsupported schemaVersion: {schema}")

status = require(["status"])
if status not in {"draft", "approved"}:
    fail("status must be draft or approved")
if os.environ.get("REQUIRE_APPROVED") == "1" and status != "approved":
    fail("REQUIRE_APPROVED=1 requires status=approved")

chain_id = as_int(["chainId"])
pool_id = as_int(["poolId"])
decimals = as_int(["asset", "decimals"])
asset = require(["asset", "address"])
symbol = require(["asset", "symbol"])

if chain_id <= 0:
    fail("chainId must be positive")
if pool_id <= 0:
    fail("poolId must be positive")
if decimals < 0 or decimals > 36:
    fail("asset.decimals must be between 0 and 36")
if not isinstance(asset, str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}", asset):
    fail("asset.address must be an EVM address")
if not isinstance(symbol, str) or not symbol:
    fail("asset.symbol must be non-empty")

bankroll = as_int(["initialBankrollRaw"])
loss_tolerance = as_int(["manualLossToleranceRaw"])
max_stake = as_int(["caps", "maxStakeRaw"])
max_payout = as_int(["caps", "maxPayoutRaw"])
max_outcome = as_int(["caps", "maxOutcomeReservedRaw"])
max_market = as_int(["caps", "maxMarketReservedRaw"])
max_event = as_int(["caps", "maxEventReservedRaw"])

if bankroll <= 0:
    fail("initialBankrollRaw must be positive")
if loss_tolerance <= 0:
    fail("manualLossToleranceRaw must be positive")
if max_stake <= 0:
    fail("caps.maxStakeRaw must be positive")
if not (max_stake <= max_payout):
    fail("maxStakeRaw must be <= maxPayoutRaw")
if not (max_payout <= max_outcome):
    fail("maxPayoutRaw must be <= maxOutcomeReservedRaw")
if not (max_outcome <= max_market):
    fail("maxOutcomeReservedRaw must be <= maxMarketReservedRaw")
if not (max_market <= max_event):
    fail("maxMarketReservedRaw must be <= maxEventReservedRaw")
if not (max_event <= loss_tolerance):
    fail("maxEventReservedRaw must be <= manualLossToleranceRaw")
if not (loss_tolerance <= bankroll):
    fail("manualLossToleranceRaw must be <= initialBankrollRaw")

print("v1.3 Sports bankroll/risk caps memo validated:")
print(f"  memo: {path}")
print(f"  status: {status}")
print(f"  chainId: {chain_id}")
print(f"  poolId: {pool_id}")
print(f"  asset: {asset} ({symbol}, decimals={decimals})")
print(f"  initialBankrollRaw: {bankroll}")
print(f"  manualLossToleranceRaw: {loss_tolerance}")
print(f"  maxStakeRaw: {max_stake}")
print(f"  maxPayoutRaw: {max_payout}")
print(f"  maxOutcomeReservedRaw: {max_outcome}")
print(f"  maxMarketReservedRaw: {max_market}")
print(f"  maxEventReservedRaw: {max_event}")
PY
