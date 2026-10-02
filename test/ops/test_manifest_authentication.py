"""Reject routing metadata changes without changing the authenticated snapshot."""
import copy
import hashlib
import json
import os
import shutil
import socket
import time
import urllib.request
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'script/release'))
from export_frontend_abis import REQUIRED_CONTRACTS
from validate_frontend_artifacts import EXECUTION_ADDRESSES, GAMES, _game_id


def fixture():
    address = lambda n: '0x' + format(n, '040x')
    common = {'architectureVersion': 'v1.6-house-edge-allocation', 'chainId': 84532, 'blockNumber': 10}
    addresses = {key: address(i + 1) for i, key in enumerate(EXECUTION_ADDRESSES)}
    addresses.update(sportsHub=address(0), sportsRiskEngine=address(0))
    snapshot = {**common, **addresses, 'refundTimeoutSeconds': 3600, 'sportsEnabled': 0,
                'numPools': 1, 'poolAssetSymbol_0': 'USDC', 'poolLpDecimals_0': 6, 'poolId_0': 1, 'poolDomain_0': 1,
                'poolAsset_0': address(21), 'poolBank_0': address(22), 'poolActive_0': 1}
    sports = {'enabled': False, 'sportsHub': address(0), 'riskEngine': address(0)}
    for key in ('resultReporterThreshold', 'resultChallengeTimeoutSeconds', 'maxStake', 'maxPayout',
                'maxMarketReserved', 'maxOutcomeReserved', 'maxEventReserved'):
        sports[key] = '0'
        snapshot['sports' + key[0].upper() + key[1:]] = 0
    for key in ('oddsSignerSetHash', 'resultReporterSetHash', 'resultChallenger', 'resultArbitrator'):
        sports[key] = '0x' + '0' * (64 if key.endswith('Hash') else 40)
        snapshot['sports' + key[0].upper() + key[1:]] = sports[key]
    manifest = {**common, 'schemaVersion': 2, 'addresses': addresses, 'sports': sports,
                'refundTimeoutSeconds': 3600,
                'games': [{'slug': slug, 'gameId': _game_id(name), 'label': name, 'module': addresses[key]}
                          for name, slug, key in GAMES],
                'pools': [{'poolId': 1, 'domainId': 1, 'domain': 'Casino', 'active': True, 'asset': address(21),
                           'bank': address(22), 'decimals': 6, 'symbol': 'USDC', 'sportsRisk': None}]}
    digest = '0x' + 'a' * 64
    release = {**common, 'schema': 'SSOT_RELEASE_DIGEST_V16', 'digest': digest}
    vectors = {**common, 'schemaVersion': 2, 'vectors': [{'poolId': 1, 'stakeSpec': {'amountPerRoll': 1_000_000}}]}
    return snapshot, manifest, release, vectors


class ManifestAuthenticationTests(unittest.TestCase):
    def test_actual_strict_entrypoint_rejects_every_execution_address_and_game_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            snapshot, manifest, release, vectors = fixture()
            for name, data in [('snapshot', snapshot), ('release', release), ('vectors', vectors)]:
                (root / f'{name}.json').write_text(json.dumps(data))
            (root / 'notes.md').write_text(release['digest'])
            rows = []
            for name, _, _ in REQUIRED_CONTRACTS:
                filename = f'{name}.abi.json'
                data = (ROOT / 'frontend/packages/ssot/src/abis/contracts' / filename).read_bytes()
                (root / filename).write_bytes(data)
                rows.append({'name': name, 'abiFile': filename, 'abiSha256': hashlib.sha256(data).hexdigest()})
            (root / 'index.json').write_text(json.dumps({'schemaVersion': 2, 'chainId': 84532, 'blockNumber': 10, 'contracts': rows}))
            cmd = [sys.executable, str(ROOT / 'script/release/validate_frontend_artifacts.py'), '--strict', '1']
            for key, filename in [('release', 'release.json'), ('snapshot', 'snapshot.json'), ('notes', 'notes.md'),
                                  ('manifest', 'manifest.json'), ('vectors', 'vectors.json'), ('abis-index', 'index.json')]:
                cmd += ['--' + key, str(root / filename)]
            def run(data):
                (root / 'manifest.json').write_text(json.dumps(data))
                return subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            control = run(manifest)
            self.assertEqual(control.returncode, 0, control.stderr)
            for key in EXECUTION_ADDRESSES:
                changed = copy.deepcopy(manifest)
                changed['addresses'][key] = '0x' + 'f' * 40
                with self.subTest(address=key):
                    result = run(changed)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('does not match authenticated snapshot', result.stderr)
            cases = []
            for field in ('gameId', 'module', 'slug'):
                changed = copy.deepcopy(manifest)
                changed['games'][0][field] = 'wrong'
                cases.append(changed)
            changed = copy.deepcopy(manifest); changed['pools'][0]['active'] = False; cases.append(changed)
            changed = copy.deepcopy(manifest); changed['sports']['maxStake'] = '1'; cases.append(changed)
            changed = copy.deepcopy(manifest); changed['refundTimeoutSeconds'] = 1; cases.append(changed)
            for changed in cases:
                with self.subTest(changed=changed):
                    self.assertNotEqual(run(changed).returncode, 0)
            self.assertEqual(json.loads((root / 'snapshot.json').read_text()), snapshot)
            self.assertEqual(json.loads((root / 'release.json').read_text()), release)

