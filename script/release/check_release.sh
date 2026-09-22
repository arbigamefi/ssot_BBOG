#!/usr/bin/env bash
set -euo pipefail

STRICT="${STRICT:-0}"
PYTHON="${PYTHON:-python}"

RELEASE_PATH="${RELEASE_PATH:-deployments/release-latest-v15.json}"
SNAPSHOT_PATH_EXPLICIT="${SNAPSHOT_PATH+x}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v15.json}"
NOTES_PATH="${NOTES_PATH:-deployments/release-notes-latest-v15.md}"

# "Latest" pointers (frontend consumes these)
FRONTEND_MANIFEST_PATH="${FRONTEND_MANIFEST_PATH:-deployments/frontend-manifest-latest-v15.json}"
GOLDEN_VECTORS_PATH="${GOLDEN_VECTORS_PATH:-deployments/golden-vectors-latest-v15.json}"
ABI_INDEX_PATH="${ABI_INDEX_PATH:-deployments/abis-v15/index.json}"
FRONTEND_SCHEMA="${FRONTEND_SCHEMA:-2}"
RELEASE_TAG_SUFFIX="${RELEASE_TAG_SUFFIX:--v15}"
VERIFY_SCRIPT="${VERIFY_SCRIPT:-script/release/VerifyReleaseV15.s.sol:VerifyReleaseV15}"

release_snapshot_path() {
  "$PYTHON" - "$RELEASE_PATH" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
with path.open("r", encoding="utf-8") as f:
    rel = json.load(f)
value = rel.get("snapshotPath")
print(value if isinstance(value, str) and value.strip() else "")
PY
}

if [[ "$STRICT" == "1" ]]; then
  [[ -f "$RELEASE_PATH" ]] || { echo "missing release artifact: $RELEASE_PATH"; exit 1; }
  if [[ -z "$SNAPSHOT_PATH_EXPLICIT" ]]; then
    SNAPSHOT_FROM_RELEASE="$(release_snapshot_path)"
    if [[ -n "$SNAPSHOT_FROM_RELEASE" ]]; then
      SNAPSHOT_PATH="$SNAPSHOT_FROM_RELEASE"
    fi
  fi
  [[ -f "$SNAPSHOT_PATH" ]] || { echo "missing snapshot: $SNAPSHOT_PATH"; exit 1; }
  [[ -f "$NOTES_PATH" ]] || { echo "missing release notes: $NOTES_PATH"; exit 1; }
  [[ -f "$FRONTEND_MANIFEST_PATH" ]] || { echo "missing frontend manifest: $FRONTEND_MANIFEST_PATH"; exit 1; }
  [[ -f "$GOLDEN_VECTORS_PATH" ]] || { echo "missing golden vectors: $GOLDEN_VECTORS_PATH"; exit 1; }
  [[ -f "$ABI_INDEX_PATH" ]] || { echo "missing abis index: $ABI_INDEX_PATH (run: make release-abis)"; exit 1; }
else
  # Non-strict mode: if artifacts are absent, don't fail CI.
  if [[ ! -f "$RELEASE_PATH" ]]; then
    echo "release check skipped (artifacts not present)."
    exit 0
  fi
  if [[ -z "$SNAPSHOT_PATH_EXPLICIT" ]]; then
    SNAPSHOT_FROM_RELEASE="$(release_snapshot_path)"
    if [[ -n "$SNAPSHOT_FROM_RELEASE" ]]; then
      SNAPSHOT_PATH="$SNAPSHOT_FROM_RELEASE"
    fi
  fi
  if [[ ! -f "$SNAPSHOT_PATH" ]]; then
    echo "release check skipped (snapshot not present: $SNAPSHOT_PATH)."
    exit 0
  fi
fi

# Validate frontend artifacts deterministically (no RPC). This is a hard gate in STRICT=1.
"$PYTHON" script/release/validate_frontend_artifacts.py \
  --strict "$STRICT" \
  --release "$RELEASE_PATH" \
  --snapshot "$SNAPSHOT_PATH" \
  --notes "$NOTES_PATH" \
  --manifest "$FRONTEND_MANIFEST_PATH" \
  --vectors "$GOLDEN_VECTORS_PATH" \
  --schema "$FRONTEND_SCHEMA" \
  --tag-suffix="$RELEASE_TAG_SUFFIX" \
  --abis-index "$ABI_INDEX_PATH"

# Verify digest + signature deterministically (no RPC needed).
RELEASE_PATH="$RELEASE_PATH" SNAPSHOT_PATH="$SNAPSHOT_PATH" \
  forge script "$VERIFY_SCRIPT" -vvv
