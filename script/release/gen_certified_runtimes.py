#!/usr/bin/env python3
"""Pin the certified core runtimes into the first-callback domain file (audit finding F-01).

For each core contract on the callback path this reads the compiled artifact in out/, hashes the deployed
bytecode as compiled (immutable slots are zero placeholders there) and records the immutable slot offsets together
with the release value each slot must hold. CertifiedRuntime.sol re-derives the same hash from the deployed code at
verification time: it checks every immutable slot against the snapshot, zeroes the slots and compares keccak256.

Immutable slots are listed per contract in source declaration order, which is the ascending AST-id order of
`immutableReferences`; CertifiedRuntime.t.sol proves the mapping against a real deployment. Run after a certified
build; the artifacts must come from the pinned compiler settings. Writes `coreRuntimes` into the domain file given
as argv[1] and prints the block. Deterministic; no timestamps."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# contract: (snapshot key or pool key family, [expected value of each immutable slot, in AST-id order])
CORE = {
    'VRFHub': ['wrapperLink', 'vrfWrapper', 'settlementRouter'],
    'GameHub': ['settlementRouter', 'vrfHub', 'refRegistry', 'refEngine'],
    'SettlementRouter': ['poolRegistry'],
    'PoolRegistry': [],
    'ReferralRegistry': [],
    'DefaultReferralEngine': [],
    'Bank': ['poolAsset', 'poolVault', 'poolAssetDecimals', 'poolAsset', 'poolVault'],
    'LiquidityVault': ['poolAsset', 'poolBank'],
}


def keccak(hex_code):
    return subprocess.check_output(['cast', 'keccak', hex_code], text=True).strip().lower()


def main(domain_path):
    block = {}
    for name, values in CORE.items():
        artifact = next(ROOT.glob(f'out/{name}.sol/{name}.json'))
        deployed = json.loads(artifact.read_text())['deployedBytecode']
        refs = deployed.get('immutableReferences') or {}
        slots = sorted(refs.items(), key=lambda kv: int(kv[0]))
        if len(slots) != len(values):
            sys.exit(f'{name}: {len(slots)} immutables in the artifact, {len(values)} expected values listed')
        immutables = []
        for (_, locs), value in zip(slots, values):
            offsets = sorted(loc['start'] for loc in locs)
            if any(loc['length'] != 32 for loc in locs):
                sys.exit(f'{name}: immutable slot is not 32 bytes')
            immutables.append({'value': value, 'offsets': offsets})
        block[name] = {'artifact': f'{name}.sol:{name}', 'runtimeBytes': (len(deployed['object']) - 2) // 2,
                       'keccakWithImmutablesZeroed': keccak(deployed['object']), 'immutables': immutables}
    path = Path(domain_path)
    domain = json.loads(path.read_text())
    rebuilt = {}
    for key, value in domain.items():
        if key == 'coreRuntimes':
            continue
        rebuilt[key] = value
        if key == 'moduleCodeHashes':
            rebuilt['coreRuntimes'] = block
    if 'coreRuntimes' not in rebuilt:
        rebuilt['coreRuntimes'] = block
    path.write_text(json.dumps(rebuilt, indent=2) + '\n')
    print(json.dumps({k: {'keccak': v['keccakWithImmutablesZeroed'][:18], 'bytes': v['runtimeBytes'],
                          'immutables': [(i['value'], len(i['offsets'])) for i in v['immutables']]}
                      for k, v in block.items()}, indent=1))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'script/release/first-callback-domain-84532.json')
