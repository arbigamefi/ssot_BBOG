#!/usr/bin/env python3
"""Exact-bytecode max-gas bound for a pinned game module's `resolve` (callee frame only).

Symbolic execution of the deployed runtime under the canonical 388-byte calldata GameHub sends:
resolve(bytes params[64], (amountPerRoll, betCount, stopGain, stopLoss), betId, uint256[] words[1]).
Unknown values (params words, amounts, stop limits, betId, random word) fork every dependent JUMPI;
reverting paths are dropped; states at the same pc with identical stack/memory/msize are merged keeping
the larger gas. Loop counters stay concrete, so bounded loops unroll exactly. The result is the maximum
over every successful path the bytecode admits for that betCount, which is an upper bound for the
admitted domain (infeasible combinations of unknown values only make it larger).

Memory: concrete word addresses are tracked; a store through an unknown address havocs every tracked
word at or above 0x80 but cannot move the free-memory pointer or grow memory. Solidity bounds-checks
memory array indices before such stores, so they stay inside already allocated memory.
Gas: Cancun static costs, exact memory expansion, KECCAK256 and copy word costs, EXP by exponent
length (32 bytes when unknown). Excludes the caller's STATICCALL, calldata encoding and return copy.
"""
import json, sys, hashlib
from pathlib import Path

B = Path(__file__).resolve().parent
U = 'U'
MASK = (1 << 256) - 1
SELECTOR = None
# M1 evidence: every MLOAD/MSTORE/MSTORE8 whose address is unknown is recorded as (pc, opcode).
UNKNOWN_MEM = []
# Shared opcode tables (also used by concrete_oracle.py, so the gas-for-gas check exercises the same prices).
ARITY = {0x01: 2, 0x02: 2, 0x03: 2, 0x04: 2, 0x05: 2, 0x06: 2, 0x07: 2, 0x08: 3, 0x09: 3, 0x0b: 2,
         0x10: 2, 0x11: 2, 0x12: 2, 0x13: 2, 0x14: 2, 0x15: 1, 0x16: 2, 0x17: 2, 0x18: 2, 0x19: 1,
         0x1a: 2, 0x1b: 2, 0x1c: 2, 0x1d: 2}
COST = {0x01: 3, 0x02: 5, 0x03: 3, 0x04: 5, 0x05: 5, 0x06: 5, 0x07: 5, 0x08: 8, 0x09: 8, 0x0b: 5,
        0x10: 3, 0x11: 3, 0x12: 3, 0x13: 3, 0x14: 3, 0x15: 3, 0x16: 3, 0x17: 3, 0x18: 3, 0x19: 3,
        0x1a: 3, 0x1b: 3, 0x1c: 3, 0x1d: 3}

def load(name):
    o = json.loads((B/'modules-solc-output.json').read_text())
    for path, cs in o['contracts'].items():
        if name in cs:
            c = cs[name]
            code = bytes.fromhex(c['evm']['deployedBytecode']['object'])
            sel = c['evm']['methodIdentifiers']['resolve(bytes,(uint256,uint32,uint256,uint256),uint256,uint256[])']
            return code, int(sel, 16)
    raise KeyError(name)

def decode(code):
    ops = {}; pc = 0; n = len(code)
    # Stop before the CBOR metadata; it is never executed.
    meta = int.from_bytes(code[-2:], 'big') + 2
    end = n - meta
    while pc < end:
        op = code[pc]
        if 0x60 <= op <= 0x7f:
            k = op - 0x5f
            ops[pc] = (op, int.from_bytes(code[pc+1:pc+1+k], 'big'), pc + 1 + k)
            pc += 1 + k
        else:
            ops[pc] = (op, None, pc + 1)
            pc += 1
    jumpdests = {p for p, (o, _, _) in ops.items() if o == 0x5b}
    return ops, jumpdests

def mem_cost(words):
    return 3*words + words*words // 512

