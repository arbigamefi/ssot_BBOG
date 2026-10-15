#!/usr/bin/env python3
"""Read-only chain readback before a v1.6 deployment (preflight stage read-chain).

    python3 script/release/read_chain.py <roles.json> <output directory>

Inputs: the roles file (public addresses, and the owners and threshold expected of the Safe and of the guardian
multisig), the certified domain file of the chain (CALLBACK_DOMAIN_PATH, default
script/release/first-callback-domain-<chainId>.json), the deployment template docs/deploy/v16/chain-<chainId>.env.example
and the RPC as OPS_RPC_URL (script/tools/with-ops-rpc.sh) or RPC_URL. Everything is read at one block.

Writes chain-readback.json (what was read and every check with its result) and deploy-params.env (the template with
every placeholder filled, public values only) into the output directory, which must not exist yet. Exits 2 when a check
fails, 1 when the readback itself fails. No keys, no transactions; the RPC URL is never printed.

Roles file:
    {"chainId": 84532, "DEPLOYER": "0x..", "GOV": "0x..", "GOV_OWNERS": ["0x..", "0x..", "0x.."], "GOV_THRESHOLD": 2,
     "GUARDIAN": "0x..", "GUARDIAN_OWNERS": ["0x..", ...], "GUARDIAN_THRESHOLD": 2,
     "RELEASE_SIGNER": "0x..", "KEEPER_ADDRESS": "0x.."}
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_callback_provider import verify_provider  # noqa: E402
from verify_governance import Rpc, VerificationError, address, quantity, require, signature, word  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ZERO = '0x' + '0' * 40
SENTINEL = '0x' + '0' * 39 + '1'
# The governance EOA exposed on the old production host (2026-09-20); it must never hold a role again.
EXPOSED = {'0xc8ec9920d573893e888db5d30b2b3b3824b1b684'}
GUARD_SLOT = 'guard_manager.guard.address'
FALLBACK_SLOT = 'fallback_manager.handler.address'
ROLES = ('DEPLOYER', 'GOV', 'GUARDIAN', 'RELEASE_SIGNER', 'KEEPER_ADDRESS')


def keccak(data):
    return subprocess.check_output(['cast', 'keccak', data], text=True).strip().lower()


def encode(types, *values):
    return subprocess.check_output(['cast', 'abi-encode', f'f({types})', *map(str, values)], text=True).strip()


def result(rpc, target, name, args, block):
    encoded = ''.join(format(int(arg, 16) if isinstance(arg, str) else arg, '064x') for arg in args)
    data = rpc('eth_call', [{'to': target, 'data': signature(name)[:10] + encoded}, hex(block)])
    require(isinstance(data, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{64})*', data), f'invalid {name} result')
    return [int(data[2 + 64 * i:66 + 64 * i], 16) for i in range((len(data) - 2) // 64)]


def address_array(words, at):
    """The address[] whose ABI offset is words[at]."""
    start = words[at] // 32
    count = words[start]
    require(start + 1 + count <= len(words), 'invalid address array')
    return ['0x' + format(value, '040x') for value in words[start + 1:start + 1 + count]]


def code(rpc, target, block):
    value = rpc('eth_getCode', [target, hex(block)])
    require(isinstance(value, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{2})*', value), 'invalid code')
    return value.lower()


def multisig(rpc, target, block):
    """A Safe's code, owners, threshold, modules and controls, and the three hashes SafeGovernance.sol pins."""
    runtime = code(rpc, target, block)
    owners = address_array(result(rpc, target, 'getOwners()', [], block), 0)
    threshold = result(rpc, target, 'getThreshold()', [], block)[0]
    page = result(rpc, target, 'getModulesPaginated(address,uint256)', [SENTINEL, 1], block)
    modules, following = address_array(page, 0), '0x' + format(page[1], '040x')

    def slot(name):
        words = result(rpc, target, 'getStorageAt(uint256,uint256)', [keccak(name) if name else 0, 1], block)
        require(len(words) >= 3 and words[1] == 32, 'invalid Safe storage read')
        return '0x' + format(words[2] % 2**160, '040x')

    singleton, guard, fallback = slot(None), slot(GUARD_SLOT), slot(FALLBACK_SLOT)
    singleton_code = code(rpc, singleton, block)
    fallback_hash = '0x' + '0' * 64 if fallback == ZERO else keccak(code(rpc, fallback, block))
    return {
        'address': target, 'codeHash': keccak(runtime) if runtime != '0x' else None, 'owners': owners,
        'threshold': threshold, 'modules': modules, 'modulesNext': following, 'singleton': singleton, 'guard': guard,
        'fallback': fallback, 'singletonHasCode': singleton_code != '0x',
        'fallbackHasCode': fallback == ZERO or code(rpc, fallback, block) != '0x',
        'ownersHash': keccak(encode('address[],uint256', '[' + ','.join(owners) + ']', threshold)),
        'controlHash': keccak(encode('address,bytes32,address,address,bytes32', singleton, keccak(singleton_code),
                                     guard, fallback, fallback_hash)),
    }


