#!/usr/bin/env python3
"""Fail unless out/ holds this checkout's build of every contract the release ABIs are checked against.

    python3 script/release/check_current_build.py [--root <checkout>] [--out <root>/out]

The release check and the image import compare a bundle's ABIs with out/, so out/ must be the build of the checkout
doing the comparison, not one left by another commit or never made (fix review 3 W-1). For each required contract the
artifact must name that contract as its compilation target, come from the solc build pinned in deps.lock, and record,
for every source file it was compiled from, the keccak256 of that file as it is in the checkout.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_frontend_abis import REQUIRED_CONTRACTS  # noqa: E402


def pinned_solc(root):
    if not (root / 'deps.lock').is_file():
        raise SystemExit(f'{root} has no deps.lock; give the checkout root with --root')
    lock = (root / 'deps.lock').read_text()
    match = re.search(r'^SOLC_LINUX_AMD64_BUILD=solc-linux-amd64-v(\S+)$', lock, re.M)
    if not match:
        raise SystemExit(f'{root / "deps.lock"} pins no solc build')
    return match.group(1)


def keccak(path):
    # Hex on stdin: cast reads 0x-prefixed input as bytes, whatever the file holds, and argv limits do not apply.
    result = subprocess.run(['cast', 'keccak'], input='0x' + path.read_bytes().hex(), capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(f'cast keccak failed for {path}: {result.stderr.strip()}')
    return result.stdout.strip().lower()


def check(root, out):
    solc = pinned_solc(root)
    hashes = {}
    for name, qualified, _ in REQUIRED_CONTRACTS:
        source, contract = qualified.split(':')
        artifact = out / Path(source).name / f'{contract}.json'
        if not artifact.is_file():
            raise SystemExit(f'missing build artifact {artifact}; build this checkout first (forge build src)')
        metadata = json.loads(artifact.read_text()).get('metadata')
        if not isinstance(metadata, dict):
            raise SystemExit(f'{artifact} has no build metadata')
        target = metadata.get('settings', {}).get('compilationTarget')
        if target != {source: contract}:
            raise SystemExit(f'{artifact} is not the build of {qualified} but of {target}')
        if metadata.get('compiler', {}).get('version') != solc:
            raise SystemExit(f'{artifact} was compiled by solc {metadata.get("compiler", {}).get("version")}, '
                             f'not the pinned {solc}')
        sources = metadata.get('sources')
        if not isinstance(sources, dict) or source not in sources:
            raise SystemExit(f'{artifact} does not list its sources')
        for path, entry in sorted(sources.items()):
            file = root / path
            if path not in hashes:
                hashes[path] = keccak(file) if file.is_file() else None
            if hashes[path] is None or hashes[path] != str(entry.get('keccak256', '')).lower():
                raise SystemExit(f'out/ is not the build of this checkout: {name} was compiled from another {path}; '
                                 f'rebuild (forge build src)')
    return len(REQUIRED_CONTRACTS), len(hashes)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--out', type=Path, help='build output directory (default <root>/out)')
    args = parser.parse_args()
    root = args.root.resolve()
    contracts, sources = check(root, (args.out or root / 'out').resolve())
    print(f'ok: out/ is the build of this checkout ({contracts} contracts, {sources} source files)')


if __name__ == '__main__':
    main()
