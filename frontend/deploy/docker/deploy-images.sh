#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"

if [[ -n "${IMAGE_TAG:-}" ]]; then
  export WEB_IMAGE="${WEB_IMAGE:-ghcr.io/arbigamefi/ssot-bbog-web:${IMAGE_TAG}}"
  export KEEPER_IMAGE="${KEEPER_IMAGE:-ghcr.io/arbigamefi/ssot-bbog-keeper:${IMAGE_TAG}}"
fi

docker compose -f "$COMPOSE_FILE" pull postgres caddy web keeper-primary keeper-testnet-primary
docker compose -f "$COMPOSE_FILE" up -d --no-build \
  postgres \
  web \
  keeper-primary \
  keeper-testnet-primary \
  caddy
docker compose -f "$COMPOSE_FILE" ps
