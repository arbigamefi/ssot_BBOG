#!/usr/bin/env python3
"""Own-instruction bounds of every frame on the first-callback path, computed on the certified build.

    python3 frames.py <build directory> <callback domain file> <output json>

Ledger convention throughout (frame_bound.py): SLOAD 100, SSTORE 0, LOG 0, CALL family 0 plus memory expansion,
so storage, events, account access and callee bodies are charged once elsewhere. Calldata is the canonical encoding
the caller sends; unknown words fork every branch they reach and reverting paths are dropped. Every frame runs on
env_frame_bound.py: each call returns the words written out below, and every immutable is unknown instead of the
zeros the compiler output holds, so no branch on a deployment-time value is pruned.

The GameHub child and outer frame decode dynamic results and copy the stored params, so their environment also
fixes the offsets and lengths that shape their loops; the child is maximised over every awards count and params
length the domain admits.

Token topology: on Bank.settleBet and the Vault's applySettlement the asset immutable holds a marker address, and
the largest number of balanceOf, transfer and transferFrom calls (36-, 68- and 100-byte inputs to the asset) on one
successful path is counted. The reused USDC body bound assumes at most eleven balanceOf calls and two transfers.
"""
import json
import sys
from pathlib import Path

import frame_bound as F
import env_frame_bound as E

U = F.U
STATICCALL, CALL, SLOAD, GAS = 0xfa, 0xf1, 0x54, 0x5a
SOURCES = {'VRFHub': 'src/core/VRFHub.sol', 'SettlementRouter': 'src/core/SettlementRouter.sol',
           'LiquidityVault': 'src/core/LiquidityVault.sol', 'Bank': 'src/core/Bank.sol',
           'GameHub': 'src/core/GameHub.sol', 'DefaultReferralEngine': 'src/engines/referral/DefaultReferralEngine.sol'}
TREE = {'fun_allocationLeaf', 'fun_prefixCovers', 'fun_push', 'fun_pushLazy', 'fun_isNeedUpdateWholeLeaves',
        'fun_getLeavesAmount', 'fun_setAmount', 'fun_changeAmount'}
AWARDS = 'uint256,uint256,uint256,uint256,uint256,(address,address,uint256,uint256,uint256,bytes32)[]'
MAX_AWARDS = 3            # DefaultReferralEngine returns at most the L0, L1 and L2 awards
# GameHub accepts at most 64 params bytes (MAX_GAME_PARAMS_BYTES) and admits a bet only after the module's validate,
# which abi-decodes at least one word, so an admitted params value has 32..64 bytes.
PARAMS_LENGTHS = range(32, 65)
ASSET = 0xa55e7a55e7a55e7a55e7a55e7a55e7a55e7a55e7    # marker address for the token immutable
TOKEN_CALLS = {36: 'balanceOf', 68: 'transfer', 100: 'transferFrom'}


class Contract:
    def __init__(self, build, name):
        self.name = name
        o = json.loads((build / f'{name}-solc-output.json').read_text())['contracts'][SOURCES[name]][name]
        self.methods = o['evm']['methodIdentifiers']
        self.refs = {int(k): sorted(r['start'] for r in v)
                     for k, v in o['evm']['deployedBytecode']['immutableReferences'].items()}
        self.code, self.fdd = F.load(build / f'{name}-solc-output.json', SOURCES[name], name)
        self.ops, _ = F.P.decode(self.code)

    def selector(self, signature):
        return int(self.methods[signature], 16)

    def immutables(self, marked=()):
        return {start: (ASSET if start in marked else U) for starts in self.refs.values() for start in starts}

    def frame(self, signature, words, calls, marked=(), opaque=False, sloads=None):
        present = TREE & {v[0] for v in self.fdd.values()} if opaque else ()
        env = {'calls': calls, 'immutables': self.immutables(marked), 'sloads': sloads or {}}
        return E.Frame(self.code, self.fdd, self.selector(signature), words, env, present)

    def extent(self, name):
        lo = next(e for e, (n, _, _) in self.fdd.items() if n == name)
        return lo, min([e for e in self.fdd if e > lo] + [len(self.code)])


def returning(n):
    """Every call returns n unknown words."""
    return lambda pc, op: [U] * n


def summary(frame):
    return {'total': frame.total(), 'states': len(frame.best)}


def vrfhub(build):
    c = Contract(build, 'VRFHub')
    lo, hi = c.extent('fun_deliver')
    call = [pc for pc, (op, _, _) in c.ops.items() if lo <= pc < hi and op == CALL]
    assert len(call) == 1, call
    raw = c.frame('rawFulfillRandomWords(uint256,uint256[])', [U, 0x40, 1, U], returning(0))
    return {'hubCallPc': call[0],
            'rawFulfillRandomWords': {**summary(raw), 'toStop': raw.to_pc(call[0]), 'afterStop': raw.from_pc(call[0])},
            'getRequest': summary(c.frame('getRequest(uint256)', [U], returning(0))),
            # acknowledge reads the Router position (11 static words) before it completes the request.
            'acknowledge': summary(c.frame('acknowledge(uint256)', [U], returning(11)))}


