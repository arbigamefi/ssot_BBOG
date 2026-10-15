"""Base Denim activation check (script/ops/denim_activation_check.py and its runner); no network calls."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_governance_permissions import Chain, addr, word

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('denim_check', ROOT / 'script/ops/denim_activation_check.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)
GOVERNANCE = sys.modules['verify_governance']
HEAD = 48_200_000


class DenimChain(Chain):
    """Chain's certified token and provider reads, plus Base blocks: one every two seconds before Denim, five a second
    after it, with the BaseTime deposit at tx[1]. "pending" is the latest block after Denim and, before it, the block
    being built: number HEAD + 1 with a hash no sealed block has. Blocks above HEAD are not sealed yet: asked for one,
    the chain raises EmptyResult, as the real Rpc does for a node's explicit null result.

    `reorgs` moves the chain to a new branch (new hashes and gas limit) just before answering the first request that
    the next predicate accepts."""

    def __init__(self, denim, gas_limit=1_200_000_000):
        super().__init__()
        self.denim, self.gas_limit = denim, gas_limit
        self.end = HEAD
        self.branch = 0
        self.reorgs = []
        self.millis = True

    def hash_of(self, number):
        return word(self.branch * 10 ** 9 + number)

    def block(self, number, full=False):
        if self.denim:
            timestamp = 1_792_605_600 + (number - 48_000_000) // 5
        else:
            timestamp = 1_791_000_000 + 2 * number
        block = {'number': hex(number), 'hash': self.hash_of(number), 'parentHash': self.hash_of(number - 1),
                 'timestamp': hex(timestamp), 'gasLimit': hex(self.gas_limit), 'baseFeePerGas': hex(5_000_000)}
        if self.denim and self.millis:
            block['timestampMs'] = hex(timestamp * 1000 + number % 5 * 200)
        if full:
            attributes = {'type': '0x7e', 'to': '0x4200000000000000000000000000000000000015'}
            user = {'type': '0x2', 'to': addr(5)}
            block['transactions'] = ([attributes, {'type': '0x7e', 'to': CHECK.BASETIME}, user] if self.denim
                                     else [attributes, user])
        return block

    def __call__(self, method, params):
        if self.reorgs and self.reorgs[0][0](method, params):
            self.gas_limit = self.reorgs.pop(0)[1]
            self.branch += 1
        if method == 'eth_getBlockByNumber':
            self.requests.append((method, params))
            tag = params[0]
            if tag == 'latest':
                return self.block(HEAD, params[1])
            if tag == 'pending':
                return self.block(HEAD) if self.denim else {**self.block(HEAD + 1), 'hash': word(7 * 10 ** 9 + HEAD + 1)}
            number = int(tag, 16)
            if number > HEAD:
                raise CHECK.EmptyResult(f'RPC eth_getBlockByNumber failed: empty JSON-RPC result after 1 attempt(s)')
            return self.block(number, params[1])
        if method == 'eth_getCode' and params[0] == CHECK.BASETIME:
            return '0x' + '60' * 2059
        if method == 'eth_call' and params[0]['to'] == CHECK.BASETIME:
            if not self.denim:
                raise CHECK.VerificationError('RPC eth_call failed: JSON-RPC error 3')
            return word(1_792_605_600_000)
        return super().__call__(method, params)


def numbered_read(method, params):
    return method == 'eth_getBlockByNumber' and params[0] not in ('latest', 'pending')


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
        self.assertEqual(report['block'], {'number': HEAD, 'hash': chain.hash_of(HEAD), 'attempts': 1})
        self.assertEqual(report['notes'], [])
        # Every provider and token read is pinned to the head block.
        reads = [params for method, params in chain.requests if method in ('eth_call', 'eth_getCode', 'eth_getStorageAt')]
        self.assertTrue(reads and all(params[-1] == hex(HEAD) for params in reads))

    def test_a_head_replaced_after_the_first_read_is_read_again_on_the_new_branch(self):
        # The first latest block passes (1.2B gas), its replacement does not (12M): no reading may mix the two.
        chain = DenimChain(denim=True)
        chain.reorgs = [(numbered_read, 12_000_000)]
        report = CHECK.check(chain, chain.domain)
        self.assertEqual(report['block'], {'number': HEAD, 'hash': chain.hash_of(HEAD), 'attempts': 2})
        self.assertEqual(report['gas']['blockGasLimit'], 12_000_000)
        self.assertFalse(report['verdict']['ok'])

    def test_a_head_replaced_during_the_state_reads_is_caught_by_the_final_check(self):
        chain = DenimChain(denim=True)
        chain.reorgs = [(lambda method, params: method == 'eth_getStorageAt', 1_200_000_000)]
        report = CHECK.check(chain, chain.domain)
        self.assertEqual(report['block'], {'number': HEAD, 'hash': chain.hash_of(HEAD), 'attempts': 2})

    def test_a_head_that_keeps_changing_fails_the_check(self):
        # Every reading's first numbered block read, right after its latest block, finds a new branch.
        last = {'tag': None}

        def after_latest(method, params):
            fire = numbered_read(method, params) and last['tag'] == 'latest'
            if method == 'eth_getBlockByNumber':
                last['tag'] = params[0]
            return fire
        chain = DenimChain(denim=True)
        chain.reorgs = [(after_latest, 1_200_000_000)] * CHECK.ATTEMPTS
        with self.assertRaisesRegex(CHECK.VerificationError, 'changed during each of 3 readings'):
            CHECK.check(chain, chain.domain)

    def test_confirm_says_whether_the_block_number_still_names_the_reported_hash(self):
        chain = DenimChain(denim=True)
        report = CHECK.check(chain, chain.domain)
        self.assertTrue(CHECK.confirm(chain, report))
        chain.branch += 1
        self.assertFalse(CHECK.confirm(chain, report))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'check.json'
            path.write_text(json.dumps(report))
            for expected in (1, 0):
                with patch.dict(CHECK.os.environ, {'OPS_RPC_URL': 'https://secret.invalid'}), \
                        patch.object(CHECK, 'Rpc', return_value=chain), \
                        patch.object(CHECK.sys, 'argv', ['x', '--confirm', str(path)]), \
                        contextlib.redirect_stdout(io.StringIO()) as output:
                    self.assertEqual(CHECK.main(), expected)
                self.assertIn('NO LONGER' if expected else 'still has hash', output.getvalue())
                chain.branch -= 1

    def test_notes_name_active_observations_that_differ_from_the_specification(self):
        chain = DenimChain(denim=True)
        chain.millis = False
        report = CHECK.check(chain, chain.domain)
        self.assertEqual(report['verdict'], {'denimActive': True, 'ok': True})
        self.assertEqual(report['notes'], ['timestampMs is missing from some cadence blocks '
                                           '(the specification allows omitting it)'])

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
        # Without an argument every run gets a new directory named by its UTC time; an existing one is refused.
        self.assertIn('out=${1:-$root/dist/denim-activation-check-$(date -u +%Y%m%dT%H%M%SZ)}', runner)
        self.assertIn('[ ! -e "$out" ] || { echo "exists: $out" >&2; exit 1; }', runner)


class Transport:
    """urlopen for the real verify_governance.Rpc, answered from a chain as a node would: a null result for a block it
    does not have, a JSON-RPC error where the chain reverts, and `faults` (a predicate on method and params, then the
    JSON-RPC error code, None for a response with neither result nor error, or a dict of response fields) for the
    requests it fails."""

    def __init__(self, chain, faults=()):
        self.chain, self.faults, self.requests = chain, list(faults), []

    def __call__(self, request, timeout=30):
        body = json.loads(request.data)
        self.requests.append((body['method'], body['params']))
        payload = {'jsonrpc': '2.0', 'id': body['id']}
        if self.faults and self.faults[0][0](body['method'], body['params']):
            fault = self.faults.pop(0)[1]
            if isinstance(fault, dict):
                payload.update(fault)
            elif fault is not None:
                payload['error'] = {'code': fault, 'message': 'node fault'}
        else:
            try:
                payload['result'] = self.chain(body['method'], body['params'])
            except CHECK.EmptyResult:
                payload['result'] = None
            except CHECK.VerificationError:
                payload['error'] = {'code': 3, 'message': 'execution reverted'}
        return io.BytesIO(json.dumps(payload).encode())


class RealRpcTests(unittest.TestCase):
    """The check and its CLI through the real Rpc adapter and its JSON handling; only the HTTP transport is replaced."""

    def run_main(self, transport, *args):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'check.json'
            env = {'OPS_RPC_URL': 'https://secret.invalid', 'RPC_MAX_ATTEMPTS': '1', 'RPC_BACKOFF_SECONDS': '0'}
            with patch.dict(CHECK.os.environ, env), patch.object(GOVERNANCE.urllib.request, 'urlopen', transport), \
                    patch.object(CHECK.sys, 'argv', ['x', *(args or [str(out)])]), \
                    contextlib.redirect_stdout(io.StringIO()):
                code = CHECK.main()
            return code, json.loads(out.read_text()) if out.exists() else None

    def test_before_denim_a_pending_block_not_yet_on_the_chain_is_reported_unsealed(self):
        chain = DenimChain(denim=False)
        transport = Transport(chain)
        code, report = self.run_main(transport)
        # The pending block's number, HEAD + 1, has no block yet: the node answers null, and the report goes on. (main
        # reads the real domain file, which this chain's provider does not match, hence MISMATCH and exit 1.)
        self.assertIn(('eth_getBlockByNumber', [hex(HEAD + 1), False]), transport.requests)
        self.assertEqual(report['pending'], {'number': HEAD + 1, 'pendingIsALatestBlock': False})
        self.assertEqual(report['verdict'], {'denimActive': False, 'ok': False})
        self.assertEqual(report['provider']['status'], 'MISMATCH')
        self.assertEqual(code, 1)

    def test_after_denim_the_pending_block_is_the_sealed_head(self):
        chain = DenimChain(denim=True)
        code, report = self.run_main(Transport(chain))
        self.assertEqual(report['pending'], {'number': HEAD, 'pendingIsALatestBlock': True})
        self.assertEqual(report['block'], {'number': HEAD, 'hash': chain.hash_of(HEAD), 'attempts': 1})

    def test_a_node_error_on_the_sealed_block_query_still_fails_the_check(self):
        chain = DenimChain(denim=False)
        fault = (lambda method, params: params == [hex(HEAD + 1), False], -32603)
        with self.assertRaisesRegex(CHECK.VerificationError, 'JSON-RPC error -32603'):
            self.run_main(Transport(chain, [fault]))

    def test_a_response_without_a_result_on_the_sealed_block_query_still_fails_the_check(self):
        # Only an explicit null result means "no block yet"; a response with neither result nor error is invalid.
        chain = DenimChain(denim=False)
        fault = (lambda method, params: params == [hex(HEAD + 1), False], None)
        with self.assertRaisesRegex(CHECK.VerificationError, 'empty JSON-RPC result') as raised:
            self.run_main(Transport(chain, [fault]))
        self.assertNotIsInstance(raised.exception, GOVERNANCE.EmptyResult)

    def test_an_answer_that_is_not_the_block_asked_for_fails_the_check(self):
        chain = DenimChain(denim=False)
        valid = chain.block(HEAD)['hash']
        for result in (False, [], 'not a block', 7, {}, {'number': hex(HEAD + 1), 'hash': 'not-a-hash'},
                       {'number': hex(HEAD + 999), 'hash': valid}):
            with self.subTest(result=result):
                fault = (lambda method, params: params == [hex(HEAD + 1), False], {'result': result})
                with self.assertRaises(CHECK.VerificationError):
                    self.run_main(Transport(DenimChain(denim=False), [fault]))

    def test_a_node_behind_the_head_it_reported_makes_the_reading_start_again(self):
        # A load-balanced endpoint may answer the head from one node and a block of it from another, lagging one.
        chain = DenimChain(denim=True)
        lagging = Transport(chain)
        missing = {'count': 0}
        original = chain.__class__.__call__

        def lag_once(method, params):
            if method == 'eth_getBlockByNumber' and params == [hex(HEAD), False] and missing['count'] == 0:
                missing['count'] += 1
                return None
            return original(chain, method, params)
        lagging.chain = lag_once
        _, report = self.run_main(lagging)
        self.assertEqual(report['block']['attempts'], 2)

    def test_confirm_answers_through_the_real_rpc_and_a_missing_block_is_not_the_same(self):
        chain = DenimChain(denim=True)
        report = CHECK.check(chain, chain.domain)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'check.json'
            path.write_text(json.dumps(report))
            self.assertEqual(self.run_main(Transport(chain), '--confirm', str(path))[0], 0)
            report['block']['number'] = HEAD + 5
            path.write_text(json.dumps(report))
            self.assertEqual(self.run_main(Transport(chain), '--confirm', str(path))[0], 1)


RUNNER_STUB_CHECK = """import json, os, sys
if sys.argv[1] == '--confirm':
    sys.exit(0 if os.environ['STUB_CONFIRM'] == 'same' else 1)
