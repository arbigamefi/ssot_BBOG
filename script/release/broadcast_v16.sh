#!/usr/bin/env bash
set -uo pipefail

# The Owner's broadcast of a v1.6 deployment (ADR-0037 §9, decision D1: contract creations only, the governance
# timelock first; the wiring is the Safe's timelock operation afterwards).
#
#   script/tools/with-ops-rpc.sh infura <base-sepolia|base> bash script/release/broadcast_v16.sh <preflight directory>
#
# Refuses, before it asks for the keystore password, unless:
#   - the preflight passed (PREFLIGHT.txt) with the chain's certified domain file and was not broadcast yet (a test
#     domain override needs BROADCAST_TEST_DOMAIN_OVERRIDE=1, for rehearsals on a local fork only); its deploy copy
#     (deploy-copy.txt, from prepare_deploy_copy.sh) is of the same commit, still holds the preflight's
#     deploy-params.env, and neither it nor a directory above it holds a .env;
#   - the RPC is on the preflight's chain; the deployer has no code (an EIP-7702 delegation would let other code act as
#     the deployer), and its latest and pending nonces both equal the plan's first nonce;
#   - a keyless simulation in the copy against the current chain produces exactly the preflight's plan;
#   - the Owner types BROADCAST.
# The keystore password is read from the terminal and must unlock the deployer in `cast wallet address`; three wrong
# passwords end the run with nothing broadcast. forge reads it from a private temporary file removed on exit.
#
# Inputs: DEPLOY_ACCOUNT (keystore name in ~/.foundry/keystores) or DEPLOY_KEYSTORE (keystore file); the RPC as
# OPS_RPC_URL (the wrapper) or RPC_URL. Writes into the preflight directory: simulation-<UTC>/ and its log for every
# attempt, then broadcast/ (forge's broadcast files), broadcast.log and deployments/ (the snapshot DeployV16 wrote,
# which also stays in the copy). Logs have the RPC URL and its key replaced, and so, on exit, does the RPC that forge
# records for each transaction in the copy's cache/ (for --resume, never used: a broadcast is not resumed).

