#!/usr/bin/env bash
# Swap KEEPER_PRIVATE_KEY in a keeper env file.
#
# The new key is read from STDIN, so it never appears in a terminal, a chat
# transcript, argv (/proc/<pid>/cmdline is world-readable), or shell history.
#
#   awk '/Private key:/{print $3}' keeper.key | ssh root@host \
#       '/opt/arbigamefi/ops/swap-keeper-key.sh keeper.primary.env'
#
# Refuses and leaves the file untouched unless the key is well formed AND
# exactly one KEEPER_PRIVATE_KEY line matched.
set -euo pipefail

f="${1:?usage: swap-keeper-key.sh <env-filename>}"
dir="${KEEPER_ENV_DIR:-/opt/arbigamefi/frontend/deploy/docker/env}"
p="$dir/$f"
[ -f "$p" ] || { echo "no such env file: $p" >&2; exit 1; }

IFS= read -r KEEPER_NEW_KEY || true
export KEEPER_NEW_KEY

bak="$p.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$p" "$bak"

if python3 - "$p" <<'PY'
import os, re, sys
k = os.environ.get('KEEPER_NEW_KEY', '').strip()
if not re.fullmatch(r'0x[0-9a-fA-F]{64}', k):
    raise SystemExit('refusing: key must be 0x + 64 hex chars')
p = sys.argv[1]
src = open(p).read()
new, n = re.subn(r'(?m)^KEEPER_PRIVATE_KEY=.*$', 'KEEPER_PRIVATE_KEY=' + k, src)
if n != 1:
    raise SystemExit(f'refusing: expected exactly 1 KEEPER_PRIVATE_KEY line, found {n}')
open(p, 'w').write(new)
print('ok: 1 line replaced')
PY
then
  chmod 600 "$p"
  echo "file:   $p"
  echo "lines:  $(wc -l < "$p")"
  echo "backup: $bak"
else
  rc=$?
  rm -f "$bak"
  echo "aborted, file untouched" >&2
  exit "$rc"
fi