def router(build):
    c = Contract(build, 'SettlementRouter')
    return {'getPosition': summary(c.frame('getPosition(uint256)', [U], returning(0))),
            'settlePosition': {n: summary(c.frame(f'settlePosition({AWARDS})', [U] * 5 + [0xc0, n] + [U] * (6 * n),
                                                  returning(0))) for n in range(MAX_AWARDS + 1)}}


def token_calls(contract, frame):
    """Token calls on one successful path of the frame: the most of each kind, the most transfers of either kind, and
    the most balanceOf calls on a path that makes a transfer or a transferFrom. A call to an unknown address counts as
    a token call when its input length matches."""
    def kind(st):
        op = contract.ops[st[0]][0]
        if op not in (CALL, STATICCALL):
            return None
        s = st[1]
        return TOKEN_CALLS.get(s[-5] if op == CALL else s[-4]) if s[-2] in (ASSET, U) else None
    most = lambda f: frame.count(lambda st: f(kind(st)))
    out = {k: most(lambda x, k=k: int(x == k)) for k in TOKEN_CALLS.values()}
    out['transfersOfEitherKind'] = most(lambda x: int(x in ('transfer', 'transferFrom')))
    assert out['transfersOfEitherKind'] <= 1, out
    for k in ('transfer', 'transferFrom'):
        best = most(lambda x, k=k: 1000 * (x == k) + (x == 'balanceOf'))
        out[f'balanceOfWith_{k}'] = best - 1000 if best >= 1000 else None
    return out


def asset_offsets(contract, domain):
    """The asset immutable's offsets as the callback domain file names them, which must be immutables of this build."""
    pinned = domain['coreRuntimes'][contract.name]['immutables']
    assert sorted(o for e in pinned for o in e['offsets']) == sorted(o for v in contract.refs.values() for o in v)
    return {o for e in pinned if e['value'] == 'poolAsset' for o in e['offsets']}


def vault(build, domain):
    c = Contract(build, 'LiquidityVault')
    sig = 'applySettlement(uint48,uint128,uint128,uint128)'
    k_positive = c.frame(sig, [U, 1, U, U], returning(1), opaque=True)
    marked = c.frame(sig, [U, 1, U, U], returning(1), marked=asset_offsets(c, domain), opaque=True)
    return {'opaqueTreeFunctions': sorted(TREE & {v[0] for v in c.fdd.values()}),
            'applySettlement_kUnknown': summary(c.frame(sig, [U, U, U, U], returning(1), opaque=True)),
            'applySettlement_kPositive': summary(k_positive),
            'applySettlementTokenCalls': token_calls(c, marked),
            # The getters Bank._requireAccounting calls after settlement (certificate v3 review M-1).
            'getReserve': summary(c.frame('getReserve()', [], returning(0))),
            'lockedLiquidity': summary(c.frame('lockedLiquidity()', [], returning(0))),
            'MAX_TREE_CAPITAL': summary(c.frame('MAX_TREE_CAPITAL()', [], returning(0)))}


def bank(build, domain):
    c = Contract(build, 'Bank')
    words = lambda n: [U] * 5 + [0xc0, n] + [U] * (6 * n)
    # Every call settleBet makes returns one word: Vault.applySettlement (uint128), the Vault getters, the token's
    # balanceOf and transfer. The transfer's word is unknown, so both trySafeTransfer outcomes are explored.
    marked = c.frame(f'settleBet({AWARDS})', words(MAX_AWARDS), returning(1), marked=asset_offsets(c, domain))
    return {'settleBet': {n: summary(c.frame(f'settleBet({AWARDS})', words(n), returning(1)))
                          for n in range(MAX_AWARDS + 1)},
            'settleBetTokenCalls': token_calls(c, marked),
            # The two getters GameHub reads before the Router call (charged in the child's pre-call work).
            'minPlayerTurnoverForUnlock': summary(c.frame('minPlayerTurnoverForUnlock()', [], returning(0))),
            'playerTurnover': summary(c.frame('playerTurnover(address)', [U], returning(0)))}


def engine(build):
    c = Contract(build, 'DefaultReferralEngine')
    sig = 'allocate((uint256,uint16,address,address,address,uint16,uint16,uint16,uint16,uint256,uint256))'
    return {'allocate': summary(c.frame(sig, [U] * 11, returning(0)))}


