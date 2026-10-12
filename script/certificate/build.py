#!/usr/bin/env python3
"""Compile every certified contract with standard JSON and require the runtime the checkout's Forge build deploys.

    python3 script/certificate/build.py <output directory>

For each contract the settings and the source list come from the Forge artifact's recorded metadata
(out/<Contract>.sol/<Contract>.json), every source is read from this checkout, and the pinned solc must emit the
artifact's runtime byte for byte. Every bound in the certificate is computed on these outputs, so a bound and the
code it describes cannot drift apart (O3). Writes <Contract>-solc-input.json, <Contract>-solc-output.json and
BUILD.json (digests of every input, output and runtime) into the output directory.
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, executable, fail, pinned_solc, read_json, sha256, sha256_bytes, write_json  # noqa: E402

CORE = ['VRFHub', 'SettlementRouter', 'LiquidityVault', 'Bank', 'GameHub', 'DefaultReferralEngine']
MODULES = ['CoinTossModule', 'DiceModule', 'SlotsModule', 'RouletteModule', 'PlinkoModule', 'SicBoModule',
           'KenoModule', 'BaccaratModule']
SELECTION = ['abi', 'evm.deployedBytecode', 'evm.methodIdentifiers', 'storageLayout', 'metadata']


def compile_contract(solc, name, outdir):
    artifact = ROOT / f'out/{name}.sol/{name}.json'
    if not artifact.is_file():
        fail(f'missing {artifact}; run forge build src first')
    art = read_json(artifact)
    meta = json.loads(art['rawMetadata'])
    s = meta['settings']
    inp = {'language': meta['language'], 'settings': {
        'remappings': [r.lstrip(':') for r in s['remappings']], 'optimizer': s['optimizer'],
        'metadata': s['metadata'], 'evmVersion': s['evmVersion'], 'libraries': {}, 'viaIR': s['viaIR'],
        'outputSelection': {'*': {'*': SELECTION}}},
        'sources': {p: {'content': (ROOT / p).read_text()} for p in sorted(meta['sources'])}}
    res = subprocess.run([str(solc), '--standard-json', '--base-path', str(ROOT), '--allow-paths', str(ROOT)],
                         input=json.dumps(inp), capture_output=True, text=True, check=True)
    out = json.loads(res.stdout)
    errors = [e['formattedMessage'] for e in out.get('errors', []) if e['severity'] == 'error']
    if errors:
        fail(f'{name}: {errors}')
    source = next(p for p, cs in out['contracts'].items() if name in cs and p in meta['settings']['compilationTarget'])
    got = out['contracts'][source][name]['evm']['deployedBytecode']['object']
    if got != art['deployedBytecode']['object'].removeprefix('0x'):
        fail(f'{name}: the standard-JSON runtime differs from out/ (rebuild with forge build src)')
    (outdir / f'{name}-solc-input.json').write_text(json.dumps(inp) + '\n')
    (outdir / f'{name}-solc-output.json').write_text(json.dumps(out) + '\n')
    runtime = bytes.fromhex(got)
    return {'source': source, 'sourceUnits': len(inp['sources']), 'runtimeBytes': len(runtime),
            'runtimeSha256': sha256_bytes(runtime), 'executableSha256': sha256_bytes(executable(runtime)),
            'inputSha256': sha256(outdir / f'{name}-solc-input.json'),
            'outputSha256': sha256(outdir / f'{name}-solc-output.json')}


def main():
    if len(sys.argv) != 2:
        fail('usage: build.py <output directory>')
    outdir = Path(sys.argv[1])
    outdir.mkdir(parents=True, exist_ok=True)
    solc, solc_sha = pinned_solc()
    rows = {}
    for name in CORE + MODULES:
        rows[name] = compile_contract(solc, name, outdir)
        print(f"{name:22s} {rows[name]['runtimeBytes']:>6} bytes  {rows[name]['runtimeSha256'][:16]}  identical to out/",
              flush=True)
    write_json(outdir / 'BUILD.json', {'compilerSha256': solc_sha, 'contracts': rows})


if __name__ == '__main__':
    main()