def readback(rpc, roles, domain):
    chain = quantity(rpc('eth_chainId', []))
    require(chain == roles['chainId'] == domain['chainId'], 'roles, domain file and RPC name different chains')
    head = rpc('eth_getBlockByNumber', ['latest', False])
    block, block_hash = quantity(head['number']), head['hash']
    word(block_hash)
    named = {role: address(roles[role]) for role in ROLES}
    deployer = named['DEPLOYER']
    checks = {}
    safe = multisig(rpc, named['GOV'], block)
    guardian = multisig(rpc, named['GUARDIAN'], block)
    expected_safe = sorted(address(owner) for owner in roles['GOV_OWNERS'])
    expected_guardian = sorted(address(owner) for owner in roles['GUARDIAN_OWNERS'])
    checks['safeIsTwoOfThree'] = len(safe['owners']) == 3 and safe['threshold'] == 2 == roles['GOV_THRESHOLD']
    checks['safeOwnersAreTheRoles'] = sorted(safe['owners']) == expected_safe
    checks['safeHasNoModuleGuardOrBrokenControl'] = (safe['codeHash'] is not None and not safe['modules']
                                                     and safe['modulesNext'] == SENTINEL and safe['guard'] == ZERO
                                                     and safe['singletonHasCode'] and safe['fallbackHasCode'])
    checks['guardianIsAMultisig'] = guardian['threshold'] >= 2 and len(guardian['owners']) >= guardian['threshold']
    checks['guardianOwnersAreTheRoles'] = (sorted(guardian['owners']) == expected_guardian
                                           and guardian['threshold'] == roles['GUARDIAN_THRESHOLD'])
    checks['guardianSignersAreNotSafeSigners'] = not set(guardian['owners']) & set(safe['owners'])
    checks['guardianHasNoModuleGuardOrBrokenControl'] = (guardian['codeHash'] is not None and not guardian['modules']
                                                         and guardian['modulesNext'] == SENTINEL
                                                         and guardian['guard'] == ZERO and guardian['singletonHasCode']
                                                         and guardian['fallbackHasCode'])
    latest = quantity(rpc('eth_getTransactionCount', [deployer, 'latest']))
    pending = quantity(rpc('eth_getTransactionCount', [deployer, 'pending']))
    balances = {role: quantity(rpc('eth_getBalance', [named[role], hex(block)])) for role in ('DEPLOYER', 'KEEPER_ADDRESS')}
    accounts = {role: code(rpc, named[role], block) for role in ('DEPLOYER', 'KEEPER_ADDRESS', 'RELEASE_SIGNER')}
    # A delegated EOA (EIP-7702) runs other code on its own behalf; the deployer must be a plain account.
    checks['deployerKeeperAndSignerHaveNoCode'] = all(value == '0x' for value in accounts.values())
    checks['deployerHasNoPendingTransaction'] = latest == pending
    checks['deployerIsFunded'] = balances['DEPLOYER'] > 0
    checks['rolesAreDistinct'] = len(set(named.values())) == len(named)
    # Nor may it sign for the Safe or the guardian: a signer acts for its multisig.
    checks['exposedGovernanceKeyIsNotUsed'] = not (set(named.values()) | set(safe['owners'])
                                                   | set(guardian['owners'])) & EXPOSED
    snap = {'chainId': chain, 'numPools': 1, 'poolDomain_0': 1, 'poolAsset_0': address(domain['token']['proxy']),
            'vrfWrapper': address(domain['providerReference']['wrapper'])}
    try:
        verify_provider(rpc, snap, block, domain)
        checks['tokenAndProviderAreCertified'] = True
    except VerificationError as error:
        checks['tokenAndProviderAreCertified'] = False
        checks['tokenAndProviderFailure'] = str(error)
    checks['domainIsCertified'] = domain.get('status') == 'CERTIFIED'
    decimals = result(rpc, snap['poolAsset_0'], 'decimals()', [], block)[0]
    passed = all(value is True for key, value in checks.items() if key != 'tokenAndProviderFailure')
    return {'chainId': chain, 'blockNumber': block, 'blockHash': block_hash.lower(), 'roles': named,
            'safe': safe, 'guardian': guardian,
            'deployer': {'address': deployer, 'latestNonce': latest, 'pendingNonce': pending,
                         'balance': balances['DEPLOYER']},
            'keeper': {'address': named['KEEPER_ADDRESS'], 'balance': balances['KEEPER_ADDRESS']},
            'domain': {'status': domain.get('status'), 'token': snap['poolAsset_0'], 'tokenDecimals': decimals,
                       'wrapper': snap['vrfWrapper'], 'consumerCallbackGasLimit': domain['consumerCallbackGasLimit']},
            'checks': checks, 'allChecksPass': passed}