def gamehub_child_anchors(c):
    """The six calls of GameHub._finalize in program order and the SLOAD of the bet's params length word."""
    lo, hi = c.extent('fun_finalize')
    seq = sorted(p for p in c.ops if lo <= p < hi)
    calls = [p for p in seq if c.ops[p][0] in (CALL, STATICCALL)]
    assert [c.ops[p][0] for p in calls] == [STATICCALL] * 4 + [CALL] * 2, [hex(c.ops[p][0]) for p in calls]
    length = next(e for e, (n, _, _) in c.fdd.items() if n == 'extract_byte_array_length')
    # The length word is loaded right before the call to extract_byte_array_length (PUSH2 <entry> ... JUMP).
    params = [p for i, p in enumerate(seq) if c.ops[p][0] == SLOAD
              and any(c.ops[q][0] == 0x61 and c.ops[q][1] == length for q in seq[i + 1:i + 8])]
    assert len(params) == 1, params
    names = ['module.resolve', 'Bank.minPlayerTurnoverForUnlock', 'Bank.playerTurnover', 'engine.allocate',
             'Router.settlePosition', 'VRFHub.acknowledge']
    return dict(zip(names, calls)), params[0]


def gamehub_child_returns(awards):
    return {'module.resolve': [U, U],                                     # (payoutGross, refundAmount)
            'Bank.minPlayerTurnoverForUnlock': [U], 'Bank.playerTurnover': [U],
            # (Allocation: six words, offset 0xe0, awards length, six words per XPAward), canonical solc encoding
            'engine.allocate': [U] * 6 + [0xe0, awards] + [U] * (6 * awards),
            'Router.settlePosition': [], 'VRFHub.acknowledge': []}


def gamehub_child(c, calls, params_sload, awards, params_length):
    returns = {calls[k]: v for k, v in gamehub_child_returns(awards).items()}
    # A params value of 32..64 bytes is stored long: the slot holds 2 * length + 1 and the data lives elsewhere.
    return c.frame('finalizeFromCallback(uint256,uint256)', [U, U], returns,
                   sloads={params_sload: 2 * params_length + 1})


def gamehub(build):
    c = Contract(build, 'GameHub')
    calls, params_sload = gamehub_child_anchors(c)
    rows = {}
    for awards in range(MAX_AWARDS + 1):
        for length in PARAMS_LENGTHS:
            frame = gamehub_child(c, calls, params_sload, awards, length)
            rows[(awards, length)] = (frame.total(), len(frame.best))
    worst = max(rows, key=lambda k: (rows[k][0], k))
    child = {'calls': calls, 'paramsLengthSload': params_sload,
             'total': rows[worst][0], 'worstAwards': worst[0], 'worstParamsLength': worst[1],
             'byAwards': {a: max(rows[(a, n)][0] for n in PARAMS_LENGTHS) for a in range(MAX_AWARDS + 1)},
             'byParamsLength': {n: max(rows[(a, n)][0] for a in range(MAX_AWARDS + 1)) for n in PARAMS_LENGTHS},
             'environments': len(rows), 'maxStates': max(s for _, s in rows.values())}

    # Outer frame: getRequest (eight static RequestInfo words) and the only-self child call, whose body is the
    # child component above; the call succeeds on the certified path.
    def outer_calls(pc, op):
        return [U] * 8 if op == STATICCALL else [] if op == CALL else None
    outer = c.frame('onRandomWords(uint256,uint256[])', [U, 0x40, 1, U], outer_calls)
    reached = outer.step.reached
    statics = [pc for pc in reached if c.ops[pc][0] == STATICCALL]
    selfcall = [pc for pc in reached if c.ops[pc][0] == CALL]
    assert len(statics) == 1 and len(selfcall) == 1, (statics, selfcall)
    call = selfcall[0]
    # The gas snapshot the child's gas is computed from is the last GAS before the call on every path.
    gas_pcs = sorted({k[0] for k in outer.best if c.ops[k[0]][0] == GAS})
    snap = [pc for pc in gas_pcs if outer.between(pc, call, barrier=set(gas_pcs) - {pc}) is not None]
    assert len(snap) == 1, snap
    out = {'getRequestCallPc': statics[0], 'selfCallPc': call, 'gasSnapshotPc': snap[0],
           'total': outer.total(), 'states': len(outer.best),
           'snapshotToCall': outer.between(snap[0], call), 'fromCall': outer.from_pc(call)}
    return {'finalizeFromCallback': child, 'onRandomWords': out}


def main():
    build, domain, target = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()), Path(sys.argv[3])
    out = {}
    for name, fn in (('VRFHub', lambda: vrfhub(build)), ('SettlementRouter', lambda: router(build)),
                     ('LiquidityVault', lambda: vault(build, domain)), ('Bank', lambda: bank(build, domain)),
                     ('DefaultReferralEngine', lambda: engine(build)), ('GameHub', lambda: gamehub(build))):
        out[name] = fn()
        print(name, json.dumps(out[name], default=str)[:400], flush=True)
    target.write_text(json.dumps(out, indent=2, default=str) + '\n')


if __name__ == '__main__':
    main()
