"""The preflight plan review (script/release/verify_dryrun_plan.py) on a synthetic build: no compiler and no chain.

Small stand-in artifacts make every init code and runtime hash known, so a conforming plan can be written here from
the deployment rules of ADR-0037 D1 (creations only, the timelock first, every governed contract under it) and each
refusal is one change to it. cast computes the addresses, encodings and hashes, as in the review itself.
"""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'script/release/verify_dryrun_plan.py'
CHAIN = 84532
DEPLOYER = '0x' + 'd0' * 20
GOV, GUARDIAN, WRAPPER, TOKEN = '0x' + '5a' * 20, '0x' + '6a' * 20, '0x' + '7a' * 20, '0x' + '8a' * 20
ZERO = '0x' + '00' * 20
FIRST_NONCE = 3
MODULES = (('DICE', 'DiceModule', 'moduleDice'), ('COIN_TOSS', 'CoinTossModule', 'moduleCoinToss'),
           ('ROULETTE', 'RouletteModule', 'moduleRoulette'), ('KENO', 'KenoModule', 'moduleKeno'),
           ('PLINKO', 'PlinkoModule', 'modulePlinko'), ('SIC_BO', 'SicBoModule', 'moduleSicBo'),
           ('SLOTS', 'SlotsModule', 'moduleSlots'), ('BACCARAT', 'BaccaratModule', 'moduleBaccarat'))
CORE = ('GovernanceTimelock', 'PoolRegistry', 'SettlementRouter', 'VRFHub', 'ReferralRegistry', 'DefaultReferralEngine',
        'GameHub', 'Bank', 'LiquidityVault')


def cast(*args):
    return subprocess.check_output(['cast', *map(str, args)], text=True).strip()


def address(sender, nonce):
    return cast('compute-address', sender, '--nonce', nonce).split()[-1].lower()


def encode(signature, *args):
    return cast('abi-encode', signature, *args)[2:] if args else ''


def initcode(name):
    return '0x6080' + name.encode().hex()


def runtime(name):
    return '0x6001' + name.encode().hex()


class PlanReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.addresses = [address(DEPLOYER, FIRST_NONCE + i) for i in range(16)]
        cls.vault = address(cls.addresses[7], 1)
        cls.runtime_hashes = {name: cast('keccak', runtime(name)).lower()
                              for name in CORE + tuple(contract for _, contract, _ in MODULES)}

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        base = Path(self.directory.name)
        self.work, self.pre = base / 'work', base / 'pre'
        for name in CORE + tuple(contract for _, contract, _ in MODULES):
            path = self.work / 'out' / f'{name}.sol' / f'{name}.json'
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({'bytecode': {'object': initcode(name)},
                                        'deployedBytecode': {'object': runtime(name)}}))
        (self.pre / 'chain').mkdir(parents=True)
        self.domain = {
            'token': {'proxy': TOKEN}, 'consumerCallbackGasLimit': 900_000, 'maxBetCountCeiling': 25,
            'ownerPolicy': {'riskReserveBps': 6000, 'withdrawalBufferBps': 1000, 'casinoMinBetAmount': 10_000},
            'moduleCodeHashes': {key: self.runtime_hashes[contract] for _, contract, key in MODULES},
            'coreRuntimes': {name: {'keccakWithImmutablesZeroed': self.runtime_hashes[name],
                                    'runtimeBytes': len(runtime(name)) // 2 - 1} for name in CORE}}
        self.readback = {'allChecksPass': True, 'chainId': CHAIN, 'domainFile': str(self.pre / 'domain.json'),
                         'deployer': {'address': DEPLOYER, 'latestNonce': FIRST_NONCE, 'pendingNonce': FIRST_NONCE},
                         'domain': {'token': TOKEN, 'tokenDecimals': 6}}
        self.params = {'CHAIN_ID': CHAIN, 'DEPLOYER': DEPLOYER, 'GOV': GOV, 'GUARDIAN': GUARDIAN,
                       'VRF_WRAPPER': WRAPPER, 'NUM_POOLS': 1, 'POOL_ASSET_0': TOKEN, 'BANK_MIN_BET_AMOUNT_0': 10_000,
                       **{f'GAME_CALLBACK_GAS_LIMIT_{name}': 900_000 for name, _, _ in MODULES},
                       **{f'GAME_MAX_BET_COUNT_{name}': 25 for name, _, _ in MODULES}}
        self.plan = self.conforming_plan()

    def tearDown(self):
        self.directory.cleanup()

    def conforming_plan(self):
        a = self.addresses
        creations = [
            ('GovernanceTimelock', encode('constructor(uint256,address[],address[],address[])', 259_200,
                                          f'[{GOV}]', f'[{GUARDIAN}]', f'[{ZERO}]')),
            ('PoolRegistry', encode('constructor(address)', a[0])),
            ('SettlementRouter', encode('constructor(address)', a[1])),
            ('VRFHub', encode('constructor(address,address)', WRAPPER, a[2])),
            ('ReferralRegistry', encode('constructor(address)', a[0])),
            ('DefaultReferralEngine', ''),
            ('GameHub', encode('constructor(address,address,address,address,address,uint256,uint16,uint16,uint16,'
                               'uint16,uint16)', a[2], a[3], a[4], a[5], a[0], 3600, 200, 1000, 2000, 500, 3000)),
            ('Bank', encode('constructor(address,address,uint256,uint8,uint256)', TOKEN, a[0], 6000, 6, 10_000)),
        ] + [(contract, '') for _, contract, _ in MODULES]
        rows = []
        for i, (name, arguments) in enumerate(creations):
            row = {'transactionType': 'CREATE', 'contractName': name, 'contractAddress': a[i],
                   'transaction': {'from': DEPLOYER, 'to': None, 'nonce': hex(FIRST_NONCE + i), 'chainId': hex(CHAIN),
                                   'value': '0x0', 'input': initcode(name) + arguments}}
            if name == 'Bank':
                row['additionalContracts'] = [{'contractName': 'LiquidityVault', 'address': self.vault,
                                               'initCode': initcode('LiquidityVault')
                                               + encode('constructor(address,address)', TOKEN, a[i])}]
            rows.append(row)
        return {'chain': CHAIN, 'receipts': [], 'libraries': [], 'pending': [], 'transactions': rows}

    def review(self):
        (self.pre / 'domain.json').write_text(json.dumps(self.domain))
        (self.pre / 'chain/chain-readback.json').write_text(json.dumps(self.readback))
        (self.pre / 'chain/deploy-params.env').write_text(''.join(f'{k}={v}\n' for k, v in self.params.items()))
        plan = self.pre / f'plan/DeployV16.s.sol/{CHAIN}/dry-run/run-latest.json'
        plan.parent.mkdir(parents=True, exist_ok=True)
        plan.write_text(json.dumps(self.plan))
        return subprocess.run(['python3', str(SCRIPT), str(self.work), str(self.pre)], capture_output=True, text=True,
                              timeout=120)

    def refused(self, reason):
        result = self.review()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(f'plan review failed: {reason}', result.stderr)
        self.assertFalse((self.pre / 'plan-review.json').exists())

    def test_a_conforming_plan_passes_with_every_creation_reviewed(self):
        result = self.review()
        self.assertEqual(result.returncode, 0, result.stderr)
        review = json.loads((self.pre / 'plan-review.json').read_text())
        self.assertEqual(review['governanceTimelock'], self.addresses[0])
        self.assertEqual((review['nonceFirst'], review['nonceLast'], review['transactions']), (3, 18, 16))
        self.assertEqual(review['vaults'], [self.vault])
        self.assertEqual([row['contract'] for row in review['reviewed']][:8],
                         ['GovernanceTimelock', 'PoolRegistry', 'SettlementRouter', 'VRFHub', 'ReferralRegistry',
                          'DefaultReferralEngine', 'GameHub', 'Bank'])

    def test_the_timelock_must_give_the_safe_and_the_guardian_their_roles_and_nobody_else(self):
        self.plan['transactions'][0]['transaction']['input'] = initcode('GovernanceTimelock') + encode(
            'constructor(uint256,address[],address[],address[])', 259_200, f'[{DEPLOYER}]', f'[{GUARDIAN}]', f'[{ZERO}]')
        self.refused('transaction 0 (GovernanceTimelock) init code differs from the artifact and constructor')

    def test_a_governed_contract_under_another_governance_is_refused(self):
        self.plan['transactions'][1]['transaction']['input'] = initcode('PoolRegistry') + encode('constructor(address)',
                                                                                                  DEPLOYER)
        self.refused('transaction 1 (PoolRegistry) init code differs from the artifact and constructor')

    def test_only_creations_from_the_deployer_in_nonce_order_without_value(self):
        extra = copy.deepcopy(self.plan)
        extra['transactions'].append({'transactionType': 'CALL', 'contractName': None, 'contractAddress': None,
                                      'transaction': {'from': DEPLOYER, 'to': self.addresses[1], 'input': '0x12345678',
                                                      'nonce': hex(FIRST_NONCE + 16), 'chainId': hex(CHAIN), 'value': '0x0'}})
        self.plan = extra
        self.refused('17 transactions planned, 16 expected')
        self.plan = self.conforming_plan()
        self.plan['transactions'][2]['transaction']['value'] = '0x1'
        self.refused('transaction 2 header')
        self.plan = self.conforming_plan()
        self.plan['transactions'][3]['transaction']['nonce'] = hex(FIRST_NONCE + 4)
        self.refused('transaction 3 header')
        self.plan = self.conforming_plan()
        self.plan['transactions'][4]['contractAddress'] = self.addresses[5]
        self.refused('transaction 4 creates at another address')

    def test_each_bank_creates_its_vault_first_with_its_asset(self):
        self.plan['transactions'][7]['additionalContracts'][0]['address'] = address(self.addresses[7], 2)
        self.refused("pool 0: the Vault is not the Bank's first creation")
        self.plan = self.conforming_plan()
        self.plan['transactions'][7]['additionalContracts'][0]['initCode'] = initcode('LiquidityVault') + encode(
            'constructor(address,address)', WRAPPER, self.addresses[7])
        self.refused('pool 0: Vault init code differs')

    def test_the_build_must_be_the_certified_one(self):
        self.domain['moduleCodeHashes']['moduleKeno'] = '0x' + '11' * 32
        self.refused('KenoModule runtime is not the certified code')
        self.domain = json.loads((self.pre / 'domain.json').read_text())
        self.domain['moduleCodeHashes']['moduleKeno'] = self.runtime_hashes['KenoModule']
        self.domain['coreRuntimes']['GameHub']['runtimeBytes'] += 1
        self.refused('GameHub runtime is not the certified code')

    def test_parameters_outside_the_owner_policy_or_the_domain_are_refused(self):
        self.params['BANK_RISK_RESERVE_BPS_0'] = 5000
        self.plan['transactions'][7]['transaction']['input'] = initcode('Bank') + encode(
            'constructor(address,address,uint256,uint8,uint256)', TOKEN, self.addresses[0], 5000, 6, 10_000)
        self.refused('pool 0 parameters differ from the Owner policy')
        del self.params['BANK_RISK_RESERVE_BPS_0']
        self.plan = self.conforming_plan()
        self.params['GAME_MAX_BET_COUNT_SLOTS'] = 26
        self.refused('SLOTS admission is outside the certified domain')

    def test_the_readback_must_have_passed_for_this_deployer_with_nothing_pending(self):
        self.readback['deployer']['pendingNonce'] = FIRST_NONCE + 1
        self.refused('the deployer had a pending transaction at the readback')
        self.readback['deployer']['pendingNonce'] = FIRST_NONCE
        self.readback['allChecksPass'] = False
        self.refused('the readback did not pass or names another chain')


if __name__ == '__main__':
    unittest.main()
