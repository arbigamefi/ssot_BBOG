"""K0-4 configuration drift monitor: timelock operations and their admission review, live release verification,
event classification, certified-domain and capacity checks, cursor and alert-state discipline, delivery and secret
hygiene, against an in-process JSON-RPC model of a timelock-governed release (no network)."""
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import re
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('config_drift_monitor', ROOT / 'script/ops/config-drift-monitor.py')
MON = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MON)
VG = sys.modules['verify_governance']
signature = MON.signature

CHAIN, SNAP_BLOCK, CREATED, CHECKPOINT_BLOCK = 84532, 100, 101, 160
NOW = 1_800_000_000
DELAY = 259_200
GAS, ROUNDS = 2_447_746, 25


def addr(n):
    # Realistic 160-bit addresses, so that no address passes for a small number.
    return '0xa5' + format(n, '038x')


def value(item):
    return int(item, 16) if isinstance(item, str) else item


def word(item):
    return '0x' + format(value(item), '064x')


def encode(fn, *args):
    return signature(fn)[:10] + ''.join(format(value(a), '064x') for a in args)


def game_id(name):
    return int(signature(name), 16)


def keccak_hex(data):
    return subprocess.check_output(['cast', 'keccak', data], text=True).strip().lower()


TIMELOCK, REGISTRY, HUB, REFERRAL, ROUTER, VRFHUB, ENGINE = (addr(0x100 + i) for i in range(7))
SAFE, GUARDIAN, DEPLOYER, KEEPER, TREASURY, SIGNER = (addr(0x150 + i) for i in range(6))
WRAPPER, COORDINATOR, TOKEN, IMPL = (addr(0x200 + i) for i in range(4))
BANK, VAULT = addr(0x300), addr(0x301)
BANK2, VAULT2, HUB2, MODULE2, STRANGER = addr(0x310), addr(0x311), addr(0x320), addr(0x330), addr(0x999)
MODULES = {key: addr(0x400 + i) for i, (_, key) in enumerate(MON.GAMES)}
MODULE_CODE = {key: '0x60' + format(0x10 + i, '02x') + '5b' * 40 for i, (_, key) in enumerate(MON.GAMES)}
WIRING, ACTIVATION, OTHER, THIRD = ('0x' + byte * 32 for byte in ('a1', 'a2', 'b0', 'b1'))
SCHEDULE_TX, WIRING_TX = word(0x5c4ed110), word(0xe8ec150)
IMPL_SLOT = '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3'
ADMIN = '0x' + '0' * 64
PROPOSER, CANCELLER, EXECUTOR = (signature(name) for name in ('PROPOSER_ROLE', 'CANCELLER_ROLE', 'EXECUTOR_ROLE'))
OPS_HOOK = 'https://hooks.example.invalid/OPS-SECRET-WEBHOOK'
PUBLIC_HOOK = 'https://hooks.example.invalid/PUBLIC-SECRET-WEBHOOK'

# Synthetic certified runtimes with immutables at fixed offsets, as gen_certified_runtimes.py records them.
LAYOUT = {
    'Bank': (300, (('poolAsset', (10, 210)), ('poolVault', (50,)), ('poolAssetDecimals', (90,)),
                   ('poolAsset', (130,)), ('poolVault', (170, 250)))),
    'LiquidityVault': (200, (('poolAsset', (10, 100)), ('poolBank', (50, 150)))),
    'GameHub': (400, (('settlementRouter', (10, 300)), ('vrfHub', (50,)), ('refRegistry', (90,)),
                      ('refEngine', (130,)))),
    'GovernanceTimelock': (96, ()), 'PoolRegistry': (97, ()), 'ReferralRegistry': (98, ()),
}


def runtime(name, **immutables):
    """The certified runtime `name` with its immutables set (unset ones are zero)."""
    size, items = LAYOUT[name]
    seed = sum(name.encode())
    code = bytearray((seed + 7 * i) % 251 + 1 for i in range(size))
    for immutable, offsets in items:
        for at in offsets:
            code[at:at + 32] = value(immutables.get(immutable, 0)).to_bytes(32, 'big')
    return '0x' + code.hex()


def tamper(code, at=5):
    data = bytearray.fromhex(code[2:])
    data[at] ^= 0xff
    return '0x' + data.hex()


BANK_CODE = runtime('Bank', poolAsset=TOKEN, poolVault=VAULT, poolAssetDecimals=6)
VAULT_CODE = runtime('LiquidityVault', poolAsset=TOKEN, poolBank=BANK)
HUB_CODE = runtime('GameHub', settlementRouter=ROUTER, vrfHub=VRFHUB, refRegistry=REFERRAL, refEngine=ENGINE)
_DOMAIN = {}


def domain_file():
    """The 84532 domain file with the fixture's token, provider, modules and certified runtimes."""
    if not _DOMAIN:
        domain = json.loads((ROOT / 'script/release/first-callback-domain-84532.json').read_text())
        domain['token'].update(proxy=TOKEN, implementation=IMPL, implementationSlot=IMPL_SLOT,
                               proxyRuntimeSha256=hashlib.sha256(bytes.fromhex('6001')).hexdigest(),
                               implementationRuntimeSha256=hashlib.sha256(bytes.fromhex('6002')).hexdigest())
        domain['providerReference'].update(wrapper=WRAPPER, coordinator=COORDINATOR)
        domain['moduleCodeHashes'] = {key: keccak_hex(code) for key, code in MODULE_CODE.items()}
        domain['coreRuntimes'] = {
            name: {'artifact': f'{name}.sol:{name}', 'runtimeBytes': size, 'keccakWithImmutablesZeroed': keccak_hex(
                runtime(name)), 'immutables': [{'value': v, 'offsets': list(o)} for v, o in items]}
            for name, (size, items) in LAYOUT.items()}
        _DOMAIN.update(domain)
    return copy.deepcopy(_DOMAIN)


def snapshot():
    snap = {'architectureVersion': 'v1.6-nft-liquidity', 'chainId': CHAIN, 'blockNumber': SNAP_BLOCK, 'timestamp': 1,
            'governanceTimelock': TIMELOCK, 'timelockMinDelay': DELAY, 'poolRegistry': REGISTRY, 'gameHub': HUB,
            'refRegistry': REFERRAL, 'refEngine': ENGINE, 'settlementRouter': ROUTER, 'vrfHub': VRFHUB,
            'vrfWrapper': WRAPPER, 'gov': SAFE, 'guardian': GUARDIAN, 'deployer': DEPLOYER, 'keeper': KEEPER,
            'treasury': TREASURY, 'releaseSigner': SIGNER, 'wiringOperationId': WIRING,
            'activationOperationId': ACTIVATION, 'refundTimeoutSeconds': 3600, 'defaultHouseEdgeBps': 200,
            'refL0Bps': 1000, 'refL1Bps': 500, 'refL2Bps': 250, 'refHoldbackBps': 2000, 'numPools': 1, 'poolId_0': 1,
            'poolDomain_0': 1, 'poolAsset_0': TOKEN, 'poolBank_0': BANK, 'poolVault_0': VAULT, 'poolAssetDecimals_0': 6,
            'poolBankMinBetAmount_0': 10_000, 'poolBankRiskReserveBps_0': 6000, 'poolBankWithdrawalBufferBps_0': 1000,
            'poolBankMinTurnoverForUnlock_0': 20_000_000, 'poolBankHoldbackVestingSeconds_0': 86_400, **MODULES}
    for name, _ in MON.GAMES:
        snap['gameMaxBetCount_' + name], snap['gameCallbackGasLimit_' + name] = ROUNDS, GAS
    return snap


def wiring_calls():
    """The release wiring batch, in the order V16Batches.wiring builds it for the fixture snapshot."""
    calls = [(REFERRAL, encode('setBinderOnce(address)', HUB)),
             (BANK, encode('setSettlementRouterOnce(address)', ROUTER)),
             (BANK, encode('setRandomnessConsumerOnce(address)', VRFHUB)),
             (BANK, encode('setGuardian(address)', GUARDIAN)),
             (REGISTRY, encode('setSentinel(address)', SAFE)), (HUB, encode('setSentinel(address)', SAFE)),
             (BANK, encode('setSentinel(address)', SAFE)),
             (BANK, encode('setWithdrawalBufferBps(uint256)', 1000)),
             (BANK, encode('setMinPlayerTurnoverForUnlock(uint256)', 20_000_000)),
             (BANK, encode('setHoldbackVestingSeconds(uint256)', 86_400)),
             (REGISTRY, encode('registerPool(uint64,address,address,uint8)', 1, TOKEN, BANK, 1)),
             (REGISTRY, encode('setHubRegistered(address,bool)', HUB, 1)),
             (REGISTRY, encode('setHubAllowedForPool(uint64,address,bool)', 1, HUB, 1))]
    calls += [(HUB, encode('registerGame(bytes32,address,uint32,uint32)', game_id(name), MODULES[key], ROUNDS, GAS))
              for name, key in MON.GAMES]
    return calls + [(REGISTRY, encode('setPoolActive(uint64,bool)', 1, 0))]


