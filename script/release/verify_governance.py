#!/usr/bin/env python3
"""Verify complete v1.6 permissions and existing governance checks at one block.

The signed snapshot supplies the deployment scan start. Empty code at start - 1
proves that the event replay covers the contracts' entire authorization history.
No RPC failure or incomplete history is treated as an empty authorization set.

Each verification also emits a checkpoint: the replayed authorization state at the
verified block and its SHA-256. A later run may start from such a checkpoint instead
of the deployment block, but only when its digest comes from a signed record
(GOVERNANCE_CHECKPOINT_SHA256) and its block hash is still on the chain.
"""
import functools
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ZERO = '0x' + '0' * 40
ROLES = ('OddsSigner', 'ResultReporter', 'ResultChallenger', 'ResultArbitrator')
# The certified casino games and their snapshot module keys (first-callback certificate domain, ADR-0034).
GAMES = (('DICE', 'moduleDice'), ('COIN_TOSS', 'moduleCoinToss'), ('ROULETTE', 'moduleRoulette'),
         ('KENO', 'moduleKeno'), ('PLINKO', 'modulePlinko'), ('SIC_BO', 'moduleSicBo'), ('SLOTS', 'moduleSlots'),
         ('BACCARAT', 'moduleBaccarat'))
# Base's public RPC refuses eth_getLogs ranges above 200 blocks (HTTP 413).
DEFAULT_PAGE_BLOCKS = 200
MAX_PAGE_BLOCKS = 10_000
# Transient provider answers worth another attempt; every other failure is final at once.
RETRY_HTTP = frozenset({408, 425, 429}) | frozenset(range(500, 600))
RETRY_JSONRPC = frozenset({-32000, -32005, -32603})
CHECKPOINT_SCHEMA = 'ARBIGAMEFI_GOVERNANCE_CHECKPOINT_V1'


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


def page_blocks():
    value = os.environ.get('GOVERNANCE_LOG_PAGE_BLOCKS', str(DEFAULT_PAGE_BLOCKS))
    require(re.fullmatch(r'[1-9][0-9]*', value) is not None and int(value) <= MAX_PAGE_BLOCKS,
            f'GOVERNANCE_LOG_PAGE_BLOCKS must be 1 to {MAX_PAGE_BLOCKS}')
    return int(value)


