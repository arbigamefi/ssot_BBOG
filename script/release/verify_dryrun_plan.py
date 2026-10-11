#!/usr/bin/env python3
"""Check a v1.6 deployment dry run transaction by transaction (preflight stage verify-plan).

    python3 script/release/verify_dryrun_plan.py <work copy> <preflight directory>

Under ADR-0037 decision D1 the deployment creates contracts and does nothing else: the GovernanceTimelock first, then
PoolRegistry, SettlementRouter, VRFHub, ReferralRegistry, DefaultReferralEngine, GameHub, one Bank per pool (each Bank
creates its LiquidityVault) and the eight modules, every governed contract with the timelock as its governance. The
wiring is the Safe's timelock operation afterwards.

Every transaction of the plan (<preflight>/plan/DeployV16.s.sol/<chain>/dry-run/run-latest.json) must come from the
deployer at the next nonce from the readback (<preflight>/chain/chain-readback.json), carry no value, create its contract
at the address derived from deployer and nonce, and have exactly the init code of the work copy's compiled artifact
followed by the constructor arguments that follow from <preflight>/chain/deploy-params.env and the addresses created
before it. The domain file is the one the readback used. Each Bank's Vault is checked the same way at
the Bank's first nonce. The compiled module and core runtimes must equal the certified pins of the domain file, and the
pool parameters the Owner policy. Writes <preflight>/plan-review.json. No RPC, wallet or broadcast.
"""
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys

# GovernanceTimelock.MIN_DELAY; DeployV16 deploys with it.
TIMELOCK_DELAY = 259_200
MODULES = (('DICE', 'DiceModule', 'moduleDice'), ('COIN_TOSS', 'CoinTossModule', 'moduleCoinToss'),
           ('ROULETTE', 'RouletteModule', 'moduleRoulette'), ('KENO', 'KenoModule', 'moduleKeno'),
           ('PLINKO', 'PlinkoModule', 'modulePlinko'), ('SIC_BO', 'SicBoModule', 'moduleSicBo'),
           ('SLOTS', 'SlotsModule', 'moduleSlots'), ('BACCARAT', 'BaccaratModule', 'moduleBaccarat'))


class PlanError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise PlanError(message)


def cast(*args):
    return subprocess.check_output(['cast', *map(str, args)], text=True).strip()


def number(value):
    return int(value, 0) if isinstance(value, str) else value


def created_at(sender, nonce):
    return re.search(r'0x[0-9a-fA-F]{40}', cast('compute-address', sender, '--nonce', nonce)).group(0).lower()


def parameters(path):
    values = {}
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = shlex.split(value)[0] if value.strip() else ''
    return values