def abi_call(*head, calldata):
    body = calldata[2:]
    return ('0x' + ''.join(format(value(w), '064x') for w in head) + format(len(body) // 2, '064x') + body
            + '0' * (-len(body) % 64))


class FakeChain:
    """The JSON-RPC methods the monitor and the verifiers use, over the history of a D1 deployment (ADR-0037 §9): the
    timelock built at block 101, the governed contracts at 102, the wiring scheduled at 110 and executed at 150."""

    def __init__(self):
        self.head = 200
        self.ms_per_block = 2000  # Base before Denim: one block every 2 seconds; block 200 is at NOW
        self.genesis = NOW - 2 * self.head
        self.logs, self.requests = [], []
        self.calls, self.storage, self.code, self.hashes = {}, {(TOKEN, IMPL_SLOT): word(IMPL)}, {}, {}
        self.down, self.fail = False, None
        self.code.update({TIMELOCK: runtime('GovernanceTimelock'), REGISTRY: runtime('PoolRegistry'),
                          REFERRAL: runtime('ReferralRegistry'), HUB: HUB_CODE, BANK: BANK_CODE, VAULT: VAULT_CODE,
                          ROUTER: '0x6003', VRFHUB: '0x6004', ENGINE: '0x6005', TOKEN: '0x6001', IMPL: '0x6002'})
        self.code.update({module: MODULE_CODE[key] for key, module in MODULES.items()})
        self.put(WRAPPER, 's_vrfCoordinator()', [], COORDINATOR)
        self.put_words(WRAPPER, 'getConfig()', [0, 0, 0, 0, 13_400] + [0] * 7)
        self.put_words(COORDINATOR, 's_config()', [0, 2_500_000] + [0] * 7)
        for name, key in MON.GAMES:
            self.put(HUB, 'gameModule(bytes32)', [game_id(name)], MODULES[key])
            self.put(HUB, 'gameCallbackGasLimit(bytes32)', [game_id(name)], GAS)
            self.put(HUB, 'gameMaxBetCount(bytes32)', [game_id(name)], ROUNDS)
        for target, name, args, result in (
                (BANK, 'minBetAmount()', [], 10_000), (BANK, 'openHolds()', [], 0), (BANK, 'vault()', [], VAULT),
                (BANK, 'settlementRouter()', [], ROUTER), (ROUTER, 'settlementConsumer(address)', [BANK], VRFHUB),
                (BANK, 'asset()', [], TOKEN), (VAULT, 'bank()', [], BANK), (VAULT, 'asset()', [], TOKEN),
                (REGISTRY, 'poolCount()', [], 1), (REGISTRY, 'poolIdAt(uint256)', [0], 1),
                (REGISTRY, 'domainFor(uint64)', [1], 1), (REGISTRY, 'isPoolActive(uint64)', [1], 0),
                (REGISTRY, 'isRegisteredHub(address)', [HUB], 1),
                (REGISTRY, 'isHubAllowedForPool(uint64,address)', [1, HUB], 1),
                (HUB, 'voidCohortEnd(address)', [BANK], 0), (VRFHUB, 'unbookedResultCount(address)', [BANK], 0)):
            self.put(target, name, args, result)
        self.deploy()

    def deploy(self):
        for role, account in ((ADMIN, TIMELOCK), (PROPOSER, SAFE), (CANCELLER, SAFE), (EXECUTOR, MON.ZERO),
                              (CANCELLER, GUARDIAN)):
            self.emit(TIMELOCK, 'RoleGranted(bytes32,address,address)', [role, account, DEPLOYER], block=101)
        self.emit(TIMELOCK, 'MinDelayChange(uint256,uint256)', data=[0, DELAY], block=101)
        for target in (REGISTRY, HUB, REFERRAL, BANK):
            self.emit(target, 'GovernanceTransferred(address,address)', [MON.ZERO, TIMELOCK], block=102)
        self.schedule(WIRING, wiring_calls(), block=110, tx=SCHEDULE_TX)
        self.execute(WIRING, wiring_calls(), block=150, tx=WIRING_TX)
        effects = [(REFERRAL, 'BinderSet(address)', [HUB], []), (BANK, 'SettlementRouterSet(address)', [ROUTER], []),
                   (ROUTER, 'RandomnessConsumerBound(address,address)', [BANK, VRFHUB], []),
                   (BANK, 'RandomnessConsumerSet(address)', [VRFHUB], []), (BANK, 'GuardianSet(address)', [GUARDIAN], []),
                   (REGISTRY, 'SentinelSet(address)', [SAFE], []), (HUB, 'SentinelSet(address)', [SAFE], []),
                   (BANK, 'SentinelSet(address)', [SAFE], []), (BANK, 'WithdrawalBufferBpsSet(uint256)', [], [1000]),
                   (BANK, 'MinPlayerTurnoverForUnlockSet(uint256)', [], [20_000_000]),
                   (BANK, 'HoldbackVestingSecondsSet(uint256)', [], [86_400]),
                   (REGISTRY, 'PoolRegistered(uint64,address,address,uint8)', [1, TOKEN, BANK], [1]),
                   (REGISTRY, 'HubRegistered(address,bool)', [HUB], [1]),
                   (REGISTRY, 'HubAllowedForPoolSet(uint64,address,bool)', [1, HUB], [1])]
        effects += [(HUB, 'GameRegistered(bytes32,address,uint32,uint32)', [game_id(name), MODULES[key]], [ROUNDS, GAS])
                    for name, key in MON.GAMES]
        effects.append((REGISTRY, 'PoolActiveSet(uint64,bool)', [1], [0]))
        for target, name, indexed, data in effects:
            self.emit(target, name, indexed, data, block=150, tx=WIRING_TX)

    def block_hash(self, number):
        return self.hashes.get(number, word(0xb10c << 64 | number))

    def block_time(self, number):
        return self.genesis + number * self.ms_per_block // 1000

    def denim(self, head):
        """Base Denim: five blocks a second with whole-second timestamps; block `head` is at NOW."""
        self.head, self.ms_per_block = head, 200
        self.genesis = NOW - head // 5

    def put(self, target, name, args, result):
        self.calls[(target, encode(name, *args))] = word(result)

    def put_words(self, target, name, values):
        self.calls[(target, encode(name))] = '0x' + ''.join(format(v, '064x') for v in values)

    def emit(self, target, name, indexed=(), data=(), block=195, tx=None, raw=None):
        self.logs.append({'address': target, 'topics': [signature(name)] + [word(i) for i in indexed],
                          'data': raw if raw is not None else '0x' + ''.join(format(value(w), '064x') for w in data),
                          'blockNumber': hex(block), 'transactionIndex': '0x0', 'logIndex': hex(len(self.logs)),
                          'transactionHash': tx or word(0x7a000000 + len(self.logs)), 'removed': False})

    def schedule(self, op, calls, block, predecessor=0, delay=DELAY, tx=None):
        tx = tx or word(0x5c4ed000 + block)
        for index, (target, calldata) in enumerate(calls):
            self.emit(TIMELOCK, MON.SCHEDULED, [op, index], block=block, tx=tx,
                      raw=abi_call(target, 0, 0xa0, predecessor, delay, calldata=calldata))

    def execute(self, op, calls, block, tx=None):
        tx = tx or word(0xe8ec000 + block)
        for index, (target, calldata) in enumerate(calls):
            self.emit(TIMELOCK, MON.EXECUTED, [op, index], block=block, tx=tx,
                      raw=abi_call(target, 0, 0x60, calldata=calldata))
        self.put(TIMELOCK, 'isOperationDone(bytes32)', [op], 1)
        self.put(TIMELOCK, 'getTimestamp(bytes32)', [op], 1)
        self.put(TIMELOCK, 'getOperationState(bytes32)', [op], 3)

    def cancel(self, op, block):
        self.emit(TIMELOCK, MON.CANCELLED, [op], block=block)
        self.put(TIMELOCK, 'getTimestamp(bytes32)', [op], 0)
        self.put(TIMELOCK, 'getOperationState(bytes32)', [op], 0)

    def __call__(self, method, params):
        self.requests.append((method, copy.deepcopy(params)))
        if self.down or method == self.fail:
            raise MON.VerificationError(f'RPC {method} failed: HTTP 503 after 6 attempt(s)')
        if method == 'eth_chainId':
            return hex(CHAIN)
        if method == 'eth_blockNumber':
            return hex(self.head)
        if method == 'eth_getBlockByNumber':
            number = self.head if params[0] == 'latest' else int(params[0], 16)
            return {'number': hex(number), 'hash': self.block_hash(number), 'timestamp': hex(self.block_time(number))}
        if method == 'eth_getLogs':
            query = params[0]
            targets = query['address'] if isinstance(query['address'], list) else [query['address']]
            wanted, first, last = set(query['topics'][0]), int(query['fromBlock'], 16), int(query['toBlock'], 16)
            return [copy.deepcopy(row) for row in self.logs if row['address'] in targets
                    and row['topics'][0] in wanted and first <= int(row['blockNumber'], 16) <= last]
        if method == 'eth_call':
            return self.calls[(params[0]['to'], params[0]['data'])]
        if method == 'eth_getStorageAt':
            return self.storage[(params[0], params[1])]
        if method == 'eth_getCode':
            return '0x' if int(params[1], 16) < CREATED else self.code.get(params[0], '0x')
        raise AssertionError(f'unexpected RPC {method}')


class FakeResponse(io.BytesIO):
    def __init__(self, status, body):
        super().__init__(body)
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class Recorder:
    """Stands in for the HTTP opener of the webhooks and of the public Telegram channel."""

    def __init__(self):
        self.posts, self.failing = [], set()

    def __call__(self, request, timeout):
        fail = any(mark in request.full_url for mark in self.failing)
        if not fail:
            self.posts.append((request.full_url, json.loads(request.data)))
        return FakeResponse(500 if fail else 200, b'{"ok": false}' if fail else b'{"ok": true, "result": {}}')

    def texts(self, mark):
        return [payload['text'] for url, payload in self.posts if mark in url]


class MonitorFixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name)
        self.chain = FakeChain()
        self.snap = snapshot()
        state, _, _ = VG.verify_permissions(self.chain, self.snap, CHECKPOINT_BLOCK, None, 'release')
        document = VG.checkpoint_document(self.snap, state, CHECKPOINT_BLOCK, self.chain.block_hash(CHECKPOINT_BLOCK))
        self.checkpoint_path, self.record_path = base / 'governance-checkpoint.json', base / 'release.json'
        self.checkpoint_path.write_text(json.dumps(document, indent=2))
        self.record = {'schema': 'SSOT_RELEASE_DIGEST_V16', 'chainId': CHAIN, 'blockNumber': SNAP_BLOCK,
                       'checkpointBlockNumber': CHECKPOINT_BLOCK,
                       'checkpointBlockHash': self.chain.block_hash(CHECKPOINT_BLOCK),
                       'checkpointSha256': '0x' + VG.checkpoint_digest(document)}
        self.record_path.write_text(json.dumps(self.record))
        (base / 'snap.json').write_text(json.dumps(self.snap))
        (base / 'domain.json').write_text(json.dumps(domain_file()))
        self.env = {'SNAPSHOT_PATH': str(base / 'snap.json'), 'CALLBACK_DOMAIN_PATH': str(base / 'domain.json'),
                    'RPC_URL': 'http://127.0.0.1:1/never-used', 'DRIFT_STATE_FILE': str(base / 'state.json'),
                    'RELEASE_PATH': str(self.record_path), 'GOVERNANCE_CHECKPOINT_PATH': str(self.checkpoint_path),
                    'ALERT_WEBHOOK_URL': OPS_HOOK, 'ALERT_PUBLIC_WEBHOOK_URL': PUBLIC_HOOK,
                    'DRIFT_DOMAIN_CHECK_SECONDS': '0', 'DRIFT_GOVERNANCE_CHECK_SECONDS': '0'}
        self.config = MON.Config(self.env)
        self.hook = Recorder()
        self.now = NOW

    def reconfigure(self, **changes):
        for key, setting in changes.items():
            if setting is None:
                self.env.pop(key, None)
            else:
                self.env[key] = setting
        self.config = MON.Config(self.env)

    def run_once(self, **kwargs):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = MON.run(self.config, self.chain, self.env, now=self.now, opener=self.hook, **kwargs)
        self.last_output = out.getvalue() + err.getvalue()
        return code

    def ops(self):
        return self.hook.texts('OPS-SECRET')

    def public(self):
        return self.hook.texts('PUBLIC-SECRET')

    def state(self):
        return json.loads(Path(self.env['DRIFT_STATE_FILE']).read_text())

    def armed(self):
        self.assertEqual(self.run_once(), 0)
        self.hook.posts.clear()

    def schedule(self, op, calls, block=195, predecessor=0, delay=DELAY, head=210):
        """Schedule an operation, set its timelock views and run the monitor over it; return its ready time."""
        self.chain.schedule(op, calls, block, predecessor, delay)
        ready = self.now + delay
        self.chain.put(TIMELOCK, 'getTimestamp(bytes32)', [op], ready)
        self.chain.put(TIMELOCK, 'getOperationState(bytes32)', [op], 1)
        self.chain.head = head
        self.assertEqual(self.run_once(), 0)
        return ready


