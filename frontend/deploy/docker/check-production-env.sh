#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "deploy/docker/env/postgres.env"
  "deploy/docker/env/web.production.env"
  "deploy/docker/env/keeper.primary.env"
  "deploy/docker/env/proxy.env"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "error: missing $file (copy the matching .env.example first)" >&2
    exit 1
  fi
  if grep -Eq "REPLACE_|change-me|example" "$file"; then
    echo "error: placeholder value remains in $file" >&2
    exit 1
  fi
done

if [[ -f "deploy/docker/env/keeper.backup.env" ]] && grep -Eq "REPLACE_|change-me|example" "deploy/docker/env/keeper.backup.env"; then
  echo "error: placeholder value remains in deploy/docker/env/keeper.backup.env" >&2
  exit 1
fi

echo "[docker-prod] validating compose graph"
docker compose -f compose.production.yml config >/dev/null

echo "[docker-prod] validating embedded Base mainnet release"
pnpm check:mainnet-release

echo "[docker-prod] OK"
