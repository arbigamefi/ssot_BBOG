#!/usr/bin/env python3
"""Verify complete v1.6 permissions and existing governance checks at one block.

The signed snapshot supplies the deployment scan start. Empty code at start - 1
proves that the event replay covers the contracts' entire authorization history.
No RPC failure or incomplete history is treated as an empty authorization set.
"""
import functools
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

ZERO = '0x' + '0' * 40
ROLES = ('OddsSigner', 'ResultReporter', 'ResultChallenger', 'ResultArbitrator')
# The certified casino games and their snapshot module keys (first-callback certificate domain, ADR-0034).
GAMES = (('DICE', 'moduleDice'), ('COIN_TOSS', 'moduleCoinToss'), ('ROULETTE', 'moduleRoulette'),
         ('KENO', 'moduleKeno'), ('PLINKO', 'modulePlinko'), ('SIC_BO', 'moduleSicBo'), ('SLOTS', 'moduleSlots'),
         ('BACCARAT', 'moduleBaccarat'))
CHUNK_SIZE = 500


class VerificationError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise VerificationError(message)


def address(value):
    require(isinstance(value, str) and re.fullmatch(r'0x[0-9a-fA-F]{40}', value), 'invalid address')
    return value.lower()


def quantity(value):
    require(isinstance(value, str) and re.fullmatch(r'0x[0-9a-fA-F]+', value), 'invalid RPC quantity')
    return int(value, 16)


def word(value):
    require(isinstance(value, str) and re.fullmatch(r'0x[0-9a-fA-F]{64}', value), 'invalid ABI word')
    return int(value, 16)


def topic_address(value):
    require(word(value) < 2**160, 'invalid indexed address')
    return '0x' + value[-40:].lower()


@functools.lru_cache(maxsize=None)
def signature(value):
    # Reuse Foundry's Keccak implementation instead of adding a crypto dependency.
    return subprocess.check_output(['cast', 'keccak', value], text=True).strip().lower()