class ArmingAndEventsTest(MonitorFixture):
    def test_first_run_arms_at_the_confirmed_head_and_verifies_the_live_release(self):
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('armed on chain 84532 at block 188', message)
        self.assertIn('Live release verification from the signed checkpoint at block 160 passed at block 188.', message)
        self.assertNotIn('VIOLATED', message)
        self.assertNotIn('FAILED', message)
        self.assertEqual(self.public(), [])
        state = self.state()
        self.assertEqual((state['cursor'], state['governanceCheckpoint']['blockNumber']), (188, 188))

    def test_without_a_signed_record_the_live_verification_is_off(self):
        self.reconfigure(RELEASE_PATH=None, GOVERNANCE_CHECKPOINT_PATH=None)
        self.assertEqual(self.run_once(), 0)
        self.assertIn('Live release verification is off', self.ops()[0])
        self.assertNotIn('governanceCheckpoint', self.state())
        with self.assertRaisesRegex(MON.VerificationError, 'must be set together'):
            self.reconfigure(RELEASE_PATH=str(self.record_path))

    def test_replay_from_deployment_reviews_the_release_wiring_and_counts_its_events(self):
        self.chain.put(TIMELOCK, 'getTimestamp(bytes32)', [WIRING], 1)
        self.assertEqual(self.run_once(from_block=CREATED), 0)
        journal = self.last_output
        self.assertIn(f'- {WIRING} (release wiring): 22 call(s), already executed by the confirmed head, delay 259200 s, '
                      f'scheduled in block 110, tx {SCHEDULE_TX}', journal)
        for line in ('1. ReferralRegistry.setBinderOnce(GameHub)', '2. Bank pool 1.setSettlementRouterOnce(SettlementRouter)',
                     '5. PoolRegistry.setSentinel(Safe)', '11. PoolRegistry.registerPool(1, USDC, Bank pool 1, casino)',
                     '12. PoolRegistry.setHubRegistered(GameHub, true)',
                     '14. GameHub.registerGame(DICE, moduleDice, 25, 2447746)', '22. PoolRegistry.setPoolActive(1, false)'):
            self.assertIn(line, journal)
        self.assertIn('admission review: passed', journal)
        self.assertNotIn('FAILED', journal)
        self.assertNotIn('recertification trigger', journal)
        self.assertIn(f'- {WIRING} (release wiring): 22 call(s) executed in block 150, tx {WIRING_TX} (23 events of the '
                      'operation in that transaction)', journal)
        self.assertNotIn('RECERTIFICATION TRIGGER', journal)
        self.assertIn('RoleGranted PROPOSER_ROLE to Safe by deployer (a release role)', journal)
        self.assertIn('GovernanceTransferred to the GovernanceTimelock (construction)', journal)
        [public] = self.public()
        self.assertIn('TIMELOCK OPERATION SCHEDULED', public)
        self.assertIn('TIMELOCK OPERATION EXECUTED', public)
        self.assertNotIn('RoleGranted', public)
        self.assertEqual(self.state()['operations'], {})

    def test_game_registration_is_a_recertification_trigger(self):
        self.armed()
        self.chain.emit(HUB, 'GameRegistered(bytes32,address,uint32,uint32)', [0x77, STRANGER], [ROUNDS, GAS], block=195)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('RECERTIFICATION TRIGGER', message)
        self.assertIn(f'GameHub: GameRegistered {word(0x77)} module {STRANGER} maxBetCount 25', message)
        # The replayed registration also fails the live release verification: the game set is the release's.
        self.assertIn('- NEW registered game set differs from release', message)
        self.assertEqual(self.state()['cursor'], 198)

    def test_edge_and_referral_changes_are_governance_events(self):
        # The certificate v5 review confirmed that their values cannot move the certified bound (ADR-0006): they are
        # alerted as governance changes and do not force the certified domain check.
        self.reconfigure(DRIFT_DOMAIN_CHECK_SECONDS='3600')
        self.armed()
        checked = self.state()['domainCheckedAt']
        self.now += 600
        self.chain.emit(HUB, 'EdgeChangeQueued(uint16,uint16,uint64)', [], [200, 300, NOW], block=195)
        self.chain.emit(HUB, 'EdgeChangeApplied(uint16,uint16)', [], [200, 300], block=196)
        self.chain.emit(HUB, 'ReferralConfigCreated(uint32,uint16,uint16,uint16,uint16)', [2], [1000, 500, 250, 2000],
                        block=196)
        self.chain.emit(HUB, 'ActiveReferralConfigSet(uint32,uint32)', [], [1, 2], block=197)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('GOVERNANCE OR AUTHORITY CHANGE', message)
        self.assertNotIn('RECERTIFICATION TRIGGER', message)
        for line in (f'EdgeChangeQueued 200 -> 300 bps, activates at {MON.utc(NOW)}', 'EdgeChangeApplied 200 -> 300 bps',
                     'ReferralConfigCreated 2: 1000 500 250 2000', 'ActiveReferralConfigSet 1 -> 2'):
            self.assertIn(line, message)
        self.assertEqual(self.state()['domainCheckedAt'], checked)

    def test_unconfirmed_blocks_wait_for_confirmations(self):
        self.armed()
        self.chain.emit(BANK, 'MinBetAmountSet(uint256)', [], [50], block=195)
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(self.ops(), [])
        self.chain.head = 207
        self.assertEqual(self.run_once(), 0)
        self.assertIn('MinBetAmountSet 50 BELOW the certified floor 99 (Owner policy 10000)', self.ops()[0])

    def test_the_confirmed_block_is_24_seconds_old_at_200ms_blocks(self):
        # Block 2000 is in second 400; second 376 ends with block 1884.
        self.chain.denim(2000)
        self.armed()
        self.assertEqual(self.state()['cursor'], 1884)
        self.chain.emit(BANK, 'MinBetAmountSet(uint256)', [], [50], block=1885)
        self.chain.head = 2004  # still second 400
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(self.ops(), [])
        self.chain.head = 2005  # second 401: second 377, blocks 1885 to 1889, is confirmed
        self.assertEqual(self.run_once(), 0)
        self.assertIn('MinBetAmountSet 50 BELOW the certified floor 99 (Owner policy 10000)', self.ops()[0])
        self.assertEqual(self.state()['cursor'], 1889)

    def test_min_bet_below_floor_is_both_an_event_and_a_domain_violation(self):
        self.armed()
        self.chain.emit(BANK, 'MinBetAmountSet(uint256)', [], [98], block=195)
        self.chain.put(BANK, 'minBetAmount()', [], 98)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('MinBetAmountSet 98 BELOW the certified floor 99', message)
        self.assertIn('CERTIFIED DOMAIN VIOLATED', message)
        self.assertIn('- NEW pool 1: minimum bet 98 below the certified floor', message)

    def test_only_k_zero_position_applied_is_reported(self):
        self.armed()
        self.chain.emit(VAULT, 'PositionApplied(uint48,uint128,uint128,uint128,uint128)', [7], [500, 100, 0, 0], block=191)
        self.chain.emit(VAULT, 'PositionApplied(uint48,uint128,uint128,uint128,uint128)', [8], [0, 100, 40, 0], block=192)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('SETTLEMENT ANOMALY', message)
        self.assertIn('released = 0 (k = 0 path, outside the certified domain): cutoff 8, stake 100, cost 40', message)
        self.assertNotIn('cutoff 7', message)

    def test_callback_failures_voids_and_issuer_freezes_are_settlement_anomalies(self):
        self.armed()
        self.chain.emit(HUB, 'CallbackSettlementFailed(uint256,bytes32)', [42], [0xdead], block=191)
        self.chain.emit(VRFHUB, 'CallbackAttempt(uint256,bool,uint8,bytes32)', [9], [1, 3, 0], block=192)
        self.chain.emit(VRFHUB, 'CallbackAttempt(uint256,bool,uint8,bytes32)', [10], [0, 2, 0xbeef], block=193)
        self.chain.emit(HUB, 'VoidWindowOpened(uint64,address,uint64,address)', [1, BANK, GUARDIAN], [NOW], block=194)
        self.chain.emit(HUB, 'BetVoided(uint256,address,uint256,bytes32)', [77, KEEPER], [5000, 0xbad], block=195)
        self.chain.emit(TOKEN, 'Blacklisted(address)', [VAULT], block=196)
        self.chain.emit(TOKEN, 'Blacklisted(address)', [STRANGER], block=196)
        self.chain.emit(TOKEN, 'Pause()', block=197)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('CallbackSettlementFailed: position 42', message)
        self.assertIn('CallbackAttempt not delivered: request 10, state 2', message)
        self.assertNotIn('request 9', message)
        self.assertIn(f'VoidWindowOpened pool 1 (Bank pool 1) for bets requested through {MON.utc(NOW)} by guardian',
                      message)
        # The window is the operator's discretion (ADR-0037 R-5): the public channel gets it, not the other anomalies.
        self.assertIn('VOID WINDOW OPENED', self.public()[-1])
        self.assertIn('VoidWindowOpened pool 1 (Bank pool 1)', self.public()[-1])
        self.assertNotIn('CallbackSettlementFailed', self.public()[-1])
        self.assertIn('BetVoided position 77 by keeper: stake 5000 refunded as a player payable', message)
        self.assertIn('USDC: Blacklisted Vault pool 1: its USDC transfers fail', message)
        self.assertIn('USDC: paused by the issuer', message)
        self.assertNotIn(STRANGER, message)
        # The void window is a live reduction that the verification notes.
        self.assertIn(f'- NEW void window opened for pool 1 through {NOW}', message)

    def test_classes_are_grouped_and_ordered(self):
        self.armed()
        self.chain.emit(BANK, 'RiskInPausedSet(bool,address)', [GUARDIAN], [1], block=190)
        self.chain.put(BANK, 'paused()', [], 1)
        self.chain.emit(HUB, 'CallbackSettlementFailed(uint256,bytes32)', [1], [0], block=191)
        self.chain.emit(REGISTRY, 'HubAllowedForPoolSet(uint64,address,bool)', [1, HUB], [0], block=192)
        self.chain.put(REGISTRY, 'isHubAllowedForPool(uint64,address)', [1, HUB], 0)
        self.chain.emit(TOKEN, 'Upgraded(address)', [addr(0x666)], block=193)
        self.chain.emit(BANK, 'GovernanceTransferStarted(address,address)', [TIMELOCK, STRANGER], block=194)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        message = self.ops()[0]
        titles = ('LIVE RELEASE VERIFICATION FAILED', 'RECERTIFICATION TRIGGER', 'SETTLEMENT ANOMALY',
                  'GOVERNANCE OR AUTHORITY CHANGE')
        order = [message.index(title) for title in titles]
        self.assertEqual(order, sorted(order))
        self.assertIn(f'USDC: Upgraded to {addr(0x666)} (not the certified implementation)', message)
        self.assertIn('HubAllowedForPoolSet pool 1 GameHub -> False', message)
        self.assertIn('RiskInPausedSet -> True by guardian', message)
        self.assertIn(f'CRITICAL GovernanceTransferStarted from GovernanceTimelock to {STRANGER}', message)
        self.assertIn('- NEW a governance transfer was started', message)

    def test_long_batches_are_counted_not_dropped(self):
        self.armed()
        for i in range(MON.MAX_LINES + 5):
            self.chain.emit(BANK, 'HoldbackVestingSecondsSet(uint256)', [], [86_400 + i], block=190)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.assertIn('... and 5 more in blocks 189-198', self.last_output)
        [message] = self.ops()
        self.assertLessEqual(len(message), MON.MAX_TEXT + 1)
        self.assertIn('not shown; the monitor journal has the full message', message)

    def test_an_event_a_contract_should_not_emit_is_reported(self):
        self.armed()
        self.chain.emit(VAULT, 'GuardianSet(address)', [STRANGER], block=195)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.assertIn('Vault pool 1: unexpected GuardianSet(address) from this contract', self.ops()[0])


