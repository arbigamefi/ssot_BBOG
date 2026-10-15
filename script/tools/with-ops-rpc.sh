#!/usr/bin/env bash
set +xv # a trace or echoed input would print a secret unredacted (an inherited SHELLOPTS, bash -x): both off first
set -uo pipefail

# Run one command with an operator RPC endpoint built from the repository .env, without ever showing the key.
#
#   script/tools/with-ops-rpc.sh <infura|alchemy> <base-sepolia|base> <command> [args...]
#
# Only the two operator keys can be used:
#   infura   INFURA_API_KEY_OPS: deployment broadcast, release checks, verify_governance replay, K0-4
#   alchemy  ALCHEMY_API_KEY_OPS: preflight, fork rehearsal, gas matrix (NFT_GAS_RPC_URL)
# The production keeper keys (*_PROD_KEEPER) belong to the server and are never read here.
#
# The command sees the endpoint as OPS_RPC_URL and the provider name (infura or alchemy) as OPS_RPC_PROVIDER, for
# example:
#   script/tools/with-ops-rpc.sh alchemy base-sepolia bash -c 'NFT_GAS_RPC_URL="$OPS_RPC_URL" python3 ...'
# Only this script reads the key line; the key reaches the command inside OPS_RPC_URL alone, and every output line,
# stdout and stderr together, is printed with the key replaced. Files the command writes are not redacted: keep its
# output outside the repository and check it before sharing.

usage() {
  echo "usage: $0 <infura|alchemy> <base-sepolia|base> <command> [args...]" >&2
  exit 64
}

root=$(cd "$(dirname "$0")/../.." && pwd)
env_file=${OPS_ENV_FILE:-$root/.env}

case "${1:-}" in
  infura) name=INFURA_API_KEY_OPS ;;
  alchemy) name=ALCHEMY_API_KEY_OPS ;;
  *) usage ;;
esac
case "${2:-}" in
  base-sepolia|base) network=$2 ;;
  *) usage ;;
esac
provider=$1
shift 2
[ $# -gt 0 ] || usage

key=$(sed -n "s/^${name}=//p" "$env_file" 2>/dev/null | head -1 | tr -d "\"' \r")
if [ -z "$key" ]; then
  echo "$name is not set in $env_file" >&2
  exit 65
fi

case "$network" in
  base-sepolia) chain=base-sepolia ;;
  base) chain=base-mainnet ;;
esac
case "$provider" in
  infura) url="https://${chain}.infura.io/v3/${key}" ;;
  alchemy) url="https://${chain}.g.alchemy.com/v2/${key}" ;;
esac

OPS_RPC_URL="$url" OPS_RPC_PROVIDER="$provider" "$@" 2>&1 | OPS_REDACT_KEY="$key" OPS_REDACT_AS="<${provider}-ops-key>" python3 -I -c '
import os, sys
key, mark = os.environ["OPS_REDACT_KEY"].encode(), os.environ["OPS_REDACT_AS"].encode()
for line in sys.stdin.buffer:
    sys.stdout.buffer.write(line.replace(key, mark))
    sys.stdout.buffer.flush()'
exit "${PIPESTATUS[0]}"
