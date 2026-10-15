#!/usr/bin/env python3
"""Read-only check of Base Denim on Base Sepolia (launch candidate plan A13 and section 13).

    script/ops/denim-activation-check.sh [new output directory]

Every reading belongs to one block, the head at the start, recorded by number and hash: the 20 cadence blocks must
chain by parent hash to it, the state reads are made at its number, and that number must still name the same hash at
the end. Otherwise the whole reading is taken again, three times at most. The runner checks the hash once more after
the fork test (`--confirm`).

At that block it reports the block cadence (five blocks a second after Denim; header timestamps in whole seconds,
`timestampMs` in 200 ms steps), the block gas limit against a void transaction, whose gas the immutable GameHub
constants fix, the BaseTime predeploy and its tx[1] deposit, whether the "pending" tag returns a sealed block, and the
VRF provider and USDC against the certified domain file (`verify_callback_provider.verify_provider`, the coordinator's
minimum request confirmations included). The verdict is two narrow signals: `denimActive` (cadence and the BaseTime
deposit) and `ok` (gas capacity and the provider fields the domain file names). Neither accepts the upgrade or a
release; `notes` lists active-chain observations that differ from the Denim specification, and the observations
themselves must be read. Run it once before and once after the activation (2026-10-21 18:00 UTC); the RPC endpoint
comes from OPS_RPC_URL and is never printed.

    denim_activation_check.py --confirm <check.json>

exits 0 if the report's block number still names its hash, 1 otherwise.
"""
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'script/release'))
from verify_governance import EmptyResult, Rpc, VerificationError, quantity, require, signature  # noqa: E402
from verify_callback_provider import GAME_HUB_REQUEST_CONFIRMATIONS, verify_provider  # noqa: E402

BASE_SEPOLIA = 84532
BASETIME = '0x4200000000000000000000000000000000000030'
# The keeper's floor for a void: VOID_SETTLEMENT_GAS + VOID_RESERVE_GAS + VOID_CALL_OVERHEAD + 150,000.
VOID_TRANSACTION_GAS = 10_755_000
# The L1 attributes deposit and, after Denim, the BaseTime deposit: 1,000,000 gas limit each.
DEPOSIT_GAS = 2_000_000
TX_GAS_CAP = 2 ** 24
CADENCE_BLOCKS = 20
ATTEMPTS = 3


class HeadChanged(Exception):
    """The chain moved to another branch while a reading was taken."""


def block_hash(value):
    require(isinstance(value, str) and re.fullmatch(r'0x[0-9a-fA-F]{64}', value), 'invalid block hash')
    return value.lower()


def numbered_block(rpc, number):
    """The canonical block of this number, or None when the node has none: an explicit null result, not an error here.
    Any other answer must be that block, with its number and a valid hash; otherwise the response is invalid and the
    check fails."""
    try:
        block = rpc('eth_getBlockByNumber', [hex(number), False])
    except EmptyResult:
        return None
    require(isinstance(block, dict) and quantity(block.get('number')) == number, f'invalid response for block {number}')
    return {**block, 'hash': block_hash(block.get('hash'))}


def block_at(rpc, number):
    """A block of the reading: one the node does not have, at or below the head just read, means the chain (or the
    node answering, behind a load balancer) changed."""
    block = numbered_block(rpc, number)
    if block is None:
        raise HeadChanged
    return block


