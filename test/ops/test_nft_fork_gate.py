"""Exercise the release fork entrypoint; RPC/Forge transport is deliberately stubbed."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class NftForkGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'script/release').mkdir(parents=True)
        (self.root / 'bin').mkdir()
        shutil.copy(ROOT / 'script/ci/fork_release_gate.sh', self.root / 'gate.sh')
        (self.root / 'script/release/verify_governance.py').write_text(
            'import json, os, sys\n'
            'class Rpc:\n'
            ' def __init__(self, url): pass\n'
            ' def __call__(self, method, params):\n'
            '  assert method=="eth_getBlockByNumber" and params==[hex(50000123),False]\n'
            '  return {"hash":"0x"+("b" if os.environ.get("REORG_AFTER_GOVERNANCE") else "a")*64}\n'
            'if __name__=="__main__":\n'
            ' if os.environ.get("REJECT_GOVERNANCE"): sys.exit(1)\n'
            ' print(json.dumps({"status":"verified", "chainId":84532, "blockNumber":50000123, "blockHash":"0x"+"a"*64}))\n')
        forge = self.root / 'bin/forge'
        forge.write_text(f'#!{sys.executable}\n' +
                         'import json, os, pathlib, sys\n'
                         'pathlib.Path("invocation.json").write_text(json.dumps({"args":sys.argv[1:],'
                         '"env":{k:v for k,v in os.environ.items() if k.startswith("NFT_")}}))\n'
                         'count=int(os.environ.get("TEST_COUNT", "4"))\n'
                         'status=os.environ.get("TEST_STATUS", "Success")\n'
                         'print(json.dumps({"suite":{"test_results":{str(n):{"status":status} for n in range(count)}}}))\n')
        forge.chmod(0o755)
        self.snapshot = {'architectureVersion': 'v1.6-nft-liquidity', 'chainId': 84532,
                         'numPools': 1, 'poolDomain_0': 1, 'poolAssetDecimals_0': 6,
                         'poolAssetSymbol_0': 'USDC',
                         'vrfWrapper': '0x' + '1' * 40, 'poolAsset_0': '0x' + '2' * 40,
                         'gameMaxBetCount_COIN_TOSS': 25, 'gameCallbackGasLimit_COIN_TOSS': 2400000}
        self.env = {k: v for k, v in os.environ.items() if not k.startswith(('FORK_', 'NFT_'))}
        self.env.update(PATH=str(self.root / 'bin') + os.pathsep + os.environ['PATH'],
                        PYTHON=sys.executable, SNAPSHOT_PATH='snapshot.json', FORK_RPC_URL='https://rpc.invalid')

    def run_gate(self, **env):
        (self.root / 'snapshot.json').write_text(json.dumps(self.snapshot))
        return subprocess.run(['bash', 'gate.sh'], cwd=self.root, env={**self.env, **env},
                              capture_output=True, text=True, timeout=10)

    def test_authenticated_target_and_frozen_block_replace_reference_defaults(self):
        result = self.run_gate(NFT_DIRECT_WRAPPER_FORK='false', NFT_FORK_BLOCK_NUMBER='123',
                               NFT_FORK_WRAPPER='0x' + '9' * 40)
        self.assertEqual(result.returncode, 0, result.stderr)
        invocation = json.loads((self.root / 'invocation.json').read_text())
        env = invocation['env']
        self.assertEqual(env['NFT_DIRECT_WRAPPER_FORK'], 'true')
        self.assertEqual(env['NFT_FORK_BLOCK_NUMBER'], '50000123')
        self.assertEqual(env['NFT_FORK_CHAIN_ID'], '84532')
        self.assertEqual(env['NFT_FORK_WRAPPER'], self.snapshot['vrfWrapper'])
        self.assertEqual(env['NFT_FORK_USDC'], self.snapshot['poolAsset_0'])
        self.assertEqual(env['NFT_FORK_CALLBACK_GAS'], '2400000')
        self.assertIn('test/fork/NftDirectWrapperFork.t.sol', invocation['args'])

    def test_skips_and_empty_or_incomplete_runs_cannot_pass_release_gate(self):
        for env in ({'TEST_STATUS': 'Skipped'}, {'TEST_STATUS': 'Failure'}, {'TEST_COUNT': '0'}, {'TEST_COUNT': '3'}):
            with self.subTest(env=env):
                result = self.run_gate(**env)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('expected four executed passing tests', result.stderr)

    def test_target_overrides_and_governance_failure_stop_before_forge(self):
        for env in ({'FORK_BLOCK_NUMBER': '123'}, {'FORK_VRF_WRAPPER': '0x' + '9' * 40},
                    {'REJECT_GOVERNANCE': '1'}):
            with self.subTest(env=env):
                self.assertNotEqual(self.run_gate(**env).returncode, 0)
                self.assertFalse((self.root / 'invocation.json').exists())

    def test_reorg_after_governance_rejects_even_when_every_fork_test_passes(self):
        result = self.run_gate(REORG_AFTER_GOVERNANCE='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.root / 'invocation.json').exists())
        self.assertIn('governance block changed', result.stderr)

    def test_old_architecture_and_unsupported_pool_scope_stop_before_forge(self):
        for field, value in (('architectureVersion', 'v1.6-house-edge-allocation'), ('numPools', 2),
                             ('poolDomain_0', 2), ('poolAssetDecimals_0', 18), ('poolAssetSymbol_0', 'OTHER'),
                             ('gameCallbackGasLimit_COIN_TOSS', 3000000)):
            original = self.snapshot[field]
            with self.subTest(field=field):
                self.snapshot[field] = value
                self.assertNotEqual(self.run_gate().returncode, 0)
                self.assertFalse((self.root / 'invocation.json').exists())
            self.snapshot[field] = original


if __name__ == '__main__':
    unittest.main()
