#!/usr/bin/env python3
"""No-preview tree component with the unused-suffix skip (patched vendor _pushLazy).

Whole-range allocation (range end = last used leaf) skips every suffix query; prefix ranges keep them. The
pushLazy boundary coefficient already contains the added end-of-range test.

k>0 settlement runs the selector (shortcut or early-exit predicate), one push and one lazy update with its
suffix queries. The vendor sufficiency preview and its second push are no longer executed. Exact CFG
coefficients rebound on this runtime; local maxima are conservative and may be jointly unreachable.
Structural DP over every 40-bit endpoint; small heights are checked exhaustively. Not a callback certificate:
Vault frame, counters, token calls, outer frames, EIP-150 and SSTORE sentry are composed elsewhere.
"""
import json, runpy
from pathlib import Path
B = Path(__file__).resolve().parent
IDENTITY = json.loads((B/'compiler-identity.json').read_text())
RUNTIME = IDENTITY['runtimeSha256']
q = json.loads((B/'query-current-cfg-binding.json').read_text()); assert q['runtimeSha256'] == RUNTIME
assert [q[k] for k in ['queryCoefficient', 'iterationCoefficient', 'coverReadCoefficient']] == [65, 133, 379]
f = json.loads((B/'tree-success-cfg-diagnostic.json').read_text())['functions']
p = json.loads((B/'prefix-success-cfg-segments.json').read_text()); assert p['runtimeSha256'] == RUNTIME
seg = p['segments']
for v in seg.values():
    for group in v['endpointGroups'].values():
        assert group[2] == 0, 'selector/predicate segments must not store'
g = lambda name, key: seg[name]['endpointGroups'][key][0]
HEAD = str(p['loopHead'])
L, R = g('predicate_left', HEAD), g('predicate_right', HEAD)
EXITMAX = max(g('predicate_exit', 'RETURN'), g('predicate_early_true', 'RETURN'), g('predicate_early_false', 'RETURN'))
E = g('selector_own', 'RETURN') + g('predicate_entry', HEAD) + EXITMAX
SHORTCUT = g('selector_shortcut', 'RETURN')
geo = runpy.run_path(str(B/'query-cold-joint-dp.py'), run_name='geometry')
tables, direct = geo['endpoint_tables'], geo['direct_query_cost']
assert f['fun_push']['gas'] == 1814 and f['fun_push_leaf']['gas'] == 77 and f['fun_setAmount']['gas'] == 481

def lazy_prices(sub):
    k = int(sub)
    change = f[f'fun_changeAmount_sub{k}']['gas']
    by = f[f'fun_pushLazy_sub{k}_boundary']['gas'] + change + 200   # two dirty-100 baselines per change
    fy = f[f'fun_pushLazy_sub{k}_full_nonroot']['gas'] + change + 200
    root = f[f'fun_pushLazy_sub{k}_full_root']['gas'] + change + 200
    return by, fy, root

def lazy_phase(bits, lp, queries=True):
    by, fy, root = lp
    active = bits.rstrip('1'); d = len(active); o = active.count('1')
    return (direct(bits) if queries else 0) + by*d + fy*o + (fy if d else root)

def prefix_body(bits):
    active = bits.rstrip('1')
    return active.count('0')*L + active.count('1')*R

def push_fixed(h):
    return h*f['fun_push']['gas'] + f['fun_push_leaf']['gas'] + 2*h*(f['fun_setAmount']['gas'] + 100)

def same_path(h, sub, with_prefix):
    by, fy, root = lazy_prices(sub)
    # A prefix range (cutoff < last) keeps its suffix queries; the latest-cutoff range ends at the last leaf.
    tab = tables(h, by + (L if with_prefix else 0), fy + ((R - L) if with_prefix else 0), 1 if with_prefix else 0)[h]
    val, bits = max((v + (fy if z else root) + (E if with_prefix and z else 0), bits) for (z, _), (v, bits) in tab.items())
    total = push_fixed(h) + 2000*(2*h + 1) + 2800*(2*h + 1) + val + (0 if with_prefix else SHORTCUT)
    return {'mode': 'prefix-covers-k' if with_prefix else 'latest-cutoff-shortcut', 'phaseAndPredicateWarmGas': val,
            'readNodeUnion': 2*h + 1, 'cleanWriteNodeUpper': 2*h + 1, 'treeBodyWithSelectorAllCold': total, 'bits': bits}

