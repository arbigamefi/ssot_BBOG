#!/usr/bin/env bash
# The whole deployment path on a Base Sepolia fork (launch candidate plan A5), before the real preflight:
#
#   test/fixtures/deploy-rehearsal.sh [new output directory] [commit] [fail-rehearsal]
#
# Public RPC, no keys: mock Safe and guardian multisigs, a throwaway deployer keystore, the preflight
# (script/release/run_preflight.sh), the deploy copy, the gated broadcast (answered by drive_terminal.py), then the Safe's
# timelock wiring from the copy and release verification. Nothing reaches a real chain. The test-only domain copy is
# marked CERTIFIED; the real domain file is not changed. With fail-rehearsal the preflight's rehearsal stage fails right
# after its fork starts, and the run passes only if the preflight stops and leaves no fork running.
#
# The output holds a full deploy copy and the throwaway keystore, so without an argument it goes to a new directory
# under the system temporary directory, not dist/. The last line is E2E PASS (or E2E FAIL-PATH PASS) on success.
set -uo pipefail
R=$(cd "$(dirname "$0")/../.." && pwd)
B=$R/test/fixtures
S=${1:-${TMPDIR:-/tmp}/deploy-rehearsal-$(date -u +%Y%m%dT%H%M%SZ)}
[ ! -e "$S" ] || { echo "exists: $S" >&2; exit 1; }
mkdir -p "$S" && S=$(cd "$S" && pwd)
echo "output: $S"
cd "$R"
commit=${2:-HEAD}
read -r -a args <<< "$(sed -n 's/^ANVIL_ARGS=//p' deps.lock)"
port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
A=http://127.0.0.1:$port
anvil "${args[@]}" --fork-url https://sepolia.base.org --host 127.0.0.1 --port "$port" --chain-id 84532 \
  --silent > "$S/anvil.log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null' EXIT
