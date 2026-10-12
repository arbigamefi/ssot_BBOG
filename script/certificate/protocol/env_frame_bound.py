#!/usr/bin/env python3
"""frame_bound with a declared environment: modelled return data per call site and modelled storage loads.

frame_bound treats the return data of every call as unknown words of a configured size. That is enough for frames
that decode static results, but a frame that decodes a dynamic result (an offset and a length) or copies a storage
`bytes` value cannot bound its loops when those words are unknown, and its abstract state graph never closes. The
environment fixes exactly the words that shape control flow and leaves every other word unknown:

  calls   {pc: [word, ...]} or a function (pc, opcode) -> [word, ...]: the call at pc succeeds and returns these
          words (each an int or U). RETURNDATASIZE is 32 * len(words) and RETURNDATACOPY copies them. A call the
          frame reaches without a model aborts the analysis.
  sloads  {pc: word}: the SLOAD at pc returns this word; every other SLOAD returns U.
  immutables {offset: word}: the PUSH32 whose data starts at offset pushes this word (U for unknown) instead of
          the zeros the compiler output holds there, so no branch on a deployment-time value is pruned.

Every other instruction keeps frame_bound's semantics and prices (ledger convention: SLOAD 100, SSTORE 0, LOG 0,
CALL family 0 plus memory expansion), so a bound is the longest successful path for one environment. The caller
takes the maximum over every environment the domain admits.
"""
import frame_bound as F

P = F.P
U = F.U
CALLS = (0xf1, 0xf2, 0xf4, 0xfa)
GAS = 0x5a


def expand(pc, op, off, ln, cur):
    if ln == 0:
        return cur, 0
    if U in (off, ln):
        raise RuntimeError(f'unknown memory extent pc={pc} op={hex(op)}')
    w = (off + ln + 31) // 32
    return (w, P.mem_cost(w) - P.mem_cost(cur)) if w > cur else (cur, 0)


def make_step(code, fdd, selector, words, env, opaque=()):
    ops, _ = P.decode(code)
    calls, sloads = env.get('calls', {}), env.get('sloads', {})
    # An immutable is a PUSH32 whose 32 data bytes the deployer fills in; the compiler output holds zeros there.
    immutable = {start - 1: value for start, value in env.get('immutables', {}).items()}
    assert all(code[pc] == 0x7f for pc in immutable), 'an immutable reference is not PUSH32 data'
    model = calls if callable(calls) else (lambda pc, op: calls.get(pc))
    reached = {}

    def unmodelled(pc):
        raise RuntimeError(f'unmodelled call at pc={pc}')
    inner = F.make_step(code, fdd, selector, words, unmodelled, opaque)

    def step(state):
        pc, st, mem, hv, msz, rds = state
        if pc not in ops:
            raise RuntimeError(f'pc {pc} outside code')
        op, _, nxt = ops[pc]
        if op in CALLS:
            ret = model(pc, op)
            if ret is None:
                raise RuntimeError(f'unmodelled call at pc={pc}')
            reached[pc] = ret
            s = list(st); m = dict(mem)
            s.pop(); s.pop()                       # gas, address
            if op in (0xf1, 0xf2):
                s.pop()                            # value
            io, il, oo, ol = s.pop(), s.pop(), s.pop(), s.pop()
            msz, e1 = expand(pc, op, io, il, msz)
            msz, e2 = expand(pc, op, oo, ol, msz)
            if ol:
                for a in range(oo - oo % 32, oo + ol, 32):
                    m[a] = U
                if oo % 32 == 0:
                    for k in range(min(ol, 32 * len(ret)) // 32):
                        m[oo + 32 * k] = ret[k]
            s.append(1)
            return [('n', (nxt, tuple(s), tuple(sorted(m.items())), hv, msz, ('RD', pc)), e1 + e2)]
        if op == 0x3d and isinstance(rds, tuple):
            return [('n', (nxt, st + (32 * len(reached[rds[1]]),), mem, hv, msz, rds), 2)]
        if op == 0x3e and isinstance(rds, tuple):
            s = list(st); m = dict(mem)
            dst, src, ln = s.pop(), s.pop(), s.pop()
            ret = reached[rds[1]]
            if U in (src, ln):
                raise RuntimeError(f'unknown return copy extent pc={pc}')
            if src + ln > 32 * len(ret):
                return [('revert', None, 0)]
            msz, eg = expand(pc, op, dst, ln, msz)
            if dst == U:
                hv = True
                m = {k: v for k, v in m.items() if k < 0x80}
            else:
                for a in range(dst - dst % 32, dst + ln, 32):
                    m[a] = U
                if dst % 32 == 0 and src % 32 == 0:
                    for k in range(ln // 32):
                        m[dst + 32 * k] = ret[src // 32 + k]
            return [('n', (nxt, tuple(s), tuple(sorted(m.items())), hv, msz, rds), 3 + 3 * ((ln + 31) // 32) + eg)]
        if pc in immutable:
            return [('n', (nxt, st + (immutable[pc],), mem, hv, msz, rds), 3)]
        if op == 0x54 and pc in sloads:
            s = list(st)
            s.pop()
            s.append(sloads[pc])
            return [('n', (nxt, tuple(s), mem, hv, msz, rds), 100)]
        return inner(state)
    step.reached = reached
    step.ops = ops
    return step


class Frame:
    """The closed abstract state graph of one frame under one environment."""

    def __init__(self, code, fdd, selector, words, env, opaque=()):
        self.step = make_step(code, fdd, selector, words, env, opaque)
        start = (0, (), (), False, 0, 0)
        self.start = F.key_of(start)
        self.best, self.edges, self.term = F.graph(self.step, [start])

    def total(self):
        """Longest successful path from the frame's entry."""
        return F.longest(self.edges, self.term, self.start)

    def states_at(self, pc):
        return [k for k in self.best if k[0] == pc]

    def from_pc(self, pc):
        """Longest successful path from an arrival at pc, including the instruction at pc."""
        return max(F.longest(self.edges, self.term, k) for k in self.states_at(pc))

    def to_pc(self, pc):
        """Longest path from the frame's entry to the first arrival at pc, excluding the instruction at pc."""
        start = (0, (), (), False, 0, 0)
        _, edges, term = F.graph(self.step, [start], stop=lambda s: s[0] == pc)
        return F.longest(edges, term, self.start, to_head=True)

    def count(self, weight):
        """Largest total of weight(state) over the instructions of one successful path (gas is not counted)."""
        edges, term = {}, {}
        for k, st in self.best.items():
            edges[k] = [(F.key_of(nxt), weight(st)) for kind, nxt, _ in self.step(st) if kind == 'n']
            if any(kind == 'ok' for kind, _, _ in self.step(st)):
                term[k] = weight(st)
        return F.longest(edges, term, self.start)

    def between(self, a, b, barrier=()):
        """Longest path that starts right after the instruction at pc a and ends right before the first following
        arrival at pc b; a path through a pc in barrier does not count. None when no path from a reaches b."""
        starts = [nxt for k in self.states_at(a) for kind, nxt, _ in self.step(self.best[k]) if kind == 'n']
        if not starts:
            return None
        _, edges, term = F.graph(self.step, starts, stop=lambda s: s[0] == b)
        best = []
        for st in starts:
            if st[0] in barrier:
                continue
            edges2 = {k: [(nk, g) for nk, g in v if nk == ('HEAD',) or nk[0] not in barrier] for k, v in edges.items()}
            val = F.longest(edges2, term, F.key_of(st), to_head=True)
            if val != float('-inf'):
                best.append(val)
        return max(best) if best else None
