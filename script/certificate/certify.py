#!/usr/bin/env python3
"""Compute the first-callback gas certificate (v5) on this checkout.

    python3 script/certificate/certify.py <new output directory> [--memory-gib N] [--jobs N]
                                          [--stages build,frames,tree,modules,ledger,bindings,composition]

Needs this checkout's build in out/ (forge build src) and the solc pinned in deps.lock (script/ci/install_solc.sh).
The output directory must not exist: sealed evidence is never overwritten. Every stage copies its scripts from this
directory next to its outputs and runs there, so the output holds the exact code that produced each file:

  build/        build.py: standard-JSON input and output per contract, each runtime identical to out/; BUILD.json
  protocol/     frames.py (frame_bound.py, env_frame_bound.py): frame-bounds.json
  tree/         the tree analyzers and DPs: suffix-skip-tree-component.json
  modules/      module_bounds.py (pure_module_bound.py): module-bounds.json, module-rounds.json (M7);
                index_access.py: index-access.json (M1); concrete_oracle.py: m6-cases.json (M6, must equal
                test/helpers/certificate/m6-cases.json, which test/unit/ModuleGasOracle.t.sol checks against the EVM)
  ledger/       ledger.py: ledger.json
  bindings/     bindings.py: component-bindings.json
  composition.py, reused.json: composition.json
  MANIFEST.sha256

The module stage is the long one (about 1.5 hours with 10 jobs and 70 GiB; Baccarat at 25 rounds needs about
32 GiB per process). --stages runs a subset into an existing directory, for development only.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import ROOT, fail, read_json, sha256, write_json  # noqa: E402

STAGES = ['build', 'frames', 'tree', 'modules', 'ledger', 'bindings', 'composition']
MODULES = ['CoinTossModule', 'DiceModule', 'SlotsModule', 'RouletteModule', 'PlinkoModule', 'SicBoModule',
           'KenoModule', 'BaccaratModule']
DOMAIN = ROOT / 'script/release/first-callback-domain-84532.json'


def run(stage_dir, name, argv):
    start = time.time()
    with open(stage_dir / f'{name}.log', 'w') as log:
        proc = subprocess.run([sys.executable, *argv], cwd=stage_dir, stdout=log, stderr=subprocess.STDOUT,
                              env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', 'CERTIFICATE_ROOT': str(ROOT)})
    if proc.returncode:
        fail(f'{stage_dir.name}/{name} failed; see {stage_dir / (name + ".log")}')
    print(f'  {stage_dir.name}/{name}: {round(time.time() - start)} s', flush=True)


def copy(sub, names, dest):
    dest.mkdir(parents=True, exist_ok=True)
    for name in names:
        shutil.copy2(HERE / sub / name, dest / name)


def stage_build(out, args):
    copy('.', ['build.py', 'common.py'], out / 'build')
    run(out / 'build', 'build', ['build.py', str(out / 'build')])


def stage_frames(out, args):
    copy('protocol', ['frame_bound.py', 'env_frame_bound.py', 'frames.py'], out / 'protocol')
    copy('modules', ['pure_module_bound.py'], out / 'modules')
    shutil.copy2(DOMAIN, out / 'protocol' / DOMAIN.name)
    run(out / 'protocol', 'frames', ['frames.py', str(out / 'build'), DOMAIN.name, 'frame-bounds.json'])


def stage_tree(out, args):
    tree = out / 'tree'
    copy('tree', ['analyze_success_cfg.py', 'analyze_prefix_segments.py', 'analyze_query_segments.py',
                  'query-cold-joint-dp.py', 'suffix-skip-joint-dp.py'], tree)
    build = read_json(out / 'build/BUILD.json')
    vault = build['contracts']['LiquidityVault']
    shutil.copy2(out / 'build/LiquidityVault-solc-output.json', tree / 'vault-solc-output.json')
    write_json(tree / 'compiler-identity.json', {'compilerSha256': build['compilerSha256'],
                                                  'runtimeBytes': vault['runtimeBytes'],
                                                  'runtimeSha256': vault['runtimeSha256']})
    for script in ['analyze_success_cfg.py', 'analyze_prefix_segments.py', 'analyze_query_segments.py',
                   'suffix-skip-joint-dp.py']:
        run(tree, script.removesuffix('.py'), [script])


def stage_modules(out, args):
    mods = out / 'modules'
    copy('modules', ['pure_module_bound.py', 'module_bounds.py', 'index_access.py', 'concrete_oracle.py'], mods)
    merged = {'contracts': {}}
    for name in MODULES:
        o = read_json(out / f'build/{name}-solc-output.json')
        for src, cs in o['contracts'].items():
            if name in cs:
                merged['contracts'].setdefault(src, {})[name] = cs[name]
    (mods / 'modules-solc-output.json').write_text(json.dumps(merged) + '\n')
    run(mods, 'module_bounds', ['module_bounds.py', 'run', '--memory-gib', str(args.memory_gib),
                                '--jobs', str(args.jobs)])
    run(mods, 'index_access', ['index_access.py', str(out / 'build')])
    # M6: the Foundry test test/unit/ModuleGasOracle.t.sol checks these cases gas for gas against the EVM; the
    # committed cases must be the ones the concrete oracle produces on this build.
    run(mods, 'm6_cases', ['concrete_oracle.py', 'gen', 'm6-cases.json'])
    if (mods / 'm6-cases.json').read_bytes() != (ROOT / 'test/helpers/certificate/m6-cases.json').read_bytes():
        fail('test/helpers/certificate/m6-cases.json differs from the cases the oracle produces on this build')


def stage_ledger(out, args):
    copy('ledger', ['ledger.py'], out / 'ledger')
    run(out / 'ledger', 'ledger', ['ledger.py', str(out / 'build'), 'ledger.json'])


def stage_bindings(out, args):
    copy('bindings', ['bindings.py'], out / 'bindings')
    shutil.copy2(DOMAIN, out / 'bindings' / DOMAIN.name)
    shutil.copy2(HERE / 'reused.json', out / 'reused.json')
    run(out / 'bindings', 'bindings', ['bindings.py', str(out / 'build'), DOMAIN.name, str(out / 'reused.json'),
                                       'component-bindings.json'])


def stage_composition(out, args):
    shutil.copy2(HERE / 'composition.py', out / 'composition.py')
    run(out, 'composition', ['composition.py', str(out)])
    print((out / 'composition.log').read_text(), end='')


def manifest(out):
    lines = [f'{sha256(p)}  {p.relative_to(out)}' for p in sorted(out.rglob('*'))
             if p.is_file() and p.name != 'MANIFEST.sha256' and '__pycache__' not in p.parts]
    (out / 'MANIFEST.sha256').write_text('\n'.join(lines) + '\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--stages', default=','.join(STAGES))
    ap.add_argument('--memory-gib', type=float, default=70.0)
    ap.add_argument('--jobs', type=int, default=10)
    args = ap.parse_args()
    out = Path(args.out).resolve()
    stages = args.stages.split(',')
    if any(s not in STAGES for s in stages):
        fail(f'unknown stage in {args.stages}')
    if stages == STAGES:
        if out.exists():
            fail(f'{out} exists; give a new directory (sealed evidence is never overwritten)')
    elif not out.is_dir() and stages[0] != 'build':
        fail(f'{out} does not exist; run the build stage first')
    out.mkdir(parents=True, exist_ok=True)
    start = time.time()
    for name in stages:
        print(f'stage {name}', flush=True)
        globals()[f'stage_{name}'](out, args)
    if stages == STAGES:
        manifest(out)
    print(f'done in {round(time.time() - start)} s: {out}')


if __name__ == '__main__':
    main()