for _ in $(seq 120); do cast chain-id --rpc-url "$A" > /dev/null 2>&1 && break; sleep 0.5; done
key=0x$(printf '%064x' 48879)   # the fixtures' public test key (0xBEEF): deploys the mocks and executes the wiring
cast rpc anvil_setBalance "$(cast wallet address --private-key "$key")" 0x56bc75e2d63100000 --rpc-url "$A" > /dev/null
deploy() { forge create "$1" --rpc-url "$A" --private-key "$key" --broadcast --json --constructor-args "${@:2}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["deployedTo"])'; }
safe=$(deploy test/utils/SafeConfigMockV16.sol:SafeConfigMockV16 11) || exit 1
guardian=$(deploy test/utils/SafeConfigMockV16.sol:SafeConfigMockV16 21) || exit 1
mkdir -p "$S/keys"
cast wallet new "$S/keys" --unsafe-password e2e-password > "$S/keys/new.txt" || exit 1
keystore=$(ls "$S/keys" | grep -v new.txt | head -1)
deployer=$(cast wallet address --keystore "$S/keys/$keystore" --password e2e-password)
cast rpc anvil_setBalance "$deployer" 0x56bc75e2d63100000 --rpc-url "$A" > /dev/null
python3 - "$S" "$deployer" "$safe" "$guardian" "$R" << 'PY'
import json, os, sys
S, deployer, safe, guardian, R = sys.argv[1:6]
owner = lambda n: '0x' + format(n, '040x')
roles = {'chainId': 84532, 'DEPLOYER': deployer, 'GOV': safe, 'GOV_OWNERS': [owner(11), owner(12), owner(13)],
         'GOV_THRESHOLD': 2, 'GUARDIAN': guardian, 'GUARDIAN_OWNERS': [owner(21), owner(22), owner(23)],
         'GUARDIAN_THRESHOLD': 2, 'RELEASE_SIGNER': '0x' + os.urandom(20).hex(), 'KEEPER_ADDRESS': '0x' + os.urandom(20).hex()}
json.dump(roles, open(f'{S}/roles.json', 'w'), indent=2)
domain = json.load(open(f'{R}/script/release/first-callback-domain-84532.json'))
domain['status'] = 'CERTIFIED'   # test only: the real file stays PENDING_INDEPENDENT_REVIEW until certificate v5
json.dump(domain, open(f'{S}/domain.json', 'w'), indent=2)
PY
echo "== preflight"
preflight=script/release/run_preflight.sh
if [[ "${3:-}" == fail-rehearsal ]]; then
  # The working tree's preflight with a rehearsal that fails right after its fork starts.
  preflight=$S/run_preflight_failing.sh
  python3 -c 'import sys; s = open(sys.argv[1]).read(); open(sys.argv[2], "w").write(s.replace("\n  for _ in $(seq 120); do\n", "\n  return 99\n  for _ in $(seq 120); do\n", 1))' script/release/run_preflight.sh "$preflight"
  grep -q '^  return 99$' "$preflight" || { echo "INJECTION FAILED"; exit 1; }
fi
RPC_URL=$A CALLBACK_DOMAIN_PATH=$S/domain.json bash "$preflight" "$commit" "$S/roles.json" "$S/pre"
status=$?
sleep 1
if pgrep -f "anvil.*--fork-url $A" > /dev/null; then echo "THE PREFLIGHT LEFT ITS FORK RUNNING"; exit 1; fi
echo "no fork left running"
if [[ "${3:-}" == fail-rehearsal ]]; then
  ((status)) && awk -F'\t' '$1 == "rehearsal" && $2 == 99' "$S/pre/STAGES.tsv" | grep -q . && { echo "E2E FAIL-PATH PASS"; exit 0; }
  echo "THE INJECTED FAILURE DID NOT STOP THE PREFLIGHT"; exit 1
fi
((status == 0)) || { echo "PREFLIGHT FAILED"; exit 1; }
echo "== deploy copy"
bash script/release/prepare_deploy_copy.sh "$S/pre" "$S/copy" || { echo "COPY FAILED"; exit 1; }
echo "== broadcast"
printf '[["Type BROADCAST", "BROADCAST"], ["Keystore password", "e2e-password"]]' > "$S/answers.json"
BROADCAST_TEST_DOMAIN_OVERRIDE=1 RPC_URL=$A DEPLOY_KEYSTORE=$S/keys/$keystore python3 -I "$B/drive_terminal.py" "$S/answers.json" \
  bash script/release/broadcast_v16.sh "$S/pre" || { echo "BROADCAST FAILED"; exit 1; }
echo "== the copy keeps no RPC"
if grep -rqF "$A" "$S/copy/cache"; then echo "RPC LEFT IN THE COPY"; exit 1; fi
grep -rqF '<rpc-url>' "$S/copy/cache" || { echo "NOTHING SCRUBBED?"; exit 1; }
echo "== the Safe's wiring, from the copy as documented"
C=$S/copy
SNAPSHOT_PATH=deployments/latest-v16.json OPS_RPC_URL=$A make -C "$C" timelock-batches-v16 > "$S/batches.log" 2>&1 ||
  { tail -30 "$S/batches.log"; exit 1; }
timelock=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["governanceTimelock"])' "$C/deployments/latest-v16.json")
cast rpc anvil_impersonateAccount "$safe" --rpc-url "$A" > /dev/null
cast rpc anvil_setBalance "$safe" 0x16345785D8A0000 --rpc-url "$A" > /dev/null
cast send "$timelock" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["transactions"][0]["data"])' "$C/deployments/safe-schedule-wiring-v16.json")" \
  --from "$safe" --unlocked --rpc-url "$A" > /dev/null || exit 1
cast rpc evm_increaseTime 259200 --rpc-url "$A" > /dev/null && cast rpc evm_mine --rpc-url "$A" > /dev/null
cast send "$timelock" "$(python3 -c 'import json,sys; print([o for o in json.load(open(sys.argv[1]))["operations"] if o["name"] == "wiring"][0]["executeCalldata"])' "$C/deployments/timelock-operations-v16.json")" \
  --private-key "$key" --rpc-url "$A" > /dev/null || exit 1
(cd "$C" && SNAPSHOT_PATH=deployments/latest-v16.json RPC_URL=$A python3 script/release/verify_governance.py) || exit 1
echo "E2E PASS"
