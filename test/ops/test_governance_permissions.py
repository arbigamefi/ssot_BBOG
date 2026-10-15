"""Complete authority and authorization history controls of a timelock-governed release; no Forge or network."""
import copy
import contextlib
import hashlib
import http.client
import math
import os
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


REGISTRY, HUB, TIMELOCK, REFERRAL = addr(1), addr(2), addr(3), addr(4)
SAFE, GUARDIAN, DEPLOYER = addr(5), addr(6), addr(7)
ASSET, BANK, VAULT = addr(20), addr(30), addr(50)
WIRING, ACTIVATION, OTHER = word(0xA1), word(0xA2), word(0xBAD)
ADMIN = '0x' + '0' * 64
PROPOSER, CANCELLER, EXECUTOR = (CHECK.signature(name) for name in ('PROPOSER_ROLE', 'CANCELLER_ROLE', 'EXECUTOR_ROLE'))


def value(item):
    return int(item, 16) if isinstance(item, str) else item


class Chain:
    """The JSON-RPC methods the verifier uses, over a D1 deployment history (ADR-0037 §9) in the release state:
    the timelock's construction at block 10, the governed contracts' at 11, the wiring scheduled at 20 and executed
    at 300. It also serves the certified token and VRF provider reads of verify_callback_provider.py
    (test_callback_provider.py)."""

    def __init__(self):
        self.start, self.end = 10, 1250
        self.snap = {'architectureVersion': 'v1.6-nft-liquidity', 'chainId': 84532, 'blockNumber': self.start,
                     'poolRegistry': REGISTRY, 'gameHub': HUB, 'governanceTimelock': TIMELOCK, 'refRegistry': REFERRAL,
                     'gov': SAFE, 'guardian': GUARDIAN, 'deployer': DEPLOYER, 'timelockMinDelay': 259200,
                     'wiringOperationId': WIRING, 'activationOperationId': ACTIVATION, 'numPools': 1,
                     'poolId_0': 1, 'poolDomain_0': 1, 'poolAsset_0': ASSET, 'poolBank_0': BANK, 'poolVault_0': VAULT}
        self.logs, self.values, self.requests = [], {}, []
        self.calls = self.retries = 0
        self.old_code = '0x'
        self.hash = word(123)
        self.fail_method = None
        for role, account in ((ADMIN, TIMELOCK), (PROPOSER, SAFE), (CANCELLER, SAFE), (EXECUTOR, addr(0)),
                              (CANCELLER, GUARDIAN)):
            self.add(TIMELOCK, 'RoleGranted(bytes32,address,address)', [role, account, DEPLOYER], block=10)
        self.add(TIMELOCK, 'MinDelayChange(uint256,uint256)', data=[0, 259200], block=10)
        for target in (REGISTRY, HUB, REFERRAL, BANK):
            self.add(target, 'GovernanceTransferred(address,address)', [0, TIMELOCK], block=11)
        self.schedule(WIRING, 3, block=20)
        self.execute(WIRING, 3, block=300)
        for target in (REGISTRY, HUB, BANK):
            self.add(target, 'SentinelSet(address)', [SAFE], block=300)
        self.add(BANK, 'GuardianSet(address)', [GUARDIAN], block=300)
        self.add(REGISTRY, 'PoolRegistered(uint64,address,address,uint8)', [1, ASSET, BANK], [1], block=300)
        self.add(REGISTRY, 'HubRegistered(address,bool)', [HUB], [1], block=300)
        self.add(REGISTRY, 'HubAllowedForPoolSet(uint64,address,bool)', [1, HUB], [1], block=300)
        for i, (name, key) in enumerate(CHECK.GAMES):
            self.snap.update({key: addr(60 + i), 'gameMaxBetCount_' + name: 25, 'gameCallbackGasLimit_' + name: 2447746})
            self.register_game(name, 60 + i, 25, 2447746)
        self.add(REGISTRY, 'PoolActiveSet(uint64,bool)', [1], [0], block=300)
        self.put(BANK, 'vault()', [], VAULT)
        self.put(BANK, 'asset()', [], ASSET)
        self.put(VAULT, 'bank()', [], BANK)
        self.put(VAULT, 'asset()', [], ASSET)
        self.put(REGISTRY, 'poolCount()', [], 1)
        self.put(REGISTRY, 'poolIdAt(uint256)', [0], 1)
        self.put(REGISTRY, 'domainFor(uint64)', [1], 1)
        self.put(REGISTRY, 'isRegisteredHub(address)', [HUB], 1)
        self.put(REGISTRY, 'isHubAllowedForPool(uint64,address)', [1, HUB], 1)
        self.put(TIMELOCK, 'isOperationDone(bytes32)', [WIRING], 1)
        # Certified token and VRF provider (first-callback certificate domain) and their live reads.
        code_hash = hashlib.sha256(bytes.fromhex('6000')).hexdigest()
        self.snap['vrfWrapper'] = addr(80)
        self.domain = {'chainId': 84532, 'consumerCallbackGasLimit': 2447746,
                       'token': {'proxy': ASSET, 'implementationSlot': word(7), 'implementation': addr(70),
                                 'proxyRuntimeSha256': code_hash, 'implementationRuntimeSha256': code_hash},
                       'providerReference': {'wrapper': addr(80), 'coordinator': addr(81),
                                             'wrapperOverheadGas': 13400, 'coordinatorMaxGas': 2500000}}
        self.storage = {(ASSET, word(7)): word(70)}
        self.put(addr(80), 's_vrfCoordinator()', [], 81)
        self.put_words(addr(80), 'getConfig()', [0, 0, 0, 0, 13400] + [0] * 7)
        self.put_words(addr(81), 's_config()', [0, 2500000] + [0] * 7)

    def put_words(self, target, name, values):
        self.values[(target, CHECK.signature(name)[:10])] = '0x' + ''.join(format(v, '064x') for v in values)

    def add(self, target, name, indexed=(), data=(), block=10):
        self.logs.append({'address': target, 'topics': [CHECK.signature(name)] + [word(value(i)) for i in indexed],
                          'data': '0x' + ''.join(format(w, '064x') for w in data), 'blockNumber': hex(block),
                          'transactionIndex': '0x0', 'logIndex': hex(len(self.logs)), 'removed': False})

    def schedule(self, op, calls, block):
        for index in range(calls):
            # target, value, offset of data, predecessor, delay, empty data
            self.add(TIMELOCK, 'CallScheduled(bytes32,uint256,address,uint256,bytes,bytes32,uint256)', [op, index],
                     [value(REGISTRY), 0, 160, 0, 259200, 0], block=block)

    def execute(self, op, calls, block):
        for index in range(calls):
            self.add(TIMELOCK, 'CallExecuted(bytes32,uint256,address,uint256,bytes)', [op, index],
                     [value(REGISTRY), 0, 96, 0], block=block)

    def register_game(self, name, module, rounds, gas, block=300):
        self.add(HUB, 'GameRegistered(bytes32,address,uint32,uint32)', [CHECK.signature(name), module], [rounds, gas],
                 block=block)

    def launch(self, block=700):
        self.schedule(ACTIVATION, 1, block=block - 100)
        self.execute(ACTIVATION, 1, block=block)
        self.add(REGISTRY, 'PoolActiveSet(uint64,bool)', [1], [1], block=block)
        self.put(REGISTRY, 'isPoolActive(uint64)', [1], 1)
        self.put(TIMELOCK, 'isOperationDone(bytes32)', [ACTIVATION], 1)

    def pend(self, op, ready=False, block=800):
        self.schedule(op, 1, block=block)
        self.put(TIMELOCK, 'getOperationState(bytes32)', [op], 2 if ready else 1)
        self.put(TIMELOCK, 'getTimestamp(bytes32)', [op], 1_800_000_000)

    def put(self, target, name, args, result):
        data = CHECK.signature(name)[:10] + ''.join(format(value(n), '064x') for n in args)
        self.values[(target, data)] = word(value(result))

    def __call__(self, method, params):
        self.calls += 1
        self.requests.append((method, copy.deepcopy(params)))
        if method == self.fail_method:
            raise CHECK.VerificationError('RPC ' + method + ' failed')
        if method == 'eth_chainId':
            return hex(self.snap['chainId'])
        if method == 'eth_getBlockByNumber':
            return {'number': hex(self.end), 'hash': self.hash}
        if method == 'eth_getCode':
            return self.old_code if int(params[1], 16) < self.start else '0x6000'
        if method == 'eth_getLogs':
            query = params[0]
            targets = query['address'] if isinstance(query['address'], list) else [query['address']]
            wanted = set(query['topics'][0])
            # Deliberately return unordered logs; replay must order them itself.
            return list(reversed([copy.deepcopy(row) for row in self.logs if row['address'] in targets
                                  and row['topics'][0] in wanted
                                  and int(query['fromBlock'], 16) <= int(row['blockNumber'], 16) <= int(query['toBlock'], 16)]))
        if method == 'eth_call':
            return self.values.get((params[0]['to'], params[0]['data']), word(0))
        if method == 'eth_getStorageAt':
            return self.storage.get((params[0], params[1]), word(0))
        raise AssertionError(method)


