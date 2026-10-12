#!/usr/bin/env python3
"""Pure structural DP for prefix suffix-query opcode cost and two-push cold union.

No EVM executions, sampled gas, production mutations or recursive-node values.
The endpoint-cost recurrence assumes each permitted prefix split is visited;
early returns and zero-left coupling can only remove counted query work.
Storage charge uses clean nonzero-or-dirty Node classification separately proved
from production source; entry/counter/outer-frame and SSTORE sentry excluded.
"""
import json
from pathlib import Path

B = Path(__file__).resolve().parent
H = 40


def direct_query_cost(bits):
    """Direct suffix-loop counts; not the DP recurrence under test."""
    h = len(bits)
    offset = int(bits or '0', 2)
    calls = iterations = reads = 0
    for depth, bit in enumerate(bits):
        width = h - depth
        subtree_end = ((offset >> width) << width) + (1 << width) - 1
        # Full subtree interval terminates before entering its split branch.
        if offset == subtree_end:
            break
        if bit != '1':
            continue
        calls += 1
        left, right = (1 << h) + offset + 1, (1 << h) + subtree_end
        while left <= right:
            iterations += 1
            if left & 1:
                reads += 1
                left += 1
            assert right & 1
            left >>= 1
            right >>= 1
    return 65 * calls + 133 * iterations + 379 * reads


def endpoint_tables(h, boundary=0, full_child=0, query_weight=1):
    # z: number of zero bits; p: width from highest zero to low end, or 0.
    tables = [{(0, 0): (0, '')}]
    for width in range(1, h + 1):
        nxt = {}
        for (z, p), (value, bits) in tables[-1].items():
            for bit in ('0', '1'):
                if bit == '0':
                    state, candidate = (z + 1, width), (value + boundary, bit + bits)
                else:
                    state = (z, p)
                    extra = query_weight*(65 + 379*z + 133*p) + boundary + full_child if z else 0
                    candidate = (value + extra, bit + bits)
                if state not in nxt or candidate[0] > nxt[state][0]:
                    nxt[state] = candidate
        tables.append(nxt)
    return tables


def joint_table(h, node_weight=4800):
    tables = endpoint_tables(h)
    by_divergence = []
    for j in range(1, h + 1):
        # x<y, highest differing bit j: x = common || 0 || sx,
        # y = common || 1 || sy. The common high bits are added below.
        states = {}
        for (zx, px), (vx, bx) in tables[j-1].items():
            for (zy, py), (vy, by) in tables[j-1].items():
                state = (zx + 1 + zy, j + py, 1 + int(zy > 0))
                value = vx + vy + (65 + 379*zy + 133*py if zy else 0)
                candidate = (value, '0' + bx, '1' + by)
                if state not in states or value > states[state][0]:
                    states[state] = candidate
        for width in range(j + 1, h + 1):
            nxt = {}
            for (z, p, k), (v, bx, by) in states.items():
                for bit in ('0', '1'):
                    if bit == '0':
                        state, value = (z+2, 2*width, 2), v
                    else:
                        state, value = (z, p, k), v + 65*k + 379*z + 133*p
                    candidate = (value, bit+bx, bit+by)
                    if state not in nxt or value > nxt[state][0]:
                        nxt[state] = candidate
            states = nxt
        best = max(states.values(), key=lambda x: x[0])
        union = 79 + 2*j if h == 40 else 2*h-1+2*j
        # The 40-bit tree has 81 nodes for one push. Two divergent paths
        # share the first h-j levels and both children at divergence.
        by_divergence.append({'highestDifferingBitWidth':j,'sharedHighBits':h-j,
            'maxQueryPairCost':best[0],'pushNodeUnion':union,
            'weightedTotal':best[0]+node_weight*union,
            'xBits':best[1],'yBits':best[2]})
    one = max(tables[h].values(),key=lambda x:x[0])
    equal = {'highestDifferingBitWidth':0,'sharedHighBits':h,
        'maxQueryPairCost':2*one[0],'pushNodeUnion':2*h+1,
        'weightedTotal':2*one[0]+node_weight*(2*h+1),
        'xBits':one[1],'yBits':one[1]}
    return max(by_divergence+[equal],key=lambda x:x['weightedTotal']),by_divergence,equal