class DeliveryAndStateTest(MonitorFixture):
    def test_failed_delivery_keeps_the_cursor_and_resends(self):
        self.armed()
        self.chain.emit(HUB, 'EdgeChangeQueued(uint16,uint16,uint64)', [], [200, 300, NOW], block=195)
        self.chain.head = 210
        self.hook.failing.add('OPS-SECRET')
        self.assertEqual(self.run_once(), 2)
        self.assertEqual(self.state()['cursor'], 188)
        self.hook.failing.clear()
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'EdgeChangeQueued 200 -> 300 bps, activates at {MON.utc(NOW)}', self.ops()[0])
        self.assertEqual(self.state()['cursor'], 198)

    def test_failed_first_delivery_does_not_arm(self):
        self.hook.failing.add('OPS-SECRET')
        self.assertEqual(self.run_once(), 2)
        self.assertFalse(Path(self.env['DRIFT_STATE_FILE']).exists())

    def test_a_failed_public_delivery_holds_all_state(self):
        self.armed()
        self.hook.failing.add('PUBLIC-SECRET')
        self.chain.schedule(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 10_000))], 195)
        self.chain.put(TIMELOCK, 'getTimestamp(bytes32)', [OTHER], self.now + DELAY)
        self.chain.put(TIMELOCK, 'getOperationState(bytes32)', [OTHER], 1)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 2)
        self.assertEqual((self.state()['cursor'], self.state()['operations']), (188, {}))
        self.hook.failing.clear()
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 2)  # the ops channel accepted the first attempt too and gets it again
        self.assertIn('TIMELOCK OPERATION SCHEDULED', self.public()[0])
        self.assertIn(OTHER, self.state()['operations'])

    def test_the_public_channel_gets_only_operations_and_never_the_host(self):
        self.reconfigure(TELEGRAM_BOT_TOKEN='123456:SECRET-telegram_token', TELEGRAM_PUBLIC_CHAT_ID='@arbigamefi_gov',
                         TELEGRAM_API_BASE='https://telegram.invalid', ALERT_PUBLIC_WEBHOOK_URL=None)
        self.armed()
        self.chain.emit(HUB, 'CallbackSettlementFailed(uint256,bytes32)', [42], [0xdead], block=194)
        self.schedule(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 10_000))])
        [(url, payload)] = [post for post in self.hook.posts if post[0].endswith('/sendMessage')]
        self.assertEqual(payload['chat_id'], '@arbigamefi_gov')
        self.assertIn('ArbiGameFi governance timelock, chain 84532', payload['text'])
        self.assertIn('TIMELOCK OPERATION SCHEDULED', payload['text'])
        self.assertNotIn('SETTLEMENT ANOMALY', payload['text'])
        self.assertNotIn('host:', payload['text'])
        self.assertIn('SETTLEMENT ANOMALY', self.ops()[0])
        self.assertNotIn('SECRET-telegram_token', self.last_output)

    def test_domain_violation_is_alerted_reminded_and_recovered(self):
        self.armed()
        self.chain.storage[(TOKEN, IMPL_SLOT)] = word(addr(0x777))
        self.assertEqual(self.run_once(), 0)
        self.assertIn('- NEW provider: token implementation differs from the certified one', self.ops()[-1])
        self.now += 600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 1)  # no repeat inside the reminder interval
        self.now += 21_600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 2)
        self.assertNotIn('NEW', self.ops()[-1])
        self.chain.storage[(TOKEN, IMPL_SLOT)] = word(IMPL)
        self.assertEqual(self.run_once(), 0)
        self.assertIn('Certified domain restored', self.ops()[-1])
        self.assertEqual(self.state()['conditions']['domain'], {})

    def test_domain_check_is_hourly_unless_a_trigger_appears(self):
        self.reconfigure(DRIFT_DOMAIN_CHECK_SECONDS='3600')
        self.armed()
        self.chain.put(BANK, 'minBetAmount()', [], 50)
        self.now += 600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(self.ops(), [])  # not due yet
        self.chain.emit(BANK, 'RiskReserveBpsSet(uint256)', [], [7000], block=195)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)  # a trigger event forces the domain check
        self.assertIn('pool 1: minimum bet 50 below the certified floor', self.ops()[-1])
        self.chain.put(BANK, 'minBetAmount()', [], 10_000)
        self.now += 3_600
        self.assertEqual(self.run_once(), 0)  # the hourly check sees the recovery
        self.assertIn('Certified domain restored', self.ops()[-1])

    def test_module_and_game_drift_are_violations(self):
        self.armed()
        self.chain.code[MODULES['moduleKeno']] = '0x60ff'
        self.chain.put(HUB, 'gameCallbackGasLimit(bytes32)', [game_id('DICE')], 2_000_000)
        self.chain.put(HUB, 'gameMaxBetCount(bytes32)', [game_id('SLOTS')], 30)
        self.assertEqual(self.run_once(), 0)
        message = self.ops()[-1]
        self.assertIn('game KENO: module runtime is not the certified code', message)
        self.assertIn('game DICE: callback gas is not the certified value', message)
        self.assertIn('game SLOTS: round limit outside the certified range', message)

    def test_capacity_is_alerted_at_96_open_holds_and_recovers(self):
        self.armed()
        self.chain.put(BANK, 'openHolds()', [], 100)
        self.assertEqual(self.run_once(), 0)
        self.assertIn('- NEW Bank pool 1: 100 of 128 open holds (alert at 96)', self.ops()[-1])
        self.chain.put(BANK, 'openHolds()', [], 101)
        self.now += 600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 1)  # the same condition, not reminded yet
        self.now += 21_600
        self.assertEqual(self.run_once(), 0)
        self.assertIn('- Bank pool 1: 101 of 128 open holds', self.ops()[-1])
        self.chain.put(BANK, 'openHolds()', [], 10)
        self.assertEqual(self.run_once(), 0)
        self.assertIn('Bank capacity is below the alert level again', self.ops()[-1])

    def test_rpc_failure_changes_nothing_then_reports_a_stall_and_recovery(self):
        self.armed()
        state = self.state()
        self.chain.down = True
        for _ in range(3):
            self.assertEqual(self.run_once(), 1)
            self.assertEqual(self.state()['cursor'], state['cursor'])
        [message] = self.ops()
        self.assertIn('STALLED', message)
        self.assertIn('last error: RPC eth_chainId failed: HTTP 503 after 6 attempt(s)', message)
        [public] = self.public()  # silence on the public channel must not read as an empty queue
        self.assertIn('The monitor that posts these alerts is failing', public)
        self.assertNotIn('HTTP 503', public)
        self.assertEqual(self.run_once(), 1)
        self.assertEqual(len(self.ops()), 1)  # reminded only after ALERT_REMIND_SECONDS
        self.chain.down = False
        self.assertEqual(self.run_once(), 0)
        self.assertIn('recovered', self.ops()[-1])
        self.assertIn('The monitor runs again', self.public()[-1])
        self.assertEqual(self.state()['failures'], 0)
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.public()), 2)

    def test_dry_run_changes_no_state(self):
        self.assertEqual(self.run_once(dry_run=True), 0)
        self.assertFalse(Path(self.env['DRIFT_STATE_FILE']).exists())
        self.assertEqual(self.hook.posts, [])
        self.assertIn('armed on chain 84532', self.last_output)

    def test_a_state_file_of_another_release_is_refused(self):
        self.armed()
        state = self.state()
        state['governanceTimelock'] = STRANGER
        Path(self.env['DRIFT_STATE_FILE']).write_text(json.dumps(state))
        self.assertEqual(self.run_once(), 2)
        self.assertIn('belongs to another release', self.last_output)

    def test_output_never_contains_the_rpc_or_webhook_url(self):
        self.armed()
        self.hook.failing.update(('OPS-SECRET', 'PUBLIC-SECRET'))
        self.chain.emit(BANK, 'MinBetAmountSet(uint256)', [], [10_000], block=195)
        self.chain.head = 210
        self.run_once()
        self.assertNotIn('SECRET-WEBHOOK', self.last_output)
        real = MON.Rpc('http://127.0.0.1:1/SECRET-RPC-KEY', attempts=1, backoff=0)
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            self.assertEqual(MON.run(self.config, real, self.env, now=self.now, opener=self.hook), 1)
        self.assertNotIn('SECRET', out.getvalue() + err.getvalue())
        self.assertIn('RPC eth_chainId failed', err.getvalue())


