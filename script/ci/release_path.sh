#!/usr/bin/env bash
set -euo pipefail

# The release check and the image import on fresh checkouts, in the order the workflows run them (launch candidate
# A2, fix review 3 W-1):
#
#   bash script/ci/release_path.sh <producer> <gate> <image>
#
# Three checkouts of one commit:
#   producer  deploys test/fixtures/ReleaseImportFixture.s.sol to a local node with Base's rules (chain 84532), wires
#             it through the timelock and signs it (test/fixtures/release-import-fixture.sh), and archives the fixture
#             release the way a release asset is laid out (SOURCE_REVISION, MANIFEST.sha256);
#   gate      runs the offline steps of the release-gate job in .github/workflows/release.yml, in its order;
#   image     runs the import step of .github/workflows/frontend-docker-images.yml.
# gate and image must never have been built: the release check and the import have to build out/ themselves.
# The fixture's callback domain is derived from the fixture (CALLBACK_DOMAIN_PATH) and its release is signed with the
# fixture's public test key, so this proves the path, not a certificate. The release gate's fork step needs a Base
# RPC and is left to the Release Gate itself.

fail() {
  echo "release path: $*" >&2
  exit 1
}

[[ $# -eq 3 ]] || fail "usage: $0 <producer> <gate> <image>"
producer=$(cd "$1" && pwd)
gate=$(cd "$2" && pwd)
image=$(cd "$3" && pwd)
revision=$(git -C "$producer" rev-parse HEAD)
for checkout in "$gate" "$image"; do
  [[ "$(git -C "$checkout" rev-parse HEAD)" == "$revision" ]] || fail "$checkout is not at $revision"
  [[ ! -e "$checkout/out" && ! -e "$checkout/cache" ]] || fail "$checkout has been built; use a fresh checkout"
done

work=$(mktemp -d)
anvil_pid=
cleanup() {
  [[ -z "$anvil_pid" ]] || kill "$anvil_pid" 2> /dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "== producer: fixture deployment and release archive"
cd "$producer"
bash script/ci/install_deps.sh
read -r -a anvil_args <<< "$(sed -n 's/^ANVIL_ARGS=//p' deps.lock)"
port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
anvil "${anvil_args[@]}" --host 127.0.0.1 --port "$port" --accounts 0 --chain-id 84532 --silent \
  > "$work/anvil.log" 2>&1 &
anvil_pid=$!
rpc=http://127.0.0.1:$port
for _ in $(seq 100); do
  cast chain-id --rpc-url "$rpc" > /dev/null 2>&1 && break
  sleep 0.1
done
[[ "$(cast chain-id --rpc-url "$rpc" 2> /dev/null)" == 84532 ]] ||
  fail "local node did not start: $(cat "$work/anvil.log")"
key=0x$(printf '%064x' 48879) # 0xBEEF, the fixture's public test key
cast rpc --rpc-url "$rpc" anvil_setBalance "$(cast wallet address --private-key "$key")" 0x56bc75e2d63100000 > /dev/null
cast rpc --rpc-url "$rpc" evm_mine > /dev/null # the snapshot's start block needs an observable predecessor
fixture=deployments/release-path-fixture       # Forge scripts may write below deployments/ only
if ! bash test/fixtures/release-import-fixture.sh "$rpc" "$fixture" > "$work/fixture.log" 2>&1; then
  tail -n 40 "$work/fixture.log"
  fail "fixture deployment failed"
fi
bundle=$fixture/bundle
python3 script/release/export_frontend_abis.py --manifest "$bundle/deployments/frontend-manifest-latest-v16.json" \
  --dest "$bundle/abis"
archive=$work/release-path-fixture.tar.gz
python3 - "$bundle" "$archive" "$revision" << 'PY'
import hashlib, io, sys, tarfile
from pathlib import Path
bundle, archive, revision = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
files = {'SOURCE_REVISION': (revision + '\n').encode()}
files.update((str(path.relative_to(bundle)), path.read_bytes()) for path in sorted(bundle.rglob('*')) if path.is_file())
files['MANIFEST.sha256'] = ''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n'
                                   for name, data in sorted(files.items())).encode()
with tarfile.open(archive, 'w:gz') as tar:
    for name, data in files.items():
        member = tarfile.TarInfo(name)
        member.size = len(data)
        tar.addfile(member, io.BytesIO(data))
PY
sha=$(shasum -a 256 "$archive" | cut -d ' ' -f 1)
snapshot=$bundle/deployments/latest-v16.json
signer=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["releaseSigner"])' "$snapshot")
digest=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["digest"])' \
  "$bundle/deployments/release-latest-v16.json")