def weighted_tree_component(h, is_sub):
    # Generic local opcode maxima; no positive/zero child relationship assumed.
    # Node SSTORE dirty baseline is included in every lazy change invocation.
    bx, fx = (2994, 0) if is_sub else (2588, 509)
    preview_terminal = 522 if is_sub else 509
    change = 961 if is_sub else 730
    by = (2976 if is_sub else 2996) + change + 200
    fy = 566 + change + 200
    lazy_root_terminal = (586 if is_sub else 845) + change + 200
    tx, ty = endpoint_tables(h,bx,fx), endpoint_tables(h,by,fy)
    candidates=[]
    for j in range(1,h+1):
        states={}
        for (zx,px),(vx,sx) in tx[j-1].items():
            for (zy,py),(vy,sy) in ty[j-1].items():
                state=(zx+1+zy,j+py,1+int(zy>0))
                value=vx+bx+vy+(65+379*zy+133*py+by+fy if zy else 0)
                if state not in states or value>states[state][0]:
                    states[state]=(value,'0'+sx,'1'+sy)
        for width in range(j+1,h+1):
            nxt={}
            for (z,p,k),(v,sx,sy) in states.items():
                for bit in ('0','1'):
                    if bit=='0':
                        state,value=(z+2,2*width,2),v+bx+by
                    else:
                        state=(z,p,k)
                        value=v+65*k+379*z+133*p+bx+fx+(by+fy if k==2 else 0)
                    if state not in nxt or value>nxt[state][0]:
                        nxt[state]=(value,bit+sx,bit+sy)
            states=nxt
        best=max(((v+preview_terminal+(fy if k==2 else lazy_root_terminal),sx,sy)
                 for (_,_,k),(v,sx,sy) in states.items()),key=lambda x:x[0])
        union=2*h-1+2*j
        # Two pushes: h boundary functions + 1 leaf each, 4h setAmount calls,
        # each setAmount has one dynamic dirty-100 baseline SSTORE.
        fixed_push=2*(h*1814+77)+4*h*481+4*h*100
        candidates.append({'mode':'fallback','divergenceWidth':j,'nodeUnion':union,
            'weightedPhaseCost':best[0],'fixedPushOpcodeAndDirtyStoreCost':fixed_push,
            'treeBodyCandidateBound':fixed_push+4800*union+best[0],
            'xBits':best[1],'yBits':best[2]})
    combined=endpoint_tables(h,bx+by,fx+fy,2)[h]
    eqbest=max(((v+preview_terminal+(fy if z else lazy_root_terminal),bits)
               for (z,_),(v,bits) in combined.items()),key=lambda x:x[0])
    for fallback in (False,True):
        pushes=2 if fallback else 1
        fixed_push=pushes*(h*1814+77+2*h*481+2*h*100)
        candidates.append({'mode':'fallback-same-endpoint' if fallback else 'no-fallback',
            'divergenceWidth':0,'nodeUnion':2*h+1,'weightedPhaseCost':eqbest[0],
            'fixedPushOpcodeAndDirtyStoreCost':fixed_push,
            'treeBodyCandidateBound':fixed_push+4800*(2*h+1)+eqbest[0],
            'xBits':eqbest[1],'yBits':eqbest[1]})
    return {'status':'LOCAL-MAXIMA-STRUCTURAL-COMPONENT-CANDIDATE',
        'isSub':is_sub,
        'localPrices':{'previewBoundary':bx,'previewFullChild':fx,
            'previewFinalTerminal':preview_terminal,'lazyBoundaryPlusChangeAndDirtyStores':by,
            'lazyNonrootFullPlusChangeAndDirtyStores':fy,
            'lazyRootFullPlusChangeAndDirtyStores':lazy_root_terminal},
        'best':max(candidates,key=lambda x:x['treeBodyCandidateBound']),
        'noFallback':next(x for x in candidates if x['mode']=='no-fallback'),
        'allBranches':candidates}


def exhaustive_sanity():
    for h in range(1, 7):
        # Independent actual query-loop enumeration for every small word.
        costs = {v:direct_query_cost(format(v,f'0{h}b')) for v in range(1<<h)}
        t = endpoint_tables(h)[h]
        assert max(costs.values()) == max(v[0] for v in t.values())
        for value,bits in t.values():
            assert costs[int(bits,2)] == value
        got,_,_ = joint_table(h)
        best = -1
        for x in range(1<<h):
            for y in range(x,1<<h):
                j = (x^y).bit_length()
                union = 2*h+1 if not j else 2*h-1+2*j
                best=max(best,costs[x]+costs[y]+4800*union)
        assert got['weightedTotal'] == best,(h,got,best)
        for sub in (False,True):
            candidate=weighted_tree_component(h,sub)
            lp=candidate['localPrices']
            max_value=-1
            for x in range(1<<h):
                xb=format(x,f'0{h}b');xp=xb.rstrip('1');dx=len(xp);ox=xp.count('1')
                preview=(costs[x]+lp['previewBoundary']*dx+
                    lp['previewFullChild']*ox+lp['previewFinalTerminal'])
                for y in range(x,1<<h):
                    yb=format(y,f'0{h}b');yp=yb.rstrip('1');dy=len(yp);oy=yp.count('1')
                    lazy=(costs[y]+lp['lazyBoundaryPlusChangeAndDirtyStores']*dy+
                        lp['lazyNonrootFullPlusChangeAndDirtyStores']*(oy+1) if dy else
                        lp['lazyRootFullPlusChangeAndDirtyStores'])
                    j=(x^y).bit_length();union=2*h+1 if not j else 2*h-1+2*j
                    fixed=2*(h*1814+77)+4*h*(481+100)
                    max_value=max(max_value,fixed+4800*union+preview+lazy)
            assert candidate['best']['treeBodyCandidateBound']==max_value,(h,sub,candidate['best'],max_value)


if __name__ == '__main__':
    exhaustive_sanity()
    best,by_divergence,equal = joint_table(H)
    assert direct_query_cost(best['xBits']) + direct_query_cost(best['yBits']) == best['maxQueryPairCost']
    out={'status':'STRUCTURAL-COMPONENT-ONLY-NOT-CALLBACK-CERTIFICATE',
        'scope':__doc__,'height':H,'queryOpcodeFormula':'65Q+133I+379R',
        'nodeMarginalWeight':4800,
        'nodeMarginalExplanation':'2000 cold SLOAD surcharge + 2800 clean-vs-dirty SSTORE difference; total write-count baseline charged separately',
        'smallExhaustiveHeights':[1,2,3,4,5,6],
        'best':best,'allEqual':equal,'byHighestDifferingBitWidth':by_divergence,
        'sstoreBaselineFor322Instructions':32200,
        'queryPlusNodeStorageBound':best['weightedTotal']+32200,
        'profitTreeComponent':weighted_tree_component(H,False),
        'lossTreeComponent':weighted_tree_component(H,True)}
    (B/'tree-query-cold-joint-bound.json').write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps({'best':best,'queryPlusNodeStorageBound':out['queryPlusNodeStorageBound'],
        'profitTreeComponent':out['profitTreeComponent']['best'],
        'lossTreeComponent':out['lossTreeComponent']['best']},indent=2))
