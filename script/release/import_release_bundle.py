#!/usr/bin/env python3
"""Import a digest-pinned release bundle into an empty staging directory only."""
import argparse
import hashlib
import re
import subprocess
import tarfile
from pathlib import Path, PurePosixPath


def unpack(bundle: Path, expected_digest: str, destination: Path, revision: str) -> None:
    if not re.fullmatch(r'[0-9a-fA-F]{64}', expected_digest):
        raise ValueError('bundle SHA-256 must contain exactly 64 hexadecimal characters')
    if hashlib.sha256(bundle.read_bytes()).hexdigest() != expected_digest.lower():
        raise ValueError('bundle SHA-256 mismatch')
    if destination.exists():
        raise ValueError('staging destination must not exist')
    files = {}
    with tarfile.open(bundle, 'r:gz') as archive:
        for member in archive.getmembers():
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts:
                raise ValueError('unsafe bundle path')
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError('links and special files are not allowed')
            name = str(path)
            if name in files:
                raise ValueError('duplicate bundle path')
            if name not in ('SOURCE_REVISION', 'MANIFEST.sha256') and path.parts[0] not in ('deployments', 'abis'):
                raise ValueError('unexpected bundle path')
            if member.size > 16 * 1024 * 1024 or sum(map(len, files.values())) + member.size > 64 * 1024 * 1024:
                raise ValueError('bundle exceeds size limit')
            files[name] = archive.extractfile(member).read()
    if files.get('SOURCE_REVISION', b'').decode().strip() != revision:
        raise ValueError('release bundle source revision mismatch')
    listed = {}
    for line in files.get('MANIFEST.sha256', b'').decode().splitlines():
        digest, name = line.split('  ', 1)
        if name in listed or name == 'MANIFEST.sha256':
            raise ValueError('invalid integrity manifest')
        listed[name] = digest
    actual = {name: hashlib.sha256(data).hexdigest() for name, data in files.items() if name != 'MANIFEST.sha256'}
    if listed != actual:
        raise ValueError('bundle inventory mismatch')
    required = {'deployments/latest-v16.json', 'deployments/release-latest-v16.json',
                'deployments/release-notes-latest-v16.md', 'deployments/frontend-manifest-latest-v16.json',
                'deployments/golden-vectors-latest-v16.json', 'abis/index.json'}
    if not required.issubset(files):
        raise ValueError('release bundle is incomplete')
    # All archive checks precede writes. Strict signature/snapshot/ABI validation
    # follows against this staging directory, before any frontend activation.
    for name, data in files.items():
        path = destination / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--destination', type=Path, required=True)
    args = parser.parse_args()
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    try:
        unpack(args.bundle, args.sha256, args.destination, revision)
    except (ValueError, KeyError, UnicodeError, tarfile.TarError) as error:
        parser.exit(1, f'release bundle rejected: {error}\n')
