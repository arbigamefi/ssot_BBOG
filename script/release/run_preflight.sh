#!/usr/bin/env bash
set -uo pipefail

# No-broadcast preflight of a v1.6 deployment (ADR-0037 §9, decision D1), end to end. Run it again, unchanged, right
# before the broadcast: broadcast_v16.sh accepts only a passed preflight whose plan the chain still allows.
#
#   script/tools/with-ops-rpc.sh alchemy <base-sepolia|base> \
#     bash script/release/run_preflight.sh <commit> <roles.json> <output directory>
#
# Stages, in order; the run stops at the first failure. STAGES.tsv records each stage, its exit status and duration;
# logs/ holds each stage's output with the RPC URL and its key replaced.
#   work-copy    git archive of <commit> in a new temporary directory outside the repository (forge loads a .env it
#                finds in the project or above, so none may exist there), the pinned libraries checked against deps.lock.
#                Every later stage runs the commit's own scripts in this copy.
#   read-chain   read_chain.py at one block: the roles, the Safe and the guardian multisig, the deployer (no code,
#                nothing pending), the certified token and VRF provider; writes chain/ with deploy-params.env
#   dry-run      DeployV16 at that block with the deployer as sender (it rehearses the wiring and the activation on the
#                simulated deployment itself); the plan goes to plan/
#   verify-plan  verify_dryrun_plan.py: every creation, its address, init code and constructor arguments, and the
#                certified runtimes; writes plan-review.json
#   rehearsal    on a local anvil fork of that block, nothing sent to the network: the deployment from the impersonated
#                deployer; PrepareTimelockBatchesV16; the Safe schedules the wiring, 72 hours pass, anyone executes it;
#                release verification in release mode, the deployed runtimes against the certified build, the live
#                provider; the activation the same way and the live verification; the rehearsed creations equal the
#                plan. Its files are in rehearsal/.
# PREFLIGHT.txt summarises a passed run: commit, tree, chain, block, deployer and first nonce, and the SHA-256 of the
# parameters, the plan and the domain file.
#
# No keys and no signing. The RPC comes as OPS_RPC_URL (the wrapper) or RPC_URL. CALLBACK_DOMAIN_PATH replaces the
# chain's certified domain file for a test run; PREFLIGHT.txt names the file used and records domainOverride=yes, which
# broadcast_v16.sh refuses. The output directory must not exist and is never overwritten.

fail() {
  printf 'preflight: %s\n' "$*" >&2
  exit 1
}