# Forge scripts read only inside the project: the gate's copy of the domain lives in its ignored deployments/.
domain=$gate/deployments/release-path-callback-domain.json
mkdir -p "$gate/deployments"
python3 - "$snapshot" > "$domain" << 'PY'
import json, sys
snap = json.load(open(sys.argv[1]))
games = ('DICE', 'COIN_TOSS', 'ROULETTE', 'KENO', 'PLINKO', 'SIC_BO', 'SLOTS', 'BACCARAT')
modules = ('moduleDice', 'moduleCoinToss', 'moduleRoulette', 'moduleKeno', 'modulePlinko', 'moduleSicBo', 'moduleSlots',
           'moduleBaccarat')
print(json.dumps({
    'chainId': snap['chainId'], 'status': 'CERTIFIED',
    'consumerCallbackGasLimit': snap['gameCallbackGasLimit_DICE'],
    'maxBetCountCeiling': max(snap[f'gameMaxBetCount_{game}'] for game in games),
    'moduleCodeHashes': {module: snap[f'codeHash_{module}'] for module in modules},
    'providerReference': {'wrapper': snap['vrfWrapper']},
    'casinoMinBetAmountFloor': snap['poolBankMinBetAmount_0'],
    'ownerPolicy': {'casinoMinBetAmount': snap['poolBankMinBetAmount_0'],
                    'riskReserveBps': snap['poolBankRiskReserveBps_0'],
                    'withdrawalBufferBps': snap['poolBankWithdrawalBufferBps_0']},
    'token': {'proxy': snap['poolAsset_0']},
}))
PY
echo "fixture release $digest signed by $signer; archive sha256 $sha"

echo "== gate: release.yml release-gate job, offline steps"
cd "$gate"
# Download explicit release input
input=$gate/deployments/.release-input
python3 script/release/import_release_bundle.py --bundle "$archive" --sha256 "$sha" --destination "$input"
# Install pinned dependencies
bash script/ci/install_deps.sh
# Release lock must be present and valid: the job sets RELEASE_SIGNER and the input paths, not RPC_URL
RELEASE_SIGNER=$signer CALLBACK_DOMAIN_PATH=$domain \
  RELEASE_PATH=$input/deployments/release-latest-v16.json SNAPSHOT_PATH=$input/deployments/latest-v16.json \
  GOVERNANCE_CHECKPOINT_PATH=$input/deployments/governance-checkpoint-latest-v16.json \
  NOTES_PATH=$input/deployments/release-notes-latest-v16.md \
  FRONTEND_MANIFEST_PATH=$input/deployments/frontend-manifest-latest-v16.json \
  GOLDEN_VECTORS_PATH=$input/deployments/golden-vectors-latest-v16.json ABI_INDEX_PATH=$input/abis/index.json \
  STRICT=1 make release-check
# Build audit handoff bundle
make audit-package
ls dist/ssot-audit-*.tar.gz > /dev/null

echo "== image: frontend-docker-images.yml release import"
cd "$image"
bash script/ci/install_deps.sh
RELEASE_BUNDLE=$archive RELEASE_BUNDLE_SHA256=$sha DEPLOY_CHAIN_ID=84532 RPC_URL=$rpc RELEASE_SIGNER=$signer \
  bash script/release/prepare_image_release.sh
embedded=frontend/packages/ssot/src/release/embedded/chain-84532.json
imported=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["releaseDigest"])' "$embedded")
[[ "$imported" == "$digest" ]] || fail "$embedded holds $imported, not the fixture release $digest"
echo "release path: ok (gate and image built out/ themselves on fresh checkouts)"
