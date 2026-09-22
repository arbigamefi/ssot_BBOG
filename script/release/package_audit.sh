#!/usr/bin/env bash
set -euo pipefail

# Build an audit handoff bundle that is (1) self-contained for reviewers and (2) tied to a release digest.
#
# Inputs (defaults match release tooling):
#   RELEASE_PATH   deployments/release-latest-v15.json
#   SNAPSHOT_PATH  deployments/latest-v15.json
#   NOTES_PATH     deployments/release-notes-latest-v15.md
#   TAG_NAME       optional; defaults to chain-<chainId>-<blockNumber>
#
# Output:
#   dist/ssot-audit-<TAG>-<digestPrefix>.tar.gz

RELEASE_PATH="${RELEASE_PATH:-deployments/release-latest-v15.json}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-deployments/latest-v15.json}"
NOTES_PATH="${NOTES_PATH:-deployments/release-notes-latest-v15.md}"
FRONTEND_MANIFEST_PATH="${FRONTEND_MANIFEST_PATH:-deployments/frontend-manifest-latest-v15.json}"
GOLDEN_VECTORS_PATH="${GOLDEN_VECTORS_PATH:-deployments/golden-vectors-latest-v15.json}"
ABIS_DIR="${ABIS_DIR:-deployments/abis-v15}"
ABIS_INDEX_PATH="${ABIS_INDEX_PATH:-deployments/abis-v15/index.json}"
TAG_NAME="${TAG_NAME:-}"

[[ -f "$RELEASE_PATH" ]] || { echo "missing $RELEASE_PATH (run: make release-digest)"; exit 1; }
[[ -f "$SNAPSHOT_PATH" ]] || { echo "missing $SNAPSHOT_PATH (run: deploy script first)"; exit 1; }
[[ -f "$NOTES_PATH" ]] || { echo "missing $NOTES_PATH (run: make release-notes)"; exit 1; }
[[ -f "$FRONTEND_MANIFEST_PATH" ]] || { echo "missing $FRONTEND_MANIFEST_PATH (run: make release-frontend-manifest)"; exit 1; }
[[ -f "$GOLDEN_VECTORS_PATH" ]] || { echo "missing $GOLDEN_VECTORS_PATH (run: make release-golden-vectors)"; exit 1; }
[[ -f "$ABIS_INDEX_PATH" ]] || { echo "missing $ABIS_INDEX_PATH (run: make release-abis)"; exit 1; }

CHAIN_ID=$(grep -E '"chainId"\s*:\s*[0-9]+' "$RELEASE_PATH" | head -n 1 | sed -E 's/.*:\s*([0-9]+).*/\1/')
BLOCK_NUMBER=$(grep -E '"blockNumber"\s*:\s*[0-9]+' "$RELEASE_PATH" | head -n 1 | sed -E 's/.*:\s*([0-9]+).*/\1/')
DIGEST=$(grep -E '"digest"\s*:\s*"0x[0-9a-fA-F]{64}"' "$RELEASE_PATH" | head -n 1 | sed -E 's/.*"(0x[0-9a-fA-F]{64})".*/\1/')

if [[ -z "$CHAIN_ID" || -z "$BLOCK_NUMBER" || -z "$DIGEST" ]]; then
  echo "failed to parse chainId/blockNumber/digest from $RELEASE_PATH"; exit 1;
fi

TAG="${TAG_NAME:-chain-${CHAIN_ID}-${BLOCK_NUMBER}}"
SAFE_DIGEST="${DIGEST:0:10}"

OUT_DIR="dist"
mkdir -p "$OUT_DIR"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

BUNDLE_ROOT="$WORK_DIR/ssot-audit-${TAG}-${SAFE_DIGEST}"
mkdir -p "$BUNDLE_ROOT"

# --- Copy release artifacts (canonical + conventional paths) ---
mkdir -p "$BUNDLE_ROOT/deployments" "$BUNDLE_ROOT/deployments/snapshots" "$BUNDLE_ROOT/deployments/release" "$BUNDLE_ROOT/deployments/verify"

cp -f "$SNAPSHOT_PATH" "$BUNDLE_ROOT/deployments/latest-v15.json"
cp -f "$RELEASE_PATH" "$BUNDLE_ROOT/deployments/release-latest-v15.json"
cp -f "$NOTES_PATH" "$BUNDLE_ROOT/deployments/release-notes-latest-v15.md"
cp -f "$FRONTEND_MANIFEST_PATH" "$BUNDLE_ROOT/deployments/frontend-manifest-latest-v15.json"
cp -f "$GOLDEN_VECTORS_PATH" "$BUNDLE_ROOT/deployments/golden-vectors-latest-v15.json"

SNAPSHOT_CONV="deployments/snapshots/deploy-${CHAIN_ID}-${BLOCK_NUMBER}-v15.json"
[[ -f "$SNAPSHOT_CONV" ]] && cp -f "$SNAPSHOT_CONV" "$BUNDLE_ROOT/$SNAPSHOT_CONV"

