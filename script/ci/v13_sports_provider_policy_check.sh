#!/usr/bin/env bash
set -euo pipefail

# Validates a SportsHub provider/evidence approval memo before public-money risk-in.
#
# Usage:
#   bash script/ci/v13_sports_provider_policy_check.sh [memo-json]
#   REQUIRE_APPROVED=1 bash script/ci/v13_sports_provider_policy_check.sh <approved-memo-json>

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [memo-json]" >&2
  exit 2
fi

MEMO="${1:-${PROVIDER_POLICY_FILE:-docs/ops/templates/sportsbook-provider-evidence-approval.example.json}}"
[[ -s "$MEMO" ]] || fail "missing or empty file: $MEMO"

command -v python3 >/dev/null 2>&1 || fail "missing command: python3"

REQUIRE_APPROVED="${REQUIRE_APPROVED:-0}" python3 - "$MEMO" <<'PY'
import json
import os
import pathlib
import re
import sys

path = sys.argv[1]
repo_root = pathlib.Path.cwd()
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


def require_filled(value, label):
    if not isinstance(value, str) or not value or value == "TBD":
        fail(f"{label} must be filled for approved provider/evidence policy")


def is_address(value):
    return isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value)


def require_existing_repo_path(value, label):
    require_filled(value, label)
    candidate = repo_root / value
    if not candidate.exists():
        fail(f"{label} does not exist: {value}")


schema = require(memo, "schemaVersion", "schemaVersion")
if schema != "sportsbook.provider-evidence-approval.v1":
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

sports_hub = require(memo, "sportsHub", "sportsHub")
if not is_address(sports_hub) or sports_hub.lower() == "0x0000000000000000000000000000000000000000":
    fail("sportsHub must be a non-zero EVM address")

scope = require(memo, "scope", "scope")
sports = require(scope, "sports", "scope.sports")
market_types = require(scope, "marketTypes", "scope.marketTypes")
excluded = require(scope, "excludedMarketTypes", "scope.excludedMarketTypes")
if not isinstance(sports, list) or not sports:
    fail("scope.sports must be a non-empty list")
if not isinstance(market_types, list) or not market_types:
    fail("scope.marketTypes must be a non-empty list")
if not isinstance(excluded, list):
    fail("scope.excludedMarketTypes must be a list")
if "football-1x2-pre-match" not in market_types:
    fail("scope.marketTypes must include football-1x2-pre-match")
for unsupported in ("live-betting", "parlays", "player-props", "futures"):
    if unsupported not in excluded:
        fail(f"scope.excludedMarketTypes must include {unsupported}")

provider_decision = require(memo, "providerDecision", "providerDecision")
primary = require(provider_decision, "primaryProvider", "providerDecision.primaryProvider")
provider_name = require(primary, "name", "providerDecision.primaryProvider.name")
provider_status = require(primary, "status", "providerDecision.primaryProvider.status")
if not isinstance(provider_name, str) or not provider_name:
    fail("providerDecision.primaryProvider.name must be non-empty")
if provider_status not in {"candidate", "approved"}:
    fail("providerDecision.primaryProvider.status must be candidate or approved")
require_filled(require(primary, "oddsFeed", "providerDecision.primaryProvider.oddsFeed"), "providerDecision.primaryProvider.oddsFeed")
require_filled(require(primary, "resultFeed", "providerDecision.primaryProvider.resultFeed"), "providerDecision.primaryProvider.resultFeed")

fallbacks = require(provider_decision, "fallbackProviders", "providerDecision.fallbackProviders")
if not isinstance(fallbacks, list):
    fail("providerDecision.fallbackProviders must be a list")

evidence_storage = require(memo, "evidenceStorage", "evidenceStorage")
if require(evidence_storage, "rawPayloadArchiveRequired", "evidenceStorage.rawPayloadArchiveRequired") is not True:
    fail("evidenceStorage.rawPayloadArchiveRequired must be true")
if require(evidence_storage, "immutableArchiveRequired", "evidenceStorage.immutableArchiveRequired") is not True:
    fail("evidenceStorage.immutableArchiveRequired must be true")

