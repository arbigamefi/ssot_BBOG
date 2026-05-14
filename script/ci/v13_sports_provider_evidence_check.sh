#!/usr/bin/env bash
set -euo pipefail

# Validates the v1.3 SportsHub provider-evidence ingestion path using a
# deterministic The Odds API fixture.

fail() {
  echo "error: $*" >&2
  exit 1
}

command -v python3 >/dev/null 2>&1 || fail "missing command: python3"
command -v cast >/dev/null 2>&1 || fail "missing command: cast"

OUT_DIR="${SPORTS_PROVIDER_EVIDENCE_DIR:-tmp/sports-provider-evidence-check}"
rm -rf "$OUT_DIR"

python3 script/ops/sports_provider_evidence.py \
  --fixture test/fixtures/sports/the-odds-api-football-completed-score.json \
  --sport-key soccer_fifa_world_cup \
  --provider-event-id odds-api-event-mexico-south-africa-2026 \
  --out-dir "$OUT_DIR" \
  --chain-id 84532 \
  --sports-hub 0x2DB4Ba326C2C3e5830b0da10F0C52B4097f9fa4b \
  --market-id 4 \
  --event-id 2026061101 \
  --pool-id 2 \
  --market-version 1 \
  --market-key FIFA_WORLD_CUP_2026_MEXICO_SOUTH_AFRICA_1X2 \
  --rulebook-hash 0x1111111111111111111111111111111111111111111111111111111111111111 \
  --reporter-set-hash 0x2222222222222222222222222222222222222222222222222222222222222222 \
  --reporter-signer 0x0000000000000000000000000000000000001002

python3 - "$OUT_DIR" <<'PY'
import json
import pathlib
import re
import sys

out_dir = pathlib.Path(sys.argv[1])
summary = json.loads((out_dir / "result-proposal.json").read_text())
env_text = (out_dir / "result-proposal.env").read_text()
source = json.loads((out_dir / "result-source.json").read_text())
evidence = json.loads((out_dir / "result-evidence.json").read_text())

def fail(message):
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)

hex32 = re.compile(r"^0x[0-9a-fA-F]{64}$")
if summary["winningOutcomeId"] != 0:
    fail("fixture should resolve home outcome 0")
if summary["observedAt"] != 1781211600:
    fail("unexpected observedAt")
for key in ("resultSourceHash", "evidenceHash"):
    if not hex32.match(summary[key]) or int(summary[key], 16) == 0:
        fail(f"{key} must be a non-zero bytes32")
for needle in (
    "FOOTBALL_WINNING_OUTCOME_ID=0",
    f"FOOTBALL_RESULT_OBSERVED_AT={summary['observedAt']}",
    f"FOOTBALL_RESULT_SOURCE_HASH={summary['resultSourceHash']}",
    f"FOOTBALL_EVIDENCE_HASH={summary['evidenceHash']}",
):
    if needle not in env_text:
        fail(f"missing env line: {needle}")
if source["outcomeMapping"]["winningSide"] != "home":
    fail("source mapping should resolve home")
if evidence["providers"][0]["sourceBundleHash"] != summary["resultSourceHash"]:
    fail("evidence must link source bundle hash")
print("v1.3 Sports provider evidence fixture validated:")
print(f"  outDir: {out_dir}")
print(f"  winningOutcomeId: {summary['winningOutcomeId']}")
print(f"  observedAt: {summary['observedAt']}")
print(f"  resultSourceHash: {summary['resultSourceHash']}")
print(f"  evidenceHash: {summary['evidenceHash']}")
PY
