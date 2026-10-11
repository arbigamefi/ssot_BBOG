"""script/release/check_current_build.py on synthetic checkouts: out/ must be the checkout's own build.

A real build is checked by the Release Path workflow (script/ci/release_path.sh), where solc's own metadata hashes
are compared with the checkout's files.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'script/release'))
from export_frontend_abis import REQUIRED_CONTRACTS  # noqa: E402

CHECK = ROOT / 'script/release/check_current_build.py'
SOLC = '0.8.37+commit.f401782d'
SHARED = 'lib/forge-std/src/Shared.sol'


def keccak(data):
    return subprocess.run(['cast', 'keccak'], input='0x' + data.hex(), capture_output=True, text=True,
                          check=True).stdout.strip()


class CurrentBuildTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        (self.root / 'deps.lock').write_text(f'SOLC_VERSION=0.8.37\nSOLC_LINUX_AMD64_BUILD=solc-linux-amd64-v{SOLC}\n')
        self.write(SHARED, '// shared dependency\n')
        for name, qualified, _ in REQUIRED_CONTRACTS:
            source, contract = qualified.split(':')
            self.write(source, f'// {contract}\n')
            sources = {source: {'keccak256': self.hash(source)}, SHARED: {'keccak256': self.hash(SHARED)}}
            target = {'compilationTarget': {source: contract}}
            self.artifact(name, {'compiler': {'version': SOLC}, 'settings': target, 'sources': sources})

    def tearDown(self):
        self.directory.cleanup()

    def write(self, path, text):
        (self.root / path).parent.mkdir(parents=True, exist_ok=True)
        (self.root / path).write_text(text)

    def hash(self, path):
        return keccak((self.root / path).read_bytes())

    def path(self, name):
        qualified = next(row[1] for row in REQUIRED_CONTRACTS if row[0] == name)
        source, contract = qualified.split(':')
        return self.root / 'out' / Path(source).name / f'{contract}.json'

    def artifact(self, name, metadata):
        self.path(name).parent.mkdir(parents=True, exist_ok=True)
        self.path(name).write_text(json.dumps({'abi': [], 'metadata': metadata}))

    def metadata(self, name):
        return json.loads(self.path(name).read_text())['metadata']

    def check(self):
        return subprocess.run([sys.executable, str(CHECK), '--root', str(self.root)], capture_output=True, text=True,
                              timeout=120)

    def assert_rejected(self, message):
        result = self.check()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(message, result.stderr)

    def test_the_checkout_s_own_build_passes(self):
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f'ok: out/ is the build of this checkout ({len(REQUIRED_CONTRACTS)} contracts, '
                      f'{len(REQUIRED_CONTRACTS) + 1} source files)', result.stdout)

    def test_a_source_changed_after_the_build_is_rejected(self):
        self.write('src/core/Bank.sol', '// Bank, edited after the build\n')
        self.assert_rejected('Bank was compiled from another src/core/Bank.sol')

    def test_a_dependency_changed_after_the_build_is_rejected(self):
        self.write(SHARED, '// another dependency version\n')
        self.assert_rejected(f'was compiled from another {SHARED}')

    def test_a_missing_source_is_rejected(self):
        (self.root / SHARED).unlink()
        self.assert_rejected(f'was compiled from another {SHARED}')

    def test_a_root_that_is_not_a_checkout_is_rejected(self):
        (self.root / 'deps.lock').unlink()
        self.assert_rejected('has no deps.lock; give the checkout root with --root')

    def test_a_missing_artifact_is_rejected(self):
        self.path('IGameModule').unlink()
        self.assert_rejected('missing build artifact')

    def test_an_artifact_of_another_contract_is_rejected(self):
        metadata = self.metadata('LiquidityVault')
        self.artifact('Bank', metadata)
        self.assert_rejected('is not the build of src/core/Bank.sol:Bank')

    def test_another_compiler_is_rejected(self):
        metadata = self.metadata('GameHub')
        metadata['compiler']['version'] = '0.8.30+commit.73712a01'
        self.artifact('GameHub', metadata)
        self.assert_rejected('was compiled by solc 0.8.30+commit.73712a01, not the pinned ' + SOLC)

    def test_artifacts_without_metadata_or_sources_are_rejected(self):
        self.path('VRFHub').write_text(json.dumps({'abi': []}))
        self.assert_rejected('has no build metadata')
        metadata = self.metadata('GameHub')
        del metadata['sources']['src/core/GameHub.sol']
        self.artifact('GameHub', metadata)
        self.artifact('VRFHub', self.metadata('PoolRegistry') | {
            'settings': {'compilationTarget': {'src/core/VRFHub.sol': 'VRFHub'}},
            'sources': {'src/core/VRFHub.sol': {'keccak256': self.hash('src/core/VRFHub.sol')}}})
        self.assert_rejected('does not list its sources')


if __name__ == '__main__':
    unittest.main()
