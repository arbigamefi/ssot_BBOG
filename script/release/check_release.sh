#!/usr/bin/env bash
set -euo pipefail

STRICT="${STRICT:-0}"

RELEASE_PATH="${RELEASE_PATH:-deployments/release-latest.json}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest.json}"
NOTES_PATH="${NOTES_PATH:-deployments/release-notes-latest.md}"

# "Latest" pointers (frontend consumes these)
FRONTEND_MANIFEST_PATH="${FRONTEND_MANIFEST_PATH:-deployments/frontend-manifest-latest.json}"
GOLDEN_VECTORS_PATH="${GOLDEN_VECTORS_PATH:-deployments/golden-vectors-latest.json}"
ABI_INDEX_PATH="${ABI_INDEX_PATH:-deployments/abis/index.json}"
FRONTEND_SCHEMA="${FRONTEND_SCHEMA:-1}"
RELEASE_TAG_SUFFIX="${RELEASE_TAG_SUFFIX:-}"
VERIFY_SCRIPT="${VERIFY_SCRIPT:-script/release/VerifyRelease.s.sol:VerifyRelease}"

if [[ "$STRICT" == "1" ]]; then
  [[ -f "$SNAPSHOT_PATH" ]] || { echo "missing snapshot: $SNAPSHOT_PATH"; exit 1; }
  [[ -f "$RELEASE_PATH" ]] || { echo "missing release artifact: $RELEASE_PATH"; exit 1; }
  [[ -f "$NOTES_PATH" ]] || { echo "missing release notes: $NOTES_PATH"; exit 1; }
  [[ -f "$FRONTEND_MANIFEST_PATH" ]] || { echo "missing frontend manifest: $FRONTEND_MANIFEST_PATH"; exit 1; }
  [[ -f "$GOLDEN_VECTORS_PATH" ]] || { echo "missing golden vectors: $GOLDEN_VECTORS_PATH"; exit 1; }
  [[ -f "$ABI_INDEX_PATH" ]] || { echo "missing abis index: $ABI_INDEX_PATH (run: make release-abis)"; exit 1; }
else
  # Non-strict mode: if artifacts are absent, don't fail CI.
  if [[ ! -f "$SNAPSHOT_PATH" || ! -f "$RELEASE_PATH" ]]; then
    echo "release check skipped (artifacts not present)."
    exit 0
  fi
fi

# Validate frontend artifacts deterministically (no RPC). This is a hard gate in STRICT=1.
python3 script/release/validate_frontend_artifacts.py \
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