rulebook_policy = require(memo, "rulebookPolicy", "rulebookPolicy")
require_existing_repo_path(require(rulebook_policy, "rulebookTemplate", "rulebookPolicy.rulebookTemplate"), "rulebookPolicy.rulebookTemplate")
require_existing_repo_path(
    require(rulebook_policy, "resultEvidenceTemplate", "rulebookPolicy.resultEvidenceTemplate"),
    "rulebookPolicy.resultEvidenceTemplate",
)
outcome_mapping = require(rulebook_policy, "outcomeMapping", "rulebookPolicy.outcomeMapping")
if "0=home" not in outcome_mapping or "1=draw" not in outcome_mapping or "2=away" not in outcome_mapping:
    fail("rulebookPolicy.outcomeMapping must document 0=home,1=draw,2=away")

ingestion = require(memo, "ingestionChecks", "ingestionChecks")
require_existing_repo_path(require(ingestion, "oddsTool", "ingestionChecks.oddsTool"), "ingestionChecks.oddsTool")
require_existing_repo_path(
    require(ingestion, "resultEvidenceTool", "ingestionChecks.resultEvidenceTool"),
    "ingestionChecks.resultEvidenceTool",
)
expected_gates = {
    "oddsFixtureGate": "make sports-provider-odds-v13",
    "resultFixtureGate": "make sports-provider-evidence-v13",
    "providerE2EGate": "make sports-provider-e2e-v13",
}
for field, expected in expected_gates.items():
    value = require(ingestion, field, f"ingestionChecks.{field}")
    if not isinstance(value, str) or expected not in value:
        fail(f"ingestionChecks.{field} must include `{expected}`")

if require_approved:
    if provider_status != "approved":
        fail("approved memo requires providerDecision.primaryProvider.status=approved")
    if require(primary, "commercialUseApproved", "providerDecision.primaryProvider.commercialUseApproved") is not True:
        fail("approved memo requires commercialUseApproved=true")
    require_filled(require(primary, "accountOrContract", "providerDecision.primaryProvider.accountOrContract"), "providerDecision.primaryProvider.accountOrContract")
    require_filled(require(primary, "termsReview", "providerDecision.primaryProvider.termsReview"), "providerDecision.primaryProvider.termsReview")
    if not fallbacks:
        fail("approved memo requires at least one fallback provider")
    for i, fallback in enumerate(fallbacks):
        require_filled(require(fallback, "name", f"providerDecision.fallbackProviders[{i}].name"), f"providerDecision.fallbackProviders[{i}].name")
        require_filled(
            require(fallback, "purpose", f"providerDecision.fallbackProviders[{i}].purpose"),
            f"providerDecision.fallbackProviders[{i}].purpose",
        )
    for field in ["providerDisagreementPolicy", "providerOutagePolicy", "correctionPolicy"]:
        require_filled(require(provider_decision, field, f"providerDecision.{field}"), f"providerDecision.{field}")
    for field in ["primaryUri", "retentionPolicy", "operatorReviewRecord"]:
        require_filled(require(evidence_storage, field, f"evidenceStorage.{field}"), f"evidenceStorage.{field}")
    for field in [
        "cancellationPolicy",
        "postponementPolicy",
        "abandonmentPolicy",
        "statCorrectionPolicy",
        "voidPolicy",
    ]:
        require_filled(require(rulebook_policy, field, f"rulebookPolicy.{field}"), f"rulebookPolicy.{field}")
    approvals = require(memo, "approvals", "approvals")
    for field in [
        "providerApproval",
        "evidenceStorageApproval",
        "legalApproval",
        "operationsApproval",
        "approvedAt",
        "evidenceUri",
    ]:
        require_filled(require(approvals, field, f"approvals.{field}"), f"approvals.{field}")

print("v1.3 Sports provider/evidence approval memo validated:")
print(f"  memo: {path}")
print(f"  status: {status}")
print(f"  chainId: {chain_id}")
print(f"  sportsHub: {sports_hub}")
print(f"  provider: {provider_name} ({provider_status})")
print(f"  marketTypes: {', '.join(market_types)}")
print(f"  fallbackProviders: {len(fallbacks)}")
PY