def preselect_last(h, sub):
    by, fy, root = lazy_prices(sub)
    tb = tables(h, by, fy, 0); out = []   # the last-leaf range skips every suffix query
    for j in range(1, h + 1):
        w = j - 1; xs = ('1'*(w - 1) + '0') if w else ''
        xv = prefix_body(xs) + L                      # x takes the left child at the divergence
        states = {}
        for (z, p_), (v, bits) in tb[w].items():
            extra = by + fy if z else 0   # y turns right at the divergence (no suffix query)
            cand = (xv + v + extra, '0' + xs, '1' + bits)
            if (z, p_) not in states or cand[0] > states[(z, p_)][0]:
                states[(z, p_)] = cand
        for width in range(j + 1, h + 1):
            nxt = {}
            for (z, p_), (v, xb, yb) in states.items():
                for bit in '01':
                    state = (z + 1, width) if bit == '0' else (z, p_)
                    extra = L + by if bit == '0' else R + (by + fy if z else 0)
                    cand = (v + extra, bit + xb, bit + yb)
                    if state not in nxt or cand[0] > nxt[state][0]:
                        nxt[state] = cand
            states = nxt
        val, xb, yb = max((v + (fy if z else root) + E, xb, yb) for (z, p_), (v, xb, yb) in states.items())
        union = 2*h - 1 + 2*j
        out.append({'mode': 'prefix-below-k-selects-last', 'divergenceWidth': j, 'readNodeUnion': union,
                    'cleanWriteNodeUpper': 2*h + 1, 'phaseAndPredicateWarmGas': val,
                    'treeBodyWithSelectorAllCold': push_fixed(h) + 2000*union + 2800*(2*h + 1) + val,
                    'cutoffBits': xb, 'lastBits': yb})
    return max(out, key=lambda x: x['treeBodyWithSelectorAllCold']), out

def exhaustive():
    for h in range(1, 7):
        for sub in (False, True):
            lp = lazy_prices(sub)
            for with_prefix in (False, True):
                expected = max(lazy_phase(format(x, f'0{h}b'), lp, queries=with_prefix)
                               + (E + prefix_body(format(x, f'0{h}b')) if with_prefix and x != (1 << h) - 1 else 0)
                               for x in range(1 << h))
                assert same_path(h, sub, with_prefix)['phaseAndPredicateWarmGas'] == expected, (h, sub, with_prefix)
            got, _ = preselect_last(h, sub); expected = -1
            for x in range(1 << h):
                xb = format(x, f'0{h}b'); d = len(xb.rstrip('1'))
                for y in range(x + 1, 1 << h):
                    yb = format(y, f'0{h}b'); j = (x ^ y).bit_length()
                    union = 2*h + 1 + 2*max(d - (h - j + 1), 0)
                    val = push_fixed(h) + 2000*union + 2800*(2*h + 1) + E + prefix_body(xb) + lazy_phase(yb, lp, queries=False)
                    expected = max(expected, val)
            assert got['treeBodyWithSelectorAllCold'] == expected, (h, sub, got, expected)

def main():
    exhaustive()
    rows = []
    for sub in (False, True):
        covered, latest = same_path(40, sub, True), same_path(40, sub, False)
        below, by = preselect_last(40, sub)
        for row in (covered, latest, below):
            row['pnl'] = 'loss' if sub else 'profit'
            row['treeBodyWithSelectorRootWarm'] = row['treeBodyWithSelectorAllCold'] - 2000
            rows.append(row)
        (B/f"suffix-skip-{'loss' if sub else 'profit'}-by-divergence.json").write_text(json.dumps(by, indent=2) + '\n')
    out = {'status': 'SUFFIX-SKIP-TREE-COMPONENT-CANDIDATE-INDEPENDENT-CHECK-PENDING', 'runtimeSha256': RUNTIME,
           'runtimeBytes': IDENTITY['runtimeBytes'], 'domain': 'k>0 casino domain; k=0 profit keeps the vendor limit operation (separate)',
           'predicateCoefficients': {'left': L, 'right': R, 'entryPlusSelectorPlusMaxExit': E, 'shortcut': SHORTCUT},
           'predicateWarmUpper40': E + 39*R + L, 'lazyPrices': {str(s): lazy_prices(s) for s in (False, True)},
           'onePushFixedWarmAndDirtyBaseline': push_fixed(40), 'smallExhaustiveHeights': [1, 2, 3, 4, 5, 6],
           'excluded': 'Vault frame/entry, _allocate counter SLOAD/SSTORE, token calls, outer frames, EIP-150, SSTORE sentry',
           'cases': rows, 'maxTreeBodyWithSelectorRootWarm': max(r['treeBodyWithSelectorRootWarm'] for r in rows)}
    (B/'suffix-skip-tree-component.json').write_text(json.dumps(out, indent=2) + '\n')
    for r in rows:
        print(r['pnl'], r['mode'], r['treeBodyWithSelectorRootWarm'])
    print('max', out['maxTreeBodyWithSelectorRootWarm'], 'E', E, 'L', L, 'R', R)

if __name__ == '__main__':
    main()
