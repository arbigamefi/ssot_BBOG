"""The preflight chain readback (script/release/read_chain.py) against an in-process chain model; no network."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('read_chain', ROOT / 'script/release/read_chain.py')
CHAIN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHAIN)
signature = CHAIN.signature


def addr(n):
    return '0x' + format(n, '040x')


def word(n):
    return format(n, '064x')


SAFE, GUARDIAN, SINGLETON, DEPLOYER, SIGNER, KEEPER = addr(0x5afe), addr(0x6a), addr(0x51), addr(0xd0), addr(0x5e), addr(0x4e)
SAFE_OWNERS = [addr(11), addr(12), addr(13)]
GUARDIAN_OWNERS = [addr(21), addr(22), addr(23)]
SENTINEL = '0x' + '0' * 39 + '1'


def array(values):
    return word(len(values)) + ''.join(word(int(v, 16)) for v in values)


class Chain:
    """A Safe and a guardian Safe proxy with one singleton, a funded deployer with nothing pending, plain accounts."""

    def __init__(self):
        self.code = {SAFE: '0x6001', GUARDIAN: '0x6001', SINGLETON: '0x6002'}
        self.owners = {SAFE: list(SAFE_OWNERS), GUARDIAN: list(GUARDIAN_OWNERS)}
        self.threshold = {SAFE: 2, GUARDIAN: 2}
        self.modules = {SAFE: [], GUARDIAN: []}
        self.guard = {SAFE: 0, GUARDIAN: 0}
        self.nonce = {'latest': 5, 'pending': 5}
        self.balance = {DEPLOYER: 10**18, KEEPER: 10**17}
        self.decimals = 6

    def __call__(self, method, params):
        if method == 'eth_chainId':
            return hex(84532)
        if method == 'eth_getBlockByNumber':
            return {'number': hex(900), 'hash': '0x' + 'ab' * 32}
        if method == 'eth_getCode':
            return self.code.get(params[0], '0x')
        if method == 'eth_getTransactionCount':
            return hex(self.nonce[params[1]])
        if method == 'eth_getBalance':
            return hex(self.balance.get(params[0], 0))
        if method == 'eth_call':
            target, data = params[0]['to'], params[0]['data']
            selector = data[:10]
            if selector == signature('getOwners()')[:10]:
                return '0x' + word(32) + array(self.owners[target])
            if selector == signature('getThreshold()')[:10]:
                return '0x' + word(self.threshold[target])
            if selector == signature('getModulesPaginated(address,uint256)')[:10]:
                return '0x' + word(64) + word(int(SENTINEL, 16)) + array(self.modules[target])
            if selector == signature('getStorageAt(uint256,uint256)')[:10]:
                slot = int(data[10:74], 16)
                value = int(SINGLETON, 16) if slot == 0 else (
                    self.guard[target] if slot == int(CHAIN.keccak(CHAIN.GUARD_SLOT), 16) else 0)
                return '0x' + word(32) + word(32) + word(value)
            if selector == signature('decimals()')[:10]:
                return '0x' + word(self.decimals)
        raise AssertionError((method, params))


def roles():
    return {'chainId': 84532, 'DEPLOYER': DEPLOYER, 'GOV': SAFE, 'GOV_OWNERS': SAFE_OWNERS, 'GOV_THRESHOLD': 2,
            'GUARDIAN': GUARDIAN, 'GUARDIAN_OWNERS': GUARDIAN_OWNERS, 'GUARDIAN_THRESHOLD': 2,
            'RELEASE_SIGNER': SIGNER, 'KEEPER_ADDRESS': KEEPER}


DOMAIN = json.loads((ROOT / 'script/release/first-callback-domain-84532.json').read_text())


class ReadChainTests(unittest.TestCase):
    def read(self, chain=None, role_changes=None, domain_changes=None, provider_error=None):
        role_set = {**roles(), **(role_changes or {})}
        domain = {**copy.deepcopy(DOMAIN), 'status': 'CERTIFIED', **(domain_changes or {})}

        def provider(*_):
            if provider_error:
                raise CHAIN.VerificationError(provider_error)

        with patch.object(CHAIN, 'verify_provider', side_effect=provider):
            return CHAIN.readback(chain or Chain(), role_set, domain)

    def failing(self, result):
        return sorted(name for name, value in result['checks'].items() if value is False)

    def test_a_conforming_chain_passes_and_pins_the_hashes_solidity_computes(self):
        result = self.read()
        self.assertTrue(result['allChecksPass'], result['checks'])
        self.assertEqual(result['deployer'], {'address': DEPLOYER, 'latestNonce': 5, 'pendingNonce': 5, 'balance': 10**18})
        safe = result['safe']
        self.assertEqual(safe['codeHash'], CHAIN.keccak('0x6001'))
        self.assertEqual(safe['ownersHash'], CHAIN.keccak(CHAIN.encode('address[],uint256', f'[{",".join(SAFE_OWNERS)}]', 2)))
        self.assertEqual(safe['controlHash'], CHAIN.keccak(CHAIN.encode('address,bytes32,address,address,bytes32',
                                                                          SINGLETON, CHAIN.keccak('0x6002'),
                                                                          addr(0), addr(0), '0x' + '0' * 64)))
        self.assertEqual(result['domain']['tokenDecimals'], 6)

    def test_the_safe_must_be_the_reviewed_two_of_three_without_extensions(self):
        chain = Chain(); chain.threshold[SAFE] = 1
        self.assertIn('safeIsTwoOfThree', self.failing(self.read(chain)))
        self.assertIn('safeOwnersAreTheRoles', self.failing(self.read(role_changes={'GOV_OWNERS': SAFE_OWNERS[:2] + [addr(99)]})))
        chain = Chain(); chain.modules[SAFE] = [addr(77)]
        self.assertIn('safeHasNoModuleGuardOrBrokenControl', self.failing(self.read(chain)))
        chain = Chain(); chain.guard[SAFE] = 0x55
        self.assertIn('safeHasNoModuleGuardOrBrokenControl', self.failing(self.read(chain)))

    def test_the_guardian_must_be_an_independent_multisig(self):
        chain = Chain(); chain.threshold[GUARDIAN] = 1
        self.assertIn('guardianIsAMultisig', self.failing(self.read(chain, role_changes={'GUARDIAN_THRESHOLD': 1})))
        chain = Chain(); chain.owners[GUARDIAN] = [SAFE_OWNERS[0], addr(22), addr(23)]
        failed = self.failing(self.read(chain, role_changes={'GUARDIAN_OWNERS': [SAFE_OWNERS[0], addr(22), addr(23)]}))
        self.assertEqual(failed, ['guardianSignersAreNotSafeSigners'])
        chain = Chain(); chain.code[GUARDIAN] = '0x'   # an EOA
        self.assertIn('guardianHasNoModuleGuardOrBrokenControl', self.failing(self.read(chain)))

    def test_every_multisig_signer_is_a_plain_account(self):
        delegated = '0xef0100' + '63c0c19a282a1b52b07dd5a65b58948a07dae32b'   # an EIP-7702 delegation
        for signer in (SAFE_OWNERS[0], GUARDIAN_OWNERS[2]):
            chain = Chain(); chain.code[signer] = delegated
            result = self.read(chain)
            self.assertEqual(self.failing(result), ['multisigSignersHaveNoCode'], signer)
            self.assertEqual(result['signersWithCode'], {signer: delegated})
        self.assertEqual(self.read()['signersWithCode'], {})

    def test_the_deployer_is_a_funded_plain_account_with_nothing_pending(self):
        chain = Chain(); chain.code[DEPLOYER] = '0xef0100' + '11' * 20   # an EIP-7702 delegation
        self.assertEqual(self.failing(self.read(chain)), ['deployerKeeperAndSignerHaveNoCode'])
        chain = Chain(); chain.nonce['pending'] = 6
        self.assertEqual(self.failing(self.read(chain)), ['deployerHasNoPendingTransaction'])
        chain = Chain(); chain.balance[DEPLOYER] = 0
        self.assertEqual(self.failing(self.read(chain)), ['deployerIsFunded'])

    def test_roles_are_distinct_and_never_the_exposed_key(self):
        self.assertEqual(self.failing(self.read(role_changes={'KEEPER_ADDRESS': DEPLOYER})), ['rolesAreDistinct'])
        exposed = '0xc8eC9920d573893E888db5D30b2B3B3824B1b684'
        self.assertEqual(self.failing(self.read(role_changes={'RELEASE_SIGNER': exposed})), ['exposedGovernanceKeyIsNotUsed'])
        # Nor a signer of either multisig.
        for multisig, owners_role, others in ((GUARDIAN, 'GUARDIAN_OWNERS', [addr(22), addr(23)]),
                                               (SAFE, 'GOV_OWNERS', [addr(12), addr(13)])):
            chain = Chain(); chain.owners[multisig] = [exposed, *others]
            failed = self.failing(self.read(chain, role_changes={owners_role: [exposed, *others]}))
            self.assertEqual(failed, ['exposedGovernanceKeyIsNotUsed'], multisig)

    def test_the_certified_provider_and_domain_are_required(self):
        result = self.read(provider_error='token implementation differs from the certified one')
        self.assertEqual(self.failing(result), ['tokenAndProviderAreCertified'])
        self.assertEqual(result['checks']['tokenAndProviderFailure'], 'token implementation differs from the certified one')
        self.assertEqual(self.failing(self.read(domain_changes={'status': 'PENDING_INDEPENDENT_REVIEW'})), ['domainIsCertified'])
        with self.assertRaisesRegex(CHAIN.VerificationError, 'different chains'):
            self.read(role_changes={'chainId': 8453})

    def test_the_parameters_fill_every_placeholder_longest_name_first(self):
        result = self.read()
        template = (ROOT / 'docs/deploy/v16/chain-84532.env.example').read_text()
        params = CHAIN.parameters(template, result)
        self.assertNotIn('REPLACE_', params)
        self.assertIn(f'GUARDIAN={GUARDIAN}\n', params)
        self.assertIn(f'GUARDIAN_CODE_HASH={result["guardian"]["codeHash"]}\n', params)
        self.assertIn(f'GUARDIAN_OWNERS_HASH={result["guardian"]["ownersHash"]}\n', params)
        self.assertIn(f'SAFE_CONTROL_HASH={result["safe"]["controlHash"]}\n', params)
        self.assertIn(f'GAME_CALLBACK_GAS_LIMIT_DICE={DOMAIN["consumerCallbackGasLimit"]}\n', params)
        other = copy.deepcopy(result)
        other['domain']['token'] = addr(0x7777)
        with self.assertRaisesRegex(CHAIN.VerificationError, 'template pool asset is not the certified token'):
            CHAIN.parameters(template, other)

    def test_the_entrypoint_never_overwrites_and_never_prints_the_rpc(self):
        with tempfile.TemporaryDirectory() as directory:
            role_file = Path(directory) / 'roles.json'
            role_file.write_text(json.dumps(roles()))
            existing = Path(directory) / 'out'
            existing.mkdir()
            result = subprocess.run(['python3', str(ROOT / 'script/release/read_chain.py'), str(role_file), str(existing)],
                                    capture_output=True, text=True, env={'PATH': '/usr/bin:/bin:/opt/homebrew/bin',
                                                                         'RPC_URL': 'https://secret.invalid/v3/key'})
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('exists; a readback is never overwritten', result.stderr)
            self.assertNotIn('secret', result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
