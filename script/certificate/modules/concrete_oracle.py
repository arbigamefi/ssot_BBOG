#!/usr/bin/env python3
"""M6: gas-for-gas oracle. Executes a pinned module's `resolve` on FULLY CONCRETE inputs with a byte-accurate
concrete interpreter that shares the opcode price tables (ARITY/COST), the memory-expansion formula and the
copy/hash pricing with pure_module_bound.py. On concrete inputs there is exactly one path, so the result must equal
the callee frame's gas as Foundry measures it (vm.lastCallGas().gasTotalUsed). Agreement on random and adversarial
inputs checks the price tables and the calldata model behind the abstract bound.

Usage: concrete_oracle.py gen <cases.json> [seed]   -> writes cases with expected gas
       concrete_oracle.py run <cases.json>          -> re-evaluates and prints
"""
import json, random, sys, hashlib
from pathlib import Path
import pure_module_bound as P

MASK = P.MASK
B = P.B

# ---- Keccak-256 (pure Python; checked against the canonical empty-string digest) ----------------------------
_RC = [0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000, 0x000000000000808B,
       0x0000000080000001, 0x8000000080008081, 0x8000000000008009, 0x000000000000008A, 0x0000000000000088,
       0x0000000080008009, 0x000000008000000A, 0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
       0x8000000000008003, 0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
       0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008]
_ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]
M64 = (1 << 64) - 1

def _rol(x, n):
    n %= 64
    return ((x << n) | (x >> (64 - n))) & M64 if n else x

def _keccak_f(a):
    for rc in _RC:
        c = [a[x][0] ^ a[x][1] ^ a[x][2] ^ a[x][3] ^ a[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        a = [[a[x][y] ^ d[x] for y in range(5)] for x in range(5)]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rol(a[x][y], _ROT[x][y])
        a = [[b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y]) for y in range(5)] for x in range(5)]
        a[0][0] ^= rc
    return a

