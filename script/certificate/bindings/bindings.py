#!/usr/bin/env python3
"""O3 and reuse bindings: every term of the composition describes exactly the code the build deploys.

    python3 bindings.py <build directory> <callback domain file> <reused.json> <output json>

1. Every analyzed contract: the runtime in its compiler output still has the digest build.py recorded after it
   compared that runtime with out/ byte for byte. Executable code is the runtime minus its CBOR metadata.
2. Reused reviewed components (reused.json) apply only to the code they were computed on: the static module bounds
   to modules whose executable code is unchanged, the token bodies to the USDC runtimes the domain file pins.
3. The constants the composition uses are read from the compiled sources, not restated.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

CONSTANTS = {
    'VRFHub': ['MAX_CALLBACK_GAS', 'CALLBACK_COMPLETION_GAS', 'CALL_OVERHEAD_GAS'],
    'GameHub': ['MAX_BET_COUNT', 'CALLBACK_COMPLETION_GAS', 'VOID_SETTLEMENT_GAS'],
}
SOURCES = {'VRFHub': 'src/core/VRFHub.sol', 'GameHub': 'src/core/GameHub.sol'}


def executable(runtime):
    return runtime[:-(int.from_bytes(runtime[-2:], 'big') + 2)]


def constant(text, name):
    found = re.findall(rf'\bconstant\b[^;=]*\b{name}\s*=\s*([0-9_]+)\s*;', text)
    assert len(found) == 1, (name, found)
    return int(found[0].replace('_', ''))


def main():
    build, domain_path, reused_path, target = (Path(a) for a in sys.argv[1:5])
    record = json.loads((build / 'BUILD.json').read_text())
    domain = json.loads(domain_path.read_text())
    reused = json.loads(reused_path.read_text())
    rows = {}
    for name, rec in record['contracts'].items():
        o = json.loads((build / f'{name}-solc-output.json').read_text())
        runtime = bytes.fromhex(o['contracts'][rec['source']][name]['evm']['deployedBytecode']['object'])
        assert hashlib.sha256(runtime).hexdigest() == rec['runtimeSha256'], name
        assert hashlib.sha256(executable(runtime)).hexdigest() == rec['executableSha256'], name
        rows[name] = {'runtimeSha256': rec['runtimeSha256'], 'executableSha256': rec['executableSha256'],
                      'runtimeBytes': rec['runtimeBytes'], 'identicalToOut': True}
    static = reused['staticModuleBounds']['executableSha256']
    static_rows = {m: {'reviewedExecutableSha256': sha, 'currentExecutableSha256': rows[m]['executableSha256'],
                       'identical': sha == rows[m]['executableSha256']} for m, sha in static.items()}
    token = reused['token']
    token_row = {'reviewedProxyRuntimeSha256': token['proxyRuntimeSha256'],
                 'reviewedImplementationRuntimeSha256': token['implementationRuntimeSha256'],
                 'domainProxyRuntimeSha256': domain['token']['proxyRuntimeSha256'],
                 'domainImplementationRuntimeSha256': domain['token']['implementationRuntimeSha256']}
    token_row['identical'] = (token_row['reviewedProxyRuntimeSha256'] == token_row['domainProxyRuntimeSha256']
                              and token_row['reviewedImplementationRuntimeSha256']
                              == token_row['domainImplementationRuntimeSha256'])
    constants = {}
    for name, names in CONSTANTS.items():
        inp = json.loads((build / f'{name}-solc-input.json').read_text())
        text = inp['sources'][SOURCES[name]]['content']
        constants[name] = {c: constant(text, c) for c in names}
    assert domain['consumerCallbackGasLimit'] == constants['VRFHub']['MAX_CALLBACK_GAS']
    assert domain['maxBetCountCeiling'] == constants['GameHub']['MAX_BET_COUNT']
    out = {'compilerSha256': record['compilerSha256'], 'analyzed': rows,
           'staticModuleBounds': {'modules': static_rows, 'apply': all(r['identical'] for r in static_rows.values())},
           'token': token_row, 'sourceConstants': constants,
           'domain': {'consumerCallbackGasLimit': domain['consumerCallbackGasLimit'],
                      'maxBetCountCeiling': domain['maxBetCountCeiling']}}
    out['allBindingsHold'] = out['staticModuleBounds']['apply'] and token_row['identical']
    target.write_text(json.dumps(out, indent=2) + '\n')
    print(json.dumps({'analyzed': len(rows), 'staticModuleBoundsApply': out['staticModuleBounds']['apply'],
                      'tokenPinsIdentical': token_row['identical'], 'sourceConstants': constants}))
    if not out['allBindingsHold']:
        raise SystemExit('bindings: a reused component no longer matches the code it was computed on')


if __name__ == '__main__':
    main()
