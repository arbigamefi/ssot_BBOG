#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${WEB_IMAGE:?Set immutable WEB_IMAGE}"
: "${KEEPER_IMAGE:?Set immutable KEEPER_IMAGE}"
: "${EXPECTED_REVISION:?Set the reviewed 40-character Git commit}"
for ref in "$WEB_IMAGE" "$KEEPER_IMAGE"; do
  [[ "$ref" =~ ^ghcr\.io/arbigamefi/ssot-bbog-(web|keeper)@sha256:[a-f0-9]{64}$ ]] || { echo "Invalid immutable application image" >&2; exit 1; }
done
bash deploy/docker/check-production-env.sh
docker compose -p arbigamefi -f compose.production.yml pull postgres caddy web keeper-primary keeper-testnet-primary
python3 deploy/docker/check-release-images.py
# Application image inspection above must pass before any existing service is changed.
docker compose -p arbigamefi -f compose.production.yml up -d --no-build --pull never postgres web keeper-primary keeper-testnet-primary caddy
docker compose -p arbigamefi -f compose.production.yml ps
