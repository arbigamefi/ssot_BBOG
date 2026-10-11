#!/usr/bin/env python3
"""Verify the complete v1.6 authority and authorization history of a release at one block.

The release is governed by its GovernanceTimelock from construction (ADR-0037 §9, decision D1). The verifier replays
every authority event of the timelock and of the governed contracts (PoolRegistry, GameHub, ReferralRegistry, each
Bank) from the signed snapshot's start block, which precedes all of their creations (empty code at start - 1 proves
it), then runs VerifyGovernanceV16 on a fork at the same frozen block for the state checks. No RPC failure or
incomplete history is treated as an empty authorization set.

GOVERNANCE_VERIFY_MODE selects what the history must show (V16Snapshot.Mode has the same two):

  release (default)  the pre-launch release state that signing and the Release Gate require: the wiring operation
                     executed and nothing else, the activation at most scheduled, every pool inactive, no pause, no
                     disabled game, no void window, every role, sentinel and guardian set exactly once as released;
  live               a deployed release as the frontend import checks it: authority exactly as released, the
                     registration sets as released or reduced (a deregistered hub or route, a disabled game, a pause,
                     an inactive pool are accepted and reported); an active pool requires the release's activation.

Each verification also emits a checkpoint: the replayed state at the verified block and its SHA-256. A later run may
start from such a checkpoint instead of the deployment block, but only when its digest comes from a signed record
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
ZERO_WORD = '0x' + '0' * 64
# The certified casino games and their snapshot module keys (first-callback certificate domain, ADR-0034).
GAMES = (('DICE', 'moduleDice'), ('COIN_TOSS', 'moduleCoinToss'), ('ROULETTE', 'moduleRoulette'),
         ('KENO', 'moduleKeno'), ('PLINKO', 'modulePlinko'), ('SIC_BO', 'moduleSicBo'), ('SLOTS', 'moduleSlots'),
         ('BACCARAT', 'moduleBaccarat'))
MODES = ('release', 'live')
# GovernanceTimelock.MIN_DELAY, the release delay (ADR-0037 D7).
RELEASE_DELAY = 259_200
# Base's public RPC refuses eth_getLogs ranges above 200 blocks (HTTP 413).
DEFAULT_PAGE_BLOCKS = 200
MAX_PAGE_BLOCKS = 10_000
# Transient provider answers worth another attempt; every other failure is final at once.
RETRY_HTTP = frozenset({408, 425, 429}) | frozenset(range(500, 600))
RETRY_JSONRPC = frozenset({-32000, -32005, -32603})
# Forge diagnostics that mean the fork's RPC connection failed, not the check.
FORGE_TRANSPORT = re.compile('|'.join((
    r'error sending request', r'tls handshake', r'client error \(connect\)', r'could not instantiate forked environment',
    r'connection (reset|refused|closed)', r'operation timed out', r'HTTP error (429|5\d\d)')), re.I)
CHECKPOINT_SCHEMA = 'ARBIGAMEFI_GOVERNANCE_CHECKPOINT_V2'

GOVERNANCE = ('GovernanceTransferStarted(address,address)', 'GovernanceTransferred(address,address)')
SENTINEL = 'SentinelSet(address)'
REGISTRY_EVENTS = ('PoolRegistered(uint64,address,address,uint8)', 'HubRegistered(address,bool)',
                   'HubAllowedForPoolSet(uint64,address,bool)', 'PoolActiveSet(uint64,bool)', SENTINEL) + GOVERNANCE
HUB_EVENTS = ('GameRegistered(bytes32,address,uint32,uint32)', 'GameDisabled(bytes32,address)',
              'VoidWindowOpened(uint64,address,uint64,address)', SENTINEL) + GOVERNANCE
BANK_EVENTS = (SENTINEL, 'GuardianSet(address)', 'RiskInPausedSet(bool,address)') + GOVERNANCE
REFERRAL_EVENTS = GOVERNANCE
TIMELOCK_EVENTS = ('RoleGranted(bytes32,address,address)', 'RoleRevoked(bytes32,address,address)',
                   'RoleAdminChanged(bytes32,bytes32,bytes32)',
                   'CallScheduled(bytes32,uint256,address,uint256,bytes,bytes32,uint256)',
                   'CallExecuted(bytes32,uint256,address,uint256,bytes)', 'Cancelled(bytes32)',
                   'MinDelayChange(uint256,uint256)')


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


def hex_word(value):
    return format(value, '#066x')


def topic_address(value):
    require(word(value) < 2**160, 'invalid indexed address')
    return '0x' + value[-40:].lower()


@functools.lru_cache(maxsize=None)
def signature(value):
    # Reuse Foundry's Keccak implementation instead of adding a crypto dependency.
    return subprocess.check_output(['cast', 'keccak', value], text=True).strip().lower()


def role(name):
    return ZERO_WORD if name == 'DEFAULT_ADMIN_ROLE' else signature(name)


def page_blocks():
    value = os.environ.get('GOVERNANCE_LOG_PAGE_BLOCKS', str(DEFAULT_PAGE_BLOCKS))
    require(re.fullmatch(r'[1-9][0-9]*', value) is not None and int(value) <= MAX_PAGE_BLOCKS,
            f'GOVERNANCE_LOG_PAGE_BLOCKS must be 1 to {MAX_PAGE_BLOCKS}')
    return int(value)


def verify_mode():
    value = os.environ.get('GOVERNANCE_VERIFY_MODE', 'release')
    require(value in MODES, 'GOVERNANCE_VERIFY_MODE must be release or live')
    return value


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


def events(rpc, watch, start, end):
    """Every log of the watched {address: [event signature]} in [start, end], in chain order.

    One eth_getLogs per page covers all addresses; each returned log must be one its address was asked for.
    """
    rows = []
    seen = set()
    wanted = {target: {signature(name): name for name in names} for target, names in watch.items()}
    topics = sorted({topic for names in wanted.values() for topic in names})
    size = page_blocks()
    for first in range(start, end + 1, size):
        last = min(first + size - 1, end)
        page = rpc('eth_getLogs', [{'address': sorted(wanted), 'fromBlock': hex(first), 'toBlock': hex(last),
                                   'topics': [topics]}])
        require(isinstance(page, list), 'invalid authorization log response')
        for row in page:
            require(isinstance(row, dict) and row.get('removed') is False, 'invalid or removed authorization log')
            target = address(row.get('address'))
            require(target in wanted and isinstance(row['topics'], list) and row['topics']
                    and row['topics'][0] in wanted[target], 'unexpected authorization log')
            block = quantity(row['blockNumber'])
            require(first <= block <= last, 'authorization log outside requested range')
            key = (block, quantity(row['transactionIndex']), quantity(row['logIndex']))
            require(key not in seen, 'duplicate authorization log')
            seen.add(key)
            rows.append((key, target, wanted[target][row['topics'][0]], row))
    return [(target, name, row) for _, target, name, row in sorted(rows, key=lambda item: item[0])]


def data_words(row, count=None):
    data = row.get('data')
    require(isinstance(data, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{64})*', data), 'invalid log data')
    values = [int(data[2 + 64 * i:66 + 64 * i], 16) for i in range((len(data) - 2) // 64)]
    require(count is None or len(values) >= count, 'invalid log data')
    return values


def boolean(value):
    require(value in (0, 1), 'invalid authorization event boolean')
    return bool(value)


def topics(row, count):
    require(len(row['topics']) == count, 'invalid authorization event topics')
    return row['topics']


class Release:
    """The contracts and declared values of one release snapshot."""

    def __init__(self, snap):
        require(snap['architectureVersion'] == 'v1.6-nft-liquidity', 'unsupported release architecture')
        start = snap['blockNumber']
        require(type(start) is int and start > 0, 'invalid authorization history start')
        self.snap, self.start, self.chain = snap, start, snap['chainId']
        self.registry, self.hub = address(snap['poolRegistry']), address(snap['gameHub'])
        self.timelock, self.referral = address(snap['governanceTimelock']), address(snap['refRegistry'])
        self.safe, self.guardian, self.deployer = address(snap['gov']), address(snap['guardian']), address(snap['deployer'])
        require(ZERO not in (self.registry, self.hub, self.timelock, self.referral, self.safe, self.guardian),
                'missing release address')
        require(self.guardian != self.safe, 'guardian is the Safe')
        require(snap['timelockMinDelay'] == RELEASE_DELAY, 'timelock delay differs from the release delay')
        self.wiring, self.activation = (hex_word(word(snap['wiringOperationId'])),
                                        hex_word(word(snap['activationOperationId'])))
        require(type(snap['numPools']) is int and 1 <= snap['numPools'] <= 32, 'invalid pool count')
        self.pools, self.vaults, self.banks = {}, {}, []
        for i in range(snap['numPools']):
            pool, domain = snap[f'poolId_{i}'], snap[f'poolDomain_{i}']
            require(type(pool) is int and 0 < pool < 2**64 and pool not in self.pools, 'invalid or duplicate pool')
            require(domain == 1, 'not a casino pool')
            asset, bank, vault = address(snap[f'poolAsset_{i}']), address(snap[f'poolBank_{i}']), address(snap[f'poolVault_{i}'])
            require(ZERO not in (asset, bank, vault) and vault != bank and vault not in self.vaults.values()
                    and bank not in self.banks, 'invalid or duplicate Vault binding')
            self.pools[pool] = (asset, bank, domain)
            self.vaults[bank] = vault
            self.banks.append(bank)
        modules = [address(snap[key]) for _, key in GAMES]
        require(len(set(modules)) == len(modules), 'a module is registered under more than one game')
        self.games = {word(signature(name)): (address(snap[key]), snap['gameMaxBetCount_' + name],
                                              snap['gameCallbackGasLimit_' + name]) for name, key in GAMES}
        self.governed = [self.registry, self.hub, self.referral] + self.banks
        require(len(set(self.governed + [self.timelock])) == len(self.governed) + 1, 'duplicate release contract')
        self.sentinel_targets = [self.registry, self.hub] + self.banks
        self.roles = {role('DEFAULT_ADMIN_ROLE'): {self.timelock}, role('PROPOSER_ROLE'): {self.safe},
                      role('CANCELLER_ROLE'): {self.safe, self.guardian}, role('EXECUTOR_ROLE'): {ZERO}}

    def watch(self):
        watch = {self.registry: REGISTRY_EVENTS, self.hub: HUB_EVENTS, self.referral: REFERRAL_EVENTS,
                 self.timelock: TIMELOCK_EVENTS}
        watch.update({bank: BANK_EVENTS for bank in self.banks})
        return watch


def empty_state():
    return {'pools': {}, 'poolActive': {}, 'registered': {}, 'allowed': {}, 'games': {}, 'disabledGames': [],
            'voidWindows': [], 'transfers': {}, 'transfersStarted': {}, 'sentinels': {}, 'guardians': {},
            'pauses': {}, 'roles': {}, 'roleAdminChanges': 0, 'minDelayChanges': [], 'operations': {}}


def encode_state(state):
    """Canonical JSON form of the replayed authority state."""
    return {
        'pools': {str(pool): list(cfg) for pool, cfg in sorted(state['pools'].items())},
        'poolActive': {str(pool): value for pool, value in sorted(state['poolActive'].items())},
        'registeredHubs': dict(sorted(state['registered'].items())),
        'allowedRoutes': {f'{pool}:{hub}': value for (pool, hub), value in sorted(state['allowed'].items())},
        'games': {hex_word(game_id): list(cfg) for game_id, cfg in sorted(state['games'].items())},
        'disabledGames': [hex_word(game_id) for game_id in state['disabledGames']],
        'voidWindows': [list(window) for window in state['voidWindows']],
        'transfers': {target: [list(t) for t in rows] for target, rows in sorted(state['transfers'].items())},
        'transfersStarted': {target: [list(t) for t in rows] for target, rows in sorted(state['transfersStarted'].items())},
        'sentinels': dict(sorted((target, list(rows)) for target, rows in state['sentinels'].items())),
        'guardians': dict(sorted((target, list(rows)) for target, rows in state['guardians'].items())),
        'pauses': {target: [list(p) for p in rows] for target, rows in sorted(state['pauses'].items())},
        'roles': {r: dict(sorted(members.items())) for r, members in sorted(state['roles'].items())},
        'roleAdminChanges': state['roleAdminChanges'],
        'minDelayChanges': [list(change) for change in state['minDelayChanges']],
        'operations': {op: dict(sorted(entry.items())) for op, entry in sorted(state['operations'].items())},
    }


def decode_state(encoded):
    keys = {'pools', 'poolActive', 'registeredHubs', 'allowedRoutes', 'games', 'disabledGames', 'voidWindows',
            'transfers', 'transfersStarted', 'sentinels', 'guardians', 'pauses', 'roles', 'roleAdminChanges',
            'minDelayChanges', 'operations'}
    require(isinstance(encoded, dict) and set(encoded) == keys, 'invalid checkpoint state')
    state = empty_state()

    def pool_id(text):
        require(isinstance(text, str) and re.fullmatch(r'[1-9][0-9]*', text) is not None and int(text) < 2**64,
                'invalid checkpoint pool')
        return int(text)

    def addresses(rows):
        require(isinstance(rows, list), 'invalid checkpoint history')
        return [address(row) for row in rows]

    def pairs(rows):
        require(isinstance(rows, list) and all(isinstance(r, list) and len(r) == 2 for r in rows),
                'invalid checkpoint history')
        return [(address(a), address(b)) for a, b in rows]

    for pool, cfg in encoded['pools'].items():
        require(isinstance(cfg, list) and len(cfg) == 3 and type(cfg[2]) is int, 'invalid checkpoint pool')
        state['pools'][pool_id(pool)] = (address(cfg[0]), address(cfg[1]), cfg[2])
    for pool, value in encoded['poolActive'].items():
        require(type(value) is bool, 'invalid checkpoint pool')
        state['poolActive'][pool_id(pool)] = value
    for hub, value in encoded['registeredHubs'].items():
        require(type(value) is bool, 'invalid checkpoint hub')
        state['registered'][address(hub)] = value
    for route, value in encoded['allowedRoutes'].items():
        pool, _, hub = route.partition(':')
        require(type(value) is bool, 'invalid checkpoint route')
        state['allowed'][(pool_id(pool), address(hub))] = value
    for game_id, cfg in encoded['games'].items():
        require(isinstance(cfg, list) and len(cfg) == 3 and type(cfg[1]) is int and type(cfg[2]) is int,
                'invalid checkpoint game')
        state['games'][word(game_id)] = (address(cfg[0]), cfg[1], cfg[2])
    require(isinstance(encoded['disabledGames'], list), 'invalid checkpoint game')
    state['disabledGames'] = [word(game_id) for game_id in encoded['disabledGames']]
    require(isinstance(encoded['voidWindows'], list) and all(
        isinstance(w, list) and len(w) == 4 and type(w[0]) is int and type(w[2]) is int for w in encoded['voidWindows']),
        'invalid checkpoint void window')
    state['voidWindows'] = [(w[0], address(w[1]), w[2], address(w[3])) for w in encoded['voidWindows']]
    for key in ('transfers', 'transfersStarted'):
        require(isinstance(encoded[key], dict), 'invalid checkpoint history')
        state[key] = {address(target): pairs(rows) for target, rows in encoded[key].items()}
    for key in ('sentinels', 'guardians'):
        require(isinstance(encoded[key], dict), 'invalid checkpoint history')
        state[key] = {address(target): addresses(rows) for target, rows in encoded[key].items()}
    require(isinstance(encoded['pauses'], dict), 'invalid checkpoint history')
    for target, rows in encoded['pauses'].items():
        require(isinstance(rows, list) and all(isinstance(r, list) and len(r) == 2 and type(r[0]) is bool for r in rows),
                'invalid checkpoint history')
        state['pauses'][address(target)] = [(r[0], address(r[1])) for r in rows]
    require(isinstance(encoded['roles'], dict), 'invalid checkpoint role')
    for r, members in encoded['roles'].items():
        require(isinstance(members, dict) and all(type(v) is bool for v in members.values()), 'invalid checkpoint role')
        state['roles'][hex_word(word(r))] = {address(member): value for member, value in members.items()}
    require(type(encoded['roleAdminChanges']) is int and encoded['roleAdminChanges'] >= 0, 'invalid checkpoint role')
    state['roleAdminChanges'] = encoded['roleAdminChanges']
    require(isinstance(encoded['minDelayChanges'], list) and all(
        isinstance(c, list) and len(c) == 2 and all(type(v) is int for v in c) for c in encoded['minDelayChanges']),
        'invalid checkpoint delay')
    state['minDelayChanges'] = [tuple(c) for c in encoded['minDelayChanges']]
    require(isinstance(encoded['operations'], dict), 'invalid checkpoint operation')
    for op, entry in encoded['operations'].items():
        require(isinstance(entry, dict) and set(entry) == {'calls', 'state'} and type(entry['calls']) is int
                and entry['state'] in ('scheduled', 'executed', 'cancelled'), 'invalid checkpoint operation')
        state['operations'][hex_word(word(op))] = dict(entry)
    return state


def apply(release, state, target, name, row):
    """One authority event, in chain order."""
    short = name.split('(')[0]
    if short == 'GovernanceTransferStarted':
        t = topics(row, 3)
        state['transfersStarted'].setdefault(target, []).append((topic_address(t[1]), topic_address(t[2])))
    elif short == 'GovernanceTransferred':
        t = topics(row, 3)
        state['transfers'].setdefault(target, []).append((topic_address(t[1]), topic_address(t[2])))
    elif short == 'SentinelSet':
        state['sentinels'].setdefault(target, []).append(topic_address(topics(row, 2)[1]))
    elif short == 'PoolRegistered':
        t = topics(row, 4)
        pool = word(t[1])
        require(pool < 2**64 and pool not in state['pools'], 'invalid or duplicate pool event')
        state['pools'][pool] = (topic_address(t[2]), topic_address(t[3]), data_words(row, 1)[0])
        state['poolActive'][pool] = True
    elif short == 'PoolActiveSet':
        pool = word(topics(row, 2)[1])
        require(pool in state['pools'], 'activity of an unregistered pool')
        state['poolActive'][pool] = boolean(data_words(row, 1)[0])
    elif short == 'HubRegistered':
        state['registered'][topic_address(topics(row, 2)[1])] = boolean(data_words(row, 1)[0])
    elif short == 'HubAllowedForPoolSet':
        t = topics(row, 3)
        pool = word(t[1])
        require(pool < 2**64, 'invalid authorization pool')
        state['allowed'][(pool, topic_address(t[2]))] = boolean(data_words(row, 1)[0])
    elif short == 'GameRegistered':
        t = topics(row, 3)
        game_id = word(t[1])
        require(game_id not in state['games'], 'duplicate game registration')
        count, gas = data_words(row, 2)[:2]
        state['games'][game_id] = (topic_address(t[2]), count, gas)
    elif short == 'GameDisabled':
        state['disabledGames'].append(word(topics(row, 3)[1]))
    elif short == 'VoidWindowOpened':
        t = topics(row, 4)
        state['voidWindows'].append((word(t[1]), topic_address(t[2]), data_words(row, 1)[0], topic_address(t[3])))
    elif short == 'GuardianSet':
        state['guardians'].setdefault(target, []).append(topic_address(topics(row, 2)[1]))
    elif short == 'RiskInPausedSet':
        state['pauses'].setdefault(target, []).append((boolean(data_words(row, 1)[0]), topic_address(topics(row, 2)[1])))
    elif short in ('RoleGranted', 'RoleRevoked'):
        t = topics(row, 4)
        state['roles'].setdefault(hex_word(word(t[1])), {})[topic_address(t[2])] = short == 'RoleGranted'
    elif short == 'RoleAdminChanged':
        topics(row, 4)
        state['roleAdminChanges'] += 1
    elif short == 'MinDelayChange':
        state['minDelayChanges'].append(tuple(data_words(row, 2)[:2]))
    elif short == 'CallScheduled':
        t = topics(row, 3)
        op, index = hex_word(word(t[1])), word(t[2])
        entry = state['operations'].get(op)
        if index == 0:
            require(entry is None or entry['state'] == 'cancelled', 'operation scheduled twice')
            state['operations'][op] = {'calls': 1, 'state': 'scheduled'}
        else:
            require(entry is not None and entry['state'] == 'scheduled' and entry['calls'] == index,
                    'operation calls out of order')
            entry['calls'] += 1
    elif short == 'CallExecuted':
        t = topics(row, 3)
        entry = state['operations'].get(hex_word(word(t[1])))
        require(entry is not None and entry['state'] in ('scheduled', 'executed') and word(t[2]) < entry['calls'],
                'execution of an operation that was not scheduled')
        entry['state'] = 'executed'
    elif short == 'Cancelled':
        entry = state['operations'].get(hex_word(word(topics(row, 2)[1])))
        require(entry is not None and entry['state'] == 'scheduled', 'cancellation of an operation that was not pending')
        entry['state'] = 'cancelled'
    else:
        raise VerificationError('unexpected authorization log')


def judge(rpc, release, state, block, mode):
    """Checks on the replayed history; returns the notes a live verification reports."""
    notes = []
    snap, strict = release.snap, mode == 'release'
    # Authority: the timelock from construction, its release roles and delay, never a transfer.
    for target in release.governed:
        require(state['transfers'].get(target, []) == [(ZERO, release.timelock)], 'governance history differs from release')
        require(not state['transfersStarted'].get(target), 'a governance transfer was started')
    members = {r: {m for m, held in held_by.items() if held} for r, held_by in state['roles'].items()}
    require({r: m for r, m in members.items() if m} == release.roles, 'timelock roles differ from release')
    require(state['roleAdminChanges'] == 0, 'timelock role administration changed')
    require(state['minDelayChanges'] == [(0, RELEASE_DELAY)], 'timelock delay history differs from release')
    for target in release.sentinel_targets:
        history = state['sentinels'].get(target, [])
        require(history and history[-1] == release.safe, 'sentinel is not the Safe')
        require(not strict or history == [release.safe], 'sentinel history differs from release')
    for bank in release.banks:
        history = state['guardians'].get(bank, [])
        require(history and history[-1] == release.guardian, 'Bank guardian differs from release')
        require(not strict or history == [release.guardian], 'guardian history differs from release')

    # Operations: the wiring executed; in the release state nothing else, the activation at most scheduled.
    operations = state['operations']
    wiring, activation = operations.get(release.wiring), operations.get(release.activation)
    require(wiring is not None and wiring['state'] == 'executed', 'wiring operation not executed')
    launched = activation is not None and activation['state'] == 'executed'
    executed = {op for op, entry in operations.items() if entry['state'] == 'executed'}
    pending = {op for op, entry in operations.items() if entry['state'] == 'scheduled'}
    if strict:
        require(not launched, 'activation executed: the release state is pre-launch')
        require(executed == {release.wiring}, 'an operation outside the release executed')
        require(pending <= {release.activation}, 'an operation outside the release is pending')
    for op in sorted(pending):
        state_code = call(rpc, release.timelock, 'getOperationState(bytes32)', [op], block)
        require(state_code in (1, 2), 'pending operation differs from the timelock')
        ready_at = call(rpc, release.timelock, 'getTimestamp(bytes32)', [op], block)
        label = 'activation' if op == release.activation else 'undeclared operation'
        notes.append(f'{label} {op} pending, {"ready" if state_code == 2 else "waiting"} from {ready_at}')
    for op in sorted(executed):
        require(call(rpc, release.timelock, 'isOperationDone(bytes32)', [op], block) == 1,
                'executed operation differs from the timelock')
        if op not in (release.wiring, release.activation):
            notes.append(f'undeclared operation {op} executed')
    notes += [f'operation {op} cancelled' for op, entry in sorted(operations.items()) if entry['state'] == 'cancelled']

    # Authorization: the released pools, hub, routes and games; reductions only in the live check.
    require(state['pools'] == release.pools, 'pool history differs from release')
    registered = {hub for hub, value in state['registered'].items() if value}
    routes = {route for route, value in state['allowed'].items() if value}
    expected_routes = {(pool, release.hub) for pool in release.pools}
    if strict:
        require(registered == {release.hub}, 'registered hub set differs from release')
        # Check raw grants too: a revoked hub must not retain an undeclared latent route.
        require(routes == expected_routes, 'hub/pool authorization set differs from release')
    else:
        require(registered <= {release.hub}, 'registered hub set differs from release')
        require(routes <= expected_routes, 'hub/pool authorization set differs from release')
        if release.hub not in registered:
            notes.append(f'hub {release.hub} deregistered')
        notes += [f'route pool {pool} closed' for pool, _ in sorted(expected_routes - routes)]
    for pool, active in sorted(state['poolActive'].items()):
        require(not (strict and active), 'pool active before the release activation')
        require(not active or launched, 'pool active without the release activation')
        if launched and not active:
            notes.append(f'pool {pool} inactive')
    # GameHub cannot enumerate games, and the snapshot names only the certified eight. Replay every
    # registration so that an extra game (any id, any module) cannot sit outside the certified domain.
    require(state['games'] == release.games, 'registered game set differs from release')
    require(not (strict and state['disabledGames']), 'game disabled in the release state')
    notes += [f'game {hex_word(game_id)} disabled' for game_id in state['disabledGames']]
    require(not (strict and state['voidWindows']), 'void window opened in the release state')
    notes += [f'void window opened for pool {w[0]} through {w[2]}' for w in state['voidWindows']]
    for bank, history in sorted(state['pauses'].items()):
        require(not strict, 'Bank pause history in the release state')
        if history[-1][0]:
            notes.append(f'Bank {bank} paused')

    # The replayed state is the chain's state at the frozen block.
    registry = release.registry
    require(call(rpc, registry, 'poolCount()', [], block) == len(release.pools), 'pool count differs from history')
    for i, (pool, cfg) in enumerate(release.pools.items()):
        require(call(rpc, registry, 'poolIdAt(uint256)', [i], block) == pool
                and call(rpc, registry, 'domainFor(uint64)', [pool], block) == cfg[2], 'pool route differs from history')
        require(call(rpc, registry, 'isPoolActive(uint64)', [pool], block) == int(state['poolActive'][pool]),
                'pool activity differs from history')
    for hub, value in state['registered'].items():
        require(call(rpc, registry, 'isRegisteredHub(address)', [hub], block) == int(value), 'hub mapping differs from history')
    for (pool, hub), value in state['allowed'].items():
        require(call(rpc, registry, 'isHubAllowedForPool(uint64,address)', [pool, hub], block) == int(value),
                'hub/pool mapping differs from history')
    for game_id in state['disabledGames']:
        require(call(rpc, release.hub, 'gameDisabled(bytes32)', [hex_word(game_id)], block) == 1,
                'disabled game differs from history')
    for bank, history in state['pauses'].items():
        require(call(rpc, bank, 'paused()', [], block) == int(history[-1][0]), 'Bank pause differs from history')
    return launched, notes


def checkpoint_document(snap, state, block, block_hash):
    return {'schema': CHECKPOINT_SCHEMA, 'chainId': snap['chainId'], 'historyStart': snap['blockNumber'],
            'governanceTimelock': address(snap['governanceTimelock']), 'poolRegistry': address(snap['poolRegistry']),
            'gameHub': address(snap['gameHub']), 'blockNumber': block, 'blockHash': block_hash.lower(),
            'state': encode_state(state)}


def checkpoint_digest(document):
    return hashlib.sha256(json.dumps(document, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def load_checkpoint(path, expected_sha256):
    """Read a checkpoint whose digest the caller took from a signed record."""
    require(isinstance(expected_sha256, str) and re.fullmatch(r'(0x)?[0-9a-f]{64}', expected_sha256) is not None,
            'a checkpoint needs GOVERNANCE_CHECKPOINT_SHA256 from a signed record')
    document = json.loads(Path(path).read_text())
    require(isinstance(document, dict) and checkpoint_digest(document) == expected_sha256.removeprefix('0x'),
            'checkpoint differs from its signed digest')
    return document


def verify_permissions(rpc, snap, block, checkpoint=None, mode='release'):
    """Return (state, launched, notes) at `block`, replayed from the deployment or from `checkpoint`."""
    require(mode in MODES, 'GOVERNANCE_VERIFY_MODE must be release or live')
    release = Release(snap)
    require(quantity(rpc('eth_chainId', [])) == release.chain, 'chain mismatch')
    require(release.start <= block, 'invalid authorization history start')
    for bank, vault in release.vaults.items():
        asset = next(cfg[0] for cfg in release.pools.values() if cfg[1] == bank)
        require(call(rpc, bank, 'vault()', [], block) == int(vault, 16), 'Bank Vault binding differs from release')
        require(call(rpc, bank, 'asset()', [], block) == int(asset, 16), 'Bank asset differs from release')
        require(call(rpc, vault, 'bank()', [], block) == int(bank, 16), 'Vault Bank binding differs from release')
        require(call(rpc, vault, 'asset()', [], block) == int(asset, 16), 'Vault asset differs from release')
    targets = [release.timelock] + release.governed
    if checkpoint is None:
        state, first = empty_state(), release.start
        for target in targets:
            require(rpc('eth_getCode', [target, hex(release.start - 1)]) == '0x',
                    'authorization history starts after contract creation')
    else:
        # The signed checkpoint carries the history up to its block; the chain must still contain that block.
        require(checkpoint.get('schema') == CHECKPOINT_SCHEMA and checkpoint.get('chainId') == release.chain
                and checkpoint.get('historyStart') == release.start
                and checkpoint.get('governanceTimelock') == release.timelock
                and checkpoint.get('poolRegistry') == release.registry and checkpoint.get('gameHub') == release.hub,
                'checkpoint belongs to another release')
        last_checked = checkpoint.get('blockNumber')
        require(type(last_checked) is int and release.start <= last_checked <= block, 'invalid checkpoint block')
        head = rpc('eth_getBlockByNumber', [hex(last_checked), False])
        require(isinstance(head, dict) and isinstance(head.get('hash'), str)
                and head['hash'].lower() == checkpoint.get('blockHash'), 'checkpoint block is not on this chain')
        state, first = decode_state(checkpoint.get('state')), last_checked + 1
    for target in targets:
        code = rpc('eth_getCode', [target, hex(block)])
        require(isinstance(code, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{2})+', code), 'authorization target has no code')
    for target, name, row in events(rpc, release.watch(), first, block):
        apply(release, state, target, name, row)
    launched, notes = judge(rpc, release, state, block, mode)
    return state, launched, notes


def verify(snap, rpc, forge, checkpoint=None, mode='release'):
    frozen = rpc('eth_getBlockByNumber', ['latest', False])
    block = quantity(frozen['number'])
    block_hash = frozen['hash']
    word(block_hash)
    state, launched, notes = verify_permissions(rpc, snap, block, checkpoint, mode)
    forge(block)
    require(rpc('eth_getBlockByNumber', [hex(block), False])['hash'] == block_hash,
            'verification block changed; retry complete verification')
    document = checkpoint_document(snap, state, block, block_hash)
    return {'status': 'verified', 'mode': mode, 'chainId': snap['chainId'], 'blockNumber': block,
            'blockHash': block_hash, 'launched': launched, 'notes': notes,
            'replayedFrom': snap['blockNumber'] if checkpoint is None else checkpoint['blockNumber'] + 1,
            'checkpointSha256': checkpoint_digest(document), 'checkpoint': document}


def main():
    snap = json.loads(Path(os.environ['SNAPSHOT_PATH']).read_text())
    rpc = Rpc(os.environ['RPC_URL'])
    mode = verify_mode()
    checkpoint = None
    if os.environ.get('GOVERNANCE_CHECKPOINT'):
        checkpoint = load_checkpoint(os.environ['GOVERNANCE_CHECKPOINT'], os.environ.get('GOVERNANCE_CHECKPOINT_SHA256'))

    def forge(block):
        result = subprocess.run(['forge', 'script', 'script/release/VerifyGovernanceV16.s.sol:VerifyGovernanceV16',
                                 '--rpc-url', rpc.url, '--fork-block-number', str(block)],
                                capture_output=True, text=True, timeout=600,
                                env={**os.environ, 'GOVERNANCE_VERIFY_MODE': mode})
        # Raw Forge diagnostics can include RPC credentials. Importers only need the rejecting stage, and the release
        # script needs to know whether a retry can help.
        transport = FORGE_TRANSPORT.search(result.stdout + result.stderr)
        require(result.returncode == 0,
                'frozen-block governance verification failed' + (' (RPC transport error)' if transport else ''))

    result = verify(snap, rpc, forge, checkpoint, mode)
    if os.environ.get('GOVERNANCE_CHECKPOINT_OUT'):
        Path(os.environ['GOVERNANCE_CHECKPOINT_OUT']).write_text(json.dumps(result['checkpoint'], indent=2) + '\n')
    print(f'RPC calls {rpc.calls}, retries {rpc.retries}, log page {page_blocks()} blocks', file=sys.stderr)
    for note in result['notes']:
        print('note: ' + note, file=sys.stderr)
    print(json.dumps({key: value for key, value in result.items() if key != 'checkpoint'}))


if __name__ == '__main__':
    try:
        main()
    except (VerificationError, KeyError, TypeError, IndexError, OSError, subprocess.SubprocessError, ValueError) as error:
        detail = str(error) if isinstance(error, VerificationError) else 'invalid verification input or unavailable verifier'
        sys.exit('governance verification failed: ' + detail)