class Rpc:
    """JSON-RPC over HTTP with bounded exponential backoff on transient failures.

    Errors name the method, the HTTP status or JSON-RPC error code and the attempt count only: never the URL,
    request headers or provider error text, any of which can carry credentials.
    """

    def __init__(self, url, attempts=None, backoff=None, sleep=time.sleep):
        self.url = url
        self.attempts = int(os.environ.get('RPC_MAX_ATTEMPTS', '6')) if attempts is None else attempts
        self.backoff = float(os.environ.get('RPC_BACKOFF_SECONDS', '1')) if backoff is None else backoff
        require(1 <= self.attempts <= 20 and 0 <= self.backoff <= 30, 'invalid RPC retry settings')
        self.sleep = sleep
        self.calls = 0
        self.retries = 0

    def once(self, method, params):
        """Return ('ok', result), ('retry', class) or ('final', class)."""
        request = urllib.request.Request(self.url, json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params,
        }).encode(), {'Content-Type': 'application/json', 'User-Agent': 'ArbiGameFi-release-verifier/1'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.load(response)
        except urllib.error.HTTPError as error:
            return ('retry' if error.code in RETRY_HTTP else 'final'), f'HTTP {error.code}'
        except (OSError, TimeoutError, http.client.HTTPException):
            return 'retry', 'connection error'
        except ValueError:
            return 'final', 'invalid JSON response'
        if not isinstance(data, dict) or data.get('id') != 1:
            return 'final', 'invalid JSON-RPC response'
        if 'error' in data:
            code = data['error'].get('code') if isinstance(data['error'], dict) else None
            code = code if type(code) is int else None
            return ('retry' if code in RETRY_JSONRPC else 'final'), f'JSON-RPC error {code}'
        if data.get('result') is None:
            return 'final', 'empty JSON-RPC result'
        return 'ok', data['result']

    def __call__(self, method, params):
        for attempt in range(1, self.attempts + 1):
            self.calls += 1
            outcome, value = self.once(method, params)
            if outcome == 'ok':
                return value
            if outcome == 'final' or attempt == self.attempts:
                raise VerificationError(f'RPC {method} failed: {value} after {attempt} attempt(s)')
            self.retries += 1
            self.sleep(min(30.0, self.backoff * 2 ** (attempt - 1)))


def call(rpc, target, name, args, block):
    encoded = ''.join(format(int(arg, 16) if isinstance(arg, str) else arg, '064x') for arg in args)
    return word(rpc('eth_call', [{'to': target, 'data': signature(name)[:10] + encoded}, hex(block)]))


def events(rpc, target, names, start, end):
    rows = []
    seen = set()
    topics = {signature(name): name for name in names}
    size = page_blocks()
    for first in range(start, end + 1, size):
        last = min(first + size - 1, end)
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


def empty_state():
    return {'pools': {}, 'registered': {}, 'allowed': {}, 'games': {}}


def encode_state(state):
    """Canonical JSON form of the replayed authorization state."""
    return {
        'pools': {str(pool): list(cfg) for pool, cfg in sorted(state['pools'].items())},
        'registeredHubs': dict(sorted(state['registered'].items())),
        'allowedRoutes': {f'{pool}:{hub}': value for (pool, hub), value in sorted(state['allowed'].items())},
        'games': {format(game_id, '#066x'): list(cfg) for game_id, cfg in sorted(state['games'].items())},
    }


def decode_state(encoded):
    require(isinstance(encoded, dict) and set(encoded) == {'pools', 'registeredHubs', 'allowedRoutes', 'games'},
            'invalid checkpoint state')
    state = empty_state()
    for pool, cfg in encoded['pools'].items():
        require(re.fullmatch(r'[0-9]+', pool) is not None and int(pool) < 2**64 and isinstance(cfg, list)
                and len(cfg) == 3 and type(cfg[2]) is int, 'invalid checkpoint pool')
        state['pools'][int(pool)] = (address(cfg[0]), address(cfg[1]), cfg[2])
    for hub, value in encoded['registeredHubs'].items():
        require(type(value) is bool, 'invalid checkpoint hub')
        state['registered'][address(hub)] = value
    for route, value in encoded['allowedRoutes'].items():
        pool, _, hub = route.partition(':')
        require(re.fullmatch(r'[0-9]+', pool) is not None and int(pool) < 2**64 and type(value) is bool,
                'invalid checkpoint route')
        state['allowed'][(int(pool), address(hub))] = value
    for game_id, cfg in encoded['games'].items():
        require(isinstance(cfg, list) and len(cfg) == 3 and type(cfg[1]) is int and type(cfg[2]) is int,
                'invalid checkpoint game')
        state['games'][word(game_id)] = (address(cfg[0]), cfg[1], cfg[2])
    return state


def checkpoint_document(snap, state, block, block_hash):
    return {'schema': CHECKPOINT_SCHEMA, 'chainId': snap['chainId'], 'historyStart': snap['blockNumber'],
            'poolRegistry': address(snap['poolRegistry']), 'gameHub': address(snap['gameHub']),
            'blockNumber': block, 'blockHash': block_hash.lower(), 'state': encode_state(state)}


def checkpoint_digest(document):
    return hashlib.sha256(json.dumps(document, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def load_checkpoint(path, expected_sha256):
    """Read a checkpoint whose digest the caller took from a signed record."""
    require(isinstance(expected_sha256, str) and re.fullmatch(r'[0-9a-f]{64}', expected_sha256) is not None,
            'a checkpoint needs GOVERNANCE_CHECKPOINT_SHA256 from a signed record')
    document = json.loads(Path(path).read_text())
    require(isinstance(document, dict) and checkpoint_digest(document) == expected_sha256,
            'checkpoint differs from its signed digest')
    return document


def verify_permissions(rpc, snap, block, checkpoint=None):
    """Return the authorization state at `block`, replayed from the deployment or from `checkpoint`."""
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
    targets = [registry, game] + ([sports] if enabled else [])
    if checkpoint is None:
        state, first = empty_state(), start
        for target in targets:
            require(rpc('eth_getCode', [target, hex(start - 1)]) == '0x', 'authorization history starts after contract creation')
    else:
        # The signed checkpoint carries the history up to its block; the chain must still contain that block.
        require(not enabled, 'checkpoint replay covers casino-only releases')
        require(checkpoint.get('schema') == CHECKPOINT_SCHEMA and checkpoint.get('chainId') == snap['chainId']
                and checkpoint.get('historyStart') == start and checkpoint.get('poolRegistry') == registry
                and checkpoint.get('gameHub') == game, 'checkpoint belongs to another release')
        last_checked = checkpoint.get('blockNumber')
        require(type(last_checked) is int and start <= last_checked <= block, 'invalid checkpoint block')
        head = rpc('eth_getBlockByNumber', [hex(last_checked), False])
        require(isinstance(head, dict) and isinstance(head.get('hash'), str)
                and head['hash'].lower() == checkpoint.get('blockHash'), 'checkpoint block is not on this chain')
        state, first = decode_state(checkpoint.get('state')), last_checked + 1
    for target in targets:
        code = rpc('eth_getCode', [target, hex(block)])
        require(isinstance(code, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{2})+', code), 'authorization target has no code')

    registered, allowed, observed_pools = state['registered'], state['allowed'], state['pools']
    names = ['PoolRegistered(uint64,address,address,uint8)', 'HubRegistered(address,bool)',
             'HubAllowedForPoolSet(uint64,address,bool)']
    for name, row in events(rpc, registry, names, first, block):
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
    observed_games = state['games']
    for _, row in events(rpc, game, ['GameRegistered(bytes32,address,uint32,uint32)'], first, block):
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
        for role, members in states.items():
            expected = address(snap['sports' + role])
            expected_members = set() if expected == ZERO else {expected}
            require({member for member, value in members.items() if value} == expected_members,
                    f'sports {role} set differs from release')
            for member, value in members.items():
                require(call(rpc, sports, role[0].lower() + role[1:] + '(address)', [member], block) == int(value),
                        f'sports {role} mapping differs from history')
    return state


def verify(snap, rpc, forge, checkpoint=None):
    frozen = rpc('eth_getBlockByNumber', ['latest', False])
    block = quantity(frozen['number'])
    block_hash = frozen['hash']
    word(block_hash)
    state = verify_permissions(rpc, snap, block, checkpoint)
    forge(block)
    require(rpc('eth_getBlockByNumber', [hex(block), False])['hash'] == block_hash,
            'verification block changed; retry complete verification')
    document = checkpoint_document(snap, state, block, block_hash)
    return {'status': 'verified', 'chainId': snap['chainId'], 'blockNumber': block, 'blockHash': block_hash,
            'replayedFrom': snap['blockNumber'] if checkpoint is None else checkpoint['blockNumber'] + 1,
            'checkpointSha256': checkpoint_digest(document), 'checkpoint': document}


def main():
    snap = json.loads(Path(os.environ['SNAPSHOT_PATH']).read_text())
    rpc = Rpc(os.environ['RPC_URL'])
    checkpoint = None
    if os.environ.get('GOVERNANCE_CHECKPOINT'):
        checkpoint = load_checkpoint(os.environ['GOVERNANCE_CHECKPOINT'], os.environ.get('GOVERNANCE_CHECKPOINT_SHA256'))

    def forge(block):
        result = subprocess.run(['forge', 'script', 'script/release/VerifyGovernanceV16.s.sol:VerifyGovernanceV16',
                                 '--rpc-url', rpc.url, '--fork-block-number', str(block)],
                                capture_output=True, text=True, timeout=600)
        # Raw Forge diagnostics can include RPC credentials. Importers only need the rejecting stage.
        require(result.returncode == 0, 'frozen-block governance verification failed')

    result = verify(snap, rpc, forge, checkpoint)
    if os.environ.get('GOVERNANCE_CHECKPOINT_OUT'):
        Path(os.environ['GOVERNANCE_CHECKPOINT_OUT']).write_text(json.dumps(result['checkpoint'], indent=2) + '\n')
    print(f'RPC calls {rpc.calls}, retries {rpc.retries}, log page {page_blocks()} blocks', file=sys.stderr)
    print(json.dumps({key: value for key, value in result.items() if key != 'checkpoint'}))


if __name__ == '__main__':
    try:
        main()
    except (VerificationError, KeyError, TypeError, IndexError, OSError, subprocess.SubprocessError, ValueError) as error:
        detail = str(error) if isinstance(error, VerificationError) else 'invalid verification input or unavailable verifier'
        sys.exit('governance verification failed: ' + detail)