class TimelockOperationTest(MonitorFixture):
    def test_a_scheduled_operation_is_decoded_named_and_announced_publicly(self):
        self.armed()
        ready = self.schedule(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 5000)),
                                      (BANK, encode('setRiskReserveBps(uint256)', 7000))])
        [message] = self.ops()
        self.assertIn('TIMELOCK OPERATION SCHEDULED', message)
        self.assertIn(f'- {OTHER} (undeclared): 2 call(s), ready {MON.utc(ready)} ({ready}), delay 259200 s, scheduled '
                      'in block 195', message)
        self.assertIn('1. Bank pool 1.setMinBetAmount(5000) [the Owner policy is 10000; recertification trigger: a minimum '
                      'bet change (ADR-0006)]', message)
        self.assertIn('2. Bank pool 1.setRiskReserveBps(7000) [the Owner policy is 6000; recertification trigger: an '
                      'Owner policy change (ADR-0006)]', message)
        self.assertIn('admission review: passed', message)
        self.assertIn(f'- NEW undeclared operation {OTHER} pending, waiting from {ready}', message)
        [public] = self.public()
        self.assertIn(f'- {OTHER} (undeclared): 2 call(s)', public)
        self.assertNotIn('RELEASE STATE NOTES', public)
        entry = self.state()['operations'][OTHER]
        self.assertEqual((entry['label'], entry['readyAt'], entry['failed']), ('undeclared', ready, False))

    def test_edge_and_referral_operations_carry_no_recertification_note(self):
        self.armed()
        self.schedule(OTHER, [(HUB, encode('queueEdgeChange(uint16)', 300)),
                              (HUB, encode('createReferralConfig(uint16,uint16,uint16,uint16)', 1000, 500, 250, 2000)),
                              (HUB, encode('setActiveReferralConfig(uint32)', 2))])
        [message] = self.ops()
        self.assertIn(f'- {OTHER} (undeclared): 3 call(s)', message)
        self.assertIn('1. GameHub.queueEdgeChange(300)\n', message)
        self.assertIn('3. GameHub.setActiveReferralConfig(2)\n', message)
        self.assertNotIn('recertification trigger', message)
        self.assertIn('admission review: passed', message)

    def test_the_declared_activation_is_named_with_its_predecessor(self):
        self.armed()
        ready = self.schedule(ACTIVATION, [(REGISTRY, encode('setPoolActive(uint64,bool)', 1, 1))], predecessor=WIRING)
        [message] = self.ops()
        self.assertIn(f'- {ACTIVATION} (release activation): 1 call(s), ready {MON.utc(ready)} ({ready}), delay 259200 '
                      f's, after release wiring {WIRING}, scheduled in block 195', message)
        self.assertIn('1. PoolRegistry.setPoolActive(1, true)\n', message)
        self.assertNotIn('recertification trigger', message)

    def test_ready_time_warning_and_ready_but_unexecuted_reminders(self):
        self.armed()
        ready = self.schedule(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 10_000))])
        self.hook.posts.clear()
        self.now = ready - 43_200 + 60
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('TIMELOCK OPERATION READY SOON', message)
        self.assertIn(f'- {OTHER} (undeclared): becomes ready at {MON.utc(ready)}, in 12.0 h; 1 call(s): Bank pool '
                      '1.setMinBetAmount(10000)', message)
        self.assertIn('TIMELOCK OPERATION READY SOON', self.public()[0])
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 1)  # warned once
        self.now = ready + 60
        self.chain.put(TIMELOCK, 'getOperationState(bytes32)', [OTHER], 2)
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'TIMELOCK OPERATION READY, NOT EXECUTED', self.ops()[-1])
        self.assertIn(f'- {OTHER} (undeclared): ready since {MON.utc(ready)} (0.0 h ago)', self.ops()[-1])
        self.now += 600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 2)
        self.now += 21_600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 3)
        self.assertIn('ready since', self.public()[-1])

    def test_an_operation_executed_beyond_the_scan_is_not_reminded_as_ready(self):
        self.armed()
        ready = self.schedule(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 10_000))])
        self.hook.posts.clear()
        self.now = ready + 60
        self.chain.put(TIMELOCK, 'getOperationState(bytes32)', [OTHER], 3)
        self.chain.put(TIMELOCK, 'isOperationDone(bytes32)', [OTHER], 1)
        self.assertEqual(self.run_once(), 0)
        self.assertFalse(any('READY, NOT EXECUTED' in text for text in self.ops()))

    def test_executions_and_cancellations_are_reported_and_close_the_operation(self):
        self.armed()
        calls = [(BANK, encode('setMinBetAmount(uint256)', 10_000)), (BANK, encode('setRiskReserveBps(uint256)', 6000))]
        self.schedule(OTHER, calls)
        self.schedule(THIRD, [(HUB, encode('setRefundTimeout(uint256)', 7200))], block=205, head=220)
        self.hook.posts.clear()
        self.chain.execute(OTHER, calls, block=220)
        self.chain.cancel(THIRD, block=221)
        self.chain.head = 240
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn(f'- {OTHER} (undeclared): 2 call(s) executed in block 220, tx', message)
        self.assertIn(f'- {THIRD} (undeclared) cancelled in block 221', message)
        [public] = self.public()
        self.assertIn('TIMELOCK OPERATION EXECUTED', public)
        self.assertIn('TIMELOCK OPERATION CANCELLED', public)
        self.assertEqual(self.state()['operations'], {})
        self.assertIn(f'- NEW undeclared operation {OTHER} executed', message)

    def test_an_unknown_selector_or_target_fails_and_is_reminded_until_cancelled(self):
        self.armed()
        ready = self.schedule(OTHER, [(BANK, '0x12345678' + '00' * 32),
                                      (addr(0xeee), encode('setMinBetAmount(uint256)', 10_000))])
        [message] = self.ops()
        self.assertIn(f'ADMISSION REVIEW FAILED: cancel before {MON.utc(ready)}', message)
        self.assertIn('1. Bank pool 1.<unknown selector 0x12345678> -> FAILED: unknown function selector 0x12345678: not '
                      'reviewed', message)
        self.assertIn('the target has no code: not reviewed', message)
        self.assertLess(message.index('ADMISSION REVIEW FAILED'), message.index('TIMELOCK OPERATION SCHEDULED'))
        self.assertIn('ADMISSION REVIEW FAILED', self.public()[0])
        self.now += 600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 1)
        self.now += 21_600
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'- operation {OTHER} (undeclared): 2 of 2 call(s) failed, scheduled in block 195', self.ops()[-1])
        self.assertIn('(reminder)', self.ops()[-1])
        self.chain.cancel(OTHER, block=230)
        self.chain.head = 250
        self.assertEqual(self.run_once(), 0)
        self.assertIn('TIMELOCK OPERATION CANCELLED', self.ops()[-1])
        self.assertNotIn('ADMISSION REVIEW FAILED', self.ops()[-1])
        sent = len(self.ops())
        self.now += 21_600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), sent)

    def test_a_failed_operation_is_warned_and_reminded_up_to_and_after_its_ready_time(self):
        self.armed()
        ready = self.schedule(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 50))])
        self.assertIn('minimum bet 50 below the certified floor 99 (the k = 0 path)', self.ops()[0])
        self.hook.posts.clear()
        self.now = ready - 43_200 + 60
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn(f'ADMISSION REVIEW FAILED: cancel before {MON.utc(ready)}', message)
        self.assertIn('; becomes ready in 12.0 h', message)
        self.assertNotIn('READY SOON', message)
        self.now = ready + 60
        self.chain.put(TIMELOCK, 'getOperationState(bytes32)', [OTHER], 2)
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'ADMISSION REVIEW FAILED: ready since {MON.utc(ready)}, anyone can execute it now',
                      self.ops()[-1])
        self.assertIn('ADMISSION REVIEW FAILED: ready since', self.public()[-1])
        self.chain.execute(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 50))], block=230)
        self.chain.put(BANK, 'minBetAmount()', [], 50)
        self.chain.head = 250
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'- {OTHER} (undeclared): 1 call(s) executed in block 230', self.ops()[-1])
        self.assertIn('- NEW pool 1: minimum bet 50 below the certified floor', self.ops()[-1])
        self.assertEqual(self.state()['operations'], {})

    def test_operations_pending_when_the_monitor_arms_are_opened_from_the_live_verification(self):
        self.chain.schedule(ACTIVATION, [(REGISTRY, encode('setPoolActive(uint64,bool)', 1, 1))], 170, WIRING)
        self.chain.schedule(OTHER, [(BANK, encode('setMinBetAmount(uint256)', 10_000))], 171)
        for op in (ACTIVATION, OTHER):
            self.chain.put(TIMELOCK, 'getTimestamp(bytes32)', [op], self.now + 3600)
            self.chain.put(TIMELOCK, 'getOperationState(bytes32)', [op], 1)
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('TIMELOCK OPERATIONS PENDING WHEN THE MONITOR ARMED', message)
        self.assertIn(f'- {ACTIVATION} (release activation): 1 call(s), ready', message)
        self.assertIn('1. PoolRegistry.setPoolActive(1, true)', message)
        self.assertIn(f'ADMISSION REVIEW FAILED: cancel before {MON.utc(self.now + 3600)}', message)
        self.assertIn('scheduled before the monitor armed, so not reviewed', message)
        self.assertEqual(set(self.state()['operations']), {ACTIVATION, OTHER})