def verify(chain, mode='release', checkpoint=None):
    return CHECK.verify_permissions(chain, chain.snap, chain.end, checkpoint, mode)


class PermissionHistoryTests(unittest.TestCase):
    def reject(self, chain, reason, mode='release'):
        with self.assertRaisesRegex(CHECK.VerificationError, reason):
            verify(chain, mode)

    def test_release_state_freezes_calls_and_reads_every_contract_in_one_page_per_range(self):
        chain = Chain()
        blocks = []
        result = CHECK.verify(chain.snap, chain, blocks.append)
        self.assertEqual(blocks, [chain.end])
        self.assertEqual((result['blockHash'], result['mode'], result['launched'], result['notes']),
                         (chain.hash, 'release', False, []))
        pages = [params[0] for method, params in chain.requests if method == 'eth_getLogs']
        self.assertEqual(len(pages), math.ceil((chain.end - chain.start + 1) / CHECK.DEFAULT_PAGE_BLOCKS))
        for page in pages:
            self.assertEqual(sorted(page['address']), sorted([REGISTRY, HUB, TIMELOCK, REFERRAL, BANK]))
            self.assertLessEqual(int(page['toBlock'], 16) - int(page['fromBlock'], 16) + 1, 200)
        self.assertTrue(all(params[1] == hex(chain.end) for method, params in chain.requests if method == 'eth_call'))

    def test_timelock_roles_must_be_exactly_the_release_roles(self):
        verify(Chain())
        for account, role in ((addr(99), PROPOSER), (DEPLOYER, ADMIN), (SAFE, ADMIN), (addr(99), CANCELLER),
                              (DEPLOYER, EXECUTOR)):
            with self.subTest(account=account, role=role):
                chain = Chain()
                chain.add(TIMELOCK, 'RoleGranted(bytes32,address,address)', [role, account, TIMELOCK], block=900)
                self.reject(chain, 'timelock roles differ from release')
                self.reject(chain, 'timelock roles differ from release', 'live')
        chain = Chain()
        chain.add(TIMELOCK, 'RoleRevoked(bytes32,address,address)', [CANCELLER, GUARDIAN, TIMELOCK], block=900)
        self.reject(chain, 'timelock roles differ from release')
        # A grant revoked later leaves the release roles.
        chain = Chain()
        chain.add(TIMELOCK, 'RoleGranted(bytes32,address,address)', [PROPOSER, addr(99), TIMELOCK], block=900)
        chain.add(TIMELOCK, 'RoleRevoked(bytes32,address,address)', [PROPOSER, addr(99), TIMELOCK], block=901)
        verify(chain, 'live')
        chain = Chain()
        chain.add(TIMELOCK, 'RoleAdminChanged(bytes32,bytes32,bytes32)', [PROPOSER, ADMIN, CANCELLER], block=900)
        self.reject(chain, 'timelock role administration changed')

    def test_the_delay_is_set_once_at_construction(self):
        chain = Chain()
        chain.add(TIMELOCK, 'MinDelayChange(uint256,uint256)', data=[259200, 345600], block=900)
        self.reject(chain, 'timelock delay history differs from release')
        self.reject(chain, 'timelock delay history differs from release', 'live')
        chain = Chain()
        chain.snap['timelockMinDelay'] = 0
        self.reject(chain, 'timelock delay differs from the release delay')

    def test_governance_is_the_timelock_from_construction_and_never_transferred(self):
        chain = Chain()
        chain.add(BANK, 'GovernanceTransferStarted(address,address)', [TIMELOCK, addr(99)], block=900)
        self.reject(chain, 'a governance transfer was started')
        self.reject(chain, 'a governance transfer was started', 'live')
        chain = Chain()
        chain.logs = [row for row in chain.logs if not (row['address'] == HUB and row['blockNumber'] == hex(11))]
        self.reject(chain, 'governance history differs from release')

    def test_sentinel_and_guardian_are_set_once_in_the_release_state(self):
        chain = Chain()
        chain.add(HUB, 'SentinelSet(address)', [SAFE], block=900)
        self.reject(chain, 'sentinel history differs from release')
        verify(chain, 'live')
        chain = Chain()
        chain.add(BANK, 'SentinelSet(address)', [addr(99)], block=900)
        self.reject(chain, 'sentinel is not the Safe', 'live')
        chain = Chain()
        chain.add(BANK, 'GuardianSet(address)', [GUARDIAN], block=900)
        self.reject(chain, 'guardian history differs from release')
        verify(chain, 'live')
        chain = Chain()
        chain.add(BANK, 'GuardianSet(address)', [addr(99)], block=900)
        self.reject(chain, 'Bank guardian differs from release', 'live')

    def test_the_release_state_executed_only_the_wiring(self):
        chain = Chain()
        chain.logs = [row for row in chain.logs if row['topics'][0] != CHECK.signature(
            'CallExecuted(bytes32,uint256,address,uint256,bytes)')]
        self.reject(chain, 'wiring operation not executed')
        self.reject(chain, 'wiring operation not executed', 'live')
        # P6: an operation the release does not declare.
        chain = Chain()
        chain.schedule(OTHER, 1, block=400)
        chain.execute(OTHER, 1, block=700)
        chain.put(TIMELOCK, 'isOperationDone(bytes32)', [OTHER], 1)
        self.reject(chain, 'an operation outside the release executed')
        _, _, notes = verify(chain, 'live')
        self.assertEqual(notes, [f'undeclared operation {OTHER} executed'])
        chain = Chain()
        chain.pend(OTHER)
        self.reject(chain, 'an operation outside the release is pending')
        _, _, notes = verify(chain, 'live')
        self.assertEqual(notes, [f'undeclared operation {OTHER} pending, waiting from 1800000000'])
        # The activation may wait; a cancelled operation leaves nothing behind.
        chain = Chain()
        chain.pend(ACTIVATION, ready=True)
        chain.schedule(OTHER, 1, block=850)
        chain.add(TIMELOCK, 'Cancelled(bytes32)', [OTHER], block=860)
        _, launched, notes = verify(chain)
        self.assertFalse(launched)
        self.assertEqual(notes, [f'activation {ACTIVATION} pending, ready from 1800000000', f'operation {OTHER} cancelled'])
        # The timelock must agree with the replayed operations.
        chain.put(TIMELOCK, 'getOperationState(bytes32)', [ACTIVATION], 0)
        self.reject(chain, 'pending operation differs from the timelock')
        chain = Chain()
        chain.put(TIMELOCK, 'isOperationDone(bytes32)', [WIRING], 0)
        self.reject(chain, 'executed operation differs from the timelock')

    def test_operation_events_must_follow_the_timelock_order(self):
        chain = Chain()
        chain.execute(OTHER, 1, block=900)
        self.reject(chain, 'execution of an operation that was not scheduled')
        chain = Chain()
        chain.schedule(WIRING, 1, block=900)
        self.reject(chain, 'operation scheduled twice')
        chain = Chain()
        chain.add(TIMELOCK, 'Cancelled(bytes32)', [OTHER], block=900)
        self.reject(chain, 'cancellation of an operation that was not pending')
        # A cancelled operation may be scheduled again.
        chain = Chain()
        chain.schedule(OTHER, 1, block=400)
        chain.add(TIMELOCK, 'Cancelled(bytes32)', [OTHER], block=410)
        chain.pend(OTHER, block=420)
        self.reject(chain, 'an operation outside the release is pending')

    def test_pools_open_only_with_the_release_activation(self):
        chain = Chain()
        chain.add(REGISTRY, 'PoolActiveSet(uint64,bool)', [1], [1], block=900)
        chain.put(REGISTRY, 'isPoolActive(uint64)', [1], 1)
        self.reject(chain, 'pool active before the release activation')
        self.reject(chain, 'pool active without the release activation', 'live')
        chain = Chain()
        chain.launch()
        self.reject(chain, 'activation executed: the release state is pre-launch')
        _, launched, notes = verify(chain, 'live')
        self.assertEqual((launched, notes), (True, []))
        # The sentinel may close the pool again after launch.
        chain.add(REGISTRY, 'PoolActiveSet(uint64,bool)', [1], [0], block=900)
        chain.put(REGISTRY, 'isPoolActive(uint64)', [1], 0)
        _, _, notes = verify(chain, 'live')
        self.assertEqual(notes, ['pool 1 inactive'])
        chain.put(REGISTRY, 'isPoolActive(uint64)', [1], 1)
        self.reject(chain, 'pool activity differs from history', 'live')

    def test_hub_and_routes_are_the_release_set_or_a_reduction_of_it(self):
        chain = Chain()
        chain.add(REGISTRY, 'HubRegistered(address,bool)', [addr(99)], [1], block=900)
        self.reject(chain, 'registered hub set differs from release')
        self.reject(chain, 'registered hub set differs from release', 'live')
        chain = Chain()
        chain.add(REGISTRY, 'HubRegistered(address,bool)', [addr(99)], [1], block=400)
        chain.add(REGISTRY, 'HubAllowedForPoolSet(uint64,address,bool)', [1, addr(99)], [1], block=400)
        chain.add(REGISTRY, 'HubRegistered(address,bool)', [addr(99)], [0], block=600)
        chain.put(REGISTRY, 'isHubAllowedForPool(uint64,address)', [1, addr(99)], 1)
        self.reject(chain, 'hub/pool authorization set differs from release', 'live')
        # The sentinel's deregistration and route closure: refused in the release state, reported live.
        chain = Chain()
        chain.add(REGISTRY, 'HubAllowedForPoolSet(uint64,address,bool)', [1, HUB], [0], block=900)
        chain.add(REGISTRY, 'HubRegistered(address,bool)', [HUB], [0], block=901)
        chain.put(REGISTRY, 'isHubAllowedForPool(uint64,address)', [1, HUB], 0)
        chain.put(REGISTRY, 'isRegisteredHub(address)', [HUB], 0)
        self.reject(chain, 'registered hub set differs from release')
        _, _, notes = verify(chain, 'live')
        self.assertEqual(notes, [f'hub {HUB} deregistered', 'route pool 1 closed'])
        chain.put(REGISTRY, 'isRegisteredHub(address)', [HUB], 1)
        self.reject(chain, 'hub mapping differs from history', 'live')

    def test_game_registrations_must_equal_the_certified_set(self):
        extra = Chain()
        extra.register_game('UNCERTIFIED', 99, 25, 2447746, block=900)
        self.reject(extra, 'registered game set differs from release')
        self.reject(extra, 'registered game set differs from release', 'live')
        for change in ({'gameMaxBetCount_KENO': 24}, {'gameCallbackGasLimit_DICE': 2447745}, {'moduleSlots': addr(98)}):
            chain = Chain()
            chain.snap.update(change)
            self.reject(chain, 'registered game set differs from release')
        missing = Chain()
        missing.logs = [row for row in missing.logs if row['topics'][0] != CHECK.signature(
            'GameRegistered(bytes32,address,uint32,uint32)')]
        self.reject(missing, 'registered game set differs from release')
        duplicate = Chain()
        duplicate.register_game('KENO', 63, 25, 2447746, block=901)
        self.reject(duplicate, 'duplicate game registration')
        shared = Chain()
        shared.snap['moduleSlots'] = shared.snap['moduleDice']
        self.reject(shared, 'a module is registered under more than one game')

    def test_disabled_games_void_windows_and_pauses_are_live_reductions(self):
        dice = CHECK.signature('DICE')
        for name, indexed, data, reason, note, view in (
                ('GameDisabled(bytes32,address)', [dice, SAFE], [], 'game disabled in the release state',
                 f'game {dice} disabled', (HUB, 'gameDisabled(bytes32)', [dice])),
                ('VoidWindowOpened(uint64,address,uint64,address)', [1, BANK, GUARDIAN], [1_800_000_000],
                 'void window opened in the release state', 'void window opened for pool 1 through 1800000000', None),
                ('RiskInPausedSet(bool,address)', [GUARDIAN], [1], 'Bank pause history in the release state',
                 f'Bank {BANK} paused', (BANK, 'paused()', []))):
            with self.subTest(event=name):
                chain = Chain()
                chain.add(HUB if 'Game' in name or 'Void' in name else BANK, name, indexed, data, block=900)
                if view:
                    chain.put(view[0], view[1], view[2], 1)
                self.reject(chain, reason)
                _, _, notes = verify(chain, 'live')
                self.assertEqual(notes, [note])
                if view:
                    chain.put(view[0], view[1], view[2], 0)
                    self.reject(chain, 'differs from history', 'live')

    def test_immutable_bank_vault_and_asset_bindings_are_required(self):
        for target, method in ((BANK, 'vault()'), (BANK, 'asset()'), (VAULT, 'bank()'), (VAULT, 'asset()')):
            with self.subTest(target=target, method=method):
                chain = Chain()
                chain.put(target, method, [], 99)
                self.reject(chain, 'differs from release')
        chain = Chain()
        chain.snap['poolVault_0'] = addr(0)
        self.reject(chain, 'invalid or duplicate Vault binding')

    def test_no_creation_coverage_archive_failure_and_log_failure_reject(self):
        chain = Chain()
        chain.old_code = '0x6000'
        self.reject(chain, 'starts after contract creation')
        for method in ('eth_getCode', 'eth_getLogs', 'eth_call'):
            chain = Chain()
            chain.fail_method = method
            self.reject(chain, 'RPC ' + method + ' failed')

    def test_omitted_expected_event_and_malformed_unexpected_or_duplicate_logs_reject(self):
        chain = Chain()
        chain.logs = [row for row in chain.logs if row['topics'][0] != CHECK.signature('HubRegistered(address,bool)')]
        self.reject(chain, 'registered hub set')
        chain = Chain()
        chain.logs.append(chain.logs[0])
        self.reject(chain, 'duplicate authorization log')
        chain = Chain()
        chain.logs[0]['removed'] = True
        self.reject(chain, 'removed authorization log')
        # A role event from a governed contract is not one it was asked for.
        chain = Chain()
        chain.add(REGISTRY, 'RoleGranted(bytes32,address,address)', [PROPOSER, addr(99), TIMELOCK], block=900)
        self.reject(chain, 'unexpected authorization log')
        chain = Chain()
        chain.logs[-1]['topics'].append(word(1))
        self.reject(chain, 'invalid authorization event topics')

    def test_only_casino_pools_and_no_additional_pool(self):
        chain = Chain()
        chain.snap['poolDomain_0'] = 2
        self.reject(chain, 'not a casino pool')
        chain = Chain()
        chain.add(REGISTRY, 'PoolRegistered(uint64,address,address,uint8)', [2, 22, 32], [1], block=900)
        self.reject(chain, 'pool history differs')

    def test_final_block_reorg_rejects_after_existing_governance_check(self):
        chain = Chain()
        with self.assertRaisesRegex(CHECK.VerificationError, 'verification block changed'):
            CHECK.verify(chain.snap, chain, lambda _: setattr(chain, 'hash', word(999)))

    def test_rpc_errors_hide_credentials_and_use_an_explicit_user_agent(self):
        for response, detail in (({'jsonrpc': '2.0', 'id': 1, 'error': {'message': 'secret'}}, 'JSON-RPC error None'),
                                 ({'jsonrpc': '2.0', 'id': 1, 'result': None}, 'empty JSON-RPC result')):
            with patch.object(CHECK.urllib.request, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())) as opened:
                with self.assertRaisesRegex(CHECK.VerificationError, rf'^RPC eth_getLogs failed: {detail} after 1 attempt\(s\)$'):
                    CHECK.Rpc('https://secret.invalid')('eth_getLogs', [])
                self.assertIn('ArbiGameFi', opened.call_args.args[0].get_header('User-agent'))
        with patch.object(CHECK.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('https://secret.invalid', 403, 'secret', {}, None)):
            with self.assertRaisesRegex(CHECK.VerificationError, r'^RPC eth_getCode failed: HTTP 403 after 1 attempt\(s\)$'):
                CHECK.Rpc('https://secret.invalid')('eth_getCode', [])

    def test_only_an_explicit_null_result_is_an_empty_result(self):
        # A null result says the node has no such block; a response with neither result nor error is invalid.
        for response, empty in (({'jsonrpc': '2.0', 'id': 1, 'result': None}, True), ({'jsonrpc': '2.0', 'id': 1}, False)):
            with patch.object(CHECK.urllib.request, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
                with self.assertRaisesRegex(CHECK.VerificationError,
                                            r'^RPC eth_getBlockByNumber failed: empty JSON-RPC result after 1 attempt\(s\)$') as raised:
                    CHECK.Rpc('https://secret.invalid')('eth_getBlockByNumber', ['0x1', False])
            self.assertIs(isinstance(raised.exception, CHECK.EmptyResult), empty, response)

    def test_entrypoint_pins_existing_forge_check_passes_the_mode_and_hides_its_rpc_diagnostics(self):
        chain = Chain()
        real_run = subprocess.run
        commands = []

        def run(args, **kwargs):
            if args[0] != 'forge':
                return real_run(args, **kwargs)
            commands.append((args, kwargs['env']['GOVERNANCE_VERIFY_MODE']))
            return subprocess.CompletedProcess(args, 0, 'https://secret.invalid', '')

        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / 'snapshot.json'
            snapshot.write_text(json.dumps(chain.snap))
            chain.url = 'https://secret.invalid'
            for mode in ('release', 'live'):
                commands.clear()
                with patch.dict(CHECK.os.environ, SNAPSHOT_PATH=str(snapshot), RPC_URL=chain.url,
                                GOVERNANCE_VERIFY_MODE=mode), \
                        patch.object(CHECK, 'Rpc', return_value=chain), patch.object(CHECK.subprocess, 'run', side_effect=run), \
                        contextlib.redirect_stdout(io.StringIO()) as output:
                    CHECK.main()
                self.assertEqual(commands[0][0][-2:], ['--fork-block-number', str(chain.end)])
                self.assertEqual(commands[0][1], mode)
                printed = json.loads(output.getvalue())
                self.assertEqual((printed['status'], printed['mode']), ('verified', mode))
                self.assertNotIn('secret', output.getvalue())
            with patch.dict(CHECK.os.environ, SNAPSHOT_PATH=str(snapshot), RPC_URL=chain.url, GOVERNANCE_VERIFY_MODE='lax'):
                with self.assertRaisesRegex(CHECK.VerificationError, 'GOVERNANCE_VERIFY_MODE must be release or live'):
                    CHECK.main()
            with patch.dict(CHECK.os.environ, SNAPSHOT_PATH=str(snapshot), RPC_URL=chain.url, GOVERNANCE_VERIFY_MODE='release'), \
                    patch.object(CHECK, 'Rpc', return_value=chain), \
                    patch.object(CHECK.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '', 'secret')):
                with self.assertRaisesRegex(CHECK.VerificationError, '^frozen-block governance verification failed$'):
                    CHECK.main()
            # A dropped fork connection is named as such, still without the URL, so the release script may retry it.
            for diagnostic in ('Error: could not instantiate forked environment with provider secret.invalid',
                               'error sending request for url (https://secret.invalid/v3/key): tls handshake eof',
                               'HTTP error 429 with body: secret'):
                failed = subprocess.CompletedProcess([], 1, '', diagnostic)
                with self.subTest(diagnostic=diagnostic), \
                        patch.dict(CHECK.os.environ, SNAPSHOT_PATH=str(snapshot), RPC_URL=chain.url,
                                   GOVERNANCE_VERIFY_MODE='release'), \
                        patch.object(CHECK, 'Rpc', return_value=chain), patch.object(CHECK.subprocess, 'run', return_value=failed):
                    with self.assertRaisesRegex(CHECK.VerificationError,
                                                r'^frozen-block governance verification failed \(RPC transport error\)$'):
                        CHECK.main()