def review(work, preflight):
    cfg = parameters(preflight / 'chain/deploy-params.env')
    chain = json.loads((preflight / 'chain/chain-readback.json').read_text())
    chain_id = int(cfg['CHAIN_ID'])
    plan = json.loads((preflight / f'plan/DeployV16.s.sol/{chain_id}/dry-run/run-latest.json').read_text())
    domain = json.loads(Path(chain['domainFile']).read_text())
    require(chain['allChecksPass'] is True and chain['chainId'] == chain_id == plan['chain'],
            'the readback did not pass or names another chain')
    deployer = cfg['DEPLOYER'].lower()
    require(chain['deployer']['address'] == deployer, 'the readback is for another deployer')
    first = chain['deployer']['latestNonce']
    require(chain['deployer']['pendingNonce'] == first, 'the deployer had a pending transaction at the readback')
    require(not plan['receipts'] and not plan.get('pending') and not plan['libraries'], 'not a dry run of plain creations')
    pools = int(cfg['NUM_POOLS'])
    require(1 <= pools <= 32, 'NUM_POOLS out of range')

    def artifact(name):
        path = work / 'out' / f'{name}.sol' / f'{name}.json'
        return path, json.loads(path.read_text())

    expected = []

    def create(name, signature, *args):
        expected.append((name, signature, [str(arg) for arg in args]))

    nonce = iter(range(first, first + 10**6))
    addresses = {}

    def next_address(name):
        addresses[name] = created_at(deployer, next(nonce))
        return addresses[name]

    timelock = next_address('GovernanceTimelock')
    create('GovernanceTimelock', 'constructor(uint256,address[],address[],address[])', TIMELOCK_DELAY,
           f'[{cfg["GOV"]}]', f'[{cfg["GUARDIAN"]}]', '[0x0000000000000000000000000000000000000000]')
    registry = next_address('PoolRegistry')
    create('PoolRegistry', 'constructor(address)', timelock)
    router = next_address('SettlementRouter')
    create('SettlementRouter', 'constructor(address)', registry)
    vrf = next_address('VRFHub')
    create('VRFHub', 'constructor(address,address)', cfg['VRF_WRAPPER'], router)
    referral = next_address('ReferralRegistry')
    create('ReferralRegistry', 'constructor(address)', timelock)
    engine = next_address('DefaultReferralEngine')
    create('DefaultReferralEngine', 'constructor()')
    next_address('GameHub')
    create('GameHub', 'constructor(address,address,address,address,address,uint256,uint16,uint16,uint16,uint16,uint16)',
           router, vrf, referral, engine, timelock, cfg.get('REFUND_TIMEOUT_SECONDS', '3600'),
           cfg.get('DEFAULT_HOUSE_EDGE_BPS', '200'), cfg.get('REF_L0_BPS', '1000'), cfg.get('REF_L1_BPS', '2000'),
           cfg.get('REF_L2_BPS', '500'), cfg.get('REF_HOLDBACK_BPS', '3000'))
    banks = []
    for i in range(pools):
        bank = next_address(f'Bank_{i}')
        banks.append(bank)
        require(cfg[f'POOL_ASSET_{i}'].lower() == chain['domain']['token'], f'pool {i} asset is not the read token')
        create('Bank', 'constructor(address,address,uint256,uint8,uint256)', cfg[f'POOL_ASSET_{i}'], timelock,
               cfg.get(f'BANK_RISK_RESERVE_BPS_{i}', '6000'), chain['domain']['tokenDecimals'],
               cfg[f'BANK_MIN_BET_AMOUNT_{i}'])
    for _, contract, _ in MODULES:
        next_address(contract)
        create(contract, 'constructor()')

    txs = plan['transactions']
    require(len(txs) == len(expected), f'{len(txs)} transactions planned, {len(expected)} expected')
    checked = []
    vault_rows = []
    for index, (row, (name, signature, args)) in enumerate(zip(txs, expected)):
        tx = row['transaction']
        require(row['transactionType'] == 'CREATE' and row['contractName'] == name and not tx.get('to'),
                f'transaction {index} is not the creation of {name}')
        require(tx['from'].lower() == deployer and number(tx['nonce']) == first + index
                and number(tx['chainId']) == chain_id and number(tx['value']) == 0, f'transaction {index} header')
        require(row['contractAddress'].lower() == created_at(deployer, first + index),
                f'transaction {index} creates at another address')
        path, art = artifact(name)
        encoded = cast('abi-encode', signature, *args)[2:] if args else ''
        require(tx['input'].lower() == (art['bytecode']['object'] + encoded).lower(),
                f'transaction {index} ({name}) init code differs from the artifact and constructor')
        require(len(tx['input']) // 2 - 1 <= 49_152, f'{name} init code exceeds the EIP-3860 limit')
        checked.append({'index': index, 'nonce': first + index, 'contract': name,
                        'address': row['contractAddress'].lower(), 'arguments': args,
                        'artifactSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'inputSha256': hashlib.sha256(bytes.fromhex(tx['input'][2:])).hexdigest()})
        vault_rows += [(row['contractAddress'].lower(), child) for child in row.get('additionalContracts') or []]

    _, vault = artifact('LiquidityVault')
    require(len(vault_rows) == pools, 'every Bank creates exactly one Vault')
    vaults = []
    for (creator, child), bank, i in zip(vault_rows, banks, range(pools)):
        require(creator == bank and child['contractName'] == 'LiquidityVault'
                and child['address'].lower() == created_at(bank, 1), f'pool {i}: the Vault is not the Bank\'s first creation')
        initcode = vault['bytecode']['object'] + cast('abi-encode', 'constructor(address,address)',
                                                      cfg[f'POOL_ASSET_{i}'], bank)[2:]
        require(child['initCode'].lower() == initcode.lower(), f'pool {i}: Vault init code differs')
        vaults.append(child['address'].lower())

    # The compiled artifacts are the certified build: module runtimes equal the domain code hashes, core runtimes the
    # pins (keccak of the artifact's runtime with zero immutable placeholders) and their lengths.
    certified = {}
    for _, contract, key in MODULES:
        _, art = artifact(contract)
        runtime = cast('keccak', art['deployedBytecode']['object']).lower()
        require(runtime == domain['moduleCodeHashes'][key].lower(), f'{contract} runtime is not the certified code')
        certified[contract] = runtime
    for contract, pin in domain['coreRuntimes'].items():
        _, art = artifact(contract)
        runtime = cast('keccak', art['deployedBytecode']['object']).lower()
        require(runtime == pin['keccakWithImmutablesZeroed'].lower()
                and len(art['deployedBytecode']['object']) // 2 - 1 == pin['runtimeBytes'],
                f'{contract} runtime is not the certified code')
        certified[contract] = runtime
    policy = domain['ownerPolicy']
    for i in range(pools):
        require(int(cfg.get(f'BANK_RISK_RESERVE_BPS_{i}', '6000')) == policy['riskReserveBps']
                and int(cfg.get(f'BANK_WITHDRAWAL_BUFFER_BPS_{i}', '1000')) == policy['withdrawalBufferBps']
                and int(cfg[f'BANK_MIN_BET_AMOUNT_{i}']) == policy['casinoMinBetAmount'],
                f'pool {i} parameters differ from the Owner policy')
        require(cfg[f'POOL_ASSET_{i}'].lower() == domain['token']['proxy'].lower(),
                f'pool {i} asset is not the certified token')
    for name, _, _ in MODULES:
        require(int(cfg[f'GAME_CALLBACK_GAS_LIMIT_{name}']) == domain['consumerCallbackGasLimit']
                and 1 <= int(cfg[f'GAME_MAX_BET_COUNT_{name}']) <= domain['maxBetCountCeiling'],
                f'{name} admission is outside the certified domain')

    return {'status': 'PASS', 'chainId': chain_id, 'deployer': deployer, 'nonceFirst': first,
            'nonceLast': first + len(txs) - 1, 'transactions': len(txs), 'governanceTimelock': timelock,
            'addresses': addresses, 'vaults': vaults, 'certifiedRuntimes': certified,
            'meaning': 'Contract creations only; the wiring is the Safe\'s timelock operation (ADR-0037 §9).',
            'reviewed': checked}


def main():
    if len(sys.argv) != 3:
        sys.exit('usage: verify_dryrun_plan.py <work copy> <preflight directory>')
    work, preflight = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    try:
        result = review(work, preflight)
    except (PlanError, KeyError, ValueError, OSError, subprocess.SubprocessError) as error:
        sys.exit('plan review failed: ' + (str(error) if isinstance(error, PlanError) else type(error).__name__))
    (preflight / 'plan-review.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'PASS: {result["transactions"]} creations from {result["deployer"]}, nonce {result["nonceFirst"]}-'
          f'{result["nonceLast"]}, timelock {result["governanceTimelock"]}, every init code the certified build')


if __name__ == '__main__':
    main()