def calldata(selector, bet_count, params=(U, U), params_len=64):
    # Head: params offset, 4 StakeSpec words, betId, words offset; tails: params (length word + its data words),
    # words (length 1 + one word). GameHub admits params of 1..64 bytes and ABI-encodes them padded to whole words;
    # a one-word module decodes 32..64 bytes, a two-word module exactly 64. Data words beyond the given params
    # words are unknown (their trailing padding bytes are zero, which only makes the real value more constrained).
    assert 1 <= params_len <= 64
    data_words = (params_len + 31) // 32
    W = {}
    def put(off, v): W[off] = v
    put(0, ('sel', selector))
    base = 4
    put(base + 0*32, 7*32)                        # params offset (0xe0)
    put(base + 1*32, U)                           # amountPerRoll
    put(base + 2*32, bet_count)                   # betCount (uint32, concrete)
    put(base + 3*32, U)                           # stopGain
    put(base + 4*32, U)                           # stopLoss
    put(base + 5*32, U)                           # betId
    put(base + 6*32, 7*32 + 32 + 32*data_words)   # words offset
    put(base + 7*32, params_len)                  # params length
    for k in range(data_words):
        put(base + (8 + k)*32, params[k] if k < len(params) else U)
    put(base + (8 + data_words)*32, 1)            # words length
    put(base + (9 + data_words)*32, U)            # random word
    return W, 4 + (10 + data_words)*32

def cd_load(W, size, off):
    if off == U:
        return U
    if off >= size:
        return 0
    if off == 0:
        sel = W[0][1]
        word1 = W.get(4)
        if word1 == U:
            return U
        return ((sel << 224) | ((word1 or 0) >> 32)) & MASK
    if (off - 4) % 32 == 0 and off in W:
        return W[off]
    # Unaligned or partially covered read of known/unknown words: unknown unless every byte is known zero.
    return U

def to_signed(x):
    return x - (1 << 256) if x >> 255 else x

