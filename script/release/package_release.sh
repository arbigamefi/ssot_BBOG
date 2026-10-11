#!/usr/bin/env bash
set -euo pipefail

# Build a release bundle that is tied to a release digest and contains
# *all* frontend-facing artifacts:
#   - release-latest-v16.json (lock)
#   - frontend-manifest-latest-v16.json (mapping)
#   - golden-vectors-latest-v16.json (provable encoding)
#   - abis-v16/ (frontend-only trimmed ABIs)
#
# Output: dist/ssot-release-<TAG>-<digestPrefix>.tar.gz

# Provenance must identify committed source, never an unrecorded working tree.
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo "release package requires a clean, committed source tree" >&2
  exit 1
fi
SOURCE_REVISION=$(git rev-parse HEAD)

RELEASE_PATH="${RELEASE_PATH:-deployments/release-latest-v16.json}"
PYTHON="${PYTHON:-python}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v16.json}"
NOTES_PATH="${NOTES_PATH:-deployments/release-notes-latest-v16.md}"

FRONTEND_MANIFEST_PATH="${FRONTEND_MANIFEST_PATH:-deployments/frontend-manifest-latest-v16.json}"
GOLDEN_VECTORS_PATH="${GOLDEN_VECTORS_PATH:-deployments/golden-vectors-latest-v16.json}"

ABIS_DIR="${ABIS_DIR:-deployments/abis-v16}"
ABIS_INDEX_PATH="${ABIS_INDEX_PATH:-deployments/abis-v16/index.json}"

TAG_NAME="${TAG_NAME:-}"

SNAPSHOT_LATEST_NAME="${SNAPSHOT_LATEST_NAME:-latest-v16.json}"
RELEASE_LATEST_NAME="${RELEASE_LATEST_NAME:-release-latest-v16.json}"
NOTES_LATEST_NAME="${NOTES_LATEST_NAME:-release-notes-latest-v16.md}"
FRONTEND_MANIFEST_LATEST_NAME="${FRONTEND_MANIFEST_LATEST_NAME:-frontend-manifest-latest-v16.json}"
GOLDEN_VECTORS_LATEST_NAME="${GOLDEN_VECTORS_LATEST_NAME:-golden-vectors-latest-v16.json}"

[[ -f "$RELEASE_PATH" ]] || { echo "missing $RELEASE_PATH (run: make release-v16)"; exit 1; }
[[ -f "$SNAPSHOT_PATH" ]] || { echo "missing $SNAPSHOT_PATH (run: make deploy)"; exit 1; }
[[ -f "$NOTES_PATH" ]] || { echo "missing $NOTES_PATH (run: make release-notes)"; exit 1; }

[[ -f "$FRONTEND_MANIFEST_PATH" ]] || { echo "missing $FRONTEND_MANIFEST_PATH (run: make release-frontend-manifest)"; exit 1; }
[[ -f "$GOLDEN_VECTORS_PATH" ]] || { echo "missing $GOLDEN_VECTORS_PATH (run: make release-golden-vectors)"; exit 1; }
[[ -f "$ABIS_INDEX_PATH" ]] || { echo "missing $ABIS_INDEX_PATH (run: make release-abis)"; exit 1; }

STAGE="$(mktemp -d)"
export STAGE
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT
mkdir -p "$STAGE/deployments" "$STAGE/abis"

# The Etherscan verification helper is generated from the snapshot being packaged, never copied as found: one left
# from another deployment would verify the wrong addresses, so a local helper that differs stops the package.
"$PYTHON" script/tools/gen_verify_helpers.py "$SNAPSHOT_PATH" \
  --out "$STAGE/deployments/verify-latest-v16.sh" > /dev/null
if [[ -f deployments/verify-latest-v16.sh ]] &&
  ! cmp -s deployments/verify-latest-v16.sh "$STAGE/deployments/verify-latest-v16.sh"; then
  echo "deployments/verify-latest-v16.sh does not match $SNAPSHOT_PATH; regenerate it (make verify-helpers-v16)" >&2
  exit 1
fi

# Direct invocation has the same gates as Make; never emit a publishable archive
# from a nominated-but-unaccepted deployment or unsigned/mismatched artifacts.
: "${RPC_URL:?Set the target-chain RPC_URL}"
: "${RELEASE_SIGNER:?Set the approved release metadata signer}"
export RELEASE_PATH SNAPSHOT_PATH NOTES_PATH FRONTEND_MANIFEST_PATH GOLDEN_VECTORS_PATH
export ABI_INDEX_PATH="$ABIS_INDEX_PATH"
STRICT=1 PYTHON="$PYTHON" bash script/release/check_release.sh
FOUNDRY_PROFILE="${VERIFY_PROFILE:-default}" "$PYTHON" script/release/verify_governance.py

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
# Its SHA-256 may already be approved: a rerun must not replace it with a new archive of the same name.
if [[ -e "$ARCHIVE" ]]; then
  echo "$ARCHIVE already exists; a release archive is never rewritten" >&2
  exit 1
fi

printf '%s\n' "$SOURCE_REVISION" > "$STAGE/SOURCE_REVISION"

# Core release artifacts
cp "$SNAPSHOT_PATH" "$STAGE/deployments/$SNAPSHOT_LATEST_NAME"
cp "$RELEASE_PATH" "$STAGE/deployments/$RELEASE_LATEST_NAME"
cp "$NOTES_PATH" "$STAGE/deployments/$NOTES_LATEST_NAME"
cp "$FRONTEND_MANIFEST_PATH" "$STAGE/deployments/$FRONTEND_MANIFEST_LATEST_NAME"
cp "$GOLDEN_VECTORS_PATH" "$STAGE/deployments/$GOLDEN_VECTORS_LATEST_NAME"

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

# Integrity manifests cover payload files, not macOS AppleDouble/xattr metadata.
COPYFILE_DISABLE=1 tar -czf "$ARCHIVE.partial" -C "$STAGE" .
mv "$ARCHIVE.partial" "$ARCHIVE"
echo "wrote: $ARCHIVE"
