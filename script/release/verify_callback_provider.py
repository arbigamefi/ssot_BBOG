#!/usr/bin/env python3
"""Verify at one frozen block that the live token and VRF provider are the ones the first-callback certificate
was derived on (script/release/first-callback-domain-<chainId>.json).

An issuer upgrade of the USDC implementation or a wrapper/coordinator parameter change voids the certificate
(docs/audit/first-callback-gas-certificate-2026-10-07.md section 3) without any project transaction. `make
release-domain-check` runs this before anything is signed, next to the offline VerifyCallbackDomainV16.
No RPC failure is treated as a match.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_governance import (  # noqa: E402
    Rpc, VerificationError, address, call, quantity, require, signature, word)


def call_words(rpc, target, name, count, block):
    data = rpc('eth_call', [{'to': target, 'data': signature(name)[:10]}, hex(block)])
    require(isinstance(data, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{64})+', data) and len(data) >= 2 + 64 * count,
            f'invalid {name} result')
    return [int(data[2 + 64 * i:66 + 64 * i], 16) for i in range(count)]


def code_sha256(rpc, target, block):
    code = rpc('eth_getCode', [target, hex(block)])
    require(isinstance(code, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{2})+', code), 'certified code missing')
    return hashlib.sha256(bytes.fromhex(code[2:])).hexdigest()


def verify_provider(rpc, snap, block, domain):
    require(domain['chainId'] == snap['chainId'], 'first-callback certificate is for another chain')
    token, provider = domain['token'], domain['providerReference']
    proxy = address(token['proxy'])
    require(all(address(snap[f'poolAsset_{i}']) == proxy for i in range(snap['numPools'])
                if snap[f'poolDomain_{i}'] == 1), 'casino asset is not the certified token')
    implementation = rpc('eth_getStorageAt', [proxy, token['implementationSlot'], hex(block)])
    require('0x' + format(word(implementation), '040x') == address(token['implementation']),
            'token implementation differs from the certified one')
    require(code_sha256(rpc, proxy, block) == token['proxyRuntimeSha256']
            and code_sha256(rpc, address(token['implementation']), block) == token['implementationRuntimeSha256'],
            'token code differs from the certified one')
    wrapper = address(provider['wrapper'])
    require(address(snap['vrfWrapper']) == wrapper, 'VRF wrapper is not the certified provider')
    require(call(rpc, wrapper, 's_vrfCoordinator()', [], block) == int(provider['coordinator'], 16),
            'VRF coordinator is not the certified provider')
    overhead = call_words(rpc, wrapper, 'getConfig()', 12, block)[4]
    maximum = call_words(rpc, address(provider['coordinator']), 's_config()', 9, block)[1]
    require(overhead == provider['wrapperOverheadGas'] and maximum == provider['coordinatorMaxGas'],
            'VRF provider gas parameters differ from the certified ones')
    consumer = domain['consumerCallbackGasLimit']
    require(consumer + consumer // 63 + 1 + overhead <= maximum, 'certified consumer gas exceeds the provider limit')


def verify(snap, rpc, domain):
    frozen = rpc('eth_getBlockByNumber', ['latest', False])
    block = quantity(frozen['number'])
    word(frozen['hash'])
    verify_provider(rpc, snap, block, domain)
    require(rpc('eth_getBlockByNumber', [hex(block), False])['hash'] == frozen['hash'],
            'verification block changed; retry complete verification')
    return {'status': 'verified', 'chainId': snap['chainId'], 'blockNumber': block, 'blockHash': frozen['hash']}


def main():
    snap = json.loads(Path(os.environ['SNAPSHOT_PATH']).read_text())
    domain_path = os.environ.get('CALLBACK_DOMAIN_PATH',
                                 f"script/release/first-callback-domain-{snap['chainId']}.json")
    domain = json.loads(Path(domain_path).read_text())
    print(json.dumps(verify(snap, Rpc(os.environ['RPC_URL']), domain)))


if __name__ == '__main__':
    try:
        main()
    except (VerificationError, KeyError, TypeError, IndexError, OSError, ValueError) as error:
        detail = str(error) if isinstance(error, VerificationError) else 'invalid verification input or unavailable verifier'
        sys.exit('first-callback provider verification failed: ' + detail)
