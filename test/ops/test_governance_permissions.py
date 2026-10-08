"""Complete authorization history controls; no Forge compilation or network calls."""
import copy
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('permissions', ROOT / 'script/release/verify_governance.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


def addr(n):
    return '0x' + format(n, '040x')


def word(n):
    return '0x' + format(n, '064x')


class Chain:
    def __init__(self, sports=False):
        self.start, self.end = 10, 1250
        self.snap = {'architectureVersion': 'v1.6-nft-liquidity', 'chainId': 84532,
                     'blockNumber': self.start, 'poolRegistry': addr(1), 'gameHub': addr(2),
                     'sportsHub': addr(3) if sports else addr(0), 'sportsRiskEngine': addr(4) if sports else addr(0),
                     'sportsEnabled': int(sports), 'numPools': 2 if sports else 1}
        self.logs, self.values, self.requests = [], {}, []
        self.old_code = '0x'
        self.hash = word(123)
        self.latest_reads = 0
        self.fail_method = None
        self.add('HubRegistered(address,bool)', addr(1), [2], 1)
        self.put(addr(1), 'isRegisteredHub(address)', [2], 1)
        if sports:
            self.add('HubRegistered(address,bool)', addr(1), [3], 1)
            self.put(addr(1), 'isRegisteredHub(address)', [3], 1)
        for i in range(self.snap['numPools']):
            pool, hub = i + 1, i + 2
            self.snap.update({f'poolId_{i}': pool, f'poolDomain_{i}': pool,
                              f'poolAsset_{i}': addr(20 + i), f'poolBank_{i}': addr(30 + i), f'poolVault_{i}': addr(50 + i)})
            self.add('PoolRegistered(uint64,address,address,uint8)', addr(1), [pool, 20 + i, 30 + i], pool)
            self.add('HubAllowedForPoolSet(uint64,address,bool)', addr(1), [pool, hub], 1)
            self.put(addr(1), 'isHubAllowedForPool(uint64,address)', [pool, hub], 1)
            self.put(addr(1), 'poolIdAt(uint256)', [i], pool)
            self.put(addr(1), 'domainFor(uint64)', [pool], pool)
            self.put(addr(30 + i), 'vault()', [], 50 + i)
            self.put(addr(30 + i), 'asset()', [], 20 + i)
            self.put(addr(50 + i), 'bank()', [], 30 + i)
            self.put(addr(50 + i), 'asset()', [], 20 + i)
        self.put(addr(1), 'poolCount()', [], self.snap['numPools'])
        # Certified token and VRF provider (first-callback certificate domain) and their live reads.
        code_hash = hashlib.sha256(bytes.fromhex('6000')).hexdigest()
        self.snap['vrfWrapper'] = addr(80)
        self.domain = {'chainId': 84532, 'consumerCallbackGasLimit': 2447746,
                       'token': {'proxy': addr(20), 'implementationSlot': word(7), 'implementation': addr(70),
                                 'proxyRuntimeSha256': code_hash, 'implementationRuntimeSha256': code_hash},
                       'providerReference': {'wrapper': addr(80), 'coordinator': addr(81),
                                             'wrapperOverheadGas': 13400, 'coordinatorMaxGas': 2500000}}
        self.storage = {(addr(20), word(7)): word(70)}
        self.put(addr(80), 's_vrfCoordinator()', [], 81)
        self.put_words(addr(80), 'getConfig()', [0, 0, 0, 0, 13400] + [0] * 7)
        self.put_words(addr(81), 's_config()', [0, 2500000] + [0] * 7)
        for i, (name, key) in enumerate(CHECK.GAMES):
            self.snap.update({key: addr(60 + i), 'gameMaxBetCount_' + name: 25, 'gameCallbackGasLimit_' + name: 2447746})
            self.register_game(name, 60 + i, 25, 2447746)
        for i, role in enumerate(CHECK.ROLES):
            self.snap['sports' + role] = addr(40 + i) if sports else addr(0)
            if sports:
                self.add(role + 'Set(address,bool)', addr(3), [40 + i], 1)
                self.put(addr(3), role[0].lower() + role[1:] + '(address)', [40 + i], 1)

    def add(self, name, target, topics, value, block=10):
        self.logs.append({'address': target, 'topics': [CHECK.signature(name)] + [word(n) for n in topics],
                          'data': word(value), 'blockNumber': hex(block), 'transactionIndex': '0x0',
                          'logIndex': hex(len(self.logs)), 'removed': False})

    def register_game(self, name, module, rounds, gas, block=10):
        self.logs.append({'address': addr(2), 'topics': [CHECK.signature('GameRegistered(bytes32,address,uint32,uint32)'),
                                                         CHECK.signature(name), word(module)],
                          'data': word(rounds) + format(gas, '064x'), 'blockNumber': hex(block),
                          'transactionIndex': '0x0', 'logIndex': hex(len(self.logs)), 'removed': False})

    def put_words(self, target, name, values):
        self.values[(target, CHECK.signature(name)[:10])] = '0x' + ''.join(format(v, '064x') for v in values)

    def put(self, target, name, args, value):
        data = CHECK.signature(name)[:10] + ''.join(format(n, '064x') for n in args)
        self.values[(target, data)] = word(value)

    def __call__(self, method, params):
        self.requests.append((method, copy.deepcopy(params)))
        if method == self.fail_method:
            raise CHECK.VerificationError('RPC ' + method + ' failed')
        if method == 'eth_chainId':
            return hex(self.snap['chainId'])
        if method == 'eth_getBlockByNumber':
            self.latest_reads += 1
            return {'number': hex(self.end), 'hash': self.hash}
        if method == 'eth_getCode':
            return self.old_code if int(params[1], 16) < self.start else '0x6000'
        if method == 'eth_getLogs':
            query = params[0]
            # Deliberately return unordered logs; replay must order them itself.
            return list(reversed([copy.deepcopy(row) for row in self.logs if row['address'] == query['address']
                                  and int(query['fromBlock'], 16) <= int(row['blockNumber'], 16) <= int(query['toBlock'], 16)]))
        if method == 'eth_call':
            return self.values.get((params[0]['to'], params[0]['data']), word(0))
        if method == 'eth_getStorageAt':
            return self.storage.get((params[0], params[1]), word(0))
        raise AssertionError(method)


class PermissionHistoryTests(unittest.TestCase):
    def reject(self, chain, reason):
        with self.assertRaisesRegex(CHECK.VerificationError, reason):
            CHECK.verify_permissions(chain, chain.snap, chain.end)

    def test_casino_and_sports_controls_freeze_calls_and_bound_every_page(self):
        for sports in (False, True):
            chain = Chain(sports)
            blocks = []
            result = CHECK.verify(chain.snap, chain, blocks.append)
            self.assertEqual(blocks, [chain.end])
            self.assertEqual(result['blockHash'], chain.hash)
            pages = [params[0] for method, params in chain.requests if method == 'eth_getLogs']
            # Registry and GameHub always replay their history; SportsHub roles only when sports is enabled.
            self.assertEqual(len(pages), 9 if sports else 6)
            self.assertEqual({page['address'] for page in pages}, {addr(1), addr(2)} | ({addr(3)} if sports else set()))
            for page in pages:
                self.assertLessEqual(int(page['toBlock'], 16) - int(page['fromBlock'], 16) + 1, 500)
            self.assertTrue(all(params[1] == hex(chain.end) for method, params in chain.requests if method == 'eth_call'))

    def test_game_registrations_must_equal_the_certified_set(self):
        chain = Chain()
        CHECK.verify_permissions(chain, chain.snap, chain.end)
        extra = Chain()
        extra.register_game('UNCERTIFIED', 99, 25, 2447746, block=900)
        self.reject(extra, 'registered game set differs from release')
        for change in ({'gameMaxBetCount_KENO': 24}, {'gameCallbackGasLimit_DICE': 2447745}, {'moduleSlots': addr(98)}):
            chain = Chain()
            chain.snap.update(change)
            self.reject(chain, 'registered game set differs from release')
        missing = Chain()
        missing.logs = [row for row in missing.logs if row['address'] != addr(2)]
        self.reject(missing, 'registered game set differs from release')
        duplicate = Chain()
        duplicate.register_game('KENO', 63, 25, 2447746, block=901)
        self.reject(duplicate, 'duplicate game registration')

    def test_immutable_bank_vault_and_asset_bindings_are_required(self):
        for target, method in ((30, 'vault()'), (30, 'asset()'), (50, 'bank()'), (50, 'asset()')):
            with self.subTest(target=target, method=method):
                chain = Chain()
                chain.put(addr(target), method, [], 99)
                self.reject(chain, 'differs from release')
        chain = Chain(); chain.snap['poolVault_0'] = addr(0)
        self.reject(chain, 'invalid or duplicate Vault binding')

    def test_extra_registered_hub_and_extra_pool_route_reject(self):
        chain = Chain()
        chain.add('HubRegistered(address,bool)', addr(1), [99], 1, block=1100)
        self.reject(chain, 'registered hub set')
        chain = Chain()
        chain.add('HubRegistered(address,bool)', addr(1), [99], 1)
        chain.add('HubAllowedForPoolSet(uint64,address,bool)', addr(1), [1, 99], 1)
        chain.add('HubRegistered(address,bool)', addr(1), [99], 0, block=600)
        self.reject(chain, 'hub/pool authorization set')

    def test_fully_revoked_extra_hub_passes_and_reads_both_false_mappings(self):
        chain = Chain()
        chain.add('HubRegistered(address,bool)', addr(1), [99], 1)
        chain.add('HubAllowedForPoolSet(uint64,address,bool)', addr(1), [1, 99], 1)
        chain.add('HubAllowedForPoolSet(uint64,address,bool)', addr(1), [1, 99], 0, block=510)
        chain.add('HubRegistered(address,bool)', addr(1), [99], 0, block=1000)
        CHECK.verify_permissions(chain, chain.snap, chain.end)
        chain.put(addr(1), 'isHubAllowedForPool(uint64,address)', [1, 99], 1)
        self.reject(chain, 'mapping differs from history')

    def test_each_sports_role_checks_missing_extra_revoked_and_mapping(self):
        for role in CHECK.ROLES:
            for failure in ('extra', 'missing', 'mapping'):
                with self.subTest(role=role, failure=failure):
                    chain = Chain(True)
                    expected = int(chain.snap['sports' + role], 16)
                    if failure == 'extra':
                        chain.add(role + 'Set(address,bool)', addr(3), [99], 1, block=1100)
                    elif failure == 'missing':
                        chain.add(role + 'Set(address,bool)', addr(3), [expected], 0, block=1100)
                    else:
                        chain.put(addr(3), role[0].lower() + role[1:] + '(address)', [expected], 0)
                    self.reject(chain, 'sports ' + role)
            chain = Chain(True)
            chain.add(role + 'Set(address,bool)', addr(3), [99], 1)
            chain.add(role + 'Set(address,bool)', addr(3), [99], 0, block=600)
            CHECK.verify_permissions(chain, chain.snap, chain.end)

    def test_no_creation_coverage_archive_failure_and_log_failure_reject(self):
        chain = Chain(); chain.old_code = '0x6000'
        self.reject(chain, 'starts after contract creation')
        for method in ('eth_getCode', 'eth_getLogs', 'eth_call'):
            chain = Chain(); chain.fail_method = method
            self.reject(chain, 'RPC ' + method + ' failed')

    def test_optional_sports_role_can_be_empty_but_cannot_have_undeclared_members(self):
        for role in CHECK.ROLES:
            with self.subTest(role=role):
                chain = Chain(True)
                expected = int(chain.snap['sports' + role], 16)
                chain.snap['sports' + role] = addr(0)
                chain.add(role + 'Set(address,bool)', addr(3), [expected], 0, block=600)
                chain.put(addr(3), role[0].lower() + role[1:] + '(address)', [expected], 0)
                CHECK.verify_permissions(chain, chain.snap, chain.end)
                chain.add(role + 'Set(address,bool)', addr(3), [99], 1, block=1100)
                self.reject(chain, 'sports ' + role + ' set differs')

    def test_omitted_expected_event_and_malformed_or_duplicate_logs_reject(self):
        chain = Chain(); chain.logs.pop(0)
        self.reject(chain, 'registered hub set')
        chain = Chain(); chain.logs.append(chain.logs[0])
        self.reject(chain, 'duplicate authorization log')
        chain = Chain(); chain.logs[0]['removed'] = True
        self.reject(chain, 'removed authorization log')

    def test_sports_disabled_rejects_role_address_or_pool_or_additional_pool(self):
        chain = Chain(); chain.snap['sportsResultArbitrator'] = addr(9)
        self.reject(chain, 'sports-disabled role route')
        chain = Chain(); chain.snap['poolDomain_0'] = 2
        self.reject(chain, 'sports-disabled pool route')
        chain = Chain(); chain.add('PoolRegistered(uint64,address,address,uint8)', addr(1), [2, 22, 32], 2)
        self.reject(chain, 'pool history differs')

    def test_final_block_reorg_rejects_after_existing_governance_check(self):
        chain = Chain()
        with self.assertRaisesRegex(CHECK.VerificationError, 'verification block changed'):
            CHECK.verify(chain.snap, chain, lambda _: setattr(chain, 'hash', word(999)))

    def test_rpc_errors_hide_credentials_and_use_an_explicit_user_agent(self):
        for response in ({'jsonrpc': '2.0', 'id': 1, 'error': {'message': 'secret'}},
                         {'jsonrpc': '2.0', 'id': 1, 'result': None}):
            with patch.object(CHECK.urllib.request, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())) as opened:
                with self.assertRaisesRegex(CHECK.VerificationError, '^RPC eth_getLogs failed$'):
                    CHECK.Rpc('https://secret.invalid')( 'eth_getLogs', [])
                self.assertIn('ArbiGameFi', opened.call_args.args[0].get_header('User-agent'))
        with patch.object(CHECK.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('https://secret.invalid', 403, 'secret', {}, None)):
            with self.assertRaisesRegex(CHECK.VerificationError, '^RPC eth_getCode failed$'):
                CHECK.Rpc('https://secret.invalid')('eth_getCode', [])

    def test_entrypoint_pins_existing_forge_check_and_hides_its_rpc_diagnostics(self):
        chain = Chain()
        real_run = subprocess.run
        commands = []

        def run(args, **kwargs):
            if args[0] != 'forge':
                return real_run(args, **kwargs)
            commands.append(args)
            return subprocess.CompletedProcess(args, 0, 'https://secret.invalid', '')

        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / 'snapshot.json'
            snapshot.write_text(json.dumps(chain.snap))
            chain.url = 'https://secret.invalid'
            with patch.dict(CHECK.os.environ, SNAPSHOT_PATH=str(snapshot), RPC_URL=chain.url), \
                    patch.object(CHECK, 'Rpc', return_value=chain), patch.object(CHECK.subprocess, 'run', side_effect=run), \
                    contextlib.redirect_stdout(io.StringIO()) as output:
                CHECK.main()
            self.assertEqual(commands[0][-2:], ['--fork-block-number', str(chain.end)])
            self.assertEqual(json.loads(output.getvalue())['status'], 'verified')
            self.assertNotIn('secret', output.getvalue())
            with patch.dict(CHECK.os.environ, SNAPSHOT_PATH=str(snapshot), RPC_URL=chain.url), \
                    patch.object(CHECK, 'Rpc', return_value=chain), \
                    patch.object(CHECK.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '', 'secret')):
                with self.assertRaisesRegex(CHECK.VerificationError, '^frozen-block governance verification failed$'):
                    CHECK.main()


if __name__ == '__main__':
    unittest.main()
