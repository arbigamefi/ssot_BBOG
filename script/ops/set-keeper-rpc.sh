#!/usr/bin/env bash
set -euo pipefail

# Owner only: point the production keeper at the dedicated *_PROD_KEEPER RPC keys, then recreate it.
#
#   bash script/ops/set-keeper-rpc.sh <base-sepolia|base>
#
# Reads INFURA_API_KEY_PROD_KEEPER and ALCHEMY_API_KEY_PROD_KEEPER from the repository .env and sends the two keeper
# endpoints to the host over SSH stdin, never in a command line, to set_keeper_rpc_env.py. That replaces
# KEEPER_RPC_HTTP and KEEPER_RPC_WS in place without keeping the old values. The keeper is then recreated from the image
# it already runs (the host's compose .env pins it by digest) and its health is printed without any URL. The script
# needs your terminal and a typed "yes", so an automated agent cannot run it for you.

usage() {
  echo "usage: bash $0 <base-sepolia|base>" >&2
  exit 64
}
if [ ! -t 0 ] || [ ! -t 1 ]; then
  echo "run this in your own terminal" >&2
  exit 1
fi

root=$(cd "$(dirname "$0")/../.." && pwd)
host=${KEEPER_HOST:-root@45.77.243.138}
deploy=${KEEPER_DEPLOY_DIR:-/opt/arbigamefi/frontend}
env_path="$deploy/deploy/docker/env/keeper.primary.env"
container=arbigamefi-keeper-primary-1
case "${1:-}" in
  base-sepolia) network=base-sepolia; chain_id=84532 ;;
  base) network=base-mainnet; chain_id=8453 ;;
  *) usage ;;
esac

read_key() { sed -n "s/^$1=//p" "$root/.env" | head -1 | tr -d "\"' \r"; }
infura=$(read_key INFURA_API_KEY_PROD_KEEPER)
alchemy=$(read_key ALCHEMY_API_KEY_PROD_KEEPER)
shape='^[0-9A-Za-z_-]{16,128}$'
if ! [[ $infura =~ $shape && $alchemy =~ $shape ]]; then
  echo "INFURA_API_KEY_PROD_KEEPER and ALCHEMY_API_KEY_PROD_KEEPER must both be set in .env" >&2
  exit 1
fi

echo "This replaces KEEPER_RPC_HTTP (Infura) and KEEPER_RPC_WS (Alchemy) for $network in"
echo "  $host:$env_path"
echo "and recreates keeper-primary from the image it runs now."
read -r -p "Type yes to continue: " answer
if [ "$answer" != yes ]; then
  echo "cancelled"
  exit 1
fi

health() {
  ssh -o ConnectTimeout=20 "$host" "curl -sS -m 20 'https://arbigamefi.com/ops/casino-keeper-health.json?chainId=$chain_id'" |
    python3 -I -c '
import json, re, sys
raw = sys.stdin.read()
leak = bool(re.search(r"infura\.io/v3/|alchemy\.com/v2/", raw))
data = json.loads(raw)
print(json.dumps({key: data.get(key) for key in ("status", "startedAt", "lastScannedBlock", "lastScanAt")} | {"providerUrlInHealth": leak}))'
}

before=$(health | python3 -I -c 'import json, sys; print(json.load(sys.stdin)["startedAt"])')
program=$(base64 < "$root/script/ops/set_keeper_rpc_env.py" | tr -d '\n')
# printf is a shell builtin: the endpoints never appear in a process argument list.
printf '{"KEEPER_RPC_HTTP":"https://%s.infura.io/v3/%s","KEEPER_RPC_WS":"wss://%s.g.alchemy.com/v2/%s"}' \
  "$network" "$infura" "$network" "$alchemy" |
  ssh -o ConnectTimeout=20 "$host" "python3 -c \"import base64; exec(base64.b64decode('$program'))\" '$env_path' '$network'"

ssh -o ConnectTimeout=20 "$host" "cd '$deploy' && docker compose -p arbigamefi -f compose.production.yml up -d --no-build --pull never --force-recreate --no-deps keeper-primary"

echo "waiting for the recreated keeper to publish health (up to 3 minutes)"
for _ in $(seq 1 18); do
  sleep 10
  now=$(health) || continue
  started=$(printf '%s' "$now" | python3 -I -c 'import json, sys; print(json.load(sys.stdin)["startedAt"])') || continue
  if [ "$started" != "$before" ]; then
    echo "$now"
    printf 'provider URLs in keeper logs since the restart: '
    ssh -o ConnectTimeout=20 "$host" "docker logs --since 10m $container 2>&1 | grep -cE 'infura\.io/v3/|alchemy\.com/v2/' || true"
    exit 0
  fi
done
echo "the keeper did not publish a new health snapshot within 3 minutes; check: docker logs $container" >&2
exit 1
