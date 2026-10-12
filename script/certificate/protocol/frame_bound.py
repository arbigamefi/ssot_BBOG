#!/usr/bin/env python3
"""Exact-bytecode own-instruction bound for protocol frames (VRFHub, Router, Vault frame), ledger convention.

Same abstract interpretation as ../modules/pure_module_bound.py (unknown values fork JUMPIs; joined states;
longest path over the final state graph), extended for non-pure frames under the fixed-ledger convention so
nothing is charged twice:
  SLOAD          100 (warm baseline; cold surcharges are in the ledger's first-touch envelope)
  SSTORE         0   (full warm SSTORE prices are in the ledger)
  LOGn           0   (event fees are in the ledger); memory expansion for the data range is charged
  CALL family    0   (account access is in the ledger; callee bodies are separate components); memory
                     expansion for input/output ranges is charged; success is assumed (admitted path);
                     returndata size comes from the frame configuration per call site
  EXTCODESIZE    0   (ledger), returns unknown
Opaque internal functions (by functionDebugData name) are skipped at zero cost: their bodies are other
components (for the Vault frame: the tree/selector component).

Assumption M2 (relocation invariance), as in the module interpreter: joined states take the maximum free memory
pointer, which is sound because solc-generated code never branches on the pointer's absolute value. The
independent certificate review of 2026-10-07 found such joins in VRFHub.rawFulfillRandomWords (2) and in each
Vault settlement measure (4), all at branch merges.
"""
import json, sys, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'modules'))
import pure_module_bound as P

U = P.U
MASK = P.MASK

def load(output_json, source, contract):
    o = json.loads(Path(output_json).read_text())
    c = o['contracts'][source][contract]['evm']['deployedBytecode']
    code = bytes.fromhex(c['object'])
    fdd = {v['entryPoint']: (k, v['parameterSlots'], v['returnSlots'])
           for k, v in c['functionDebugData'].items() if v['entryPoint'] is not None}
    return code, fdd

