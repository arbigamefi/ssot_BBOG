#!/usr/bin/env bash
set -euo pipefail

# Validates casino jurisdiction and frontend-access approval before public-money risk-in.
#
# Usage:
#   bash script/ci/v13_casino_frontend_access_check.sh [memo-json]
#   REQUIRE_APPROVED=1 bash script/ci/v13_casino_frontend_access_check.sh <approved-memo-json>

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [memo-json]" >&2
  exit 2
fi

MEMO="${1:-${FRONTEND_ACCESS_FILE:-docs/ops/templates/casino-frontend-access.example.json}}"
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


def as_int(value, label):
    if isinstance(value, bool):
        fail(f"{label} must be an integer")
    if isinstance(value, int):
        return value
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        return int(value)
    fail(f"{label} must be an integer")


def require_bool(value, label):
    if not isinstance(value, bool):
        fail(f"{label} must be a boolean")
    return value


def require_filled(value, label):
    if not isinstance(value, str) or not value or value == "TBD":
        fail(f"{label} must be filled for approved casino frontend access")


def require_nonempty_list(value, label):
    if not isinstance(value, list) or not value:
        fail(f"{label} must be a non-empty list")


def require_filled_list(value, label):
    require_nonempty_list(value, label)
    for i, item in enumerate(value):
        require_filled(item, f"{label}[{i}]")


def is_address(value):
    return isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value)


schema = require(memo, "schemaVersion", "schemaVersion")
if schema != "casino.frontend-access.v1":
    fail(f"unsupported schemaVersion: {schema}")

status = require(memo, "status", "status")
if status not in {"draft", "approved"}:
    fail("status must be draft or approved")
require_approved = os.environ.get("REQUIRE_APPROVED") == "1"
if require_approved and status != "approved":
    fail("REQUIRE_APPROVED=1 requires status=approved")

chain_id = as_int(require(memo, "chainId", "chainId"), "chainId")
if chain_id <= 0:
    fail("chainId must be positive")

game_hub = require(memo, "gameHub", "gameHub")
if not is_address(game_hub):
    fail("gameHub must be an EVM address")
if require_approved and game_hub.lower() == "0x0000000000000000000000000000000000000000":
    fail("approved memo requires non-zero gameHub")

frontend = require(memo, "frontend", "frontend")
public_enabled = require_bool(
    require(frontend, "publicCasinoEnabled", "frontend.publicCasinoEnabled"),
    "frontend.publicCasinoEnabled",
)
default_state = require(frontend, "defaultState", "frontend.defaultState")
if default_state not in {"off", "on"}:
    fail("frontend.defaultState must be off or on")
allowed_block_behaviors = {"block-risk-in", "hide-risk-in"}
unknown_behavior = require(frontend, "unknownJurisdictionBehavior", "frontend.unknownJurisdictionBehavior")
restricted_behavior = require(frontend, "restrictedJurisdictionBehavior", "frontend.restrictedJurisdictionBehavior")
if unknown_behavior not in allowed_block_behaviors:
    fail("frontend.unknownJurisdictionBehavior must block or hide risk-in")
if restricted_behavior not in allowed_block_behaviors:
    fail("frontend.restrictedJurisdictionBehavior must block or hide risk-in")

jurisdiction = require(memo, "jurisdictionDecision", "jurisdictionDecision")
targets = require(jurisdiction, "targetJurisdictions", "jurisdictionDecision.targetJurisdictions")
restricted = require(jurisdiction, "restrictedJurisdictions", "jurisdictionDecision.restrictedJurisdictions")
licenses = require(jurisdiction, "operatorLicensesOrExemptions", "jurisdictionDecision.operatorLicensesOrExemptions")
require_nonempty_list(targets, "jurisdictionDecision.targetJurisdictions")
require_nonempty_list(restricted, "jurisdictionDecision.restrictedJurisdictions")
require_nonempty_list(licenses, "jurisdictionDecision.operatorLicensesOrExemptions")

access = require(memo, "accessControls", "accessControls")
minimum_age = as_int(require(access, "minimumAge", "accessControls.minimumAge"), "accessControls.minimumAge")
if minimum_age < 18:
    fail("accessControls.minimumAge must be at least 18")
responsible_controls = require(access, "responsibleGamingControls", "accessControls.responsibleGamingControls")
require_nonempty_list(responsible_controls, "accessControls.responsibleGamingControls")

content = require(memo, "contentLinks", "contentLinks")
for field in ["termsUri", "privacyUri", "riskDisclaimerUri", "responsibleGamingUri", "supportUri"]:
    value = require(content, field, f"contentLinks.{field}")
    if not isinstance(value, str) or not value:
        fail(f"contentLinks.{field} must be non-empty")

technical = require(memo, "technicalControls", "technicalControls")
for field in [
    "riskInDisabledWhenUnapproved",
    "unknownJurisdictionBlocksRiskIn",
    "restrictedJurisdictionBlocksRiskIn",
    "walletGateRequired",
    "auditLogRequired",
    "healthzRequired",
]:
    if require(technical, field, f"technicalControls.{field}") is not True:
        fail(f"technicalControls.{field} must be true")

if require_approved:
    if default_state != "off":
        fail("approved memo requires frontend.defaultState=off")
    require_filled_list(targets, "jurisdictionDecision.targetJurisdictions")
    require_filled_list(restricted, "jurisdictionDecision.restrictedJurisdictions")
    require_filled_list(licenses, "jurisdictionDecision.operatorLicensesOrExemptions")
    overlap = {item.lower() for item in targets} & {item.lower() for item in restricted}
    if overlap:
        fail(f"target and restricted jurisdictions overlap: {', '.join(sorted(overlap))}")
    for field in [
        "agePolicy",
        "kycPolicy",
        "sanctionsPolicy",
        "geoRestrictionProvider",
        "vpnProxyPolicy",
        "cookieConsentPolicy",
        "selfExclusionPolicy",
        "stakeLimitPolicy",
    ]:
        require_filled(require(access, field, f"accessControls.{field}"), f"accessControls.{field}")
    require_filled_list(responsible_controls, "accessControls.responsibleGamingControls")
    for field in ["termsUri", "privacyUri", "riskDisclaimerUri", "responsibleGamingUri", "supportUri"]:
        require_filled(require(content, field, f"contentLinks.{field}"), f"contentLinks.{field}")
    approvals = require(memo, "approvals", "approvals")
    for field in [
        "legalApproval",
        "complianceApproval",
        "frontendApproval",
        "operationsApproval",
        "approvedAt",
        "evidenceUri",
    ]:
        require_filled(require(approvals, field, f"approvals.{field}"), f"approvals.{field}")

print("v1.3 Casino frontend-access approval memo validated:")
print(f"  memo: {path}")
print(f"  status: {status}")
print(f"  chainId: {chain_id}")
print(f"  gameHub: {game_hub}")
print(f"  publicCasinoEnabled: {public_enabled}")
print(f"  targetJurisdictions: {len(targets)}")
print(f"  restrictedJurisdictions: {len(restricted)}")
print(f"  minimumAge: {minimum_age}")
PY