class AdmissionReviewTest(MonitorFixture):
    def setUp(self):
        super().setUp()
        self.armed()
        self.block = 195
        self.ids = iter(word(0xc0 << 248 | i) for i in range(1, 100))

    def deploy_pool(self, bank=None, vault=None, minimum=10_000, vault_view=VAULT2, router=0, consumer=0):
        self.chain.code[BANK2] = bank or runtime('Bank', poolAsset=TOKEN, poolVault=VAULT2, poolAssetDecimals=6)
        self.chain.code[VAULT2] = vault or runtime('LiquidityVault', poolAsset=TOKEN, poolBank=BANK2)
        self.chain.put(BANK2, 'vault()', [], vault_view)
        self.chain.put(BANK2, 'minBetAmount()', [], minimum)
        self.chain.put(BANK2, 'settlementRouter()', [], router)
        self.chain.put(ROUTER, 'settlementConsumer(address)', [BANK2], consumer)

    def review(self, calls):
        """Schedule `calls` as a new operation and return the run's ops message."""
        self.hook.posts.clear()
        self.block += 1
        self.schedule(next(self.ids), calls, block=self.block, head=self.block + 12)
        return self.ops()[0]

    def deploy_hub(self, code=HUB_CODE, edge=200, timeout=3600, pending=0, schedule=(1000, 500, 250, 2000)):
        self.chain.code[HUB2] = code
        self.chain.put(HUB2, 'defaultHouseEdgeBps()', [], edge)
        self.chain.put(HUB2, 'refundTimeoutSeconds()', [], timeout)
        self.chain.put_words(HUB2, 'pendingEdgeChange()', [edge + 1 if pending else 0, pending])
        self.chain.put(HUB2, 'activeReferralConfigId()', [], 1)
        self.chain.calls[(HUB2, encode('getReferralConfig(uint32)', 1))] = '0x' + ''.join(
            format(v, '064x') for v in schedule)

    def register_pool(self, pool=2, asset=TOKEN, bank=BANK2, domain=1):
        return REGISTRY, encode('registerPool(uint64,address,address,uint8)', pool, asset, bank, domain)

    def test_the_certified_bank_vault_hub_and_module_pass(self):
        self.deploy_pool()
        self.deploy_hub()
        self.chain.code[MODULE2] = MODULE_CODE['moduleDice']
        message = self.review([
            (BANK2, encode('setSentinel(address)', SAFE)), self.register_pool(),
            (REGISTRY, encode('setHubRegistered(address,bool)', HUB2, 1)),
            (REGISTRY, encode('setHubAllowedForPool(uint64,address,bool)', 2, HUB2, 1)),
            (HUB, encode('registerGame(bytes32,address,uint32,uint32)', game_id('DICE_V2'), MODULE2, ROUNDS, GAS))])
        self.assertIn('admission review: passed', message)
        self.assertNotIn('FAILED', message)
        self.assertIn(f'1. new Bank {BANK2}.setSentinel(Safe)', message)
        self.assertIn(f'2. PoolRegistry.registerPool(2, USDC, {BANK2}, casino) [recertification trigger: a new pool', message)
        self.assertIn(f'5. GameHub.registerGame({word(game_id("DICE_V2"))}, {MODULE2}, 25, 2447746) [certified moduleDice '
                      'runtime; recertification trigger: any registerGame', message)

    def test_a_different_runtime_or_immutable_fails(self):
        bank = runtime('Bank', poolAsset=TOKEN, poolVault=VAULT2, poolAssetDecimals=6)
        vault = runtime('LiquidityVault', poolAsset=TOKEN, poolBank=BANK2)
        cases = [
            ({'bank': tamper(bank)}, self.register_pool(), f'Bank {BANK2}: runtime is not the certified code'),
            ({'bank': bank + '00'}, self.register_pool(), f'Bank {BANK2}: runtime is 301 bytes, not the certified 300'),
            ({'bank': runtime('Bank', poolAsset=STRANGER, poolVault=VAULT2, poolAssetDecimals=6)}, self.register_pool(),
             'its asset immutable is not the registered asset'),
            ({'bank': runtime('Bank', poolAsset=TOKEN, poolVault=VAULT2, poolAssetDecimals=18)}, self.register_pool(),
             "its decimals immutable is not the certified token's"),
            ({'vault_view': STRANGER}, self.register_pool(), 'vault() differs from its Vault immutable'),
            ({'vault': tamper(vault)}, self.register_pool(), f'Vault {VAULT2}: runtime is not the certified code'),
            ({'vault': runtime('LiquidityVault', poolAsset=TOKEN, poolBank=STRANGER)}, self.register_pool(),
             f'Vault {VAULT2}: its Bank immutable is not Bank {BANK2}'),
            ({'minimum': 50}, self.register_pool(), f'Bank {BANK2}: minimum bet 50 below the certified floor 99'),
            ({'router': STRANGER}, self.register_pool(),
             f'Bank {BANK2}: its SettlementRouter is {STRANGER}, not the release SettlementRouter'),
            ({'router': ROUTER, 'consumer': STRANGER}, self.register_pool(),
             f'Bank {BANK2}: the SettlementRouter binds it to a randomness consumer other than the release VRFHub'),
            ({}, self.register_pool(asset=STRANGER), f'asset {STRANGER} is not the certified token {TOKEN}'),
            ({}, self.register_pool(domain=2), 'pool domain 2 is not casino (1)'),
        ]
        for deployment, call_, reason in cases:
            with self.subTest(reason=reason):
                self.deploy_pool(**deployment)
                message = self.review([call_])
                self.assertIn('ADMISSION REVIEW FAILED: cancel before', message)
                self.assertIn(reason, message)
        hub_cases = [
            (runtime('GameHub', settlementRouter=ROUTER, vrfHub=STRANGER, refRegistry=REFERRAL, refEngine=ENGINE),
             f'hub {HUB2}: immutable vrfHub is not the release VRFHub'),
            (tamper(HUB_CODE), f'hub {HUB2}: runtime is not the certified code'),
        ]
        for code, reason in hub_cases:
            with self.subTest(reason=reason):
                self.deploy_hub(code)
                for call_ in ((REGISTRY, encode('setHubRegistered(address,bool)', HUB2, 1)),
                              (REGISTRY, encode('setHubAllowedForPool(uint64,address,bool)', 1, HUB2, 1))):
                    self.assertIn(reason, self.review([call_]))
        for change, reason in (({'edge': 1}, f'hub {HUB2}: defaultHouseEdgeBps 1 is not the release value 200'),
                               ({'timeout': 60}, f'hub {HUB2}: refundTimeoutSeconds 60 is not the release value 3600'),
                               ({'pending': NOW}, f'hub {HUB2}: an edge change is pending'),
                               ({'schedule': (3500, 0, 0, 0)},
                                f'hub {HUB2}: referral schedule [3500, 0, 0, 0] is not the release schedule')):
            with self.subTest(reason=reason):
                self.deploy_hub(**change)
                self.assertIn(reason, self.review([(REGISTRY, encode('setHubRegistered(address,bool)', HUB2, 1))]))
        # Deregistering a hub needs no review.
        self.assertIn('admission review: passed', self.review([(REGISTRY, encode('setHubRegistered(address,bool)', HUB2, 0))]))

    def test_a_minimum_bet_raised_in_the_same_operation_passes(self):
        self.deploy_pool(minimum=50)
        message = self.review([(BANK2, encode('setMinBetAmount(uint256)', 10_000)), self.register_pool()])
        self.assertIn('admission review: passed', message)
        message = self.review([(BANK, encode('setMinBetAmount(uint256)', 98))])
        self.assertIn('minimum bet 98 below the certified floor 99 (the k = 0 path)', message)

    def test_an_uncertified_module_or_other_game_limits_fail(self):
        self.chain.code[MODULE2] = '0x60ff'
        register = 'registerGame(bytes32,address,uint32,uint32)'
        cases = [
            ((HUB, encode(register, game_id('NEW'), MODULE2, ROUNDS, GAS)),
             f'module {MODULE2}: its runtime is not a certified module'),
            ((HUB, encode(register, game_id('NEW'), MODULES['moduleDice'], ROUNDS, 2_000_000)),
             'callbackGasLimit 2000000 is not the certified 2447746'),
            ((HUB, encode(register, game_id('NEW'), MODULES['moduleDice'], 26, GAS)), 'maxBetCount 26 outside 1..25'),
            ((HUB, encode(register, game_id('NEW'), addr(0xeee), ROUNDS, GAS)), f'module {addr(0xeee)} has no code'),
        ]
        for call_, reason in cases:
            with self.subTest(reason=reason):
                message = self.review([call_])
                self.assertIn('ADMISSION REVIEW FAILED', message)
                self.assertIn(reason, message)

    def test_a_governance_transfer_adoption_or_foreign_wiring_fails(self):
        message = self.review([(BANK, encode('transferGovernance(address)', STRANGER))])
        self.assertIn('ADMISSION REVIEW FAILED: cancel before', message)
        self.assertIn(f'1. Bank pool 1.transferGovernance({STRANGER}) -> FAILED: moves the governance of Bank pool 1 '
                      'away from the timelock', message)
        self.deploy_pool()
        # A certified runtime that another governance configured first (a hub with its own games, a Bank with its own
        # router) would pass the runtime checks, so adopting it fails the review.
        self.chain.code[HUB2] = HUB_CODE
        message = self.review([(HUB2, encode('acceptGovernance()')), (BANK2, encode('acceptGovernance()'))])
        self.assertIn(f'1. new GameHub {HUB2}.acceptGovernance() -> FAILED: the timelock adopts new GameHub {HUB2}, '
                      'which another governance configured', message)
        self.assertIn(f'2. new Bank {BANK2}.acceptGovernance() -> FAILED', message)
        message = self.review([(BANK2, encode('setSettlementRouterOnce(address)', STRANGER))])
        self.assertIn(f'{STRANGER} is not the release SettlementRouter', message)
        message = self.review([(HUB, encode('registerPool(uint64,address,address,uint8)', 2, TOKEN, BANK2, 1))])
        self.assertIn('is not a governed function of GameHub: not reviewed', message)

    def test_authority_changes_are_named_without_failing(self):
        message = self.review([(TIMELOCK, encode('grantRole(bytes32,address)', PROPOSER, STRANGER)),
                               (BANK, encode('setGuardian(address)', STRANGER)),
                               (TIMELOCK, encode('updateDelay(uint256)', 345_600))])
        self.assertIn('1. GovernanceTimelock.grantRole(PROPOSER_ROLE, ', message)
        self.assertIn('changes the timelock roles: the live release verification fails once this executes', message)
        self.assertIn('not the release guardian', message)
        self.assertIn('the new delay of 345600 s applies to operations scheduled afterwards', message)
        self.assertIn('admission review: passed', message)


def words(*values):
    return '0x' + ''.join(format(value(v), '064x') for v in values)