def keccak256(data: bytes) -> int:
    rate = 136
    msg = bytearray(data) + b'\x01'
    msg += b'\x00' * ((-len(msg)) % rate)
    msg[-1] |= 0x80
    a = [[0] * 5 for _ in range(5)]
    for off in range(0, len(msg), rate):
        for i in range(rate // 8):
            x, y = i % 5, i // 5
            a[x][y] ^= int.from_bytes(msg[off + 8 * i: off + 8 * i + 8], 'little')
        a = _keccak_f(a)
    out = b''.join(a[i % 5][i // 5].to_bytes(8, 'little') for i in range(4))
    return int.from_bytes(out, 'big')

assert keccak256(b'') == 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
assert keccak256(b'abc') == 0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45

# ---- Concrete executor --------------------------------------------------------------------------------------
def encode_calldata(selector, params: bytes, amount, bet_count, stop_gain, stop_loss, bet_id, word):
    """resolve(bytes,(uint256,uint32,uint256,uint256),uint256,uint256[]) with one random word, as GameHub encodes it."""
    w = lambda v: int(v).to_bytes(32, 'big')
    padded = params + b'\x00' * ((-len(params)) % 32)
    head = w(7 * 32) + w(amount) + w(bet_count) + w(stop_gain) + w(stop_loss) + w(bet_id) + w(7 * 32 + 32 + len(padded))
    tail = w(len(params)) + padded + w(1) + w(word)
    return selector.to_bytes(4, 'big') + head + tail

class Revert(Exception):
    pass

def execute(code, cd: bytes):
    """Returns (gas, return_data). Raises Revert on REVERT/INVALID. Straight-line: every JUMPI condition is concrete."""
    ops, jumpdests = P.decode(code)
    mem = bytearray()
    st = []
    gas = 0
    pc = 0

    def expand(offset, length):
        nonlocal gas
        if length == 0:
            return
        words = (offset + length + 31) // 32
        cur = len(mem) // 32
        if words > cur:
            gas += P.mem_cost(words) - P.mem_cost(cur)
            mem.extend(b'\x00' * (32 * (words - cur)))

    def rd(off, n):
        if off + n > len(cd):
            return bytes(cd[off:]) + b'\x00' * (off + n - len(cd))
        return bytes(cd[off:off + n])

    steps = 0
    while True:
        steps += 1
        if steps > 50_000_000:
            raise RuntimeError('step limit')
        if pc not in ops:
            raise RuntimeError(f'pc {pc} outside code')
        op, arg, nxt = ops[pc]
        if 0x60 <= op <= 0x7f:
            st.append(arg); gas += 3; pc = nxt; continue
        if op == 0x5f:
            st.append(0); gas += 2; pc = nxt; continue
        if 0x80 <= op <= 0x8f:
            st.append(st[-(op - 0x7f)]); gas += 3; pc = nxt; continue
        if 0x90 <= op <= 0x9f:
            j = op - 0x8f; st[-1], st[-1 - j] = st[-1 - j], st[-1]; gas += 3; pc = nxt; continue
        if op == 0x50:
            st.pop(); gas += 2; pc = nxt; continue
        if op == 0x5b:
            gas += 1; pc = nxt; continue
        if op == 0x56:
            d = st.pop(); gas += 8
            if d not in jumpdests:
                raise RuntimeError(f'invalid jump {d} at {pc}')
            pc = d; continue
        if op == 0x57:
            d = st.pop(); c = st.pop(); gas += 10
            if c != 0:
                if d not in jumpdests:
                    raise RuntimeError(f'invalid jumpi {d} at {pc}')
                pc = d
            else:
                pc = nxt
            continue
        if op == 0x00:
            return gas, b''
        if op == 0xf3:
            off = st.pop(); ln = st.pop(); expand(off, ln)
            return gas, bytes(mem[off:off + ln])
        if op in (0xfd, 0xfe):
            raise Revert()
        if op == 0x35:
            off = st.pop(); st.append(int.from_bytes(rd(off, 32), 'big')); gas += 3; pc = nxt; continue
        if op == 0x36:
            st.append(len(cd)); gas += 2; pc = nxt; continue
        if op in (0x34, 0x3d):
            st.append(0); gas += 2; pc = nxt; continue
        if op == 0x38:
            st.append(len(code)); gas += 2; pc = nxt; continue
        if op == 0x59:
            st.append(len(mem)); gas += 2; pc = nxt; continue
        if op == 0x51:
            off = st.pop(); gas += 3; expand(off, 32)
            st.append(int.from_bytes(mem[off:off + 32], 'big')); pc = nxt; continue
        if op == 0x52:
            off = st.pop(); val = st.pop(); gas += 3; expand(off, 32)
            mem[off:off + 32] = (val & MASK).to_bytes(32, 'big'); pc = nxt; continue
        if op == 0x53:
            off = st.pop(); val = st.pop(); gas += 3; expand(off, 1)
            mem[off] = val & 0xff; pc = nxt; continue
        if op in (0x37, 0x39, 0x5e):
            dst = st.pop(); src = st.pop(); ln = st.pop()
            gas += 3 + 3 * ((ln + 31) // 32)
            expand(dst, ln)
            if op == 0x37:
                data = rd(src, ln)
            elif op == 0x39:
                data = code[src:src + ln] + b'\x00' * max(0, src + ln - len(code))
            else:
                expand(src, ln); data = bytes(mem[src:src + ln])
            if ln:
                mem[dst:dst + ln] = data
            pc = nxt; continue
        if op == 0x20:
            off = st.pop(); ln = st.pop(); expand(off, ln)
            gas += 30 + 6 * ((ln + 31) // 32)
            st.append(keccak256(bytes(mem[off:off + ln]))); pc = nxt; continue
        if op == 0x0a:
            a = st.pop(); e = st.pop(); gas += 10 + 50 * ((e.bit_length() + 7) // 8)
            st.append(pow(a, e, 1 << 256)); pc = nxt; continue
        if op in P.ARITY:
            a = [st.pop() for _ in range(P.ARITY[op])]; gas += P.COST[op]
            x, y = a[0], a[1] if len(a) > 1 else None
            ts = P.to_signed
            if op == 0x01: r = (x + y) & MASK
            elif op == 0x02: r = (x * y) & MASK
            elif op == 0x03: r = (x - y) & MASK
            elif op == 0x04: r = 0 if y == 0 else x // y
            elif op == 0x05:
                sx, sy = ts(x), ts(y)
                r = 0 if sy == 0 else (abs(sx) // abs(sy) * (1 if (sx < 0) == (sy < 0) else -1)) & MASK
            elif op == 0x06: r = 0 if y == 0 else x % y
            elif op == 0x07:
                sx, sy = ts(x), ts(y)
                r = 0 if sy == 0 else ((abs(sx) % abs(sy)) * (1 if sx >= 0 else -1)) & MASK
            elif op == 0x08: r = 0 if a[2] == 0 else (x + y) % a[2]
            elif op == 0x09: r = 0 if a[2] == 0 else (x * y) % a[2]
            elif op == 0x0b:
                if x >= 31: r = y
                else:
                    bit = 8 * x + 7; mask = (1 << (bit + 1)) - 1
                    r = (y | (MASK ^ mask)) if (y >> bit) & 1 else (y & mask)
            elif op == 0x10: r = int(x < y)
            elif op == 0x11: r = int(x > y)
            elif op == 0x12: r = int(ts(x) < ts(y))
            elif op == 0x13: r = int(ts(x) > ts(y))
            elif op == 0x14: r = int(x == y)
            elif op == 0x15: r = int(x == 0)
            elif op == 0x16: r = x & y
            elif op == 0x17: r = x | y
            elif op == 0x18: r = x ^ y
            elif op == 0x19: r = MASK ^ x
            elif op == 0x1a: r = 0 if x >= 32 else (y >> (8 * (31 - x))) & 0xff
            elif op == 0x1b: r = 0 if x >= 256 else (y << x) & MASK
            elif op == 0x1c: r = 0 if x >= 256 else y >> x
            elif op == 0x1d: r = (ts(y) >> min(x, 256)) & MASK
            st.append(r); pc = nxt; continue
        raise RuntimeError(f'unsupported opcode {hex(op)} at {pc}')

# ---- Case generation ------------------------------------------------------------------------------------------
MODULES = ['DiceModule', 'CoinTossModule', 'RouletteModule', 'KenoModule', 'PlinkoModule', 'SicBoModule',
           'SlotsModule', 'BaccaratModule']
W = lambda v: int(v).to_bytes(32, 'big')

def params_for(name, rng):
    """Admitted parameter values (canonical 64-byte encodings; one-word modules carry a nonzero tail word)."""
    tail = W(0xDEAD)
    if name == 'DiceModule':
        return W(rng.randint(0, 1)) + W(rng.randint(1, 99))
    if name == 'CoinTossModule':
        return W(rng.randint(0, 1)) + tail
    if name == 'RouletteModule':
        kind = rng.randint(0, 13)
        if kind == 0:
            pc = rng.randint(1, 36); mask = 0
            while bin(mask).count('1') < pc:
                mask |= 1 << rng.randint(0, 36)
            return W(0) + W(mask)
        payload = {1: rng.randint(0, 36), 2: (lambda a, b: a | (b << 6))(*rng.sample(range(37), 2)),
                   3: 1 + 3 * rng.randint(0, 11), 4: rng.choice([n for n in range(1, 33) if n % 3]),
                   5: 1 + 3 * rng.randint(0, 10), 6: rng.randint(1, 3), 7: rng.randint(1, 3)}.get(kind, 0)
        return W(kind) + W(payload)
    if name == 'KenoModule':
        played = rng.randint(1, 5); mask = 0
        while bin(mask).count('1') < played:
            mask |= 1 << rng.randint(0, 14)
        return W(mask) + tail
    if name == 'PlinkoModule':
        return W(rng.randint(0, 2)) + tail
    if name == 'SicBoModule':
        kind = rng.randint(0, 6)
        value = 0 if kind <= 2 else rng.randint(4, 17) if kind == 4 else rng.randint(1, 6)
        return W(kind) + W(value)
    if name == 'SlotsModule':
        return W(0) + tail
    return W(rng.randint(0, 2)) + tail

def spec_for(rng, kind):
    big = (1 << 108) - 1
    if kind == 'floor':
        return 99, 25, (1 << 256) - 1, (1 << 256) - 1
    if kind == 'large':
        return big // 25 // 6000, 25, (1 << 256) - 1, (1 << 256) - 1
    if kind == 'stop-gain':
        a = rng.randint(99, 10 ** 12); return a, 25, 1, (1 << 256) - 1
    if kind == 'stop-loss':
        a = rng.randint(99, 10 ** 12); return a, 25, (1 << 256) - 1, 1
    if kind == 'stop-both':
        a = rng.randint(99, 10 ** 12); return a, 25, a, a
    a = rng.randint(99, 10 ** 18); n = rng.randint(1, 25)
    return a, n, rng.choice([(1 << 256) - 1, rng.randint(1, a * n)]), rng.choice([(1 << 256) - 1, rng.randint(1, a * n)])

def gen(path, seed=20261008, per_module=24):
    rng = random.Random(seed)
    cases = []
    kinds = ['floor', 'large', 'stop-gain', 'stop-loss', 'stop-both'] + ['random'] * (per_module - 5)
    for name in MODULES:
        code, sel = P.load(name)
        for kind in kinds:
            for _ in range(50):
                params = params_for(name, rng)
                amount, n, sg, sl = spec_for(rng, kind)
                bet_id = rng.getrandbits(256)
                word = rng.choice([0, MASK, rng.getrandbits(256)])
                cd = encode_calldata(sel, params, amount, n, sg, sl, bet_id, word)
                try:
                    gas, ret = execute(code, cd)
                except Revert:
                    continue  # not admitted (e.g. params the module rejects); try another draw
                cases.append({'module': name, 'kind': kind, 'params': '0x' + params.hex(), 'amountPerRoll': str(amount),
                              'betCount': n, 'stopGain': str(sg), 'stopLoss': str(sl), 'betId': str(bet_id),
                              'word': str(word), 'expectedGas': gas, 'expectedPayoutGross': str(int.from_bytes(ret[:32], 'big')),
                              'expectedRefund': str(int.from_bytes(ret[32:64], 'big'))})
                break
    Path(path).write_text(json.dumps(cases, indent=1) + '\n')
    print(len(cases), 'cases;', {m: sum(1 for c in cases if c['module'] == m) for m in MODULES})

def run(path):
    cases = json.loads(Path(path).read_text())
    codes = {name: P.load(name) for name in MODULES}
    for c in cases:
        code, sel = codes[c['module']]
        cd = encode_calldata(sel, bytes.fromhex(c['params'][2:]), int(c['amountPerRoll']), c['betCount'],
                             int(c['stopGain']), int(c['stopLoss']), int(c['betId']), int(c['word']))
        gas, _ = execute(code, cd)
        assert gas == c['expectedGas'], (c, gas)
    print('re-evaluated', len(cases), 'cases: all equal')

if __name__ == '__main__':
    if sys.argv[1] == 'gen':
        gen(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 20261008)
    else:
        run(sys.argv[2])
