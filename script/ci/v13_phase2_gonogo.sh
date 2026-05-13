#!/usr/bin/env bash
set -euo pipefail

# Validates that the v1.3 SportsHub Phase 2 go/no-go packet exists and still
# carries the required production-blocking evidence before mainnet canary work.
#
# Usage:
#   bash script/ci/v13_phase2_gonogo.sh [packet-file]

fail() {
  echo "error: $*" >&2
  exit 1
}

need_file() {
  local path="$1"
  [[ -s "$path" ]] || fail "missing or empty file: $path"
}

need_text() {
  local path="$1"
  local text="$2"
  grep -Fq "$text" "$path" || fail "$path missing required text: $text"
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [packet-file]" >&2
  exit 2
fi

PACKET="${1:-docs/ops/sportsbook-phase2-gonogo-2026-05-14.md}"
CONTROLS_DOC="docs/ops/sportsbook-production-controls.md"
READINESS_DOC="docs/plan/Milestone-3.1-SportsHub-Readiness.md"
SPORTS_REHEARSAL_DOC="docs/deploy/base-sepolia-v13-sports-rehearsal-2026-05-13.md"
GAMEHUB_CANARY_DOC="docs/deploy/base-sepolia-v13-gamehub-canary-2026-05-14.md"
PROVIDER_POLICY_DOC="docs/ops/sportsbook-provider-evidence-policy.md"
RULEBOOK_TEMPLATE="docs/ops/templates/sportsbook-rulebook.pre-match-moneyline.example.json"
RESULT_EVIDENCE_TEMPLATE="docs/ops/templates/sportsbook-result-evidence.example.json"
BANKROLL_POLICY_DOC="docs/ops/sportsbook-bankroll-risk-caps.md"
BANKROLL_CAPS_TEMPLATE="docs/ops/templates/sportsbook-bankroll-risk-caps.example.json"

need_file "$PACKET"
need_file "$CONTROLS_DOC"
need_file "$READINESS_DOC"
need_file "$SPORTS_REHEARSAL_DOC"
need_file "$GAMEHUB_CANARY_DOC"
need_file "$PROVIDER_POLICY_DOC"
need_file "$RULEBOOK_TEMPLATE"
need_file "$RESULT_EVIDENCE_TEMPLATE"
need_file "$BANKROLL_POLICY_DOC"
need_file "$BANKROLL_CAPS_TEMPLATE"

need_text "$PACKET" "Decision: NO-GO"
need_text "$PACKET" "Open No-Go Items"
need_text "$PACKET" "Managed key custody"
need_text "$PACKET" "Provider and evidence policy"
need_text "$PACKET" "Jurisdiction and frontend access"
need_text "$PACKET" "Bankroll sizing"
need_text "$PACKET" "Final risk caps"
need_text "$PACKET" "Monitoring and alerts"
need_text "$PACKET" "Keeper/debt-out operations"
need_text "$PACKET" "Mainnet release artifacts"
need_text "$PACKET" "Fresh canary"
need_text "$PACKET" "$SPORTS_REHEARSAL_DOC"
need_text "$PACKET" "$GAMEHUB_CANARY_DOC"
need_text "$PACKET" "$PROVIDER_POLICY_DOC"
need_text "$PACKET" "$RULEBOOK_TEMPLATE"
need_text "$PACKET" "$RESULT_EVIDENCE_TEMPLATE"
need_text "$PACKET" "$BANKROLL_POLICY_DOC"
need_text "$PACKET" "$BANKROLL_CAPS_TEMPLATE"
need_text "$PACKET" "8971eb9ed4a111cfd79d50cadeb9155e95d144e0"
need_text "$PACKET" "0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f"

need_text "$CONTROLS_DOC" "The next production gate is a documented go/no-go packet"
need_text "$CONTROLS_DOC" "sportsbook-phase2-gonogo-2026-05-14.md"
need_text "$CONTROLS_DOC" "sportsbook-provider-evidence-policy.md"
need_text "$CONTROLS_DOC" "sportsbook-bankroll-risk-caps.md"
need_text "$READINESS_DOC" "make sports-phase2-gonogo-v13"
need_text "$READINESS_DOC" "make sports-bankroll-caps-check-v13"
need_text "$READINESS_DOC" "$PROVIDER_POLICY_DOC"
need_text "$READINESS_DOC" "$BANKROLL_POLICY_DOC"
need_text "$PROVIDER_POLICY_DOC" "rulebookHash"
need_text "$PROVIDER_POLICY_DOC" "resultSourceHash"
need_text "$PROVIDER_POLICY_DOC" "evidenceHash"
need_text "$PROVIDER_POLICY_DOC" "challengeReasonHash"
need_text "$PROVIDER_POLICY_DOC" "arbitrationDecisionHash"
need_text "$BANKROLL_POLICY_DOC" "maxEventReservedRaw"
need_text "$BANKROLL_POLICY_DOC" "manualLossToleranceRaw"
need_text "$BANKROLL_POLICY_DOC" "REQUIRE_APPROVED=1"

echo "v1.3 Sports Phase 2 go/no-go packet validated:"
echo "  packet: $PACKET"
echo "  decision: NO-GO"
echo "  controls: $CONTROLS_DOC"
echo "  readiness: $READINESS_DOC"
echo "  providerPolicy: $PROVIDER_POLICY_DOC"
echo "  bankrollPolicy: $BANKROLL_POLICY_DOC"
