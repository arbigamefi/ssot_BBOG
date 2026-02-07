#!/usr/bin/env bash
set -euo pipefail

# Build a release bundle that is tied to a release digest and contains
# *all* frontend-facing artifacts:
#   - release-latest.json (lock)
#   - frontend-manifest-latest.json (mapping)
#   - golden-vectors-latest.json (provable encoding)
#   - abis/ (frontend-only trimmed ABIs)
#
# Output: dist/ssot-release-<TAG>-<digestPrefix>.tar.gz

RELEASE_PATH="${RELEASE_PATH:-deployments/release-latest.json}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest.json}"
NOTES_PATH="${NOTES_PATH:-deployments/release-notes-latest.md}"

FRONTEND_MANIFEST_PATH="${FRONTEND_MANIFEST_PATH:-deployments/frontend-manifest-latest.json}"
GOLDEN_VECTORS_PATH="${GOLDEN_VECTORS_PATH:-deployments/golden-vectors-latest.json}"

ABIS_DIR="${ABIS_DIR:-deployments/abis}"
ABIS_INDEX_PATH="${ABIS_INDEX_PATH:-deployments/abis/index.json}"

TAG_NAME="${TAG_NAME:-}"

[[ -f "$RELEASE_PATH" ]] || { echo "missing $RELEASE_PATH (run: make release-digest)"; exit 1; }
[[ -f "$SNAPSHOT_PATH" ]] || { echo "missing $SNAPSHOT_PATH (run: make deploy)"; exit 1; }
[[ -f "$NOTES_PATH" ]] || { echo "missing $NOTES_PATH (run: make release-notes)"; exit 1; }

[[ -f "$FRONTEND_MANIFEST_PATH" ]] || { echo "missing $FRONTEND_MANIFEST_PATH (run: make release-frontend-manifest)"; exit 1; }
[[ -f "$GOLDEN_VECTORS_PATH" ]] || { echo "missing $GOLDEN_VECTORS_PATH (run: make release-golden-vectors)"; exit 1; }
[[ -f "$ABIS_INDEX_PATH" ]] || { echo "missing $ABIS_INDEX_PATH (run: make release-abis)"; exit 1; }

python3 - <<'PY'
import json,sys
p="deployments/release-latest.json"
j=json.load(open(p,"r",encoding="utf-8"))
for k in ("chainId","blockNumber","digest"):
    if k not in j: 
        print(f"missing {k} in {p}", file=sys.stderr); sys.exit(1)
PY

CHAIN_ID=$(python3 -c 'import json;print(json.load(open("'"$RELEASE_PATH"'"))["chainId"])')
BLOCK_NUMBER=$(python3 -c 'import json;print(json.load(open("'"$RELEASE_PATH"'"))["blockNumber"])')
DIGEST=$(python3 -c 'import json;print(json.load(open("'"$RELEASE_PATH"'"))["digest"])')

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
cp "$SNAPSHOT_PATH" "$STAGE/deployments/latest.json"
cp "$RELEASE_PATH" "$STAGE/deployments/release-latest.json"
cp "$NOTES_PATH" "$STAGE/deployments/release-notes-latest.md"
cp "$FRONTEND_MANIFEST_PATH" "$STAGE/deployments/frontend-manifest-latest.json"
cp "$GOLDEN_VECTORS_PATH" "$STAGE/deployments/golden-vectors-latest.json"

# Also include per-release copies if present
for f in   "deployments/release/frontend-manifest-${CHAIN_ID}-${BLOCK_NUMBER}.json"   "deployments/release/golden-vectors-${CHAIN_ID}-${BLOCK_NUMBER}.json"   "deployments/release/release-${CHAIN_ID}-${BLOCK_NUMBER}.json"   "deployments/release/abi-index-${CHAIN_ID}-${BLOCK_NUMBER}.json" ; do
  [[ -f "$f" ]] && { mkdir -p "$STAGE/$(dirname "$f")"; cp "$f" "$STAGE/$f"; }
done

# Verify helpers (optional)
for f in "deployments/verify-latest.sh" "deployments/verify/verify-${CHAIN_ID}-${BLOCK_NUMBER}.sh"; do
  [[ -f "$f" ]] && { mkdir -p "$STAGE/$(dirname "$f")"; cp "$f" "$STAGE/$f"; }
done

# Frontend-only ABIs
cp "$ABIS_DIR"/*.abi.json "$STAGE/abis/"
cp "$ABIS_INDEX_PATH" "$STAGE/abis/index.json"

# Integrity manifest
python3 - <<'PY'
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
