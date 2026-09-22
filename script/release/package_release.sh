#!/usr/bin/env bash
set -euo pipefail

# Build a release bundle that is tied to a release digest and contains
# *all* frontend-facing artifacts:
#   - release-latest-v15.json (lock)
#   - frontend-manifest-latest-v15.json (mapping)
#   - golden-vectors-latest-v15.json (provable encoding)
#   - abis-v15/ (frontend-only trimmed ABIs)
#
# Output: dist/ssot-release-<TAG>-<digestPrefix>.tar.gz

RELEASE_PATH="${RELEASE_PATH:-deployments/release-latest-v15.json}"
PYTHON="${PYTHON:-python}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v15.json}"
NOTES_PATH="${NOTES_PATH:-deployments/release-notes-latest-v15.md}"

FRONTEND_MANIFEST_PATH="${FRONTEND_MANIFEST_PATH:-deployments/frontend-manifest-latest-v15.json}"
GOLDEN_VECTORS_PATH="${GOLDEN_VECTORS_PATH:-deployments/golden-vectors-latest-v15.json}"

ABIS_DIR="${ABIS_DIR:-deployments/abis-v15}"
ABIS_INDEX_PATH="${ABIS_INDEX_PATH:-deployments/abis-v15/index.json}"

TAG_NAME="${TAG_NAME:-}"
RELEASE_TAG_SUFFIX="${RELEASE_TAG_SUFFIX:--v15}"

SNAPSHOT_LATEST_NAME="${SNAPSHOT_LATEST_NAME:-latest-v15.json}"
RELEASE_LATEST_NAME="${RELEASE_LATEST_NAME:-release-latest-v15.json}"
NOTES_LATEST_NAME="${NOTES_LATEST_NAME:-release-notes-latest-v15.md}"
FRONTEND_MANIFEST_LATEST_NAME="${FRONTEND_MANIFEST_LATEST_NAME:-frontend-manifest-latest-v15.json}"
GOLDEN_VECTORS_LATEST_NAME="${GOLDEN_VECTORS_LATEST_NAME:-golden-vectors-latest-v15.json}"

[[ -f "$RELEASE_PATH" ]] || { echo "missing $RELEASE_PATH (run: make release-digest)"; exit 1; }
[[ -f "$SNAPSHOT_PATH" ]] || { echo "missing $SNAPSHOT_PATH (run: make deploy)"; exit 1; }
[[ -f "$NOTES_PATH" ]] || { echo "missing $NOTES_PATH (run: make release-notes)"; exit 1; }

[[ -f "$FRONTEND_MANIFEST_PATH" ]] || { echo "missing $FRONTEND_MANIFEST_PATH (run: make release-frontend-manifest)"; exit 1; }
[[ -f "$GOLDEN_VECTORS_PATH" ]] || { echo "missing $GOLDEN_VECTORS_PATH (run: make release-golden-vectors)"; exit 1; }
[[ -f "$ABIS_INDEX_PATH" ]] || { echo "missing $ABIS_INDEX_PATH (run: make release-abis)"; exit 1; }

# Direct invocation has the same gates as Make; never emit a publishable archive
# from a nominated-but-unaccepted deployment or unsigned/mismatched artifacts.
: "${RPC_URL:?Set the target-chain RPC_URL}"
: "${RELEASE_SIGNER:?Set the approved release metadata signer}"
export RELEASE_PATH SNAPSHOT_PATH NOTES_PATH FRONTEND_MANIFEST_PATH GOLDEN_VECTORS_PATH
export ABI_INDEX_PATH="$ABIS_INDEX_PATH"
STRICT=1 PYTHON="$PYTHON" bash script/release/check_release.sh
FOUNDRY_PROFILE="${VERIFY_PROFILE:-default}" forge script \
  script/release/VerifyGovernanceV15.s.sol:VerifyGovernanceV15 --rpc-url "$RPC_URL"