class UnbookedResultTest(MonitorFixture):
    """ADR-0037 §7.3 rule 4: unbooked results tracked from VRFHub's result logs, with vrfRequestedAt from GameHub."""

    def setUp(self):
        super().setUp()
        self.count = 0

    def time(self, block):
        return self.chain.block_time(block)

    def set_count(self, delta):
        self.count += delta
        self.chain.put(VRFHUB, 'unbookedResultCount(address)', [BANK], self.count)

    def receive(self, request, bet, requested_at, block, settle=False):
        """The VRF result of `bet` arrives in `block`; unless it settles in that transaction it stays unbooked."""
        tx = word(0x7e5000 + request)
        self.chain.emit(VRFHUB, MON.RECEIVED, [request, BANK], [0x5eed], block=block, tx=tx)
        self.chain.calls[(VRFHUB, encode('getRequest(uint256)', request))] = words(BANK, HUB, bet, KEEPER, 1, 1, 0x5eed, 2)
        fields = [0] * MON.BET_WORDS
        fields[MON.BET_ID], fields[MON.BET_BANK], fields[MON.BET_REQUEST] = bet, value(BANK), request
        fields[MON.BET_REQUESTED_AT] = requested_at
        self.chain.calls[(HUB, encode('getBet(uint256)', bet))] = words(*fields)
        if settle:
            self.chain.emit(VRFHUB, MON.ACKNOWLEDGED, [request, BANK], block=block, tx=tx)
        else:
            self.set_count(1)

    def settle(self, request, block):
        self.chain.emit(VRFHUB, MON.ACKNOWLEDGED, [request, BANK], block=block)
        self.set_count(-1)

    def void(self, request, bet, block):
        tx = word(0x701d000 + request)
        self.chain.emit(HUB, 'BetVoided(uint256,address,uint256,bytes32)', [bet, KEEPER], [5000, 0xbad], block=block, tx=tx)
        self.chain.emit(VRFHUB, MON.VOIDED, [request, BANK], block=block, tx=tx)
        self.set_count(-1)

    def window(self, block):
        cohort = self.time(block)
        self.chain.emit(HUB, MON.WINDOW, [1, BANK, GUARDIAN], [cohort], block=block)
        self.chain.put(HUB, 'voidCohortEnd(address)', [BANK], cohort)
        return cohort

    def reads(self, name):
        selector = signature(name)[:10]
        return sum(1 for method, params in self.chain.requests
                   if method == 'eth_call' and params[0]['data'].startswith(selector))

    def test_a_result_settled_in_its_own_transaction_is_not_tracked(self):
        self.armed()
        self.chain.requests.clear()
        self.receive(61, 31, self.time(190), block=195, settle=True)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(self.state()['voids']['unbooked'], {})
        self.assertEqual(self.reads('getRequest(uint256)'), 0)

    def test_a_result_unbooked_for_an_hour_is_alerted_and_cleared_when_booked(self):
        self.armed()
        self.receive(41, 7, self.time(190), block=195)
        self.chain.emit(HUB, 'CallbackSettlementFailed(uint256,bytes32)', [7], [0xdead], block=195)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.assertNotIn('UNBOOKED RESULT', self.ops()[-1])
        entry = self.state()['voids']['unbooked']['41']
        self.assertEqual((entry['betId'], entry['requestedAt'], entry['receivedAt']), (7, self.time(190), self.time(195)))
        self.chain.head = 195 + 1800 + 12
        self.assertEqual(self.run_once(), 0)
        self.assertIn('UNBOOKED RESULT OLDER THAN 1.0 h', self.ops()[-1])
        self.assertIn(f'- NEW Bank pool 1: request 41 (position 7) unbooked since {MON.utc(self.time(195))}, 1.0 h',
                      self.ops()[-1])
        self.settle(41, block=2000)
        self.chain.head = 2020
        self.assertEqual(self.run_once(), 0)
        self.assertIn('Booked or voided since; previously reported as unbooked:\n- Bank pool 1: request 41', self.ops()[-1])
        self.assertEqual(self.state()['voids']['unbooked'], {})

    def test_a_result_nearing_seven_days_is_warned_once(self):
        self.armed()
        now = self.time(198)
        self.receive(42, 8, now - 7 * 86_400 + 6 * 3600, block=195)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.assertIn('UNBOOKED RESULT REACHES 7 DAYS SOON', self.ops()[-1])
        self.assertIn(f'- Bank pool 1: position 8 (request 42), requested {MON.utc(now - 7 * 86_400 + 6 * 3600)}, '
                      f'reaches 7 days at {MON.utc(now + 6 * 3600)}, in 6.0 h', self.ops()[-1])
        sent = len(self.ops())
        self.chain.head = 230
        self.assertEqual(self.run_once(), 0)
        self.assertFalse(any('REACHES 7 DAYS' in text for text in self.ops()[sent:]))

    def test_an_eligible_bet_left_unattempted_is_alerted_until_voided(self):
        self.armed()
        self.receive(43, 9, self.time(196) - 2 * 86_400, block=195)
        cohort = self.window(block=196)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'VoidWindowOpened pool 1 (Bank pool 1) for bets requested through {MON.utc(cohort)}',
                      self.ops()[-1])
        self.assertNotIn('ELIGIBLE BET NOT ATTEMPTED', self.ops()[-1])
        self.chain.head = 196 + 300 + 12 - 1  # one block short of N = 300 blocks after the window opened
        self.assertEqual(self.run_once(), 0)
        self.assertFalse(any('ELIGIBLE BET NOT ATTEMPTED' in text for text in self.ops()))
        self.chain.head += 1
        self.assertEqual(self.run_once(), 0)
        self.assertIn('ELIGIBLE BET NOT ATTEMPTED', self.ops()[-1])
        self.assertIn(f'- NEW Bank pool 1: position 9 (request 43) eligible since {MON.utc(cohort)} on the path of the '
                      f'window opened {MON.utc(cohort)}, still unbooked 600 seconds later', self.ops()[-1])
        self.void(43, 9, block=510)
        self.chain.head = 530
        self.assertEqual(self.run_once(), 0)
        self.assertIn('Settled or voided since; previously reported as not attempted:', self.ops()[-1])
        self.assertIn('BetVoided position 9 by keeper', self.ops()[-1])

    def test_an_unattempted_bet_is_alerted_600_seconds_after_eligibility_at_200ms_blocks(self):
        self.chain.denim(1000)
        self.armed()
        self.receive(43, 9, self.time(996) - 2 * 86_400, block=995)
        cohort = self.window(block=996)  # second 199
        self.chain.head = 1200
        self.assertEqual(self.run_once(), 0)
        self.assertNotIn('ELIGIBLE BET NOT ATTEMPTED', self.ops()[-1])
        # 600 seconds after second 199 is second 799; it is confirmed once the head reaches second 823 (block 4115).
        self.chain.head = 4114
        self.assertEqual(self.run_once(), 0)
        self.assertFalse(any('ELIGIBLE BET NOT ATTEMPTED' in text for text in self.ops()))
        self.chain.head = 4115
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'- NEW Bank pool 1: position 9 (request 43) eligible since {MON.utc(cohort)} on the path of the '
                      f'window opened {MON.utc(cohort)}, still unbooked 600 seconds later', self.ops()[-1])

    def test_a_bet_eligible_by_the_seven_day_limit_is_tracked_on_that_path(self):
        self.armed()
        self.receive(44, 10, self.time(195) - 7 * 86_400 - 3600, block=195)
        self.chain.head = 195 + 300 + 12
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'- NEW Bank pool 1: position 10 (request 44) eligible since {MON.utc(self.time(195))} on the 7-day '
                      'path, still unbooked 600 seconds later', self.ops()[-1])

    def test_a_bet_settled_after_a_void_on_the_same_path_is_reported(self):
        self.armed()
        self.receive(51, 21, self.time(190) - 2 * 86_400, block=195)
        self.receive(52, 22, self.time(190) - 2 * 86_400 + 60, block=195)
        cohort = self.window(block=196)
        self.receive(53, 23, self.time(197), block=197)  # requested after the window: the 7-day path, not eligible
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.settle(52, block=215)  # settles before any void: nothing to report
        self.void(51, 21, block=220)
        self.settle(53, block=221)  # the 7-day path, and not eligible yet
        self.chain.head = 240
        self.assertEqual(self.run_once(), 0)
        self.assertNotIn('BET SETTLED AFTER A VOID', self.ops()[-1])
        # Not reported either: a bet eligible on the 7-day path (requested 8 days before the window opened), a bet of
        # the window's cohort that settles before it is 24 hours old, and a late result that arrives and settles in
        # one transaction.
        self.receive(56, 26, cohort - 8 * 86_400, block=229)
        self.receive(57, 27, cohort - 3600, block=229)
        self.chain.head = 245
        self.assertEqual(self.run_once(), 0)
        self.settle(56, block=236)
        self.settle(57, block=237)
        self.receive(58, 28, self.time(190) - 2 * 86_400 + 240, block=238, settle=True)
        self.chain.head = 250
        self.assertEqual(self.run_once(), 0)
        self.assertNotIn('BET SETTLED AFTER A VOID', self.ops()[-1])
        # A second bet of the window's cohort, eligible since the window opened, settles after the void.
        self.receive(55, 25, self.time(190) - 2 * 86_400 + 180, block=240)
        self.chain.head = 255
        self.assertEqual(self.run_once(), 0)
        self.settle(55, block=246)
        self.chain.head = 260
        self.assertEqual(self.run_once(), 0)
        self.assertIn('BET SETTLED AFTER A VOID ON THE SAME PATH', self.ops()[-1])
        self.assertIn(f'- Bank pool 1: position 25 settled in block 246 (tx ', self.ops()[-1])
        self.assertIn(f'while eligible on the path of the window opened {MON.utc(cohort)}, after position 21 on that '
                      'path was voided in block 220', self.ops()[-1])
        self.assertIn('BET SETTLED AFTER A VOID ON THE SAME PATH', self.public()[-1])

    def test_results_received_before_arming_are_reported_as_untracked(self):
        self.set_count(2)
        self.assertEqual(self.run_once(), 0)
        self.assertIn('UNBOOKED RESULTS NOT TRACKED', self.ops()[-1])
        self.assertIn('- NEW Bank pool 1: 2 unbooked result(s) on chain, 0 tracked', self.ops()[-1])
        self.set_count(-2)
        self.chain.head = 220
        self.assertEqual(self.run_once(), 0)
        self.assertIn('The VRFHub count matches the tracked results again', self.ops()[-1])

    def test_a_window_opened_before_arming_counts(self):
        cohort = self.time(150)
        self.chain.put(HUB, 'voidCohortEnd(address)', [BANK], cohort)
        self.armed()
        self.assertEqual(self.state()['voids']['windows'], {BANK: [[cohort, None, None]]})
        self.receive(45, 11, cohort - 86_400, block=195)
        self.chain.head = 195 + 300 + 12
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'- NEW Bank pool 1: position 11 (request 45) eligible since {MON.utc(self.time(195))} on the path '
                      f'of the window opened {MON.utc(cohort)}', self.ops()[-1])

    def test_result_reads_are_bounded_per_run_oldest_first(self):
        self.reconfigure(DRIFT_RESULT_READS_PER_RUN='2')
        self.armed()
        for i in range(5):
            self.receive(70 + i, 40 + i, self.time(185), block=191 + i)
        self.chain.head = 210
        loaded = []
        for _ in range(3):
            self.chain.requests.clear()
            self.assertEqual(self.run_once(), 0)
            self.assertLessEqual(self.reads('getRequest(uint256)'), 2)
            entries = self.state()['voids']['unbooked']
            loaded.append(sorted(int(key) for key, entry in entries.items() if entry['loaded']))
        self.assertEqual(loaded, [[70, 71], [70, 71, 72, 73], [70, 71, 72, 73, 74]])


class LiveVerificationTest(MonitorFixture):
    def verification_pages(self):
        """eth_getLogs ranges of the live verification, which reads only the governed contracts and the timelock."""
        return [params[0] for method, params in self.chain.requests
                if method == 'eth_getLogs' and ROUTER not in params[0]['address']]

    def test_a_failure_is_alerted_reminded_and_recovered(self):
        self.armed()
        self.chain.emit(TIMELOCK, 'RoleGranted(bytes32,address,address)', [PROPOSER, STRANGER, TIMELOCK], block=195)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        [message] = self.ops()
        self.assertIn('LIVE RELEASE VERIFICATION FAILED', message)
        self.assertIn('- NEW timelock roles differ from release', message)
        self.assertIn(f'RoleGranted PROPOSER_ROLE to {STRANGER} by GovernanceTimelock (not a release role)', message)
        self.assertEqual(self.state()['governanceCheckpoint']['blockNumber'], 198)  # advances even when failing
        self.now += 600
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.ops()), 1)
        self.now += 21_600
        self.assertEqual(self.run_once(), 0)
        self.assertIn('- timelock roles differ from release', self.ops()[-1])
        self.chain.emit(TIMELOCK, 'RoleRevoked(bytes32,address,address)', [PROPOSER, STRANGER, TIMELOCK], block=230)
        self.chain.head = 250
        self.assertEqual(self.run_once(), 0)
        self.assertIn('Live release verification passes again; previously reported:\n- timelock roles differ from '
                      'release', self.ops()[-1])
        self.assertEqual(self.state()['conditions']['governance'], {})

    def test_changed_notes_are_reported(self):
        self.armed()
        self.chain.emit(BANK, 'RiskInPausedSet(bool,address)', [GUARDIAN], [1], block=195)
        self.chain.put(BANK, 'paused()', [], 1)
        self.chain.head = 210
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'RELEASE STATE NOTES CHANGED (the live release verification passed)\n- NEW Bank {BANK} paused',
                      self.ops()[-1])
        self.chain.emit(BANK, 'RiskInPausedSet(bool,address)', [TIMELOCK], [0], block=220)
        self.chain.put(BANK, 'paused()', [], 0)
        self.chain.head = 240
        self.assertEqual(self.run_once(), 0)
        self.assertIn(f'- no longer: Bank {BANK} paused', self.ops()[-1])

    def test_each_verification_replays_only_the_blocks_since_the_last_one(self):
        self.chain.requests.clear()
        self.armed()
        self.assertEqual(min(int(page['fromBlock'], 16) for page in self.verification_pages()), CHECKPOINT_BLOCK + 1)
        self.chain.requests.clear()
        self.chain.head = 260
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(min(int(page['fromBlock'], 16) for page in self.verification_pages()), 189)
        # A reorg below the monitor's own checkpoint sends it back to the signed one.
        self.chain.hashes[248] = word(0xdead)
        self.chain.requests.clear()
        self.chain.head = 270
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(min(int(page['fromBlock'], 16) for page in self.verification_pages()), CHECKPOINT_BLOCK + 1)

    def test_a_newly_signed_record_restarts_from_its_own_checkpoint(self):
        self.armed()
        self.chain.head = 260
        self.assertEqual(self.run_once(), 0)
        # The Owner signs a new record at block 240 and installs it with the same state file.
        state, _, _ = VG.verify_permissions(self.chain, self.snap, 240, None, 'live')
        document = VG.checkpoint_document(self.snap, state, 240, self.chain.block_hash(240))
        self.checkpoint_path.write_text(json.dumps(document))
        self.record_path.write_text(json.dumps({**self.record, 'checkpointBlockNumber': 240,
                                                'checkpointBlockHash': self.chain.block_hash(240),
                                                'checkpointSha256': VG.checkpoint_digest(document)}))
        self.reconfigure()
        self.chain.requests.clear()
        self.chain.head = 270
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(min(int(page['fromBlock'], 16) for page in self.verification_pages()), 241)
        self.assertEqual(self.state()['signedCheckpointSha256'], VG.checkpoint_digest(document))

    def test_the_verification_runs_hourly_unless_an_event_appears(self):
        self.reconfigure(DRIFT_GOVERNANCE_CHECK_SECONDS='3600')
        self.armed()
        self.chain.requests.clear()
        self.now += 600
        self.chain.head = 220
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(self.verification_pages(), [])
        self.chain.emit(HUB, 'GameDisabled(bytes32,address)', [game_id('DICE'), SAFE], block=215)
        self.chain.put(HUB, 'gameDisabled(bytes32)', [game_id('DICE')], 1)
        self.chain.head = 230
        self.assertEqual(self.run_once(), 0)
        self.assertTrue(self.verification_pages())
        self.assertIn(f'- NEW game {word(game_id("DICE"))} disabled', self.ops()[-1])

    def test_a_signed_checkpoint_must_match_its_record(self):
        document = json.loads(self.checkpoint_path.read_text())
        document['state']['registeredHubs'][STRANGER] = True
        self.checkpoint_path.write_text(json.dumps(document))
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            self.assertEqual(MON.main([], env=self.env), 2)
        self.assertIn('checkpoint differs from its signed digest', err.getvalue())
        self.record_path.write_text(json.dumps({**self.record, 'blockNumber': SNAP_BLOCK + 1}))
        with self.assertRaisesRegex(MON.VerificationError, 'release record belongs to another release'):
            MON.Config(self.env)

    def test_an_rpc_failure_during_the_verification_fails_the_run_not_the_release(self):
        self.armed()
        self.chain.fail = 'eth_getBlockByNumber'
        self.assertEqual(self.run_once(), 1)
        state = self.state()
        self.assertEqual((state['failures'], state['conditions']['governance']), (1, {}))


