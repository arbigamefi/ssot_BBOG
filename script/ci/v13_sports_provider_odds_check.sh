#!/usr/bin/env bash
set -euo pipefail

# Validates the v1.3 SportsHub provider-odds ingestion path using a deterministic
# The Odds API fixture.

fail() {
  echo "error: $*" >&2
  exit 1
}

command -v python3 >/dev/null 2>&1 || fail "missing command: python3"
command -v cast >/dev/null 2>&1 || fail "missing command: cast"

OUT_DIR="${SPORTS_ODDS_SNAPSHOT_DIR:-tmp/sports-provider-odds-check}"
rm -rf "$OUT_DIR"

python3 script/ops/sports_provider_odds.py \
  --fixture test/fixtures/sports/the-odds-api-football-h2h-odds.json \
  --sport-key soccer_fifa_world_cup \
  --provider-event-id odds-api-event-mexico-south-africa-2026 \
  --bookmaker-key draftkings \
  --out-dir "$OUT_DIR" \
  --chain-id 84532 \
  --sports-hub 0x2DB4Ba326C2C3e5830b0da10F0C52B4097f9fa4b \
  --market-id 4 \
  --event-id 2026061101 \
  --pool-id 2 \
  --market-version 1 \
  --ttl-seconds 120 \
  --generated-at 1781193600 \
  --expires-at 1781193720 \
  --max-payout-raw 500000 \
  --rulebook-hash 0x1111111111111111111111111111111111111111111111111111111111111111

python3 - "$OUT_DIR" <<'PY'
import json
import pathlib
import re
import sys

out_dir = pathlib.Path(sys.argv[1])
summary = json.loads((out_dir / "odds-proposal.json").read_text())
snapshot = json.loads((out_dir / "odds-snapshot.json").read_text())
env_text = (out_dir / "odds-snapshot.env").read_text()

def fail(message):
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)

hex32 = re.compile(r"^0x[0-9a-fA-F]{64}$")
expected = {
    "homeOddsWad": 1800000000000000000,
    "drawOddsWad": 3400000000000000000,
    "awayOddsWad": 4500000000000000000,
}
for key, value in expected.items():
    if int(summary[key]) != value:
        fail(f"{key} mismatch: {summary[key]} != {value}")
if not hex32.match(summary["marketKey"]):
    fail("marketKey must be bytes32")
if not hex32.match(summary["oddsSourceHash"]):
    fail("oddsSourceHash must be bytes32")
if summary["oddsSourceHash"] != "0x0b17e50148a6053476fbbf4b84a5b7153c4b96b5b834bc76df8effdd2439f0d4":
    fail("oddsSourceHash mismatch")
if summary["expiresAt"] != 1781193720:
    fail("expiresAt mismatch")
if summary["generatedAt"] != 1781193600:
    fail("generatedAt mismatch")
if int(summary["requiredMaxPayoutRaw"]) != 450000:
    fail("requiredMaxPayoutRaw mismatch")
if int(summary["maxPayoutRaw"]) != 500000:
    fail("maxPayoutRaw mismatch")
for needle in (
    f"FOOTBALL_MARKET_KEY={summary['marketKey']}",
    f"FOOTBALL_RULEBOOK_HASH={summary['rulebookHash']}",
    "FOOTBALL_ODDS_EXPIRES_AT=1781193720",
    "FOOTBALL_HOME_ODDS_WAD=1800000000000000000",
    "FOOTBALL_DRAW_ODDS_WAD=3400000000000000000",
    "FOOTBALL_AWAY_ODDS_WAD=4500000000000000000",
    "FOOTBALL_MAX_PAYOUT=500000",
    "FOOTBALL_REQUIRED_MAX_PAYOUT=450000",
    f"FOOTBALL_ODDS_SOURCE_HASH={summary['oddsSourceHash']}",
):
    if needle not in env_text:
        fail(f"missing env line: {needle}")
if len(snapshot["outcomes"]) != 3:
    fail("snapshot must contain three 1X2 outcomes")
print("v1.3 Sports provider odds fixture validated:")
print(f"  outDir: {out_dir}")
print(f"  marketKey: {summary['marketKey']}")
print(f"  homeOddsWad: {summary['homeOddsWad']}")
print(f"  drawOddsWad: {summary['drawOddsWad']}")
print(f"  awayOddsWad: {summary['awayOddsWad']}")
print(f"  oddsSourceHash: {summary['oddsSourceHash']}")
PY