[[ $# -eq 3 ]] || fail "usage: $0 <commit> <roles.json> <output directory>"
root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "run inside the repository"
. "$root/script/release/operator-functions.sh" || fail "cannot load script/release/operator-functions.sh"
commit=$(git -C "$root" rev-parse --verify --quiet "$1^{commit}") || fail "unknown commit $1"
[[ -f "$2" ]] || fail "no roles file $2"
roles=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
[[ ! -e "$3" ]] || fail "$3 exists; a preflight is never overwritten"
RPC_URL=${OPS_RPC_URL:-${RPC_URL:-}}
[[ -n "$RPC_URL" ]] || fail "no RPC: run through script/tools/with-ops-rpc.sh, which sets OPS_RPC_URL, or set RPC_URL"
export RPC_URL
mkdir -p "$3/logs" || fail "cannot create $3"
out=$(cd "$3" && pwd)
scratch=$(mktemp -d "${TMPDIR:-/tmp}/arbigamefi-preflight.XXXXXX") || fail "cannot create a work directory"
scratch=$(cd "$scratch" && pwd) # macOS TMPDIR ends with a slash; the paths Python reports have none
work=$scratch/copy
cleanup() {
  [[ ! -f "$scratch/anvil.pid" ]] || kill "$(cat "$scratch/anvil.pid")" 2> /dev/null
  rm -rf "$scratch"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

: > "$out/STAGES.tsv"
stage() { # name, command...
  local name=$1 start=$SECONDS status
  shift
  redacted "$out/logs/$name.log" "$RPC_URL" "$@"
  status=$?
  printf '%s\t%s\t%ss\n' "$name" "$status" "$((SECONDS - start))" >> "$out/STAGES.tsv"
  if ((status)); then
    echo "$name: FAILED (log: $out/logs/$name.log)"
    tail -n 25 "$out/logs/$name.log" | sed 's/^/  | /'
    exit 1
  fi
  echo "$name: pass"
}

json() { # file, Python expression over `d`
  python3 -I -c 'import json, sys; d = json.load(open(sys.argv[1])); print(eval(sys.argv[2]))' "$1" "$2"
}

work_copy() {
  make_copy "$root" "$commit" "$work" || return 1
  if [[ -n "${CALLBACK_DOMAIN_PATH:-}" ]]; then
    # Forge reads files inside the project only; the test domain file travels into the copy.
    mkdir -p "$work/deployments" && cp "$CALLBACK_DOMAIN_PATH" "$work/deployments/callback-domain-override.json" ||
      return 1
  fi
  echo "commit $commit tree $(git -C "$root" rev-parse "$commit^{tree}") copy $work"
}

read_chain() {
  cd "$work" && python3 script/release/read_chain.py "$roles" "$out/chain"
}

parameters() {
  set -a
  . "$out/chain/deploy-params.env" || return 1
  set +a
}

dry_run() {
  cd "$work" && parameters && env -u FOUNDRY_PROFILE WRITE_DRY_RUN_ARTIFACTS=false FOUNDRY_BROADCAST="$out/plan" \
    FOUNDRY_FORK_BLOCK_NUMBER="$block" forge script script/DeployV16.s.sol:DeployV16 --rpc-url "$RPC_URL" \
    --sender "$DEPLOYER"
}

verify_plan() {
  cd "$work" && python3 script/release/verify_dryrun_plan.py "$work" "$out"
}

send() { # rpc, from, to, calldata: one transaction from an impersonated account; fails unless it succeeds
  local status
  status=$(cast send "$3" "$4" --from "$2" --unlocked --rpc-url "$1" --json | json /dev/stdin 'd["status"]') || return 1
  [[ "$status" == 0x1 ]] || { echo "transaction to $3 from $2 failed ($status)"; return 1; }
}

rehearsal() {
  local port local_rpc anvil_pid status
  mkdir -p "$out/rehearsal" || return 1
  port=$(python3 -I -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
  local_rpc=http://127.0.0.1:$port
  read -r -a anvil_args <<< "$(sed -n 's/^ANVIL_ARGS=//p' "$work/deps.lock")"
  anvil "${anvil_args[@]}" --fork-url "$RPC_URL" --fork-block-number "$block" --host 127.0.0.1 --port "$port" \
    --chain-id "$chain" --auto-impersonate --silent > /dev/null 2>&1 &
  anvil_pid=$!
  # The fork holds the RPC URL in its arguments, so it must stop. stage() runs this function as a pipeline element,
  # where an EXIT trap never runs: stop it on every return, and leave its pid for cleanup() in case this subshell dies.
  echo "$anvil_pid" > "$scratch/anvil.pid"
  rehearse "$local_rpc"
  status=$?
  kill "$anvil_pid" 2> /dev/null
  wait "$anvil_pid" 2> /dev/null
  rm -f "$scratch/anvil.pid"
  return "$status"
}

rehearse() { # local fork RPC
  local local_rpc=$1 snapshot timelock operation
  for _ in $(seq 120); do
    cast chain-id --rpc-url "$local_rpc" > /dev/null 2>&1 && break
    sleep 0.5
  done
  [[ "$(cast chain-id --rpc-url "$local_rpc" 2> /dev/null)" == "$chain" ]] || { echo "the local fork did not start"; return 1; }
  cd "$work" && parameters || return 1
  echo "== deployment from the impersonated deployer"
  env -u FOUNDRY_PROFILE FOUNDRY_BROADCAST="$out/rehearsal/broadcast" forge script script/DeployV16.s.sol:DeployV16 \
    --rpc-url "$local_rpc" --broadcast --unlocked --sender "$DEPLOYER" --slow || return 11
  snapshot=$work/deployments/latest-v16.json
  cp "$snapshot" "$out/rehearsal/latest-v16.json" || return 11
  echo "== the Safe's timelock files"
  SNAPSHOT_PATH=$snapshot SAFE_WIRING_BATCH_PATH=deployments/safe-schedule-wiring-v16.json \
    SAFE_ACTIVATION_BATCH_PATH=deployments/safe-schedule-activation-v16.json \
    TIMELOCK_OPERATIONS_PATH=deployments/timelock-operations-v16.json \
    forge script script/release/PrepareTimelockBatchesV16.s.sol:PrepareTimelockBatchesV16 --rpc-url "$local_rpc" ||
    return 12
  cp deployments/safe-schedule-wiring-v16.json deployments/safe-schedule-activation-v16.json \
    deployments/timelock-operations-v16.json "$out/rehearsal/" || return 12
  timelock=$(json "$snapshot" 'd["governanceTimelock"]')
  cast rpc anvil_setBalance "$GOV" 0x16345785D8A0000 --rpc-url "$local_rpc" > /dev/null || return 13
  for operation in wiring activation; do
    echo "== $operation: the Safe schedules, 72 hours pass, anyone executes"
    send "$local_rpc" "$GOV" "$timelock" \
      "$(json "$out/rehearsal/safe-schedule-$operation-v16.json" 'd["transactions"][0]["data"]')" || return 13
    cast rpc evm_increaseTime "$(json "$snapshot" 'd["timelockMinDelay"]')" --rpc-url "$local_rpc" > /dev/null &&
      cast rpc evm_mine --rpc-url "$local_rpc" > /dev/null || return 13
    send "$local_rpc" "$DEPLOYER" "$timelock" "$(json "$out/rehearsal/timelock-operations-v16.json" \
      "[o for o in d['operations'] if o['name'] == '$operation'][0]['executeCalldata']")" || return 14
    if [[ $operation == wiring ]]; then
      echo "== the release state"
      SNAPSHOT_PATH=$snapshot RPC_URL=$local_rpc GOVERNANCE_VERIFY_MODE=release python3 script/release/verify_governance.py ||
        return 15
      SNAPSHOT_PATH=$snapshot RPC_URL=$local_rpc CALLBACK_REQUIRE_FORK=1 \
        forge script script/release/VerifyCallbackDomainV16.s.sol:VerifyCallbackDomainV16 || return 16
      SNAPSHOT_PATH=$snapshot RPC_URL=$local_rpc python3 script/release/verify_callback_provider.py || return 17
    fi
  done
  echo "== the launched state"
  SNAPSHOT_PATH=$snapshot RPC_URL=$local_rpc GOVERNANCE_VERIFY_MODE=live python3 script/release/verify_governance.py \
    > "$out/rehearsal/live.json" || return 18
  [[ "$(json "$out/rehearsal/live.json" 'd["launched"]')" == True ]] || { echo "not launched after the activation"; return 18; }
  python3 -I - "$out/plan/DeployV16.s.sol/$chain/dry-run/run-latest.json" \
    "$out/rehearsal/broadcast/DeployV16.s.sol/$chain/run-latest.json" << 'PY' || return 19
import json, sys
plan, run = (json.load(open(path)) for path in sys.argv[1:3])
key = lambda t: (t['contractName'], (t.get('contractAddress') or '').lower(), t['transaction']['input'].lower(),
                 int(t['transaction']['nonce'], 16))
assert [key(t) for t in plan['transactions']] == [key(t) for t in run['transactions']], 'rehearsal differs from the plan'
assert all(int(r['status'], 16) == 1 for r in run['receipts']) and len(run['receipts']) == len(plan['transactions'])
print(f"rehearsal equals the plan: {len(run['transactions'])} creations, gas {sum(int(r['gasUsed'], 16) for r in run['receipts'])}")
PY
}

echo "preflight: commit $commit, roles $roles, output $out"
domain_override=
if [[ -n "${CALLBACK_DOMAIN_PATH:-}" ]]; then
  [[ -f "$CALLBACK_DOMAIN_PATH" ]] || fail "no domain file $CALLBACK_DOMAIN_PATH"
  domain_override=$(cd "$(dirname "$CALLBACK_DOMAIN_PATH")" && pwd)/$(basename "$CALLBACK_DOMAIN_PATH")
  CALLBACK_DOMAIN_PATH=$domain_override
fi
stage work-copy work_copy
[[ -z "${CALLBACK_DOMAIN_PATH:-}" ]] || export CALLBACK_DOMAIN_PATH=$work/deployments/callback-domain-override.json
stage read-chain read_chain
chain=$(json "$out/chain/chain-readback.json" 'd["chainId"]')
block=$(json "$out/chain/chain-readback.json" 'd["blockNumber"]')
stage dry-run dry_run
stage verify-plan verify_plan
stage rehearsal rehearsal

sha() { shasum -a 256 "$1" | cut -c1-64; }
domain=$(json "$out/chain/chain-readback.json" 'd["domainFile"]')
{
  echo "result=PASS"
  echo "commit=$commit"
  echo "tree=$(git -C "$root" rev-parse "$commit^{tree}")"
  echo "chainId=$chain"
  echo "block=$block"
  echo "deployer=$(json "$out/chain/chain-readback.json" 'd["deployer"]["address"]')"
  echo "firstNonce=$(json "$out/plan-review.json" 'd["nonceFirst"]')"
  echo "transactions=$(json "$out/plan-review.json" 'd["transactions"]')"
  echo "governanceTimelock=$(json "$out/plan-review.json" 'd["governanceTimelock"]')"
  echo "params_sha256=$(sha "$out/chain/deploy-params.env")"
  echo "plan_sha256=$(sha "$out/plan/DeployV16.s.sol/$chain/dry-run/run-latest.json")"
  if [[ -n "$domain_override" ]]; then
    echo "domain=$domain_override"
    echo "domainOverride=yes"
  else
    echo "domain=${domain#"$work"/}"
    echo "domainOverride=no"
  fi
  echo "domain_sha256=$(sha "$domain")"
  echo "finishedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$out/PREFLIGHT.txt"
cat "$out/PREFLIGHT.txt"