def reply(result):
    return io.BytesIO(json.dumps({'jsonrpc': '2.0', 'id': 1, 'result': result}).encode())


def http_error(code):
    return urllib.error.HTTPError('https://secret.invalid/v3/key', code, 'secret body', {}, None)


class RpcRetryTests(unittest.TestCase):
    """Bounded backoff on transient provider failures; final failures stop at once; nothing leaks the URL."""

    def run_rpc(self, outcomes, attempts=6, backoff=1.0):
        sleeps = []
        rpc = CHECK.Rpc('https://secret.invalid/v3/key', attempts=attempts, backoff=backoff, sleep=sleeps.append)
        with patch.object(CHECK.urllib.request, 'urlopen', side_effect=outcomes):
            try:
                return rpc('eth_getLogs', []), sleeps, rpc, None
            except CHECK.VerificationError as error:
                self.assertNotIn('secret', str(error))
                return None, sleeps, rpc, str(error)

    def test_transient_failures_are_retried_with_backoff(self):
        transient = [http_error(429), http_error(503), urllib.error.URLError('reset'), TimeoutError(),
                     http.client.IncompleteRead(b''), io.BytesIO(json.dumps({'jsonrpc': '2.0', 'id': 1,
                                                                               'error': {'code': -32005}}).encode())]
        for failure in transient:
            with self.subTest(failure=type(failure).__name__):
                result, sleeps, rpc, error = self.run_rpc([failure, reply(['ok'])])
                self.assertIsNone(error)
                self.assertEqual((result, sleeps, rpc.calls, rpc.retries), (['ok'], [1.0], 2, 1))

    def test_persistent_transient_failure_stops_after_the_attempt_limit(self):
        for code in (429, 503, 599, 502):
            with self.subTest(code=code):
                _, sleeps, rpc, error = self.run_rpc([http_error(code)] * 6)
                self.assertEqual(error, f'RPC eth_getLogs failed: HTTP {code} after 6 attempt(s)')
                self.assertEqual((sleeps, rpc.calls), ([1.0, 2.0, 4.0, 8.0, 16.0], 6))

    def test_final_failures_are_not_retried(self):
        final = {413: 'HTTP 413', 403: 'HTTP 403', 400: 'HTTP 400'}
        for code, detail in final.items():
            with self.subTest(code=code):
                _, sleeps, _, error = self.run_rpc([http_error(code)])
                self.assertEqual((error, sleeps), (f'RPC eth_getLogs failed: {detail} after 1 attempt(s)', []))
        invalid_params = io.BytesIO(json.dumps({'jsonrpc': '2.0', 'id': 1, 'error': {'code': -32602, 'message': 'secret'}}).encode())
        _, sleeps, _, error = self.run_rpc([invalid_params])
        self.assertEqual((error, sleeps), ('RPC eth_getLogs failed: JSON-RPC error -32602 after 1 attempt(s)', []))

    def test_backoff_is_capped(self):
        _, sleeps, _, _ = self.run_rpc([http_error(429)] * 6, backoff=10)
        self.assertEqual(sleeps, [10, 20, 30, 30, 30])

    def test_the_operator_endpoint_sets_the_page_size(self):
        wrapper = {'OPS_RPC_URL': 'https://ops.invalid', 'RPC_URL': 'https://ops.invalid'}
        for provider, size in (('infura', 10_000), ('alchemy', 10), ('other', CHECK.DEFAULT_PAGE_BLOCKS)):
            with self.subTest(provider=provider), patch.dict(os.environ, {**wrapper, 'OPS_RPC_PROVIDER': provider}):
                os.environ.pop('GOVERNANCE_LOG_PAGE_BLOCKS', None)
                self.assertEqual(CHECK.page_blocks(), size)
        with patch.dict(os.environ, {**wrapper, 'OPS_RPC_PROVIDER': 'infura', 'RPC_URL': 'https://sepolia.base.org'}):
            os.environ.pop('GOVERNANCE_LOG_PAGE_BLOCKS', None)
            self.assertEqual(CHECK.page_blocks(), CHECK.DEFAULT_PAGE_BLOCKS)  # another endpoint than the wrapper's
        with patch.dict(os.environ, {**wrapper, 'OPS_RPC_PROVIDER': 'infura', 'GOVERNANCE_LOG_PAGE_BLOCKS': '50'}):
            self.assertEqual(CHECK.page_blocks(), 50)

    def test_last_block_at_or_before_with_whole_second_timestamps(self):
        # Before Base Denim one block every 2 seconds; since, five blocks share each second.
        for ms in (2000, 200):
            times = [1_000 + number * ms // 1000 for number in range(400)]
            for target in range(990, times[-1] + 2):
                expected = max([n for n in range(10, 400) if times[n] <= target], default=9)
                for guess in (1, 7, 125, 1_000):
                    with self.subTest(ms=ms, target=target, guess=guess):
                        self.assertEqual(CHECK.last_block_at_or_before(times.__getitem__, target, 399, 10, guess),
                                         expected)

    def test_page_size_comes_from_the_environment_within_bounds(self):
        for value_ in ('0', '10001', 'abc', '-5'):
            with self.subTest(value=value_), patch.dict(os.environ, GOVERNANCE_LOG_PAGE_BLOCKS=value_):
                with self.assertRaisesRegex(CHECK.VerificationError, 'GOVERNANCE_LOG_PAGE_BLOCKS'):
                    CHECK.page_blocks()
        chain = Chain()
        with patch.dict(os.environ, GOVERNANCE_LOG_PAGE_BLOCKS='50'):
            verify(chain)
        pages = [params[0] for method, params in chain.requests if method == 'eth_getLogs']
        self.assertTrue(all(int(p['toBlock'], 16) - int(p['fromBlock'], 16) + 1 <= 50 for p in pages))


class CheckpointTests(unittest.TestCase):
    """A signed checkpoint lets a later run replay only the blocks after it, with the same result."""

    def checkpoint(self, chain=None):
        chain = chain or Chain()
        result = CHECK.verify(chain.snap, chain, lambda _: None)
        self.assertEqual(result['checkpointSha256'], CHECK.checkpoint_digest(result['checkpoint']))
        return chain, result['checkpoint']

    def test_the_encoded_state_round_trips(self):
        chain = Chain()
        chain.pend(ACTIVATION)
        chain.schedule(OTHER, 1, block=850)
        chain.add(TIMELOCK, 'Cancelled(bytes32)', [OTHER], block=860)
        _, document = self.checkpoint(chain)
        self.assertEqual(CHECK.encode_state(CHECK.decode_state(document['state'])), document['state'])
        self.assertEqual(document['state']['operations'][WIRING], {'calls': 3, 'state': 'executed'})
        self.assertEqual(document['state']['minDelayChanges'], [[0, 259200]])

    def test_incremental_replay_reads_only_later_blocks_and_matches_full_replay(self):
        chain, document = self.checkpoint()
        chain.end, chain.requests = 1900, []
        chain.launch(block=1500)
        incremental = CHECK.verify(chain.snap, chain, lambda _: None, document, 'live')
        pages = [params[0] for method, params in chain.requests if method == 'eth_getLogs']
        self.assertTrue(pages and min(int(p['fromBlock'], 16) for p in pages) == document['blockNumber'] + 1)
        self.assertEqual((incremental['replayedFrom'], incremental['launched']), (document['blockNumber'] + 1, True))
        full = CHECK.verify(chain.snap, chain, lambda _: None, None, 'live')
        self.assertEqual(incremental['checkpoint'], full['checkpoint'])

    def test_later_changes_are_still_detected(self):
        chain, document = self.checkpoint()
        chain.end = 1900
        chain.add(REGISTRY, 'HubRegistered(address,bool)', [addr(99)], [1], block=1600)
        with self.assertRaisesRegex(CHECK.VerificationError, 'registered hub set'):
            CHECK.verify(chain.snap, chain, lambda _: None, document)
        chain, document = self.checkpoint()
        chain.end = 1900
        chain.register_game('KENO', 63, 25, 2447746, block=1700)
        with self.assertRaisesRegex(CHECK.VerificationError, 'duplicate game registration'):
            CHECK.verify(chain.snap, chain, lambda _: None, document)
        chain, document = self.checkpoint()
        chain.end = 1900
        chain.add(TIMELOCK, 'RoleGranted(bytes32,address,address)', [PROPOSER, addr(99), TIMELOCK], block=1800)
        with self.assertRaisesRegex(CHECK.VerificationError, 'timelock roles differ'):
            CHECK.verify(chain.snap, chain, lambda _: None, document, 'live')

    def test_checkpoint_must_be_signed_on_chain_and_for_this_release(self):
        chain, document = self.checkpoint()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'checkpoint.json'
            path.write_text(json.dumps(document))
            digest = CHECK.checkpoint_digest(document)
            self.assertEqual(CHECK.load_checkpoint(path, digest), document)
            self.assertEqual(CHECK.load_checkpoint(path, '0x' + digest), document)
            for expected in (None, '', 'f' * 64):
                with self.assertRaises(CHECK.VerificationError):
                    CHECK.load_checkpoint(path, expected)
        moved = Chain()
        moved.hash = word(777)
        with self.assertRaisesRegex(CHECK.VerificationError, 'not on this chain'):
            verify(moved, checkpoint=document)
        for key, other in (('poolRegistry', addr(9)), ('governanceTimelock', addr(8))):
            with self.subTest(key=key):
                elsewhere = Chain()
                elsewhere.snap[key] = other
                with self.assertRaisesRegex(CHECK.VerificationError, 'another release'):
                    verify(elsewhere, checkpoint=document)
        tampered = copy.deepcopy(document)
        tampered['state']['registeredHubs'][addr(99)] = True
        with self.assertRaisesRegex(CHECK.VerificationError, 'registered hub set'):
            verify(Chain(), checkpoint=tampered)
        tampered = copy.deepcopy(document)
        tampered['state']['operations'][WIRING]['state'] = 'scheduled'
        with self.assertRaisesRegex(CHECK.VerificationError, 'wiring operation not executed'):
            verify(Chain(), checkpoint=tampered)

    def test_entrypoint_writes_the_next_checkpoint_and_prints_only_its_digest(self):
        chain = Chain()
        with tempfile.TemporaryDirectory() as directory:
            snapshot, out = Path(directory) / 'snapshot.json', Path(directory) / 'checkpoint.json'
            snapshot.write_text(json.dumps(chain.snap))
            chain.url = 'https://secret.invalid'
            env = {'SNAPSHOT_PATH': str(snapshot), 'RPC_URL': chain.url, 'GOVERNANCE_CHECKPOINT_OUT': str(out),
                   'GOVERNANCE_VERIFY_MODE': 'release'}
            with patch.dict(CHECK.os.environ, env), patch.object(CHECK, 'Rpc', return_value=chain), \
                    patch.object(CHECK.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '', '')), \
                    contextlib.redirect_stdout(io.StringIO()) as output, contextlib.redirect_stderr(io.StringIO()):
                CHECK.main()
            printed = json.loads(output.getvalue())
            self.assertNotIn('checkpoint', printed)
            self.assertEqual(printed['checkpointSha256'], CHECK.checkpoint_digest(json.loads(out.read_text())))


if __name__ == '__main__':
    unittest.main()
