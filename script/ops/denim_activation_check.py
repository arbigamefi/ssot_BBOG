#!/usr/bin/env python3
"""Read-only check of Base Denim on Base Sepolia (launch candidate plan A13 and section 13).

    script/ops/denim-activation-check.sh <new output directory>

At the head block it reports the block cadence (five blocks a second after Denim; header timestamps in whole seconds,
`timestampMs` in 200 ms steps), the block gas limit against a void transaction, whose gas the immutable GameHub
constants fix, the BaseTime predeploy and its tx[1] deposit, what the "pending" tag returns, and the VRF provider and
USDC against the certified domain file (`verify_callback_provider.verify_provider`, the coordinator's minimum request
confirmations included). The runner adds the direct-wrapper fork test at the same block. Run it once before and once
after the activation (2026-10-21 18:00 UTC); the RPC endpoint comes from OPS_RPC_URL and is never printed.
"""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'script/release'))
from verify_governance import Rpc, VerificationError, quantity, require, signature  # noqa: E402
from verify_callback_provider import GAME_HUB_REQUEST_CONFIRMATIONS, verify_provider  # noqa: E402

BASE_SEPOLIA = 84532
BASETIME = '0x4200000000000000000000000000000000000030'
# The keeper's floor for a void: VOID_SETTLEMENT_GAS + VOID_RESERVE_GAS + VOID_CALL_OVERHEAD + 150,000.
VOID_TRANSACTION_GAS = 10_755_000
# The L1 attributes deposit and, after Denim, the BaseTime deposit: 1,000,000 gas limit each.
DEPOSIT_GAS = 2_000_000
TX_GAS_CAP = 2 ** 24
CADENCE_BLOCKS = 20


def check(rpc, domain):
    require(quantity(rpc('eth_chainId', [])) == BASE_SEPOLIA, 'not Base Sepolia')
    latest = rpc('eth_getBlockByNumber', ['latest', True])
    head = quantity(latest['number'])
    blocks = [rpc('eth_getBlockByNumber', [hex(n), False]) for n in range(head - CADENCE_BLOCKS + 1, head + 1)]
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
    around = [rpc('eth_getBlockByNumber', [tag, False]) for tag in ('latest', 'pending', 'latest')]
    pending = {
        'numbers': [quantity(block['number']) for block in around],
        'pendingIsALatestBlock': around[1]['hash'] in (around[0]['hash'], around[2]['hash']),
    }
    snap = {'chainId': BASE_SEPOLIA, 'numPools': 1, 'poolDomain_0': 1, 'poolAsset_0': domain['token']['proxy'],
            'vrfWrapper': domain['providerReference']['wrapper']}
    try:
        verify_provider(rpc, snap, head, domain)
        provider = {'status': 'matches the certified domain', 'gameHubRequestConfirmations': GAME_HUB_REQUEST_CONFIRMATIONS}
    except VerificationError as error:
        provider = {'status': 'MISMATCH', 'error': str(error)}
    active = (cadence['blocksPerSecond'] or 0) >= 4 and base_time['tx1IsBaseTimeDeposit']
    return {
        'chainId': BASE_SEPOLIA, 'cadence': cadence, 'gas': gas, 'baseTime': base_time, 'pending': pending,
        'provider': {'block': head, **provider},
        'verdict': {'denimActive': active,
                    'ok': gas['voidFits'] and gas['txCapFits'] and provider['status'] != 'MISMATCH'},
    }


def main():
    out = Path(sys.argv[1])
    domain = json.loads((ROOT / 'script/release/first-callback-domain-84532.json').read_text())
    report = check(Rpc(os.environ['OPS_RPC_URL']), domain)
    out.write_text(json.dumps(report, indent=1) + '\n')
    print(json.dumps(report['verdict']), 'head', report['cadence']['head'], 'blockGasLimit',
          report['gas']['blockGasLimit'], 'provider', report['provider']['status'])
    return 0 if report['verdict']['ok'] else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (VerificationError, KeyError, TypeError, IndexError, OSError, ValueError) as error:
        detail = str(error) if isinstance(error, VerificationError) else 'invalid input or unavailable endpoint'
        sys.exit('Denim activation check failed: ' + detail)