"$PYTHON" - <<'PY'
import json, os, sys
p=os.environ["RELEASE_PATH"]
j=json.load(open(p,"r",encoding="utf-8"))
for k in ("chainId","blockNumber","digest"):
    if k not in j: 
        print(f"missing {k} in {p}", file=sys.stderr); sys.exit(1)
PY

CHAIN_ID=$("$PYTHON" -c 'import json;print(json.load(open("'"$RELEASE_PATH"'"))["chainId"])')
BLOCK_NUMBER=$("$PYTHON" -c 'import json;print(json.load(open("'"$RELEASE_PATH"'"))["blockNumber"])')
DIGEST=$("$PYTHON" -c 'import json;print(json.load(open("'"$RELEASE_PATH"'"))["digest"])')

DIGEST_PREFIX="${DIGEST:0:10}"

if [[ -z "$TAG_NAME" ]]; then
  TAG_NAME="chain-${CHAIN_ID}-${BLOCK_NUMBER}"
fi

mkdir -p dist

ARCHIVE="dist/ssot-release-${TAG_NAME}-${DIGEST_PREFIX}.tar.gz"

STAGE="$(mktemp -d)"
export STAGE
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

mkdir -p "$STAGE/deployments" "$STAGE/abis"

# Core release artifacts
cp "$SNAPSHOT_PATH" "$STAGE/deployments/$SNAPSHOT_LATEST_NAME"
cp "$RELEASE_PATH" "$STAGE/deployments/$RELEASE_LATEST_NAME"
cp "$NOTES_PATH" "$STAGE/deployments/$NOTES_LATEST_NAME"
cp "$FRONTEND_MANIFEST_PATH" "$STAGE/deployments/$FRONTEND_MANIFEST_LATEST_NAME"
cp "$GOLDEN_VECTORS_PATH" "$STAGE/deployments/$GOLDEN_VECTORS_LATEST_NAME"

# Also include per-release copies if present
for f in   "deployments/release/frontend-manifest-${CHAIN_ID}-${BLOCK_NUMBER}${RELEASE_TAG_SUFFIX}.json"   "deployments/release/golden-vectors-${CHAIN_ID}-${BLOCK_NUMBER}${RELEASE_TAG_SUFFIX}.json"   "deployments/release/release-${CHAIN_ID}-${BLOCK_NUMBER}${RELEASE_TAG_SUFFIX}.json"   "deployments/release/release-notes-${CHAIN_ID}-${BLOCK_NUMBER}${RELEASE_TAG_SUFFIX}.md"   "deployments/release/abi-index-${CHAIN_ID}-${BLOCK_NUMBER}${RELEASE_TAG_SUFFIX}.json" ; do
  [[ -f "$f" ]] && { mkdir -p "$STAGE/$(dirname "$f")"; cp "$f" "$STAGE/$f"; }
done

# Verify helpers (optional)
for f in "deployments/verify-latest${RELEASE_TAG_SUFFIX}.sh" "deployments/verify/verify-${CHAIN_ID}-${BLOCK_NUMBER}${RELEASE_TAG_SUFFIX}.sh"; do
  [[ -f "$f" ]] && { mkdir -p "$STAGE/$(dirname "$f")"; cp "$f" "$STAGE/$f"; }
done

# Frontend-only ABIs
cp "$ABIS_DIR"/*.abi.json "$STAGE/abis/"
cp "$ABIS_INDEX_PATH" "$STAGE/abis/index.json"

# Integrity manifest
"$PYTHON" - <<'PY'
import hashlib, os
from pathlib import Path
root=Path(os.environ["STAGE"])
out=[]
for p in sorted(root.rglob("*")):
    if p.is_file():
        h=hashlib.sha256(p.read_bytes()).hexdigest()
        out.append(f"{h}  {p.relative_to(root)}")
(root/"MANIFEST.sha256").write_text("\n".join(out)+"\n",encoding="utf-8")
PY

tar -czf "$ARCHIVE" -C "$STAGE" .
echo "wrote: $ARCHIVE"