def make_step(code, selector, bet_count, params=(U, U), params_len=64):
    ops, jumpdests = decode(code)
    W, size = calldata(selector, bet_count, params, params_len)

    def step(state):
        pc, st, mem, hv, msz = state
        out = []
        s = list(st); m = dict(mem)
        if pc not in ops:
            raise RuntimeError(f'pc {pc} outside code')
        op, arg, nxt = ops[pc]

        def pop():
            if not s:
                raise RuntimeError(f'stack underflow pc={pc}')
            return s.pop()

        def expand(offset, length, cur):
            if length == 0:
                return cur, 0
            if offset == U or length == U:
                raise RuntimeError(f'unknown memory extent pc={pc} op={hex(op)}')
            words = (offset + length + 31) // 32
            if words > cur:
                return words, mem_cost(words) - mem_cost(cur)
            return cur, 0

        g = 0
        if 0x60 <= op <= 0x7f:
            s.append(arg); g = 3
        elif op == 0x5f:
            s.append(0); g = 2
        elif 0x80 <= op <= 0x8f:
            s.append(s[-(op - 0x7f)]); g = 3
        elif 0x90 <= op <= 0x9f:
            j = op - 0x8f; s[-1], s[-1-j] = s[-1-j], s[-1]; g = 3
        elif op == 0x50:
            pop(); g = 2
        elif op == 0x5b:
            g = 1
        elif op == 0x56:  # JUMP
            d = pop(); g = 8
            if d == U or d not in jumpdests:
                raise RuntimeError(f'unresolved/invalid jump pc={pc} dest={d}')
            out.append(('n', (d, tuple(s), tuple(sorted(m.items())), hv, msz), g)); return out
        elif op == 0x57:  # JUMPI
            d = pop(); c = pop(); g = 10
            if d == U or d not in jumpdests:
                raise RuntimeError(f'unresolved/invalid jumpi pc={pc} dest={d}')
            nm = tuple(sorted(m.items()))
            if c == U or c != 0:
                out.append(('n', (d, tuple(s), nm, hv, msz), g))
            if c == U or c == 0:
                out.append(('n', (nxt, tuple(s), nm, hv, msz), g))
            return out
        elif op in (0x00, 0xf3):  # STOP / RETURN
            if op == 0xf3:
                off = pop(); ln = pop(); msz2, eg = expand(off, ln, msz); msz = msz2; g = eg
            out.append(('ok', msz, g)); return out
        elif op in (0xfd, 0xfe):  # REVERT / INVALID
            out.append(('revert', None, 0)); return out
        elif op == 0x35:  # CALLDATALOAD
            off = pop(); s.append(cd_load(W, size, off)); g = 3
        elif op == 0x36:
            s.append(size); g = 2
        elif op == 0x34:
            s.append(0); g = 2
        elif op == 0x3d:
            s.append(0); g = 2
        elif op in (0x30, 0x32, 0x33, 0x3a, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x48, 0x5a, 0x4a):
            s.append(U); g = 2
        elif op == 0x38:
            s.append(len(code)); g = 2
        elif op == 0x59:  # MSIZE
            s.append(msz * 32); g = 2
        elif op == 0x51:  # MLOAD
            off = pop(); g = 3
            if off == U:
                UNKNOWN_MEM.append((pc, op))
                s.append(U)
            else:
                msz, eg = expand(off, 32, msz); g += eg
                if off % 32:
                    s.append(U)
                elif off in m:
                    s.append(m[off])
                elif hv and off >= 0x80:
                    s.append(U)
                else:
                    s.append(0)
        elif op in (0x52, 0x53):  # MSTORE / MSTORE8
            off = pop(); val = pop(); g = 3
            if off == U:
                UNKNOWN_MEM.append((pc, op))
                hv = True
                m = {k: v for k, v in m.items() if k < 0x80}
            else:
                ln = 32 if op == 0x52 else 1
                msz, eg = expand(off, ln, msz); g += eg
                if op == 0x52 and off % 32 == 0:
                    m[off] = val
                else:
                    base = off - off % 32
                    m[base] = U
                    if op == 0x52 and off % 32:
                        m[base + 32] = U
        elif op in (0x37, 0x39, 0x5e):  # CALLDATACOPY / CODECOPY / MCOPY
            dst = pop(); src = pop(); ln = pop()
            if ln == U:
                raise RuntimeError(f'unknown copy length pc={pc}')
            msz, eg = expand(dst, ln, msz)
            if op == 0x5e:
                msz, eg2 = expand(src, ln, msz); eg += eg2
            g = 3 + 3*((ln + 31)//32) + eg
            if dst == U:
                hv = True; m = {k: v for k, v in m.items() if k < 0x80}
            else:
                for a in range(dst - dst % 32, dst + ln, 32):
                    m[a] = U
                if op == 0x37 and dst % 32 == 0 and src != U and ln % 32 == 0:
                    for k in range(ln // 32):
                        m[dst + 32*k] = cd_load(W, size, src + 32*k)
        elif op == 0x20:  # KECCAK256
            off = pop(); ln = pop()
            if ln == U:
                raise RuntimeError(f'unknown hash length pc={pc}')
            msz, eg = expand(off, ln, msz)
            g = 30 + 6*((ln + 31)//32) + eg; s.append(U)
        elif op == 0x0a:  # EXP
            a = pop(); e = pop()
            nbytes = 32 if e == U else (e.bit_length() + 7)//8
            g = 10 + 50*nbytes
            s.append(U if U in (a, e) else pow(a, e, 1 << 256))
        else:
            arity, cost = ARITY, COST
            if op not in arity:
                raise RuntimeError(f'unsupported opcode {hex(op)} at pc={pc}')
            a = [pop() for _ in range(arity[op])]; g = cost[op]
            if U in a:
                r = U
                # Exact zero results that do not depend on unknowns.
                if op == 0x02 and 0 in a: r = 0
                if op == 0x16 and 0 in a: r = 0
                if op in (0x1b, 0x1c) and a[0] != U and a[0] >= 256: r = 0
                s.append(r)
            else:
                x, y = a[0], a[1] if len(a) > 1 else None
                if op == 0x01: r = (x + y) & MASK
                elif op == 0x02: r = (x * y) & MASK
                elif op == 0x03: r = (x - y) & MASK
                elif op == 0x04: r = 0 if y == 0 else x // y
                elif op == 0x05:
                    sx, sy = to_signed(x), to_signed(y)
                    r = 0 if sy == 0 else (abs(sx)//abs(sy) * (1 if (sx < 0) == (sy < 0) else -1)) & MASK
                elif op == 0x06: r = 0 if y == 0 else x % y
                elif op == 0x07:
                    sx, sy = to_signed(x), to_signed(y)
                    r = 0 if sy == 0 else ((abs(sx) % abs(sy)) * (1 if sx >= 0 else -1)) & MASK
                elif op == 0x08: r = 0 if a[2] == 0 else (x + y) % a[2]
                elif op == 0x09: r = 0 if a[2] == 0 else (x * y) % a[2]
                elif op == 0x0b:
                    if x >= 31: r = y
                    else:
                        bit = 8*x + 7; mask = (1 << (bit + 1)) - 1
                        r = (y | (MASK ^ mask)) if (y >> bit) & 1 else (y & mask)
                elif op == 0x10: r = int(x < y)
                elif op == 0x11: r = int(x > y)
                elif op == 0x12: r = int(to_signed(x) < to_signed(y))
                elif op == 0x13: r = int(to_signed(x) > to_signed(y))
                elif op == 0x14: r = int(x == y)
                elif op == 0x15: r = int(x == 0)
                elif op == 0x16: r = x & y
                elif op == 0x17: r = x | y
                elif op == 0x18: r = x ^ y
                elif op == 0x19: r = MASK ^ x
                elif op == 0x1a: r = 0 if x >= 32 else (y >> (8*(31 - x))) & 0xff
                elif op == 0x1b: r = 0 if x >= 256 else (y << x) & MASK
                elif op == 0x1c: r = 0 if x >= 256 else y >> x
                elif op == 0x1d: r = (to_signed(y) >> min(x, 256)) & MASK
                s.append(r)
        out.append(('n', (nxt, tuple(s), tuple(sorted(m.items())), hv, msz), g))
        return out
    return step


SMALL = 1 << 32

def sig(stack):
    # Small concrete words (loop counters, return addresses, offsets) stay in the key; others are joinable.
    return tuple(v if (v != U and v < SMALL) else '*' for v in stack)

def key_of(state):
    pc, st, mem, hv, msz = state
    return (pc, sig(st), hv)

def join(a, b):
    pc, st1, m1, hv, z1 = a; _, st2, m2, _, z2 = b
    st = tuple(x if x == y else U for x, y in zip(st1, st2))
    d1, d2 = dict(m1), dict(m2)
    jm = {k: (d1.get(k) if d1.get(k) == d2.get(k) else U) for k in set(d1) | set(d2)}
    # Free-memory pointer: keep the larger concrete value. Later allocations then start no lower and the
    # smaller msize over-charges expansion, so costs stay an upper bound; Solidity never branches on it.
    f1, f2 = d1.get(0x40, 0), d2.get(0x40, 0)
    if f1 != U and f2 != U:
        jm[0x40] = max(f1, f2)
    # msize joins by max; phase 2 pre-pays every incoming edge's expansion up to it (C is a function of the
    # final size, so pre-paying is exact in total and never under-charges).
    return (pc, st, tuple(sorted(jm.items())), hv, max(z1, z2))

def run(code, selector, bet_count, state_limit=2_000_000, params=(U, U), params_len=64):
    """Phase 1: abstract fixpoint without gas. Phase 2: longest path over the final state graph."""
    step = make_step(code, selector, bet_count, params, params_len)
    start = (0, (), (), False, 0)
    best = {key_of(start): start}
    work = [key_of(start)]
    while work:
        k = work.pop()
        for kind, nxt, _ in step(best[k]):
            if kind != 'n':
                continue
            nk = key_of(nxt)
            if nk in best:
                j = join(best[nk], nxt)
                if j == best[nk]:
                    continue
                best[nk] = j
            else:
                best[nk] = nxt
                if len(best) > state_limit:
                    raise RuntimeError('abstract state limit')
            work.append(nk)
    # Phase 2: edges from the final abstract states; every successor is subsumed by its key's final state.
    edges = {}; terminal = {}; reverts = 0
    for k, stt in best.items():
        lst = []
        for kind, nxt, g in step(stt):
            if kind == 'n':
                nk = key_of(nxt)
                prepay = max(0, mem_cost(best[nk][4]) - mem_cost(nxt[4]))
                lst.append((nk, g + prepay))
            elif kind == 'ok':
                terminal[k] = max(terminal.get(k, -1), g); 
            else:
                reverts += 1
        edges[k] = lst
    sys.setrecursionlimit(1_000_000)
    memo = {}; onstack = set(); order = []
    # Iterative DFS post-order for longest path to any successful terminal.
    NEG = float('-inf')
    stack = [(key_of(start), 0)]
    while stack:
        k, i = stack.pop()
        if i == 0:
            if k in memo:
                continue
            if k in onstack:
                raise RuntimeError('cycle in abstract state graph (unbounded loop)')
            onstack.add(k)
        succ = edges.get(k, [])
        if i < len(succ):
            stack.append((k, i + 1))
            nk = succ[i][0]
            if nk not in memo:
                if nk in onstack:
                    raise RuntimeError('cycle in abstract state graph (unbounded loop)')
                stack.append((nk, 0))
            continue
        val = terminal.get(k, NEG)
        for nk, g in succ:
            if memo[nk] != NEG:
                val = max(val, memo[nk] + g)
        memo[k] = val
        onstack.discard(k)
    maxwords = max((best[k][4] for k in terminal), default=0)
    return {'maxSuccessGas': memo[key_of(start)], 'abstractStates': len(best), 'revertEdges': reverts,
            'successTerminalStates': len(terminal), 'maxTerminalMemoryWordsLowerOfJoined': maxwords}

def params_domain(name):
    """Concrete params only where a loop bound depends on them; elsewhere unknown words cover every value."""
    if name == 'RouletteModule':
        # (uint8 kind, uint40 payload): Dozen(6) and Column(7) loop from payload in 1..3; other kinds keep
        # payload unknown (pure arithmetic) or ignore it. kind >= 14 reverts in the enum conversion.
        return [(k, U) for k in range(14) if k not in (6, 7)] + [(k, v) for k in (6, 7) for v in (1, 2, 3)]
    return [(U, U)]

TWO_WORD = {'DiceModule', 'RouletteModule', 'SicBoModule'}

def params_lengths(name):
    """M3: admitted params length classes. abi.decode of two words needs exactly 64 bytes (the maximum GameHub
    accepts); one word decodes from 32..64 bytes, whose copy and padding costs differ only between 32 and 33..64."""
    return [64] if name in TWO_WORD else [32, 33, 64]

def main():
    args = sys.argv[1:]
    counts = [25]
    if args and args[0].startswith('--counts='):
        counts = [int(x) for x in args[0].split('=', 1)[1].split(',')]
        args = args[1:]
    names = args or ['CoinTossModule', 'DiceModule', 'SlotsModule', 'RouletteModule', 'PlinkoModule',
                     'SicBoModule', 'BaccaratModule', 'KenoModule']
    out = {}
    for name in names:
        code, sel = load(name)
        rows = {}
        for n in counts:
            per = []
            for prm in params_domain(name):
                for plen in params_lengths(name):
                    r = run(code, sel, n, params=prm, params_len=plen)
                    per.append({'params': [None if v == U else v for v in prm], 'paramsLength': plen, **r})
            worst = max(per, key=lambda r: r['maxSuccessGas'])
            rows[n] = {'maxSuccessGas': worst['maxSuccessGas'], 'worstParams': worst['params'],
                       'worstParamsLength': worst['paramsLength'], 'paramsCases': len(per),
                       'byParamsLength': {str(l): max(r['maxSuccessGas'] for r in per if r['paramsLength'] == l)
                                          for l in params_lengths(name)},
                       'abstractStates': sum(r['abstractStates'] for r in per)}
            print(name, n, rows[n], flush=True)
        out[name] = {'runtimeSha256': hashlib.sha256(code).hexdigest(), 'byBetCount': rows}
    tag = '-'.join(str(c) for c in counts) if len(counts) < 4 else f'{counts[0]}to{counts[-1]}'
    (B/('module-bounds-' + tag + '-' + '-'.join(n.replace('Module', '') for n in names) + '.json')).write_text(
        json.dumps(out, indent=2) + '\n')

if __name__ == '__main__':
    main()
