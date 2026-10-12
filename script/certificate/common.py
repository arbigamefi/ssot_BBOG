"""Shared helpers for the first-callback certificate tools: repository paths, the pinned solc and file digests."""
import hashlib
import json
import os
from pathlib import Path
import platform

# certify.py runs copies of these scripts inside the output directory and names the checkout here.
ROOT = Path(os.environ.get('CERTIFICATE_ROOT') or Path(__file__).resolve().parents[2])
HERE = Path(__file__).resolve().parent


def fail(message):
    raise SystemExit(f'certificate: {message}')


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def lock_value(name):
    for line in (ROOT / 'deps.lock').read_text().splitlines():
        if line.startswith(name + '='):
            return line.split('=', 1)[1]
    fail(f'deps.lock has no {name}')


def pinned_solc():
    """The solc binary script/ci/install_solc.sh installs for this platform, checked against deps.lock."""
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


def read_json(path):
    return json.loads(Path(path).read_text())


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + '\n')


def executable(runtime):
    """Runtime minus the trailing CBOR metadata: the bytes that can execute."""
    return runtime[:-(int.from_bytes(runtime[-2:], 'big') + 2)]
