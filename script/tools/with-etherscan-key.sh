#!/usr/bin/env bash
set +xv # a trace or echoed input would print a secret unredacted (an inherited SHELLOPTS, bash -x): both off first
set -uo pipefail

# Run one command with the Etherscan V2 API key from the repository .env, without ever showing the key. The Owner
# allowed it for source verification after a deployment (2026-10-15):
#
#   script/tools/with-etherscan-key.sh <command> [args...]
#   script/tools/with-etherscan-key.sh env SNAPSHOT_PATH=deployments/latest-v16.json make -C <copy directory> verify-v16
#
# Only ETHERSCAN_V2_API_KEY is read; the command sees it under that name. Only this script reads the key line, and
# every output line, stdout and stderr together, is printed with the key replaced. Files the command writes are not
# redacted: keep its output outside the repository and check it before sharing. The caller's own environment still
# reaches the command: this is not an environment cleaner.

usage() {
  echo "usage: $0 <command> [args...]" >&2
  exit 64
}

root=$(cd "$(dirname "$0")/../.." && pwd)
env_file=${OPS_ENV_FILE:-$root/.env}
[ $# -gt 0 ] || usage

name=ETHERSCAN_V2_API_KEY
key=$(sed -n "s/^${name}=//p" "$env_file" 2>/dev/null | head -1 | tr -d "\"' \r")
if [ -z "$key" ]; then
  echo "$name is not set in $env_file" >&2
  exit 65
fi

ETHERSCAN_V2_API_KEY="$key" "$@" 2>&1 | OPS_REDACT_KEY="$key" OPS_REDACT_AS="<etherscan-key>" python3 -I -c '
import os, sys
key, mark = os.environ["OPS_REDACT_KEY"].encode(), os.environ["OPS_REDACT_AS"].encode()
for line in sys.stdin.buffer:
    sys.stdout.buffer.write(line.replace(key, mark))
    sys.stdout.buffer.flush()'
exit "${PIPESTATUS[0]}"
