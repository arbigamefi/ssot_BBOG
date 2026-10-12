#!/usr/bin/env bash
# Freeze run: every gate that runs locally, on one committed tree, with nothing edited in between
# (docs/release/evidence.md, freeze procedure), and the first-callback certificate computed on that tree.
#
#   script/tools/with-ops-rpc.sh alchemy base-sepolia script/release/run_freeze.sh <new evidence directory>
#
# The worktree must be clean: the freeze names HEAD, its tree and a manifest of every tracked file (lib/ is pinned
# by digest in deps.lock). The manifest is checked before and after each group of stages. The fork stages read the
# pinned Base Sepolia block through OPS_RPC_URL, which the wrapper provides; every stage log is rewritten without
# that URL before the next stage starts. Stages continue after a failure; STAGES.tsv records each exit code and
# duration. GitHub runs at the same commit are recorded separately (CI run IDs), as the procedure requires.
set -u

root=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:-}
[ -n "$out" ] || { echo "usage: $0 <new evidence directory>" >&2; exit 64; }
[ ! -e "$out" ] || { echo "$out exists; a sealed evidence directory is never reused" >&2; exit 1; }
[ -n "${OPS_RPC_URL:-}" ] || { echo "run through script/tools/with-ops-rpc.sh alchemy base-sepolia" >&2; exit 1; }
cd "$root"
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "the worktree has uncommitted changes" >&2; exit 1; }
mkdir -p "$out"
out=$(cd "$out" && pwd)
export PYTHONDONTWRITEBYTECODE=1

python3 - "$out/COMMIT.json" <<'EOF'
import json, subprocess, sys
git = lambda *a: subprocess.check_output(['git', *a], text=True).strip()
json.dump({'commit': git('rev-parse', 'HEAD'), 'tree': git('rev-parse', 'HEAD^{tree}'),
           'parent': git('rev-parse', 'HEAD^'), 'subject': git('log', '-1', '--format=%s'),
           'committedAt': git('log', '-1', '--format=%cI')}, open(sys.argv[1], 'w'), indent=2)
EOF
git ls-files -z | grep -zv '^lib/' | xargs -0 shasum -a 256 > "$out/FREEZE_MANIFEST.sha256"
{
  echo "HEAD $(git rev-parse HEAD)"
  forge --version
  python3 --version
  grep -E '^(FOUNDRY_VERSION|SOLC_VERSION|ANVIL_ARGS)=' deps.lock
  date -u
} > "$out/environment.txt" 2>&1
: > "$out/STAGES.tsv"

redact() { # file: replace the RPC URL, which carries the operator key, wherever a tool printed it
  python3 - "$1" <<'EOF'
import os, sys
from pathlib import Path
url = os.environ['OPS_RPC_URL']
p = Path(sys.argv[1])
data = p.read_bytes()
if url.encode() in data:
    p.write_bytes(data.replace(url.encode(), b'<OPS_RPC_URL>'))
EOF
}
stage() { # name, then command...
  local name=$1; shift
  local start; start=$(date +%s)
  echo "[$(date -u +%FT%TZ)] start $name" >> "$out/freeze.log"
  ( "$@" ) > "$out/$name.log" 2>&1
  local rc=$?
  redact "$out/$name.log"
  printf '%s\t%s\t%ss\n' "$name" "$rc" "$(( $(date +%s) - start ))" >> "$out/STAGES.tsv"
  echo "[$(date -u +%FT%TZ)] end $name rc=$rc" >> "$out/freeze.log"
}
check_manifest() {
  local changed
  changed=$(shasum -a 256 -c "$out/FREEZE_MANIFEST.sha256" 2>&1 | grep -v ': OK$')
  if [ -n "$changed" ]; then echo "$changed"; return 1; fi
  echo "manifest intact: $(wc -l < "$out/FREEZE_MANIFEST.sha256") files"
  [ -z "$(git status --porcelain --untracked-files=no)" ] || { git status --short; return 1; }
}

stage manifest-before check_manifest
stage build bash -c 'forge build src && python3 script/release/check_current_build.py --root .'
stage regression-pr env FOUNDRY_PROFILE=pr forge test --threads 1 --no-match-path 'test/fork/*' -vvv
stage casino-admission make test-casino-admission
stage manifest-after-regression check_manifest
stage nightly-unit env FOUNDRY_PROFILE=nightly forge test --threads 1 --match-path 'test/unit/*' -vvv
stage nightly-diff env FOUNDRY_PROFILE=nightly forge test --match-path 'test/diff/*' -vvv
stage nightly-invariants env FOUNDRY_PROFILE=nightly forge test --match-path 'test/invariants/*' -vvv
stage release-tree-gates make tree-equivalence-release
stage manifest-after-nightly check_manifest
stage certificate-tools python3 -m unittest discover -s test/certificate -v
stage ops python3 -m unittest discover -s test/ops -v
stage full-matrix env NFT_GAS_RPC_URL="$OPS_RPC_URL" python3 test/helpers/nft-callback/run_gas_matrix.py \
  --all-cases --require-fit --isolate-build --output "$out/full-matrix"
stage void-usdc env VOID_USDC_FORK=true NFT_GAS_RPC_URL="$OPS_RPC_URL" \
  forge test --isolate --match-path test/fork/VoidBetUsdcFork.t.sol -vv
stage direct-wrapper env NFT_DIRECT_WRAPPER_FORK=true NFT_FORK_RPC_URL="$OPS_RPC_URL" FOUNDRY_PROFILE=pr \
  forge test --match-path test/fork/NftDirectWrapperFork.t.sol -vv
stage manifest-after-forks check_manifest
stage certificate python3 script/certificate/certify.py "$out/certificate" --memory-gib "${FREEZE_MEMORY_GIB:-90}" \
  --jobs "${FREEZE_JOBS:-12}"
stage manifest-after check_manifest
for f in "$out"/full-matrix/*.log "$out"/full-matrix/*.json; do [ -f "$f" ] && redact "$f"; done
echo "[$(date -u +%FT%TZ)] freeze run finished" >> "$out/freeze.log"
cat "$out/STAGES.tsv"