class TelegramDeliveryTest(MonitorFixture):
    """The ops Telegram path goes through alert-notify.py and never prints the token."""

    def test_telegram_message_is_sent_without_leaking_the_token(self):
        received = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append((self.path, json.loads(self.rfile.read(int(self.headers['content-length'])))))
                body = b'{"ok": true, "result": {}}'
                self.send_response(200)
                self.send_header('content-length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        token = '123456:SECRET-telegram_token'
        self.reconfigure(TELEGRAM_BOT_TOKEN=token, TELEGRAM_CHAT_ID='42',
                         TELEGRAM_API_BASE=f'http://127.0.0.1:{server.server_port}', ALERT_WEBHOOK_URL=None)
        self.assertEqual(self.run_once(), 0)
        [(path, payload)] = received
        self.assertEqual(payload['chat_id'], '42')
        self.assertIn('armed on chain 84532', payload['text'])
        self.assertNotIn(token, self.last_output)


def solidity_files(*patterns):
    files = []
    for pattern in patterns:
        files += sorted(ROOT.glob(pattern))
    return files


SOURCES = {
    'timelock': ('src/access/GovernanceTimelock.sol', 'lib/openzeppelin-contracts/contracts/governance/TimelockController.sol',
                 'lib/openzeppelin-contracts/contracts/access/AccessControl.sol',
                 'lib/openzeppelin-contracts/contracts/access/IAccessControl.sol'),
    'registry': ('src/core/PoolRegistry.sol', 'src/core/interfaces/IPoolRegistry.sol', 'src/access/Sentinel.sol',
                 'src/access/Governable.sol'),
    'hub': ('src/core/GameHub.sol', 'src/core/interfaces/IGameHub.sol', 'src/access/Sentinel.sol',
            'src/access/Governable.sol'),
    'bank': ('src/core/Bank.sol', 'src/core/interfaces/IBank.sol', 'src/core/interfaces/ILiquidityVaultBank.sol',
             'src/access/Sentinel.sol', 'src/access/Governable.sol', 'lib/openzeppelin-contracts/contracts/utils/Pausable.sol'),
    'referral': ('src/engines/referral/ReferralRegistry.sol', 'src/engines/referral/IReferralRegistry.sol',
                 'src/access/Governable.sol'),
    'router': ('src/core/SettlementRouter.sol', 'src/core/interfaces/ISettlementRouter.sol'),
    'vrfhub': ('src/core/VRFHub.sol', 'src/core/interfaces/IVRFHub.sol'),
    'vault': ('src/core/LiquidityVault.sol', 'src/vendor/azuro-v3/utils/LiquidityTree.sol',
              'lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol',
              'lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol'),
}
TYPES = {'RequestState': 'uint8', 'SSOTTypes.PoolDomain': 'uint8', 'PoolDomain': 'uint8'}


def canonical(params):
    types = []
    for param in filter(None, (p.strip() for p in params.replace('\n', ' ').split(','))):
        kind = param.split()[0]
        types.append(TYPES.get(kind, kind))
    return ','.join(types)


def declared_events(paths):
    found = {}
    for path in paths:
        text = (ROOT / path).read_text()
        for name, params in re.findall(r'event\s+(\w+)\s*\(([^)]*)\)\s*;', text):
            found.setdefault(name, set()).add(f'{name}({canonical(params)})')
    return found


class SignaturesMatchSourceTest(unittest.TestCase):
    """The tables must match the contract sources; the fake chain above reuses the monitor's own strings, so only these
    tests catch a mistyped signature or an event a contract emits that the monitor does not classify."""

    def test_watched_events_are_declared_with_their_types(self):
        for kind, names in MON.EVENTS.items():
            if kind == 'token':
                continue  # FiatTokenProxy and FiatToken are not in this repository
            declared = declared_events(SOURCES[kind])
            for name in names:
                with self.subTest(kind=kind, event=name):
                    self.assertIn(name, declared.get(name.split('(')[0], set()))

    def test_every_watched_event_a_contract_emits_is_classified_for_it(self):
        watched = set(MON.WATCHED)
        for kind, paths in SOURCES.items():
            declared = declared_events(paths)
            emitted = set()
            for path in paths:
                emitted.update(re.findall(r'emit\s+(\w+)\s*\(', (ROOT / path).read_text()))
            for name in sorted(emitted):
                for event in declared.get(name, set()) & watched:
                    with self.subTest(kind=kind, event=event):
                        self.assertIn(event, MON.EVENTS[kind])

    def test_every_governed_function_is_reviewed_with_its_types(self):
        functions = {}
        for path in solidity_files('src/core/*.sol', 'src/access/*.sol', 'src/engines/referral/*.sol'):
            text = path.read_text()
            for name, params, modifiers in re.findall(r'function\s+(\w+)\s*\(([^)]*)\)([^{;]*)[{;]', text):
                functions.setdefault(name, set()).add((f'{name}({canonical(params)})', modifiers))
        governed = {sig for entries in functions.values() for sig, modifiers in entries
                    if re.search(r'\bonlyGov(OrSentinel)?\b', modifiers)}
        # Functions that authorize inside their body (ADR-0037 §3).
        governed |= {'setPoolActive(uint64,bool)', 'setHubRegistered(address,bool)',
                     'setHubAllowedForPool(uint64,address,bool)', 'setRiskInPaused(bool)', 'openVoidWindow(uint64)',
                     'transferGovernance(address)', 'acceptGovernance()'}
        self.assertTrue(governed <= set(MON.FUNCTIONS), governed - set(MON.FUNCTIONS))
        timelock = ''.join((ROOT / path).read_text() for path in SOURCES['timelock'])
        declared = {sig for entries in functions.values() for sig, _ in entries}
        for fn in MON.FUNCTIONS:
            with self.subTest(function=fn):
                name = fn.split('(')[0]
                in_timelock = any(f'{n}({canonical(p)})' == fn for n, p in
                                  re.findall(r'function\s+(\w+)\s*\(([^)]*)\)', timelock) if n == name)
                self.assertTrue(fn in declared or in_timelock, fn)

    def test_result_views_and_void_delays_match_the_sources(self):
        def fields(path, struct):
            body = re.search(rf'struct {struct} {{(.*?)\n    }}', (ROOT / path).read_text(), re.S).group(1)
            declared = [re.sub(r'//.*', '', line).strip() for line in body.splitlines()]
            return [line.rstrip(';').split() for line in declared if line]
        bet = fields('src/core/interfaces/SSOTTypes.sol', 'Bet')
        names = [field[-1] for field in bet]
        self.assertEqual(len(bet), MON.BET_WORDS)
        self.assertEqual([names.index(n) for n in ('betId', 'bank', 'requestId', 'vrfRequestedAt')],
                         [MON.BET_ID, MON.BET_BANK, MON.BET_REQUEST, MON.BET_REQUESTED_AT])
        self.assertTrue(all(field[0] in ('uint256', 'bytes32', 'address', 'uint32', 'uint16', 'uint64', 'BetState')
                            for field in bet))  # static fields only: the tuple is returned inline
        request = fields('src/core/interfaces/IVRFHub.sol', 'RequestInfo')
        names = [field[-1] for field in request]
        self.assertEqual((len(request), names.index('bank'), names.index('hub'), names.index('betId')),
                         (MON.REQUEST_WORDS, MON.REQUEST_BANK, MON.REQUEST_HUB, MON.REQUEST_BET))
        game_hub = (ROOT / 'src/core/GameHub.sol').read_text()
        self.assertIn('VOID_DELAY = 24 hours;', game_hub)
        self.assertIn('PUBLIC_VOID_DELAY = 7 days;', game_hub)
        self.assertEqual((MON.VOID_DELAY, MON.PUBLIC_VOID_DELAY), (24 * 3600, 7 * 24 * 3600))
        self.assertIn('requestedAt <= voidCohortEnd[b.bank] ? VOID_DELAY : PUBLIC_VOID_DELAY', game_hub)
        self.assertIn('uint256 betId) external view override returns (SSOTTypes.Bet memory)', game_hub)
        self.assertRegex((ROOT / 'src/core/VRFHub.sol').read_text(),
                         r'mapping\(address => uint256\) public override unbookedResultCount;')

    def test_getters_and_constants_exist(self):
        game_hub = (ROOT / 'src/core/GameHub.sol').read_text()
        for getter in ('gameModule', 'gameMaxBetCount', 'gameCallbackGasLimit'):
            self.assertRegex(game_hub, rf'public override {getter};')
        bank = (ROOT / 'src/core/Bank.sol').read_text()
        self.assertRegex(bank, r'uint256 public (override )?minBetAmount')
        self.assertIn(f'MAX_OPEN_HOLDS = {MON.MAX_OPEN_HOLDS};', bank)
        self.assertRegex(bank, r'function openHolds\(\) public view')


if __name__ == '__main__':
    unittest.main()