class Rpc:
    def __init__(self, url):
        self.url = url

    def __call__(self, method, params):
        request = urllib.request.Request(self.url, json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params,
        }).encode(), {'Content-Type': 'application/json', 'User-Agent': 'ArbiGameFi-release-verifier/1'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.load(response)
        except (OSError, ValueError, urllib.error.HTTPError):
            # Never include URLs, request headers or provider error bodies.
            raise VerificationError(f'RPC {method} failed') from None
        require(isinstance(data, dict) and data.get('id') == 1 and 'error' not in data
                and data.get('result') is not None, f'RPC {method} failed')
        return data['result']


def call(rpc, target, name, args, block):
    encoded = ''.join(format(int(arg, 16) if isinstance(arg, str) else arg, '064x') for arg in args)
    return word(rpc('eth_call', [{'to': target, 'data': signature(name)[:10] + encoded}, hex(block)]))


def events(rpc, target, names, start, end):
    rows = []
    seen = set()
    topics = {signature(name): name for name in names}
    for first in range(start, end + 1, CHUNK_SIZE):
        last = min(first + CHUNK_SIZE - 1, end)
        page = rpc('eth_getLogs', [{'address': target, 'fromBlock': hex(first), 'toBlock': hex(last),
                                   'topics': [list(topics)]}])
        require(isinstance(page, list), 'invalid authorization log response')
        for row in page:
            require(isinstance(row, dict) and row.get('removed') is False, 'invalid or removed authorization log')
            require(address(row['address']) == target and isinstance(row['topics'], list)
                    and row['topics'] and row['topics'][0] in topics, 'unexpected authorization log')
            block = quantity(row['blockNumber'])
            require(first <= block <= last, 'authorization log outside requested range')
            key = (block, quantity(row['transactionIndex']), quantity(row['logIndex']))
            require(key not in seen, 'duplicate authorization log')
            seen.add(key)
            rows.append((key, topics[row['topics'][0]], row))
    return [(name, row) for _, name, row in sorted(rows, key=lambda item: item[0])]


def boolean_event(row, count):
    require(len(row['topics']) == count, 'invalid authorization event topics')
    value = word(row['data'])
    require(value in (0, 1), 'invalid authorization event boolean')
    return bool(value)


def verify_permissions(rpc, snap, block):
    require(snap['architectureVersion'] == 'v1.6-nft-liquidity', 'unsupported release architecture')
    require(quantity(rpc('eth_chainId', [])) == snap['chainId'], 'chain mismatch')
    start = snap['blockNumber']
    require(type(start) is int and 0 < start <= block, 'invalid authorization history start')
    registry, game = address(snap['poolRegistry']), address(snap['gameHub'])
    sports = address(snap['sportsHub'])
    require(snap['sportsEnabled'] in (0, 1), 'invalid sports flag')
    enabled = snap['sportsEnabled'] == 1
    require(registry != ZERO and game != ZERO, 'missing registry or game hub')
    require(type(snap['numPools']) is int and 1 <= snap['numPools'] <= 32, 'invalid pool count')
    pools, vaults = {}, set()
    for i in range(snap['numPools']):
        pool, domain = snap[f'poolId_{i}'], snap[f'poolDomain_{i}']
        require(type(pool) is int and 0 <= pool < 2**64 and pool not in pools, 'invalid or duplicate pool')
        require(domain in (1, 2) and (enabled or domain == 1), 'sports-disabled pool route')
        pools[pool] = (address(snap[f'poolAsset_{i}']), address(snap[f'poolBank_{i}']), domain)
        asset, bank, _ = pools[pool]
        vault = address(snap[f'poolVault_{i}'])
        require(asset != ZERO and bank != ZERO and vault != ZERO and vault != bank and vault not in vaults,
                'invalid or duplicate Vault binding')
        vaults.add(vault)
        require(call(rpc, bank, 'vault()', [], block) == int(vault, 16), 'Bank Vault binding differs from release')
        require(call(rpc, bank, 'asset()', [], block) == int(asset, 16), 'Bank asset differs from release')
        require(call(rpc, vault, 'bank()', [], block) == int(bank, 16), 'Vault Bank binding differs from release')
        require(call(rpc, vault, 'asset()', [], block) == int(asset, 16), 'Vault asset differs from release')
    if enabled:
        require(sports != ZERO and sports != game and any(p[2] == 2 for p in pools.values()), 'invalid sports route')
    else:
        require(sports == ZERO and address(snap['sportsRiskEngine']) == ZERO
                and all(address(snap['sports' + role]) == ZERO for role in ROLES), 'sports-disabled role route')
    for target in [registry, game] + ([sports] if enabled else []):
        require(rpc('eth_getCode', [target, hex(start - 1)]) == '0x', 'authorization history starts after contract creation')
        code = rpc('eth_getCode', [target, hex(block)])
        require(isinstance(code, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{2})+', code), 'authorization target has no code')

    registered, allowed, observed_pools = {}, {}, {}
    names = ['PoolRegistered(uint64,address,address,uint8)', 'HubRegistered(address,bool)',
             'HubAllowedForPoolSet(uint64,address,bool)']
    for name, row in events(rpc, registry, names, start, block):
        if name == names[0]:
            require(len(row['topics']) == 4, 'invalid pool event topics')
            pool = word(row['topics'][1])
            require(pool < 2**64 and pool not in observed_pools, 'invalid or duplicate pool event')
            observed_pools[pool] = (topic_address(row['topics'][2]), topic_address(row['topics'][3]), word(row['data']))
        elif name == names[1]:
            registered[topic_address(row['topics'][1])] = boolean_event(row, 2)
        else:
            value = boolean_event(row, 3)
            pool = word(row['topics'][1])
            require(pool < 2**64, 'invalid authorization pool')
            allowed[(pool, topic_address(row['topics'][2]))] = value
    require(observed_pools == pools, 'pool history differs from release')
    expected_hubs = {game} | ({sports} if enabled else set())
    expected_routes = {(pool, game if cfg[2] == 1 else sports) for pool, cfg in pools.items()}
    require({hub for hub, value in registered.items() if value} == expected_hubs, 'registered hub set differs from release')
    # Check raw grants too: a revoked hub must not retain an undeclared latent route.
    require({route for route, value in allowed.items() if value} == expected_routes, 'hub/pool authorization set differs from release')
    require(call(rpc, registry, 'poolCount()', [], block) == len(pools), 'pool count differs from history')
    for i, (pool, cfg) in enumerate(pools.items()):
        require(call(rpc, registry, 'poolIdAt(uint256)', [i], block) == pool
                and call(rpc, registry, 'domainFor(uint64)', [pool], block) == cfg[2], 'pool route differs from history')
    for hub, value in registered.items():
        require(call(rpc, registry, 'isRegisteredHub(address)', [hub], block) == int(value), 'hub mapping differs from history')
    for (pool, hub), value in allowed.items():
        require(call(rpc, registry, 'isHubAllowedForPool(uint64,address)', [pool, hub], block) == int(value), 'hub/pool mapping differs from history')

    # GameHub cannot enumerate games, and the snapshot names only the certified eight. Replay every
    # registration so that an extra game (any id, any module) cannot sit outside the certified domain.
    expected_games = {word(signature(name)): (address(snap[key]), snap['gameMaxBetCount_' + name],
                                              snap['gameCallbackGasLimit_' + name]) for name, key in GAMES}
    observed_games = {}
    for _, row in events(rpc, game, ['GameRegistered(bytes32,address,uint32,uint32)'], start, block):
        require(len(row['topics']) == 3 and isinstance(row['data'], str)
                and re.fullmatch(r'0x[0-9a-fA-F]{128}', row['data']), 'invalid game event')
        game_id = word(row['topics'][1])
        require(game_id not in observed_games, 'duplicate game registration')
        observed_games[game_id] = (topic_address(row['topics'][2]), int(row['data'][2:66], 16),
                                   int(row['data'][66:], 16))
    require(observed_games == expected_games, 'registered game set differs from release')

    if enabled:
        role_names = {role + 'Set(address,bool)': role for role in ROLES}
        states = {role: {} for role in ROLES}
        for name, row in events(rpc, sports, role_names, start, block):
            value = boolean_event(row, 2)
            states[role_names[name]][topic_address(row['topics'][1])] = value
        for role, state in states.items():
            expected = address(snap['sports' + role])
            expected_members = set() if expected == ZERO else {expected}
            require({member for member, value in state.items() if value} == expected_members,
                    f'sports {role} set differs from release')
            for member, value in state.items():
                require(call(rpc, sports, role[0].lower() + role[1:] + '(address)', [member], block) == int(value),
                        f'sports {role} mapping differs from history')


def verify(snap, rpc, forge):
    frozen = rpc('eth_getBlockByNumber', ['latest', False])
    block = quantity(frozen['number'])
    block_hash = frozen['hash']
    word(block_hash)
    verify_permissions(rpc, snap, block)
    forge(block)
    require(rpc('eth_getBlockByNumber', [hex(block), False])['hash'] == block_hash,
            'verification block changed; retry complete verification')
    return {'status': 'verified', 'chainId': snap['chainId'], 'blockNumber': block, 'blockHash': block_hash}


def main():
    snap = json.loads(Path(os.environ['SNAPSHOT_PATH']).read_text())
    rpc = Rpc(os.environ['RPC_URL'])

    def forge(block):
        result = subprocess.run(['forge', 'script', 'script/release/VerifyGovernanceV16.s.sol:VerifyGovernanceV16',
                                 '--rpc-url', rpc.url, '--fork-block-number', str(block)],
                                capture_output=True, text=True, timeout=600)
        # Raw Forge diagnostics can include RPC credentials. Importers only need the rejecting stage.
        require(result.returncode == 0, 'frozen-block governance verification failed')

    print(json.dumps(verify(snap, rpc, forge)))


if __name__ == '__main__':
    try:
        main()
    except (VerificationError, KeyError, TypeError, IndexError, OSError, subprocess.SubprocessError, ValueError) as error:
        detail = str(error) if isinstance(error, VerificationError) else 'invalid verification input or unavailable verifier'
        sys.exit('governance verification failed: ' + detail)
