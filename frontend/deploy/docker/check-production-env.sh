#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "deploy/docker/env/postgres.env"
  "deploy/docker/env/web.production.env"
  "deploy/docker/env/keeper.primary.env"
  "deploy/docker/env/keeper.testnet.primary.env"
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

# Do not connect the new contracts to the old projection database.
python3 - <<'PYDB'
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

if read("postgres.env").get("POSTGRES_DB") != "arbigamefi_v15":
    raise SystemExit("Use the dedicated arbigamefi_v15 database")
for name in ("web.production.env", "keeper.primary.env", "keeper.testnet.primary.env"):
    try:
        database = urlsplit(read(name).get("BET_INDEX_DATABASE_URL", "")).path
    except ValueError:
        database = ""
    if database != "/arbigamefi_v15":
        raise SystemExit(name + ": v1.5 database identity mismatch")
PYDB

echo "[docker-prod] validating compose graph"
docker compose -f compose.production.yml config >/dev/null

if [[ "${CHECK_EMBEDDED_RELEASE:-0}" == "1" ]]; then
  if [[ ! -f package.json ]]; then
    echo "error: CHECK_EMBEDDED_RELEASE=1 requires a frontend source checkout" >&2
    exit 1
  fi
  echo "[docker-prod] validating embedded Base mainnet release"
  pnpm check:mainnet-release
fi

echo "[docker-prod] OK"