if os.environ['STUB_CHECK'] == 'none':
    sys.exit('Denim activation check failed: RPC eth_chainId failed: HTTP 503 after 6 attempt(s)')
json.dump({'block': {'number': 48200000, 'hash': '0x' + 'ab' * 32}}, open(sys.argv[1], 'w'))
sys.exit(0 if os.environ['STUB_CHECK'] == 'ok' else 1)
"""
RUNNER_STUB_WRAPPER = """#!/usr/bin/env bash
shift 2
OPS_RPC_URL=https://stub.invalid/ops OPS_RPC_PROVIDER=alchemy "$@"
"""
RUNNER_STUB_FORGE = """#!/usr/bin/env bash
echo "block=$NFT_FORK_BLOCK_NUMBER rpc=$NFT_FORK_RPC_URL" >> "$STUB_LOG"
[ "$STUB_FORGE" = pass ] || { echo "Error: compilation failed"; exit 1; }
echo "fork target mode: explicit"
echo "Suite result: ok. 4 passed; 0 failed"
"""


class DenimRunnerTests(unittest.TestCase):
    """The runner in a scratch repository whose check, wrapper and forge are stubs: every way it can end leaves the
    finish line in RUN.txt and a non-zero status unless all three steps passed."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        base = Path(self.directory.name)
        self.repo, self.bin, self.log = base / 'repo', base / 'bin', base / 'forge.log'
        files = {'script/ops/denim-activation-check.sh': (ROOT / 'script/ops/denim-activation-check.sh').read_text(),
                 'script/ops/denim_activation_check.py': RUNNER_STUB_CHECK,
                 'script/tools/with-ops-rpc.sh': RUNNER_STUB_WRAPPER,
                 'script/release/first-callback-domain-84532.json':
                     (ROOT / 'script/release/first-callback-domain-84532.json').read_text()}
        for name, text in files.items():
            (self.repo / name).parent.mkdir(parents=True, exist_ok=True)
            (self.repo / name).write_text(text)
            (self.repo / name).chmod(0o755)
        self.bin.mkdir()
        (self.bin / 'forge').write_text(RUNNER_STUB_FORGE)
        (self.bin / 'forge').chmod(0o755)
        git = ['git', '-C', str(self.repo), '-c', 'user.name=t', '-c', 'user.email=t@invalid']
        subprocess.run(git[:3] + ['init', '-q'], check=True)
        subprocess.run(git + ['add', '-A'], check=True)
        subprocess.run(git + ['commit', '-q', '-m', 'stub'], check=True)

    def tearDown(self):
        self.directory.cleanup()

    def run_runner(self, check, forge='pass', confirm='same'):
        out = Path(self.directory.name) / 'out'
        env = {**os.environ, 'PATH': f"{self.bin}{os.pathsep}{os.environ['PATH']}", 'STUB_CHECK': check,
               'STUB_FORGE': forge, 'STUB_CONFIRM': confirm, 'STUB_LOG': str(self.log)}
        result = subprocess.run(['bash', str(self.repo / 'script/ops/denim-activation-check.sh'), str(out)],
                                env=env, capture_output=True, text=True, timeout=60)
        run = (out / 'RUN.txt').read_text()
        forged = self.log.read_text() if self.log.exists() else ''
        return result.returncode, run, forged

    def test_a_check_that_leaves_no_report_skips_the_fork_and_still_finishes(self):
        code, run, forged = self.run_runner('none')
        self.assertEqual(code, 1)
        self.assertIn('direct wrapper and confirmation SKIPPED', run)
        self.assertRegex(run, r'finished \S+ status 1\n$')
        self.assertEqual(forged, '')

    def test_a_failed_check_with_a_report_still_runs_the_fork_and_the_confirmation_at_its_block(self):
        code, run, forged = self.run_runner('not-ok')
        self.assertEqual(code, 1)
        self.assertIn('direct wrapper: passed at block 48200000', run)
        self.assertIn('confirm: block 48200000 still has hash', run)
        self.assertRegex(run, r'finished \S+ status 1\n$')
        self.assertEqual(forged, 'block=48200000 rpc=https://stub.invalid/ops\n')

    def test_a_fork_failure_without_its_summary_still_confirms_and_finishes(self):
        code, run, _ = self.run_runner('ok', forge='fail')
        self.assertEqual(code, 1)
        self.assertIn('direct wrapper: FAILED at block 48200000', run)
        self.assertIn('confirm: block 48200000 still has hash', run)
        self.assertRegex(run, r'finished \S+ status 1\n$')

    def test_a_block_replaced_by_the_end_fails_the_run(self):
        code, run, _ = self.run_runner('ok', confirm='changed')
        self.assertEqual(code, 1)
        self.assertIn('no longer has hash', run)
        self.assertRegex(run, r'finished \S+ status 1\n$')

    def test_three_passing_steps_finish_with_status_0(self):
        code, run, _ = self.run_runner('ok')
        self.assertEqual(code, 0)
        self.assertRegex(run, r'^commit [0-9a-f]{40}\nstarted ')
        self.assertRegex(run, r'finished \S+ status 0\n$')


if __name__ == '__main__':
    unittest.main()