class SignedImportIntegrationTests(unittest.TestCase):
    """Real generators, signature verification and live local governance; no passing-check mocks.

    SafeConfigMockV16 models the Safe configuration only. The actual Governable
    contracts accept it locally; this test does not prove Safe quorum execution.
    """

    @classmethod
    def setUpClass(cls):
        (ROOT / 'deployments').mkdir(exist_ok=True)
        cls.fixture_temp = tempfile.TemporaryDirectory(prefix='import-fixture-', dir=ROOT / 'deployments')
        cls.addClassCleanup(cls.fixture_temp.cleanup)
        cls.fixture_root = Path(cls.fixture_temp.name)
        env = {**os.environ, 'RELEASE_IMPORT_FIXTURE_DIR': str(cls.fixture_root)}
        cls.run_checked(['forge', 'script', 'test/fixtures/ReleaseImportFixture.s.sol:ReleaseImportFixture',
                         '--non-interactive'], cwd=ROOT, env=env)
        cls.bundle = cls.fixture_root / 'bundle'
        cls.wrong_precision = cls.fixture_root / 'wrong-precision/bundle'
        for bundle in (cls.bundle, cls.wrong_precision):
            cls.run_checked([sys.executable, str(ROOT / 'script/release/export_frontend_abis.py'),
                             '--manifest', str(bundle / 'deployments/frontend-manifest-latest-v16.json'),
                             '--dest', str(bundle / 'abis')], cwd=ROOT)
        cls.snapshot = json.loads((cls.bundle / 'deployments/latest-v16.json').read_text())
        cls.accepted_rpc = cls.start_node('accepted')
        cls.pending_rpc = cls.start_node('pending')
        # Keep one Foundry project identity for the class. Changing cwd for each
        # case invalidates Foundry's source cache even when the sources match.
        cls.import_temp = tempfile.TemporaryDirectory(prefix='release-import-')
        cls.addClassCleanup(cls.import_temp.cleanup)
        cls.root = Path(cls.import_temp.name)
        cls.frontend = cls.root / 'frontend'
        cls.active = cls.frontend / 'packages/ssot/src/release/embedded'
        cls.deployments = cls.root / 'deployments'
        cls.deployments.mkdir()
        for name in ('src', 'script', 'lib', 'test'):
            (cls.root / name).symlink_to(ROOT / name, target_is_directory=True)
        # Verification may update Foundry's cache for the isolated project; do
        # not evict the caller's existing build or fixture compilation cache.
        for name in ('out', 'cache'):
            shutil.copytree(ROOT / name, cls.root / name)
        shutil.copy(ROOT / 'foundry.toml', cls.root / 'foundry.toml')
        cls.env = {**os.environ, 'RELEASE_SIGNER': cls.snapshot['releaseSigner'], 'RPC_URL': cls.accepted_rpc}

    @classmethod
    def run_checked(cls, cmd, **kwargs):
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=900, **kwargs)
        if result.returncode:
            raise AssertionError(f"Local release control failed: {cmd[0]}\n{result.stdout}\n{result.stderr}")
        return result

    @classmethod
    def rpc(cls, endpoint, method):
        request = urllib.request.Request(endpoint, json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': []
        }).encode(), {'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=2) as response:
            return json.load(response)['result']

    @classmethod
    def start_node(cls, state):
        allocations = json.loads((cls.fixture_root / f'{state}-alloc.json').read_text())
        genesis = cls.fixture_root / f'{state}-genesis.json'
        genesis.write_text(json.dumps({'config': {'chainId': cls.snapshot['chainId']}, 'alloc': allocations}))
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        endpoint = f'http://127.0.0.1:{port}'
        log = (cls.fixture_root / f'{state}-anvil.log').open('w+')
        cls.addClassCleanup(log.close)
        process = subprocess.Popen(['anvil', '--host', '127.0.0.1', '--port', str(port), '--accounts', '0',
                                    '--chain-id', str(cls.snapshot['chainId']), '--init', str(genesis), '--silent'],
                                   stdout=log, stderr=subprocess.STDOUT)
        def stop():
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
        cls.addClassCleanup(stop)
        for _ in range(100):
            if process.poll() is not None:
                log.flush(); log.seek(0)
                raise AssertionError(f'Local node failed: {log.read()}')
            try:
                if int(cls.rpc(endpoint, 'eth_chainId'), 16) == cls.snapshot['chainId']:
                    return endpoint
            except (OSError, ValueError, KeyError):
                time.sleep(0.05)
        raise AssertionError('Local node startup timed out')

    def setUp(self):
        # All paths below belong to this class's temporary import destination.
        if self.active.exists():
            shutil.rmtree(self.active)
        self.active.mkdir(parents=True)
        self.addCleanup(shutil.rmtree, self.root / 'changed-bundle', ignore_errors=True)
        self.addCleanup(shutil.rmtree, self.root / 'wrong-precision', ignore_errors=True)
        (self.active / 'chain-1.json').write_bytes(b'previous unrelated release')
        self.assert_success(self.bundle)
        self.original = self.files(self.active)

    @staticmethod
    def files(root):
        return {str(path.relative_to(root)): path.read_bytes() for path in root.rglob('*') if path.is_file()}

    def sync(self, bundle, endpoint=None, only_chain=None):
        env = {**self.env, 'RPC_URL': endpoint or self.accepted_rpc}
        return subprocess.run(['node', str(ROOT / 'frontend/scripts/ssot-sync.mjs'), '--from', str(bundle)] +
                              (['--only-chain', str(only_chain)] if only_chain is not None else []),
                              cwd=self.frontend, env=env, capture_output=True, text=True, timeout=300)

    def assert_success(self, bundle):
        result = self.sync(bundle)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        active = json.loads((self.active / f"chain-{self.snapshot['chainId']}.json").read_text())
        self.assertEqual(active['contracts']['gameHub'], self.snapshot['gameHub'].lower())
        self.assertEqual(active['assets'][0]['decimals'], 6)
        self.assertEqual(active['pools'][0]['decimals'], 6)
        release = json.loads((bundle / 'deployments/release-latest-v16.json').read_text())
        self.assertEqual(active['releaseDigest'], release['digest'])
        self.assertFalse(active['isPlaceholder'])
        self.assertEqual(list(self.deployments.iterdir()), [])

    def changed_bundle(self):
        target = self.root / 'changed-bundle'
        shutil.copytree(self.bundle, target)
        return target

    @staticmethod
    def change(bundle, filename, update):
        path = bundle / 'deployments' / f'{filename}-v16.json'
        data = json.loads(path.read_text())
        update(data)
        path.write_text(json.dumps(data))

    def assert_rejected(self, bundle, stage, detail=None, endpoint=None):
        result = self.sync(bundle, endpoint)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(f'{stage} failed; active release was not changed', result.stderr)
        if detail:
            self.assertIn(detail, result.stderr)
        self.assertEqual(self.files(self.active), self.original)
        self.assertEqual(list(self.deployments.iterdir()), [])

    def assert_verifier_reason(self, bundle, script, reason, endpoint=None):
        # Inspect only this owned loopback test's verifier output. The importer
        # intentionally exposes a safe stage label rather than raw RPC stderr.
        env = {**self.env, 'SNAPSHOT_PATH': str(bundle / 'deployments/latest-v16.json'),
               'RELEASE_PATH': str(bundle / 'deployments/release-latest-v16.json')}
        cmd = ['forge', 'script', f'script/release/{script}.s.sol:{script}']
        if script == 'VerifyGovernanceV16':
            cmd += ['--rpc-url', endpoint or self.accepted_rpc]
        result = subprocess.run(cmd, cwd=self.root, env=env, capture_output=True, text=True, timeout=300)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(reason, result.stdout + result.stderr)

    def test_selected_chain_prunes_other_manifests_only_after_authentication(self):
        wrong = 8453 if self.snapshot['chainId'] == 84532 else 84532
        result = self.sync(self.bundle, only_chain=wrong)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Release chain differs', result.stderr)
        self.assertEqual(self.files(self.active), self.original)
        result = self.sync(self.bundle, endpoint=self.pending_rpc, only_chain=self.snapshot['chainId'])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("live governance failed", result.stderr)
        self.assertEqual(self.files(self.active), self.original)
        result = self.sync(self.bundle, only_chain=self.snapshot['chainId'])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(set(self.files(self.active)), {f"chain-{self.snapshot['chainId']}.json", 'index.ts'})
        self.assertNotIn('chain-1.json', (self.active / 'index.ts').read_text())
        check = subprocess.run(['node', str(ROOT / 'frontend/scripts/check-release.mjs')],
                               cwd=self.frontend, env={**self.env, 'STRICT_RELEASE': '1',
                               'REQUIRED_EMBEDDED_CHAIN_IDS': str(self.snapshot['chainId'])}, capture_output=True, text=True)
        self.assertEqual(check.returncode, 0, check.stdout + check.stderr)

    def test_valid_control_then_single_route_change(self):
        bundle = self.changed_bundle()
        authenticated = {name: (bundle / 'deployments' / name).read_bytes()
                         for name in ('latest-v16.json', 'release-latest-v16.json')}
        self.change(bundle, 'frontend-manifest-latest',
                    lambda data: data['addresses'].update(gameHub='0x' + 'f' * 40))
        self.assert_rejected(bundle, 'artifact validation', 'addresses.gameHub does not match authenticated snapshot')
        self.assertEqual(authenticated, {name: (bundle / 'deployments' / name).read_bytes() for name in authenticated})

    def test_manifest_and_vector_precision_each_reject_at_artifact_validation(self):
        bundle = self.changed_bundle()
        self.change(bundle, 'frontend-manifest-latest', lambda data: data['pools'][0].update(decimals=9))
        self.assert_rejected(bundle, 'artifact validation', 'pools[0].decimals=9')
        shutil.rmtree(bundle)
        bundle = self.changed_bundle()
        self.change(bundle, 'golden-vectors-latest', lambda data: data['vectors'][0]['stakeSpec'].update(amountPerRoll=10**9))
        self.assert_rejected(bundle, 'artifact validation', 'amountPerRoll=1000000000')

    def test_obsolete_coordinated_precision_fields_reject_before_activation(self):
        bundle = self.changed_bundle()
        self.change(bundle, 'latest', lambda data: data.update(poolAssetDecimals_0=9, poolBankDecimals_0=9))
        self.change(bundle, 'frontend-manifest-latest', lambda data: data['pools'][0].update(decimals=9))
        self.change(bundle, 'golden-vectors-latest',
                    lambda data: [row['stakeSpec'].update(amountPerRoll=10**9) for row in data['vectors']])
        self.assert_rejected(bundle, 'artifact validation', 'obsolete unsigned precision field')

    def test_signed_precision_and_symbol_changes_reject_original_signature(self):
        for field, value in (('poolLpDecimals_0', 9), ('poolAssetSymbol_0', 'OTHER')):
            with self.subTest(field=field):
                bundle = self.changed_bundle()
                self.change(bundle, 'latest', lambda data: data.update({field: value}))
                if field == 'poolLpDecimals_0':
                    self.change(bundle, 'frontend-manifest-latest', lambda data: data['pools'][0].update(decimals=9))
                    self.change(bundle, 'golden-vectors-latest',
                                lambda data: [row['stakeSpec'].update(amountPerRoll=10**9) for row in data['vectors']])
                else:
                    self.change(bundle, 'frontend-manifest-latest', lambda data: data['pools'][0].update(symbol='OTHER'))
                self.assert_rejected(bundle, 'release signature')
                self.assert_verifier_reason(bundle, 'VerifyReleaseV16', 'digest mismatch')
                shutil.rmtree(bundle)

    def test_correctly_signed_wrong_precision_rejects_at_live_governance(self):
        bundle = self.root / 'wrong-precision'
        shutil.copytree(self.wrong_precision, bundle)
        self.assert_rejected(bundle, 'live governance')
        self.assert_verifier_reason(bundle, 'VerifyGovernanceV16', 'bank precision mismatch')

    def test_unaccepted_governance_rejects_at_live_governance(self):
        bundle = self.changed_bundle()
        self.assert_rejected(bundle, 'live governance', endpoint=self.pending_rpc)
        self.assert_verifier_reason(bundle, 'VerifyGovernanceV16', 'governance not ready', endpoint=self.pending_rpc)


if __name__ == '__main__':
    unittest.main()
