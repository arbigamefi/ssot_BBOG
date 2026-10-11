#!/usr/bin/env python3
"""Reproduce first-callback gas certificate v4 on this checkout from the archived evidence (launch candidate A12).

    python3 script/certificate/reproduce_first_callback_v4.py [--archive DIR] [--work DIR] [--modules rerun|sealed]

The sealed certificate package and the component bounds it reuses were archived with the rest of dist/
(docs/release/evidence.md). This script
  1. checks the two archives against docs/release/evidence-index.sha256 and extracts the four evidence directories
     into a new work directory, as the sealed copy, which nothing writes;
  2. checks the sealed package against script/release/certificates/first-callback-v4/CERTIFICATE-v4.sha256, the
     copy the callback domain file cites;
  3. builds this checkout (forge build src, then check_current_build.py) and lays out a rerun copy in which the
     certificate's scripts find this checkout's src, lib, out, script, test, foundry.toml and deps.lock where they
     expect the repository root, and the reused 2026-10-04 and 2026-10-07 evidence where they expect dist/;
  4. reruns the sealed scripts there: the tree component (the Vault solc input rebuilt from this checkout and
     compiled with the solc pinned in deps.lock, the three CFG analyses, the joint DP), the protocol frames, the
     module checks (the bounds themselves only with --modules rerun: about 3.5 hours and 32 GB), the O3 bindings
     against this checkout's out/, the input pins and the composition;
  5. compares the rerun with the sealed package (its own compare_v4.py) and prints the key numbers.

Certificate v4 covers the contracts as they were before work package B, whose first item (B9) changed GameHub and
SettlementRouter. The O3 bindings compare the certified executable code with this checkout's build, so on a later
checkout that step fails by design; reproduce v4 on commit 4a5762aa3 (V4_CODE), the last one with the v4 contracts.

The scripts run unchanged on disk. Two adaptations happen in memory: protocol/run_frames.py names the 2026-10-04
compiler outputs by an absolute path of the original workstation, which is pointed at the extracted copy, and
keno_index_access.py gets the pinned solc through its SOLC variable. The tree's compiler identity records the solc
binary's SHA-256, which differs by platform; a difference there is accepted only when it is the digest deps.lock
pins for this platform and nothing else in that file differs.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
CERT = 'dist/landing-2026-10-08/certificate-v4'
REUSED = ['dist/callback-cost-certificate-2026-10-04', 'dist/h1-callback-cost-certificate-2026-10-04',
          'dist/takeover-2026-10-07']
ARCHIVES = {'2026-10-11-clean-slate/dist.tar.gz': [CERT],
            '2026-10-11-superseded/superseded-2026-10-11.tar.gz': REUSED}
SEAL = ROOT / 'script/release/certificates/first-callback-v4/CERTIFICATE-v4.sha256'
FRAMES_OLD = '/Users/kevin/arbigamefi_ssot_project_all/dist/callback-cost-certificate-2026-10-04/tree'
LINKS = ['src', 'lib', 'out', 'script', 'test', 'foundry.toml', 'deps.lock']
V4_CODE = '4a5762aa3'


def fail(message):
    raise SystemExit(f'reproduce v4: {message}')


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def lock_value(name):
    for line in (ROOT / 'deps.lock').read_text().splitlines():
        if line.startswith(name + '='):
            return line.split('=', 1)[1]
    fail(f'deps.lock has no {name}')


def pinned_solc():
    """The solc binary install_solc.sh installs for this platform, checked against deps.lock."""
    system = {'Darwin': 'MACOSX', 'Linux': 'LINUX'}.get(platform.system()) or fail('unsupported platform')
    version, expected = lock_value('SOLC_VERSION'), lock_value(f'SOLC_{system}_AMD64_SHA256')
    home = Path.home()
    if (home / '.svm').is_dir():
        svm = home / '.svm'
    elif system == 'LINUX':
        svm = Path(os.environ.get('XDG_DATA_HOME', home / '.local/share')) / 'svm'
    else:
        svm = home / 'Library/Application Support/svm'
    solc = svm / version / f'solc-{version}'
    if not solc.is_file() or sha256(solc) != expected:
        fail(f'{solc} is not the solc pinned in deps.lock; run script/ci/install_solc.sh')
    return solc, expected


def verify_archives(archive_root):
    index = {}
    for line in (ROOT / 'docs/release/evidence-index.sha256').read_text().splitlines():
        digest, name = line.split('  ', 1)
        index[name] = digest
    for name in ARCHIVES:
        path = archive_root / name
        if not path.is_file():
            fail(f'missing archive {path}')
        if sha256(path) != index.get(name):
            fail(f'{path} does not match docs/release/evidence-index.sha256')
    print(f'archives match the evidence index: {", ".join(ARCHIVES)}', flush=True)


def extract(archive_root, sealed):
    for name, prefixes in ARCHIVES.items():
        with tarfile.open(archive_root / name) as archive:
            members = []
            for member in archive:
                inside = any(member.name == p or member.name.startswith(p + '/') for p in prefixes)
                # Workspaces are isolated build copies with links to the original checkout; nothing reads them.
                if inside and '/workspace/' not in member.name + '/' and (member.isfile() or member.isdir()):
                    members.append(member)
            archive.extractall(sealed, members=members, filter='data')
    print(f'extracted {CERT} and the reused evidence into {sealed}', flush=True)


def verify_seal(cert):
    if (cert / 'CERTIFICATE-v4.sha256').read_bytes() != SEAL.read_bytes():
        fail('the archived CERTIFICATE-v4.sha256 differs from the copy the domain file cites')
    lines = SEAL.read_text().splitlines()
    for line in lines:
        digest, name = line.split('  ', 1)
        if sha256(cert / name) != digest:
            fail(f'sealed {name} does not match CERTIFICATE-v4.sha256')
    print(f'sealed package: {len(lines)} files match CERTIFICATE-v4.sha256 '
          f'({hashlib.sha256(SEAL.read_bytes()).hexdigest()[:16]}...)', flush=True)


class Runner:
    def __init__(self, logs):
        self.logs = logs
        self.steps = []

    def __call__(self, name, argv, cwd, stdout=None, env=None, hint=''):
        started = time.time()
        log = self.logs / f'{len(self.steps):02d}-{name}.log'
        with open(log, 'w') as err:
            out = open(stdout, 'w') if stdout else err
            try:
                result = subprocess.run(argv, cwd=cwd, stdout=out, stderr=err, env={**os.environ, **(env or {})})
            finally:
                if stdout:
                    out.close()
        seconds = round(time.time() - started, 1)
        self.steps.append({'step': name, 'seconds': seconds, 'exitCode': result.returncode})
        print(f'{name}: exit {result.returncode} in {seconds} s', flush=True)
        if result.returncode:
            sys.stdout.write(''.join(log.read_text().splitlines(keepends=True)[-30:]))
            fail(f'{name} failed (log {log}){hint}')


def run_frames_source(protocol, reused_tree):
    """Execute run_frames.py from its own file with the one absolute path pointed at the extracted copy."""
    return (
        'import os\n'
        f'path = os.path.abspath("run_frames.py")\n'
        'source = open(path).read()\n'
        f'assert source.count({FRAMES_OLD!r}) == 1\n'
        f'source = source.replace({FRAMES_OLD!r}, {str(reused_tree)!r})\n'
        'exec(compile(source, path, "exec"), {"__name__": "__main__", "__file__": path})\n'
    )


def compare(sealed_cert, rerun_cert, solc_sha):
    result = subprocess.run([sys.executable, str(sealed_cert / 'compare_v4.py'), str(sealed_cert), str(rerun_cert)],
                            capture_output=True, text=True)
    print(result.stdout, end='')
    problems = [line for line in result.stdout.splitlines() if line.startswith(('differs:', 'only in'))]
    accepted = []
    if problems == ['differs: tree/compiler-identity.json']:
        a = json.loads((sealed_cert / 'tree/compiler-identity.json').read_text())
        b = json.loads((rerun_cert / 'tree/compiler-identity.json').read_text())
        if {k: v for k, v in a.items() if k != 'compilerSha256'} == \
                {k: v for k, v in b.items() if k != 'compilerSha256'} and b['compilerSha256'] == solc_sha:
            accepted = problems
            problems = []
            print('accepted: tree/compiler-identity.json differs only in the platform solc binary digest pinned in '
                  'deps.lock; runtime bytes and SHA-256 are identical')
    if problems or (result.returncode and not accepted):
        fail('the rerun differs from the sealed certificate')
    return accepted


def key_numbers(rerun_cert):
    composition = json.loads((rerun_cert / 'composition-v4.json').read_text())
    modules = json.loads((rerun_cert / 'modules/module-bounds-v4.json').read_text())
    tree = json.loads((rerun_cert / 'tree/suffix-skip-tree-component.json').read_text())
    bindings = json.loads((rerun_cert / 'bindings/component-bindings.json').read_text())
    return {
        'moduleBounds25Rounds': {name: row['bound'] for name, row in modules.items()},
        'treeComponent': composition['terms']['tree'],
        'treeRuntimeSha256': tree['runtimeSha256'],
        # composition_v4.py asserts that this split plus 25,900 is the integrated fixed ledger, 811,982.
        'fixedLedgerSplitTotal': sum(composition['ledgerSplit'].values()),
        'allExecutableCodeIdentical': bindings['allExecutableCodeIdentical'],
        'measures': [{'moduleMeasure': m['moduleMeasure'], 'boundaryTreatment': m['boundaryTreatment'],
                      'requirementAtConsumerEntry': m['requirementAtConsumerEntry'], 'margin': m['margin']}
                     for m in composition['measures']],
        'status': composition['status'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--archive', type=Path, default=Path.home() / 'arbigamefi-archive')
    parser.add_argument('--work', type=Path, help='new or empty directory (default: a new temporary directory)')
    parser.add_argument('--modules', choices=('rerun', 'sealed'), default='rerun',
                        help='rerun the module bounds and the Baccarat unrolling, or keep the sealed ones')
    args = parser.parse_args()
    work = args.work or Path(tempfile.mkdtemp(prefix='certificate-v4-'))
    if work.exists() and any(work.iterdir()):
        fail(f'{work} is not empty')
    sealed, rerun, logs = work / 'sealed', work / 'rerun', work / 'logs'
    for directory in (sealed, rerun, logs):
        directory.mkdir(parents=True)
    print(f'work directory {work}', flush=True)

    solc, solc_sha = pinned_solc()
    verify_archives(args.archive.expanduser())
    extract(args.archive.expanduser(), sealed)
    verify_seal(sealed / CERT)

    run = Runner(logs)
    run('forge-build', ['forge', 'build', 'src'], ROOT, env={'FOUNDRY_PROFILE': 'default'})
    run('current-build', [sys.executable, 'script/release/check_current_build.py', '--root', str(ROOT)], ROOT)

    shutil.copytree(sealed / CERT, rerun / CERT)
    for directory in REUSED:
        (rerun / directory).symlink_to(sealed / directory, target_is_directory=True)
    for name in LINKS:
        (rerun / name).symlink_to(ROOT / name)
    cert = rerun / CERT
    py = sys.executable

    tree = cert / 'tree'
    run('tree-solc-input', [py, 'build_solc_input.py'], tree, stdout=tree / 'vault-solc-input.sources.sha256')
    run('tree-solc', [str(solc), '--standard-json', 'vault-solc-input.json'], tree,
        stdout=tree / 'vault-solc-output.json')
    output = json.loads((tree / 'vault-solc-output.json').read_text())
    runtime = bytes.fromhex(
        output['contracts']['src/core/LiquidityVault.sol']['LiquidityVault']['evm']['deployedBytecode']['object'])
    (tree / 'compiler-identity.json').write_text(json.dumps({
        'compilerSha256': solc_sha, 'runtimeBytes': len(runtime),
        'runtimeSha256': hashlib.sha256(runtime).hexdigest()}, indent=2))
    run('tree-success-cfg', [py, 'analyze_success_cfg.py'], tree, stdout=tree / 'tree-success-cfg-diagnostic.stdout')
    run('tree-prefix-segments', [py, 'analyze_prefix_segments.py'], tree, stdout=tree / 'prefix.stdout')
    run('tree-query-segments', [py, 'analyze_query_segments.py'], tree, stdout=tree / 'query.stdout')
    run('tree-joint-dp', [py, 'suffix-skip-joint-dp.py'], tree, stdout=tree / 'suffix-skip-joint-dp.stdout')

    protocol = cert / 'protocol'
    reused_tree = rerun / 'dist/callback-cost-certificate-2026-10-04/tree'
    run('protocol-frames', [py, '-c', run_frames_source(protocol, reused_tree)], protocol,
        stdout=protocol / 'run_frames.stdout')

    modules = cert / 'modules'
    if args.modules == 'rerun':
        run('module-bounds', [py, 'module_bounds_v4.py'], modules, stdout=modules / 'module-bounds-v4.log')
        run('baccarat-unroll-1-7', [py, 'baccarat_unroll.py', '1,2,3,4,5,6,7'], modules,
            stdout=modules / 'baccarat-unroll-small.log')
        run('baccarat-unroll-25', [py, 'baccarat_unroll.py', '25', '400000000'], modules,
            stdout=modules / 'baccarat-unroll-25.log')
    run('module-concrete-oracle', [py, 'concrete_oracle.py', 'run', 'm6-cases.json'], modules)
    run('keno-index-access', [py, 'keno_index_access.py'], modules, env={'SOLC': str(solc)})

    run('bindings', [py, 'component_bindings.py'], cert / 'bindings',
        hint=f'; v4 covers the contracts before work package B, so reproduce it on commit {V4_CODE}')
    run('pin-inputs', [py, 'pin_inputs.py'], cert)
    run('composition', [py, 'composition_v4.py'], cert)

    accepted = compare(sealed / CERT, cert, solc_sha)
    numbers = key_numbers(cert)
    summary = {'checkout': subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True,
                                          text=True).stdout.strip(),
               'modules': args.modules, 'acceptedDifferences': accepted, 'steps': run.steps, 'keyNumbers': numbers}
    (work / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(numbers, indent=2))
    print(f'certificate v4 reproduced on {summary["checkout"][:12]} '
          f'({"module bounds rerun" if args.modules == "rerun" else "module bounds kept as sealed"}); '
          f'summary {work / "summary.json"}')


if __name__ == '__main__':
    main()
