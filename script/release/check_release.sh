#!/usr/bin/env bash
set -euo pipefail

STRICT="${STRICT:-0}"
PYTHON="${PYTHON:-python}"

RELEASE_PATH="${RELEASE_PATH:-deployments/release-latest-v16.json}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v16.json}"
NOTES_PATH="${NOTES_PATH:-deployments/release-notes-latest-v16.md}"

# "Latest" pointers (frontend consumes these)
FRONTEND_MANIFEST_PATH="${FRONTEND_MANIFEST_PATH:-deployments/frontend-manifest-latest-v16.json}"
GOLDEN_VECTORS_PATH="${GOLDEN_VECTORS_PATH:-deployments/golden-vectors-latest-v16.json}"
ABI_INDEX_PATH="${ABI_INDEX_PATH:-deployments/abis-v16/index.json}"

if [[ "$STRICT" == "1" ]]; then
  [[ -f "$RELEASE_PATH" ]] || { echo "missing release artifact: $RELEASE_PATH"; exit 1; }
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
  --abis-index "$ABI_INDEX_PATH"

# Verify digest + signature deterministically (no RPC needed).
RELEASE_PATH="$RELEASE_PATH" SNAPSHOT_PATH="$SNAPSHOT_PATH" \
  forge script script/release/VerifyReleaseV16.s.sol:VerifyReleaseV16 -vvv
