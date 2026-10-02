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

# Require the services to share the configured database.
python3 - <<'PYDB'
import os
from pathlib import Path
from urllib.parse import urlsplit

def read(name):
    result = {}
    for line in (Path("deploy/docker/env") / name).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key] = value.strip().strip("\"'")
    return result

if read("postgres.env").get("POSTGRES_DB") != "arbigamefi":
    raise SystemExit("Use the dedicated arbigamefi database")
for name in ("web.production.env", "keeper.primary.env"):
    try:
        database = urlsplit(read(name).get("BET_INDEX_DATABASE_URL", "")).path
    except ValueError:
        database = ""
    if database != "/arbigamefi":
        raise SystemExit(name + ": database identity mismatch")
chain = os.environ.get("DEPLOY_CHAIN_ID")
if chain not in ("8453", "84532"):
    raise SystemExit("DEPLOY_CHAIN_ID must be 8453 or 84532")
web, keeper = read("web.production.env"), read("keeper.primary.env")
if web.get("NEXT_PUBLIC_CHAIN_ID") != chain or keeper.get("KEEPER_CHAIN_ID") != chain:
    raise SystemExit("web/keeper chain differs from DEPLOY_CHAIN_ID")
if keeper.get("KEEPER_RELEASE_PATH") != f"/app/frontend/packages/ssot/src/release/embedded/chain-{chain}.json":
    raise SystemExit("keeper release path differs from DEPLOY_CHAIN_ID")
# A stale per-chain override takes precedence over the Compose health path.
if any(key.startswith("KEEPER_HEALTH_PATH") for key in web):
    raise SystemExit("Remove web env KEEPER_HEALTH_PATH overrides; Compose owns the health path")
PYDB

echo "[docker-prod] validating compose graph"
docker compose -f compose.production.yml config >/dev/null

if [[ "${CHECK_EMBEDDED_RELEASE:-0}" == "1" ]]; then
  if [[ ! -f package.json ]]; then
    echo "error: CHECK_EMBEDDED_RELEASE=1 requires a frontend source checkout" >&2
    exit 1
  fi
  echo "[docker-prod] validating selected embedded release"
  REQUIRED_EMBEDDED_CHAIN_IDS="$DEPLOY_CHAIN_ID" STRICT_RELEASE=1 pnpm check:release
fi

echo "[docker-prod] OK"