fail() {
  printf 'broadcast: REFUSED: %s\n' "$*" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail "usage: $0 <preflight directory>"
root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "run inside the repository"
. "$root/script/release/operator-functions.sh" || fail "cannot load script/release/operator-functions.sh"
pre=$(cd "$1" 2> /dev/null && pwd) || fail "no preflight directory $1"
value() { sed -n "s/^$1=//p" "$2" 2> /dev/null | head -n 1; }
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
sha() { shasum -a 256 "$1" | cut -c1-64; }

[[ "$(value result "$pre/PREFLIGHT.txt")" == PASS ]] || fail "no passed preflight in $pre"
[[ "$(value domainOverride "$pre/PREFLIGHT.txt")" == no || "${BROADCAST_TEST_DOMAIN_OVERRIDE:-}" == 1 ]] ||
  fail "the preflight used a test domain file (CALLBACK_DOMAIN_PATH); a deployment needs the certified one"
[[ ! -e "$pre/broadcast" ]] || fail "$pre/broadcast exists; this preflight was broadcast already"
[[ -f "$pre/deploy-copy.txt" ]] || fail "no deploy copy: run prepare_deploy_copy.sh first"
copy=$(value copy "$pre/deploy-copy.txt")
[[ -d "$copy" ]] || fail "the deploy copy $copy is missing"
[[ "$(value commit "$pre/deploy-copy.txt")" == "$(value commit "$pre/PREFLIGHT.txt")" ]] ||
  fail "the deploy copy is of another commit"
[[ -f "$copy/deploy-params.env" && "$(sha "$copy/deploy-params.env")" == "$(value params_sha256 "$pre/PREFLIGHT.txt")" ]] ||
  fail "deploy-params.env in the copy differs from the preflight's"
no_env_above "$copy" || fail "a .env is visible from the deploy copy"
if [[ -n "${DEPLOY_ACCOUNT:-}" && -z "${DEPLOY_KEYSTORE:-}" ]]; then
  wallet=(--account "$DEPLOY_ACCOUNT")
  wallet_name=$DEPLOY_ACCOUNT
elif [[ -n "${DEPLOY_KEYSTORE:-}" && -z "${DEPLOY_ACCOUNT:-}" ]]; then
  wallet=(--keystore "$DEPLOY_KEYSTORE")
  wallet_name=$DEPLOY_KEYSTORE
else
  fail "set exactly one of DEPLOY_ACCOUNT (keystore name) and DEPLOY_KEYSTORE (keystore file)"
fi
RPC_URL=${OPS_RPC_URL:-${RPC_URL:-}}
[[ -n "$RPC_URL" ]] || fail "no RPC: run through script/tools/with-ops-rpc.sh, which sets OPS_RPC_URL, or set RPC_URL"

chain=$(value chainId "$pre/PREFLIGHT.txt")
deployer=$(lower "$(value deployer "$pre/PREFLIGHT.txt")")
nonce=$(value firstNonce "$pre/PREFLIGHT.txt")
count=$(value transactions "$pre/PREFLIGHT.txt")
plan=$pre/plan/DeployV16.s.sol/$chain/dry-run/run-latest.json
[[ -f "$plan" && "$(sha "$plan")" == "$(value plan_sha256 "$pre/PREFLIGHT.txt")" ]] || fail "the preflight plan changed"
[[ "$(cast chain-id --rpc-url "$RPC_URL" 2> /dev/null)" == "$chain" ]] || fail "the RPC is not on chain $chain"
[[ "$(cast code "$deployer" --rpc-url "$RPC_URL" 2> /dev/null)" == 0x ]] ||
  fail "the deployer has code (an EIP-7702 delegation?); nothing was broadcast"
[[ "$(cast nonce "$deployer" --rpc-url "$RPC_URL" 2> /dev/null)" == "$nonce" ]] ||
  fail "the deployer's nonce is not $nonce; run the preflight again"
[[ "$(cast nonce "$deployer" --block pending --rpc-url "$RPC_URL" 2> /dev/null)" == "$nonce" ]] ||
  fail "the deployer has a pending transaction"

cd "$copy" || fail "cannot enter the deploy copy"
password_dir=
cleanup() {
  [[ -z "$password_dir" ]] || rm -rf "$password_dir"
  scrub_rpc "$copy/cache" "$RPC_URL" || echo "broadcast: the RPC key may remain in $copy/cache; remove it there" >&2
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
set -a
. ./deploy-params.env || fail "cannot read deploy-params.env"
set +a
[[ "$(lower "$DEPLOYER")" == "$deployer" ]] || fail "DEPLOYER in deploy-params.env differs from the preflight's"
simulation=$pre/simulation-$(date -u +%Y%m%dT%H%M%SZ)
echo "== keyless simulation against the current chain"
redacted "$simulation.log" "$RPC_URL" env -u FOUNDRY_PROFILE WRITE_DRY_RUN_ARTIFACTS=false \
  FOUNDRY_BROADCAST="$simulation" forge script script/DeployV16.s.sol:DeployV16 --rpc-url "$RPC_URL" \
  --sender "$deployer" || fail "the simulation failed (log: $simulation.log)"
python3 -I - "$plan" "$simulation/DeployV16.s.sol/$chain/dry-run/run-latest.json" << 'PY' ||
import json, sys
plan, now = (json.load(open(path))['transactions'] for path in sys.argv[1:3])
key = lambda t: (t['contractName'], (t.get('contractAddress') or '').lower(), t['transaction']['input'].lower(),
                 int(t['transaction']['nonce'], 16), (t['transaction'].get('to') or '').lower())
sys.exit(0 if [key(t) for t in plan] == [key(t) for t in now] else 1)
PY
  fail "the simulation differs from the preflight plan; nothing was broadcast"
echo "the simulation equals the preflight plan: $count creations"

echo
echo "commit     $(value commit "$pre/PREFLIGHT.txt")"
echo "chain      $chain"
echo "deployer   $deployer, nonce $nonce to $((nonce + count - 1))"
echo "timelock   $(value governanceTimelock "$pre/PREFLIGHT.txt") (governance of every contract from construction)"
echo "domain     $(value domain "$pre/PREFLIGHT.txt")"
{ : < /dev/tty; } 2> /dev/null || fail "no terminal to confirm on; nothing was broadcast"
printf 'Type BROADCAST to send %s transactions: ' "$count" > /dev/tty
IFS= read -r answer < /dev/tty || answer=
[[ "$answer" == BROADCAST ]] || fail "not confirmed; nothing was broadcast"

password_dir=$(mktemp -d "${TMPDIR:-/tmp}/broadcast-v16.XXXXXX") || fail "cannot create a private directory"
unlock_keystore broadcast DEPLOYER "$deployer" "nothing was broadcast" "$password_dir" "$wallet_name" "${wallet[@]}" ||
  exit 1
echo "broadcast: the keystore unlocks $deployer; broadcasting"
redacted "$pre/broadcast.log" "$RPC_URL" env -u FOUNDRY_PROFILE FOUNDRY_BROADCAST="$pre/broadcast" \
  forge script script/DeployV16.s.sol:DeployV16 --rpc-url "$RPC_URL" --broadcast "${wallet[@]}" \
  --password-file "$password_dir/password" --sender "$deployer" --slow
status=$?
rm -rf "$password_dir"
[[ -d "$copy/deployments" ]] && cp -R "$copy/deployments" "$pre/deployments"
tail -n 20 "$pre/broadcast.log"
if ((status)); then
  echo "broadcast: forge exited $status; inspect $pre/broadcast.log and the transactions it sent before anything else."
  echo "A broadcast is not resumed: after a partial one, a new preflight starts from the deployer's current nonce."
  exit "$status"
fi
case "$chain" in
  84532) network=base-sepolia ;;
  8453) network=base ;;
  *) network="<network>" ;;
esac
echo "broadcast: done. The snapshot is deployments/latest-v16.json in the copy, and in $pre/deployments. The RPC that"
echo "forge saved among its sensitive values in the copy's cache/ loses its key when this script exits."
echo "Next (docs/deploy/v16-release.md, step 2), from the repository: verify the sources, then prepare the Safe's"
echo "timelock operations in the copy:"
echo "  SNAPSHOT_PATH=deployments/latest-v16.json script/tools/with-ops-rpc.sh alchemy $network make -C $copy timelock-batches-v16"
