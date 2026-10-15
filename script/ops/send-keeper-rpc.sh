#!/usr/bin/env bash
set +xv # a trace or echoed input would print a secret unredacted (an inherited SHELLOPTS, bash -x): both off first
set -uo pipefail

# The Owner's step that gives the production keeper its RPC endpoints (key allocation of 2026-10-11): reads
# INFURA_API_KEY_PROD_KEEPER and ALCHEMY_API_KEY_PROD_KEEPER from the repository .env on this machine and writes
# KEEPER_RPC_HTTP (Infura HTTPS) and KEEPER_RPC_WS (Alchemy WSS) into the keeper env file on the production host.
#
#   script/ops/send-keeper-rpc.sh <ssh destination> <base-sepolia|base> [env file basename]
#
# Only those two key names are read, and no value is printed. Both URLs travel over ssh on standard input, never in a
# command line or the environment, to /opt/arbigamefi/ops/swap-keeper-key.sh --rpc on the host (installed with the ops
# scripts), which replaces both lines of the env file (default keeper.primary.env in
# /opt/arbigamefi/frontend/deploy/docker/env) in one atomic write, or neither. Nothing is restarted: restart the keeper
# afterwards and check its health (docs/ops/runbooks/production-rebuild.md).

usage() {
  echo "usage: $0 <ssh destination> <base-sepolia|base> [env file basename]" >&2
  exit 64
}

[[ $# -eq 2 || $# -eq 3 ]] || usage
destination=$1
case "$2" in
  base-sepolia) chain=base-sepolia ;;
  base) chain=base-mainnet ;;
  *) usage ;;
esac
file=${3:-keeper.primary.env}
[[ "$file" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || usage

root=$(cd "$(dirname "$0")/../.." && pwd)
env_file=${OPS_ENV_FILE:-$root/.env}
key() { sed -n "s/^$1=//p" "$env_file" 2> /dev/null | head -1 | tr -d "\"' \r"; }
infura=$(key INFURA_API_KEY_PROD_KEEPER)
alchemy=$(key ALCHEMY_API_KEY_PROD_KEEPER)
if [[ -z "$infura" || -z "$alchemy" ]]; then
  echo "INFURA_API_KEY_PROD_KEEPER and ALCHEMY_API_KEY_PROD_KEEPER must both be set in $env_file" >&2
  exit 65
fi
if [[ ! "$infura" =~ ^[A-Za-z0-9_-]+$ || ! "$alchemy" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "a PROD_KEEPER key in $env_file has characters an API key does not" >&2
  exit 65
fi

# printf is a shell builtin: the keys reach ssh's standard input without appearing in any process's arguments.
printf 'KEEPER_RPC_HTTP=https://%s.infura.io/v3/%s\nKEEPER_RPC_WS=wss://%s.g.alchemy.com/v2/%s\n' \
  "$chain" "$infura" "$chain" "$alchemy" |
  ssh "$destination" "bash /opt/arbigamefi/ops/swap-keeper-key.sh --rpc $file"
status=$?
infura=
alchemy=
if ((status)); then
  echo "send-keeper-rpc: the host did not replace the endpoints (exit $status); the env file is unchanged unless it said otherwise" >&2
  exit "$status"
fi
echo "send-keeper-rpc: KEEPER_RPC_HTTP and KEEPER_RPC_WS of $file on $destination now use the PROD_KEEPER keys ($chain)"
