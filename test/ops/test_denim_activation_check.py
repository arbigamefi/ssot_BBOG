"""Base Denim activation check (script/ops/denim_activation_check.py); no network calls."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_governance_permissions import Chain, addr, word

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('denim_check', ROOT / 'script/ops/denim_activation_check.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)
HEAD = 48_200_000


class DenimChain(Chain):
    """Chain's certified token and provider reads, plus Base blocks: one every two seconds before Denim, five a second
    after it, with the BaseTime deposit at tx[1] and "pending" equal to the latest block."""

    def __init__(self, denim, gas_limit=1_200_000_000):
        super().__init__()
        self.denim, self.gas_limit = denim, gas_limit
        self.end = HEAD

    def block(self, number, full=False):
        if self.denim:
            timestamp = 1_792_605_600 + (number - 48_000_000) // 5
        else:
            timestamp = 1_791_000_000 + 2 * number
        block = {'number': hex(number), 'hash': word(number), 'timestamp': hex(timestamp),
                 'gasLimit': hex(self.gas_limit), 'baseFeePerGas': hex(5_000_000)}
        if self.denim:
            block['timestampMs'] = hex(timestamp * 1000 + number % 5 * 200)
        if full:
            attributes = {'type': '0x7e', 'to': '0x4200000000000000000000000000000000000015'}
            user = {'type': '0x2', 'to': addr(5)}
            block['transactions'] = ([attributes, {'type': '0x7e', 'to': CHECK.BASETIME}, user] if self.denim
                                     else [attributes, user])
        return block

    def __call__(self, method, params):
        if method == 'eth_getBlockByNumber':
            self.requests.append((method, params))
            tag = params[0]
            if tag == 'latest':
                return self.block(HEAD, params[1])
            if tag == 'pending':
                return self.block(HEAD if self.denim else HEAD + 1)
            return self.block(int(tag, 16), params[1])
        if method == 'eth_getCode' and params[0] == CHECK.BASETIME:
            return '0x' + '60' * 2059
        if method == 'eth_call' and params[0]['to'] == CHECK.BASETIME:
            if not self.denim:
                raise CHECK.VerificationError('RPC eth_call failed: JSON-RPC error 3')
            return word(1_792_605_600_000)
        return super().__call__(method, params)


class DenimActivationCheckTests(unittest.TestCase):
    def test_before_denim_two_second_blocks_and_no_basetime_deposit(self):
        chain = DenimChain(denim=False)
        report = CHECK.check(chain, chain.domain)
        self.assertEqual(report['verdict'], {'denimActive': False, 'ok': True})
        self.assertEqual(report['cadence']['blocksPerSecond'], 0.5)
        self.assertEqual(report['cadence']['maxBlocksSharingASecond'], 1)
        self.assertIsNone(report['cadence']['timestampMsSteps'])
        self.assertFalse(report['baseTime']['tx1IsBaseTimeDeposit'])
        self.assertTrue(report['baseTime']['timestampMs()'].startswith('reverts or unavailable'))
        self.assertFalse(report['pending']['pendingIsALatestBlock'])
        self.assertEqual(report['provider']['status'], 'matches the certified domain')

    def test_after_denim_five_blocks_a_second_the_basetime_deposit_and_pending_as_latest(self):
        chain = DenimChain(denim=True)
        report = CHECK.check(chain, chain.domain)
        self.assertEqual(report['verdict'], {'denimActive': True, 'ok': True})
        self.assertGreaterEqual(report['cadence']['blocksPerSecond'], 4)
        self.assertEqual(report['cadence']['maxBlocksSharingASecond'], 5)
        self.assertEqual(report['cadence']['timestampMsSteps'], [200])
        self.assertTrue(report['baseTime']['tx1IsBaseTimeDeposit'])
        self.assertTrue(report['pending']['pendingIsALatestBlock'])
        self.assertEqual(report['gas'], {'blockGasLimit': 1_200_000_000, 'baseFeePerGas': 5_000_000,
                                         'voidFits': True, 'txCapFits': True})
        # Every provider and token read is pinned to the head block.
        reads = [params for method, params in chain.requests if method in ('eth_call', 'eth_getCode', 'eth_getStorageAt')]
        self.assertTrue(reads and all(params[-1] == hex(HEAD) for params in reads))

    def test_a_block_gas_limit_too_small_for_a_void_fails(self):
        chain = DenimChain(denim=True, gas_limit=12_000_000)
        report = CHECK.check(chain, chain.domain)
        self.assertFalse(report['gas']['voidFits'])
        self.assertFalse(report['verdict']['ok'])

    def test_a_coordinator_minimum_above_gamehubs_confirmations_fails(self):
        chain = DenimChain(denim=True)
        chain.put_words(addr(81), 's_config()', [4, 2500000] + [0] * 7)
        report = CHECK.check(chain, chain.domain)
        self.assertEqual(report['provider']['status'], 'MISMATCH')
        self.assertIn('requires 4 request confirmations', report['provider']['error'])
        self.assertFalse(report['verdict']['ok'])

    def test_main_writes_the_report_and_fails_on_a_mismatch(self):
        # The fake provider is not the one in the real domain file, so the check must fail and say so.
        chain = DenimChain(denim=True)
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'check.json'
            with patch.dict(CHECK.os.environ, {'OPS_RPC_URL': 'https://secret.invalid'}), \
                    patch.object(CHECK, 'Rpc', return_value=chain), patch.object(CHECK.sys, 'argv', ['x', str(out)]), \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(CHECK.main(), 1)
            report = json.loads(out.read_text())
        self.assertEqual(report['provider']['status'], 'MISMATCH')
        self.assertNotIn('secret', output.getvalue())

    def test_the_runner_uses_the_operator_wrapper_and_the_explicit_fork_target(self):
        runner = (ROOT / 'script/ops/denim-activation-check.sh').read_text()
        self.assertIn('script/tools/with-ops-rpc.sh alchemy base-sepolia python3 script/ops/denim_activation_check.py',
                      runner)
        for name in ('NFT_DIRECT_WRAPPER_FORK=true', 'NFT_FORK_BLOCK_NUMBER=', 'NFT_FORK_CHAIN_ID=84532',
                     'NFT_FORK_WRAPPER=', 'NFT_FORK_USDC=', 'NFT_FORK_CALLBACK_GAS=', 'NFT_FORK_RPC_URL="$OPS_RPC_URL"',
                     'test/fork/NftDirectWrapperFork.t.sol'):
            self.assertIn(name, runner)
        self.assertNotIn('PROD_KEEPER', runner)


if __name__ == '__main__':
    unittest.main()
