#!/usr/bin/env bash
set -uo pipefail

# The isolated copy a v1.6 deployment is broadcast from, prepared from a passed preflight (run_preflight.sh).
#
#   bash script/release/prepare_deploy_copy.sh <preflight directory> <copy directory>
#
# The copy is `git archive` of the preflight's commit, with the pinned libraries checked against deps.lock and the
# preflight's deploy-params.env. Neither the copy nor any directory above it may hold a .env: forge loads one it finds
# there, and the repository root's .env holds API keys. Use a directory outside the repository, for example
# /Users/Shared/arbigamefi-deploy-<commit>. Writes <preflight>/deploy-copy.txt, which broadcast_v16.sh checks; refuses
# when the copy or that record exists already. No keys, no RPC.

fail() {
  printf 'deploy copy: %s\n' "$*" >&2
  exit 1
}

[[ $# -eq 2 ]] || fail "usage: $0 <preflight directory> <copy directory>"
root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "run inside the repository"
. "$root/script/release/operator-functions.sh" || fail "cannot load script/release/operator-functions.sh"
pre=$(cd "$1" 2> /dev/null && pwd) || fail "no preflight directory $1"
value() { sed -n "s/^$1=//p" "$2" 2> /dev/null | head -n 1; }
[[ "$(value result "$pre/PREFLIGHT.txt")" == PASS ]] || fail "no passed preflight in $pre"
[[ ! -e "$pre/deploy-copy.txt" ]] || fail "$pre/deploy-copy.txt exists; this preflight has its copy"
commit=$(value commit "$pre/PREFLIGHT.txt")
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || fail "the preflight names no commit"
copy=$2
[[ "$copy" == /* ]] || copy=$PWD/$copy
case "$copy/" in
  "$root"/*) fail "the copy must be outside the repository, whose root holds a .env" ;;
esac

make_copy "$root" "$commit" "$copy" || fail "could not prepare $copy"
cp "$pre/chain/deploy-params.env" "$copy/deploy-params.env" || fail "cannot copy the parameters"
params=$(shasum -a 256 "$copy/deploy-params.env" | cut -c1-64)
[[ "$params" == "$(value params_sha256 "$pre/PREFLIGHT.txt")" ]] || fail "the parameters differ from the preflight's"
no_env_above "$copy" || fail "a .env is visible from $copy"
{
  echo "copy=$copy"
  echo "commit=$commit"
  echo "tree=$(git -C "$root" rev-parse "$commit^{tree}")"
  echo "params_sha256=$params"
  echo "preparedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$pre/deploy-copy.txt"
cat "$pre/deploy-copy.txt"