def reading(rpc, domain):
    latest = rpc('eth_getBlockByNumber', ['latest', True])
    require(isinstance(latest, dict), 'no latest block')
    head, head_hash = quantity(latest['number']), block_hash(latest['hash'])
    blocks = [block_at(rpc, n) for n in range(head - CADENCE_BLOCKS + 1, head + 1)]
    if blocks[-1]['hash'] != head_hash or any((b.get('parentHash') or '').lower() != a['hash']
                                              for a, b in zip(blocks, blocks[1:])):
        raise HeadChanged
    stamps = [quantity(block['timestamp']) for block in blocks]
    millis = [block.get('timestampMs') for block in blocks]
    span = stamps[-1] - stamps[0]
    cadence = {
        'head': head,
        'headTimestamp': stamps[-1],
        'blocksPerSecond': round((CADENCE_BLOCKS - 1) / span, 3) if span else None,
        'maxBlocksSharingASecond': max(stamps.count(stamp) for stamp in set(stamps)),
        'timestampMsSteps': sorted({quantity(b) - quantity(a) for a, b in zip(millis, millis[1:])})
        if all(millis) else None,
    }
    gas_limit = quantity(latest['gasLimit'])
    gas = {
        'blockGasLimit': gas_limit,
        'baseFeePerGas': quantity(latest['baseFeePerGas']),
        'voidFits': gas_limit >= VOID_TRANSACTION_GAS + DEPOSIT_GAS,
        'txCapFits': gas_limit >= TX_GAS_CAP + DEPOSIT_GAS,
    }
    transactions = latest['transactions']
    second = transactions[1] if len(transactions) > 1 else {}
    try:
        millis_now = rpc('eth_call', [{'to': BASETIME, 'data': signature('timestampMs()')[:10]}, hex(head)])
    except VerificationError as error:
        millis_now = 'reverts or unavailable: ' + str(error)[:80]
    base_time = {
        'codeBytes': (len(rpc('eth_getCode', [BASETIME, hex(head)])) - 2) // 2,
        'timestampMs()': millis_now,
        'tx1IsBaseTimeDeposit': isinstance(second, dict) and second.get('type') == '0x7e'
                                and (second.get('to') or '').lower() == BASETIME,
    }
    # A sealed block is one the canonical chain holds under the same number and hash; before Denim "pending" returned
    # the block being built, which has no number on the chain yet, after it (on Vibenet) the latest block.
    pending_block = rpc('eth_getBlockByNumber', ['pending', False])
    require(isinstance(pending_block, dict), 'no pending block')
    pending_number = quantity(pending_block['number'])
    sealed = numbered_block(rpc, pending_number)
    pending = {
        'number': pending_number,
        'pendingIsALatestBlock': sealed is not None and isinstance(pending_block.get('hash'), str)
                                 and sealed['hash'] == pending_block['hash'].lower(),
    }
    snap = {'chainId': BASE_SEPOLIA, 'numPools': 1, 'poolDomain_0': 1, 'poolAsset_0': domain['token']['proxy'],
            'vrfWrapper': domain['providerReference']['wrapper']}
    try:
        verify_provider(rpc, snap, head, domain)
        provider = {'status': 'matches the certified domain', 'gameHubRequestConfirmations': GAME_HUB_REQUEST_CONFIRMATIONS}
    except VerificationError as error:
        provider = {'status': 'MISMATCH', 'error': str(error)}
    if block_at(rpc, head)['hash'] != head_hash:
        raise HeadChanged
    active = (cadence['blocksPerSecond'] or 0) >= 4 and base_time['tx1IsBaseTimeDeposit']
    notes = []
    if active:
        if cadence['timestampMsSteps'] is None:
            notes.append('timestampMs is missing from some cadence blocks (the specification allows omitting it)')
        elif cadence['timestampMsSteps'] != [200]:
            notes.append(f"timestampMs steps are {cadence['timestampMsSteps']}, not 200 ms")
        if not isinstance(millis_now, str) or millis_now.startswith('reverts'):
            notes.append('BaseTime timestampMs() did not answer')
        if not pending['pendingIsALatestBlock']:
            notes.append('"pending" did not return a sealed block')
    return {
        'chainId': BASE_SEPOLIA, 'block': {'number': head, 'hash': head_hash}, 'cadence': cadence, 'gas': gas,
        'baseTime': base_time, 'pending': pending, 'provider': {'block': head, **provider},
        'verdict': {'denimActive': active,
                    'ok': gas['voidFits'] and gas['txCapFits'] and provider['status'] != 'MISMATCH'},
        'notes': notes,
    }


def check(rpc, domain):
    require(quantity(rpc('eth_chainId', [])) == BASE_SEPOLIA, 'not Base Sepolia')
    for attempt in range(1, ATTEMPTS + 1):
        try:
            report = reading(rpc, domain)
        except HeadChanged:
            continue
        report['block']['attempts'] = attempt
        return report
    raise VerificationError(f'the head block changed during each of {ATTEMPTS} readings; run the check again')


def confirm(rpc, report):
    """True if the report's block number still names the report's hash."""
    block = report['block']
    current = numbered_block(rpc, block['number'])
    return current is not None and current['hash'] == block_hash(block['hash'])


def main():
    rpc = Rpc(os.environ['OPS_RPC_URL'])
    if sys.argv[1] == '--confirm':
        report = json.loads(Path(sys.argv[2]).read_text())
        same = confirm(rpc, report)
        print(f"block {report['block']['number']} {'still' if same else 'NO LONGER'} has hash {report['block']['hash']}")
        return 0 if same else 1
    out = Path(sys.argv[1])
    domain = json.loads((ROOT / 'script/release/first-callback-domain-84532.json').read_text())
    report = check(rpc, domain)
    out.write_text(json.dumps(report, indent=1) + '\n')
    print(json.dumps(report['verdict']), 'block', report['block']['number'], report['block']['hash'], 'blockGasLimit',
          report['gas']['blockGasLimit'], 'provider', report['provider']['status'], 'notes', len(report['notes']))
    return 0 if report['verdict']['ok'] else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (VerificationError, KeyError, TypeError, IndexError, OSError, ValueError) as error:
        detail = str(error) if isinstance(error, VerificationError) else 'invalid input or unavailable endpoint'
        sys.exit('Denim activation check failed: ' + detail)