def parameters(template, readback_):
    """The deployment template with every placeholder replaced by a value read or derived at the readback block."""
    roles = readback_['roles']
    values = {key: roles[key] for key in ROLES}
    for prefix, data in (('SAFE', readback_['safe']), ('GUARDIAN', readback_['guardian'])):
        values[f'{prefix}_CODE_HASH'] = data['codeHash']
        values[f'{prefix}_OWNERS_HASH'] = data['ownersHash']
        values[f'{prefix}_CONTROL_HASH'] = data['controlHash']
    values['VRF_WRAPPER'] = readback_['domain']['wrapper']
    values['QUALIFIED_GAS'] = str(readback_['domain']['consumerCallbackGasLimit'])
    text = template
    # Longest first: REPLACE_GUARDIAN is a prefix of REPLACE_GUARDIAN_CODE_HASH.
    for key in sorted(values, key=len, reverse=True):
        text = text.replace('REPLACE_' + key, values[key])
    require('REPLACE_' not in text, 'deployment template has an unresolved placeholder')
    asset = re.search(r'^POOL_ASSET_0=(0x[0-9a-fA-F]{40})$', text, re.M)
    require(asset is not None and asset.group(1).lower() == readback_['domain']['token'],
            'template pool asset is not the certified token')
    return (f'# v1.6 deployment parameters for chain {readback_["chainId"]}, read at block {readback_["blockNumber"]} by\n'
            '# script/release/read_chain.py from the roles file, the chain and the certified domain file. Public values\n'
            '# only; not a broadcast authorization.\n' + text)


def main():
    if len(sys.argv) != 3:
        sys.exit('usage: read_chain.py <roles.json> <output directory>')
    roles = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    require(not out.exists(), f'{out} exists; a readback is never overwritten')
    rpc_url = os.environ.get('OPS_RPC_URL') or os.environ.get('RPC_URL')
    require(bool(rpc_url), 'no RPC: run through script/tools/with-ops-rpc.sh or set RPC_URL')
    chain = roles['chainId']
    domain_path = Path(os.environ.get('CALLBACK_DOMAIN_PATH') or ROOT / f'script/release/first-callback-domain-{chain}.json')
    domain = json.loads(domain_path.read_text())
    template = (ROOT / f'docs/deploy/v16/chain-{chain}.env.example').read_text()
    data = readback(Rpc(rpc_url), roles, domain)
    data['domainFile'] = str(domain_path)
    out.mkdir(parents=True)
    (out / 'chain-readback.json').write_text(json.dumps(data, indent=2) + '\n')
    if data['allChecksPass']:
        (out / 'deploy-params.env').write_text(parameters(template, data))
    for name, value in data['checks'].items():
        print(f'{name}: {value}')
    print(f'block {data["blockNumber"]}, deployer nonce {data["deployer"]["latestNonce"]}: '
          + ('all checks pass' if data['allChecksPass'] else 'CHECKS FAILED'))
    sys.exit(0 if data['allChecksPass'] else 2)


if __name__ == '__main__':
    try:
        main()
    except (VerificationError, KeyError, TypeError, IndexError, OSError, ValueError,
            subprocess.SubprocessError) as error:
        detail = str(error) if isinstance(error, VerificationError) else type(error).__name__
        sys.exit('chain readback failed: ' + detail)
