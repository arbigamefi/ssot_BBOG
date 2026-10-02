#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-$ROOT_DIR/dist/arbigamefi-docker-deploy-bundle.tar.gz}"

mkdir -p "$(dirname "$OUT")"

COPYFILE_DISABLE=1 tar -czf "$OUT" -C "$ROOT_DIR" \
  compose.production.yml \
  deploy/docker/README.md \
  deploy/docker/Caddyfile \
  deploy/docker/check-production-env.sh \
  deploy/docker/check-release-images.py \
  deploy/docker/deploy-images.sh \
  deploy/docker/env/postgres.env.example \
  deploy/docker/env/web.production.env.example \
  deploy/docker/env/keeper.primary.env.example \
  deploy/docker/env/proxy.env.example

echo "wrote $OUT"