def make_step(code, fdd, selector, words, ret_size, opaque=()):
    ops, jumpdests = P.decode(code)
    size = 4 + 32*len(words)
    W = {4 + 32*i: v for i, v in enumerate(words)}
    opaque_entries = {pc: (name, ps, rs) for pc, (name, ps, rs) in fdd.items() if name in opaque}
    sub = P.make_step(code, 0, 1)   # exact arithmetic/comparison/bitwise semantics, built once

    def cd(off):
        if off == U: return U
        if off >= size: return 0
        if off == 0:
            w = W.get(4)
            # Selector-prefixed word: shr(224, .) recovers the concrete selector; anything else sees U.
            return ('SEL', selector) if w == U else ((selector << 224) | ((w or 0) >> 32)) & MASK
        if (off - 4) % 32 == 0: return W[off]
        return U

    def step(state):
        pc, st, mem, hv, msz, rds = state
        out = []; s = list(st); m = dict(mem)
        if pc not in ops: raise RuntimeError(f'pc {pc} outside code')
        op, arg, nxt = ops[pc]
        def pop():
            if not s: raise RuntimeError(f'stack underflow pc={pc}')
            return s.pop()
        def expand(off, ln, cur):
            if ln == 0: return cur, 0
            if off == U or ln == U: raise RuntimeError(f'unknown memory extent pc={pc} op={hex(op)}')
            w = (off + ln + 31)//32
            return (w, P.mem_cost(w) - P.mem_cost(cur)) if w > cur else (cur, 0)
        def emit(npc, g):
            out.append(('n', (npc, tuple(s), tuple(sorted(m.items())), hv, msz, rds), g))
        g = 0
        if 0x60 <= op <= 0x7f: s.append(arg); g = 3
        elif op == 0x5f: s.append(0); g = 2
        elif 0x80 <= op <= 0x8f: s.append(s[-(op - 0x7f)]); g = 3
        elif 0x90 <= op <= 0x9f:
            j = op - 0x8f; s[-1], s[-1-j] = s[-1-j], s[-1]; g = 3
        elif op == 0x50: pop(); g = 2
        elif op == 0x5b: g = 1
        elif op == 0x56:
            d = pop(); g = 8
            if d == U or d not in jumpdests: raise RuntimeError(f'unresolved jump pc={pc} dest={d}')
            if d in opaque_entries:
                name, ps, rs = opaque_entries[d]
                ret = s[-ps - 1]
                del s[-ps - 1:]
                s.extend([U]*rs)
                if ret == U or ret not in jumpdests: raise RuntimeError(f'opaque {name} bad return {ret}')
                emit(ret, g); return out
            emit(d, g); return out
        elif op == 0x57:
            d = pop(); c = pop(); g = 10
            if d == U or d not in jumpdests: raise RuntimeError(f'unresolved jumpi pc={pc} dest={d}')
            nm = tuple(sorted(m.items()))
            if c == U or c != 0: out.append(('n', (d, tuple(s), nm, hv, msz, rds), g))
            if c == U or c == 0: out.append(('n', (nxt, tuple(s), nm, hv, msz, rds), g))
            return out
        elif op in (0x00, 0xf3):
            if op == 0xf3:
                off = pop(); ln = pop(); msz2, eg = expand(off, ln, msz); g = eg; msz = msz2
            out.append(('ok', msz, g)); return out
        elif op in (0xfd, 0xfe): out.append(('revert', None, 0)); return out
        elif op == 0x35: s.append(cd(pop())); g = 3
        elif op == 0x36: s.append(size); g = 2
        elif op == 0x34: s.append(0); g = 2
        elif op == 0x3d: s.append(rds); g = 2
        elif op in (0x30, 0x32, 0x33, 0x3a, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x4a, 0x5a):
            s.append(U); g = 2 if op != 0x47 else 5
        elif op == 0x38: s.append(len(code)); g = 2
        elif op == 0x59: s.append(msz*32); g = 2
        elif op == 0x54: pop(); s.append(U); g = 100
        elif op == 0x55: pop(); pop(); g = 0
        elif op == 0x3b: pop(); s.append(U); g = 0
        elif 0xa0 <= op <= 0xa4:
            off = pop(); ln = pop()
            for _ in range(op - 0xa0): pop()
            msz, eg = expand(off, ln, msz); g = eg
        elif op in (0xf1, 0xf2, 0xf4, 0xfa):
            pop(); pop()                       # gas, address
            if op in (0xf1, 0xf2): pop()       # value (0 on admitted paths)
            io = pop(); il = pop(); oo = pop(); ol = pop()
            msz, e1 = expand(io, il, msz); msz, e2 = expand(oo, ol, msz); g = e1 + e2
            rsz = ret_size(pc)
            if oo != U and ol != U and ol:
                for a in range(oo - oo % 32, oo + ol, 32): m[a] = U
            s.append(1); rds = rsz
        elif op in (0x51, 0x52, 0x53, 0x37, 0x39, 0x5e, 0x3e, 0x20, 0x0a):
            if op == 0x51:
                off = pop(); g = 3
                if off == U: s.append(U)
                else:
                    msz, eg = expand(off, 32, msz); g += eg
                    s.append(U if off % 32 else (m[off] if off in m else (U if hv and off >= 0x80 else 0)))
            elif op in (0x52, 0x53):
                off = pop(); val = pop(); g = 3
                if off == U:
                    hv = True; m = {k: v for k, v in m.items() if k < 0x80}
                else:
                    msz, eg = expand(off, 32 if op == 0x52 else 1, msz); g += eg
                    if op == 0x52 and off % 32 == 0: m[off] = val
                    else:
                        b = off - off % 32; m[b] = U
                        if op == 0x52 and off % 32: m[b + 32] = U
            elif op in (0x37, 0x39, 0x5e, 0x3e):
                dst = pop(); src = pop(); ln = pop()
                if ln == U: raise RuntimeError(f'unknown copy length pc={pc} op={hex(op)}')
                if op == 0x3e and src != U and src + ln > rds: out.append(('revert', None, 0)); return out
                msz, eg = expand(dst, ln, msz)
                if op == 0x5e: msz, e2 = expand(src, ln, msz); eg += e2
                g = 3 + 3*((ln + 31)//32) + eg
                if dst == U:
                    hv = True; m = {k: v for k, v in m.items() if k < 0x80}
                else:
                    for a in range(dst - dst % 32, dst + ln, 32): m[a] = U
                    if op == 0x37 and dst % 32 == 0 and src != U and ln % 32 == 0:
                        for k in range(ln//32): m[dst + 32*k] = cd(src + 32*k)
            elif op == 0x20:
                off = pop(); ln = pop()
                if ln == U: raise RuntimeError(f'unknown hash length pc={pc}')
                msz, eg = expand(off, ln, msz); g = 30 + 6*((ln + 31)//32) + eg; s.append(U)
            else:
                a = pop(); e = pop(); nb = 32 if e == U else (e.bit_length() + 7)//8
                g = 10 + 50*nb; s.append(U if U in (a, e) else pow(a, e, 1 << 256))
        elif op == 0x1c and len(s) >= 2 and s[-1] == 224 and isinstance(s[-2], tuple):
            pop(); v = pop(); s.append(v[1]); g = 3
        else:
            # Arithmetic/comparison/bitwise: reuse the module interpreter's exact semantics via a tiny state.
            s = [U if isinstance(v, tuple) else v for v in s]
            res = sub((pc, tuple(s), tuple(sorted(m.items())), hv, msz))
            kind, ns, gg = res[0]
            if kind != 'n': raise RuntimeError(f'unexpected {kind} at pc={pc} op={hex(op)}')
            npc, nst, nmem, nhv, nmsz = ns
            out.append(('n', (npc, nst, nmem, nhv, nmsz, rds), gg)); return out
        emit(nxt, g); return out
    return step

def key_of(st):
    pc, stack, mem, hv, msz, rds = st
    return (pc, tuple('*' if isinstance(v, tuple) else w for v, w in zip(stack, P.sig(tuple(U if isinstance(v, tuple) else v for v in stack)))), hv, rds)

def join(a, b):
    j = P.join(a[:5], b[:5])
    return j + (a[5],)

def graph(step, starts, stop=None, limit=2_000_000):
    best = {}; work = []
    for st in starts:
        k = key_of(st); best[k] = join(best[k], st) if k in best else st; work.append(k)
    while work:
        k = work.pop()
        for kind, nxt, _ in step(best[k]):
            if kind != 'n' or (stop and stop(nxt)): continue
            nk = key_of(nxt)
            if nk in best:
                jj = join(best[nk], nxt)
                if jj == best[nk]: continue
                best[nk] = jj
            else:
                best[nk] = nxt
                if len(best) > limit: raise RuntimeError('abstract state limit')
            work.append(nk)
    edges = {}; term = {}
    for k, st in best.items():
        lst = []
        for kind, nxt, g in step(st):
            if kind == 'n':
                if stop and stop(nxt): lst.append((('HEAD',), g))
                else:
                    nk = key_of(nxt)
                    lst.append((nk, g + max(0, P.mem_cost(best[nk][4]) - P.mem_cost(nxt[4]))))
            elif kind == 'ok':
                term[k] = max(term.get(k, -1), g)
        edges[k] = lst
    return best, edges, term

def longest(edges, term, start_key, to_head=False):
    NEG = float('-inf'); HEAD = ('HEAD',)
    memo = {HEAD: (0 if to_head else NEG)}; onstack = set(); stack = [(start_key, 0)]
    while stack:
        k, i = stack.pop()
        if i == 0:
            if k in memo: continue
            onstack.add(k)
        succ = edges.get(k, [])
        if i < len(succ):
            stack.append((k, i + 1)); nk = succ[i][0]
            if nk not in memo:
                if nk in onstack: raise RuntimeError('cycle (unbounded loop)')
                stack.append((nk, 0))
            continue
        val = NEG if to_head else term.get(k, NEG)
        for nk, g in succ:
            if memo[nk] != NEG: val = max(val, memo[nk] + g)
        memo[k] = val; onstack.discard(k)
    return memo[start_key]

def bound(code, fdd, selector, words, ret_size=lambda pc: 0, opaque=(), stop_pc=None):
    """Longest successful path from entry; with stop_pc, also the longest path to the first arrival there."""
    step = make_step(code, fdd, selector, words, ret_size, opaque)
    start = (0, (), (), False, 0, 0)
    best, edges, term = graph(step, [start])
    total = longest(edges, term, key_of(start))
    out = {'total': total, 'states': len(best)}
    if stop_pc is not None:
        _, e2, t2 = graph(step, [start], stop=lambda nxt: nxt[0] == stop_pc)
        out['toStop'] = longest(e2, t2, key_of(start), to_head=True)
        afters = [k for k in best if k[0] == stop_pc]
        out['afterStop'] = max(longest(edges, term, k) for k in afters) if afters else None
    return out
