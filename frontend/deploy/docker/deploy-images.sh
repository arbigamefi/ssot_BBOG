#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"

docker compose -f "$COMPOSE_FILE" pull postgres caddy web keeper-primary
docker compose -f "$COMPOSE_FILE" up -d --no-build postgres web keeper-primary caddy
docker compose -f "$COMPOSE_FILE" ps
