#!/usr/bin/env bash
# Use only in an image-build checkout: imports the authenticated bundle and
# retains exactly the selected chain in the generated embedded release directory.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${RELEASE_BUNDLE:?Set the downloaded release archive path}"
: "${RELEASE_BUNDLE_SHA256:?Set the approved archive SHA-256}"
: "${RELEASE_SIGNER:?Set the trusted release signer}"
: "${RPC_URL:?Set the selected chain RPC for live governance verification}"
: "${DEPLOY_CHAIN_ID:?Set the selected chain}"
case "$DEPLOY_CHAIN_ID" in 8453|84532) ;; *) echo 'Unsupported DEPLOY_CHAIN_ID' >&2; exit 1 ;; esac
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
python3 script/release/import_release_bundle.py \
  --bundle "$RELEASE_BUNDLE" --sha256 "$RELEASE_BUNDLE_SHA256" --destination "$stage/input"
cd frontend
node scripts/ssot-sync.mjs --from "$stage/input" --only-chain "$DEPLOY_CHAIN_ID"
REQUIRED_EMBEDDED_CHAIN_IDS="$DEPLOY_CHAIN_ID" STRICT_RELEASE=1 node scripts/check-release.mjs
