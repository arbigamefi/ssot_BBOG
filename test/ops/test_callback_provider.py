"""Live first-callback provider identity (token implementation and VRF provider); no network calls."""
import importlib.util
import io
import json
from pathlib import Path
import contextlib
import tempfile
import unittest
from unittest.mock import patch

from test_governance_permissions import Chain, addr, word

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('provider', ROOT / 'script/release/verify_callback_provider.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class CallbackProviderTests(unittest.TestCase):
    def reject(self, mutate, reason):
        chain = Chain()
        mutate(chain)
        with self.assertRaisesRegex(CHECK.VerificationError, reason):
            CHECK.verify_provider(chain, chain.snap, chain.end, chain.domain)

    def test_certified_token_and_provider_pass_at_one_frozen_block(self):
        chain = Chain()
        result = CHECK.verify(chain.snap, chain, chain.domain)
        self.assertEqual((result['status'], result['blockNumber']), ('verified', chain.end))
        reads = [params for method, params in chain.requests if method in ('eth_call', 'eth_getCode', 'eth_getStorageAt')]
        self.assertTrue(reads and all(params[-1] == hex(chain.end) for params in reads))

    def test_every_drift_rejects(self):
        self.reject(lambda c: c.domain.update(chainId=8453), 'certificate is for another chain')
        self.reject(lambda c: c.snap.update(poolAsset_0=addr(29)), 'casino asset is not the certified token')
        self.reject(lambda c: c.storage.update({(addr(20), word(7)): word(71)}), 'token implementation differs')
        self.reject(lambda c: c.domain['token'].update(implementationRuntimeSha256='00' * 32), 'token code differs')
        self.reject(lambda c: c.snap.update(vrfWrapper=addr(82)), 'VRF wrapper is not the certified provider')
        self.reject(lambda c: c.put(addr(80), 's_vrfCoordinator()', [], 83), 'VRF coordinator is not the certified')
        self.reject(lambda c: c.put_words(addr(80), 'getConfig()', [0, 0, 0, 0, 13401] + [0] * 7),
                    'provider gas parameters differ')
        self.reject(lambda c: c.put_words(addr(81), 's_config()', [0, 2499999] + [0] * 7),
                    'provider gas parameters differ')

    def test_entrypoint_reads_the_chain_domain_file_and_rejects_a_changed_block(self):
        chain = Chain()
        with tempfile.TemporaryDirectory() as directory:
            snapshot, domain = Path(directory) / 'snapshot.json', Path(directory) / 'domain.json'
            snapshot.write_text(json.dumps(chain.snap))
            domain.write_text(json.dumps(chain.domain))
            env = {'SNAPSHOT_PATH': str(snapshot), 'RPC_URL': 'https://secret.invalid', 'CALLBACK_DOMAIN_PATH': str(domain)}
            with patch.dict(CHECK.os.environ, env), patch.object(CHECK, 'Rpc', return_value=chain), \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                CHECK.main()
            self.assertEqual(json.loads(output.getvalue())['status'], 'verified')
            self.assertNotIn('secret', output.getvalue())
        moved = Chain()
        hashes = iter([word(1), word(2)])
        original = moved.__call__

        def reorg(method, params):
            result = original(method, params)
            return {**result, 'hash': next(hashes)} if method == 'eth_getBlockByNumber' else result

        with self.assertRaisesRegex(CHECK.VerificationError, 'verification block changed'):
            CHECK.verify(moved.snap, reorg, moved.domain)


if __name__ == '__main__':
    unittest.main()