RELEASE_CONV="deployments/release/release-${CHAIN_ID}-${BLOCK_NUMBER}-v15.json"
[[ -f "$RELEASE_CONV" ]] && cp -f "$RELEASE_CONV" "$BUNDLE_ROOT/$RELEASE_CONV"

NOTES_CONV="deployments/release/release-notes-${CHAIN_ID}-${BLOCK_NUMBER}-v15.md"
[[ -f "$NOTES_CONV" ]] && cp -f "$NOTES_CONV" "$BUNDLE_ROOT/$NOTES_CONV"

FRONTEND_CONV="deployments/release/frontend-manifest-${CHAIN_ID}-${BLOCK_NUMBER}-v15.json"
[[ -f "$FRONTEND_CONV" ]] && cp -f "$FRONTEND_CONV" "$BUNDLE_ROOT/$FRONTEND_CONV"

VECTORS_CONV="deployments/release/golden-vectors-${CHAIN_ID}-${BLOCK_NUMBER}-v15.json"
[[ -f "$VECTORS_CONV" ]] && cp -f "$VECTORS_CONV" "$BUNDLE_ROOT/$VECTORS_CONV"

VERIFY_LATEST="deployments/verify-latest-v15.sh"
[[ -f "$VERIFY_LATEST" ]] && cp -f "$VERIFY_LATEST" "$BUNDLE_ROOT/$VERIFY_LATEST"

VERIFY_CONV="deployments/verify/verify-${CHAIN_ID}-${BLOCK_NUMBER}-v15.sh"
[[ -f "$VERIFY_CONV" ]] && cp -f "$VERIFY_CONV" "$BUNDLE_ROOT/$VERIFY_CONV"

# --- Copy source code and tooling (excluding vendored deps) ---
for path in src test script docs .github; do
  if [[ -d "$path" ]]; then
    cp -a "$path" "$BUNDLE_ROOT/"
  fi
done

# Do not vendor dependencies into the audit bundle; auditors can re-install from deps.lock.
rm -rf "$BUNDLE_ROOT/lib" "$BUNDLE_ROOT/script/lib" "$BUNDLE_ROOT/test/lib" 2>/dev/null || true

for file in README.md CHANGELOG.md LICENSE SECURITY.md CONTRIBUTING.md foundry.toml remappings.txt deps.lock Makefile; do
  [[ -f "$file" ]] && cp -f "$file" "$BUNDLE_ROOT/$file"
done

# --- Add verifier instructions ---
cat > "$BUNDLE_ROOT/AUDIT_VERIFY.md" <<EOF
# SSOT audit handoff bundle

This bundle is tied to a specific on-chain deployment via a **release digest**.

## What is included
- Source code (src/), tests (test/), scripts (script/), docs (docs/)
- Pinned dependency metadata (deps.lock + install script)
- Deployment snapshot + release lock + release notes (deployments/)
- Frontend manifest + golden vectors (deployments/frontend-manifest-*.json, deployments/golden-vectors-*.json)
- Optional verify helpers (deployments/verify*.sh)

## Quick verification (local)

1) Install dependencies (works even without .git):

\`\`\`bash
make deps
\`\`\`

2) Verify the release digest + signature deterministically (no RPC needed):

\`\`\`bash
RELEASE_SIGNER=<approved-public-signer> RELEASE_PATH=deployments/release-latest-v15.json SNAPSHOT_PATH=deployments/latest-v15.json \
  forge script script/release/VerifyReleaseV15.s.sol:VerifyReleaseV15 -vvv
\`\`\`

3) (Optional) Run proof gates:

\`\`\`bash
make pr
\`\`\`

4) (Optional) Verify contracts on the target explorer:

\`\`\`bash
export ETHERSCAN_API_KEY=...   # BaseScan/Arbiscan compatible
bash deployments/verify-latest-v15.sh
\`\`\`

## Deployment identity
- chainId: ${CHAIN_ID}
- blockNumber: ${BLOCK_NUMBER}
- releaseDigest: ${DIGEST}
EOF

# --- Build a manifest (sha256) for integrity ---
(
  cd "$BUNDLE_ROOT"
  # Normalize permissions for hashing stability.
  find . -type f -exec chmod 0644 {} + >/dev/null 2>&1 || true
  # Create manifest.
  find . -type f ! -name 'MANIFEST.sha256' -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256
)

ARCHIVE="$OUT_DIR/ssot-audit-${TAG}-${SAFE_DIGEST}.tar.gz"

# Prefer deterministic tar flags when available (GNU tar).
if tar --help 2>/dev/null | grep -q -- '--sort'; then
  tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -czf "$ARCHIVE" -C "$WORK_DIR" "$(basename "$BUNDLE_ROOT")"
else
  tar -czf "$ARCHIVE" -C "$WORK_DIR" "$(basename "$BUNDLE_ROOT")"
fi

echo "wrote: $ARCHIVE"
