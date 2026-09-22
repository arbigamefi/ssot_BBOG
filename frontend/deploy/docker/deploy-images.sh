#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# A separate Compose project creates fresh DB and health volumes for v1.5.
# The old Caddy listener must be handed over in the reviewed cutover window.
: "${WEB_IMAGE:?Set immutable WEB_IMAGE}"
: "${KEEPER_IMAGE:?Set immutable KEEPER_IMAGE}"
: "${EXPECTED_REVISION:?Set the reviewed 40-character Git commit}"
[[ -z "${IMAGE_TAG:-}" ]] || { echo "IMAGE_TAG is retired; use digest references" >&2; exit 1; }
for ref in "$WEB_IMAGE" "$KEEPER_IMAGE"; do
  [[ "$ref" =~ ^ghcr\.io/arbigamefi/ssot-bbog-(web|keeper)@sha256:[a-f0-9]{64}$ ]] || { echo "Invalid immutable application image" >&2; exit 1; }
done
# Shared keeper keys and public listeners must not run in both deployments at once.
for service in keeper-primary keeper-testnet-primary caddy; do
  running=$(docker ps --filter label=com.docker.compose.project=arbigamefi-production --filter "label=com.docker.compose.service=$service" --format '{{.ID}}')
  [[ -z "$running" ]] || { echo "Old $service is still running; complete the reviewed handover first" >&2; exit 1; }
done
bash deploy/docker/check-production-env.sh
docker compose -p arbigamefi-v15 -f compose.production.yml pull postgres caddy web keeper-primary keeper-testnet-primary
python3 deploy/docker/check-release-images.py
# Application image inspection above must pass before any existing service is changed.
docker compose -p arbigamefi-v15 -f compose.production.yml up -d --no-build --pull never postgres web keeper-primary keeper-testnet-primary caddy
docker compose -p arbigamefi-v15 -f compose.production.yml ps
