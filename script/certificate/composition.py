#!/usr/bin/env python3
"""First-callback nested gas composition, certificate v5 (launch candidate).

    python3 composition.py <certificate directory>

Reads the stage outputs under the certificate directory (protocol/frame-bounds.json, tree/suffix-skip-tree-
component.json, modules/module-bounds.json and module-rounds.json, ledger/ledger.json, bindings/component-
bindings.json, reused.json) and writes composition.json there.

Scope: k > 0 casino positions (architecture decision §12.2); the domain table is script/release/first-callback-
domain-84532.json. Nested rule at a CALL (reviewed nested-budget.py, unchanged since certificate v2):
    need(U; O, R, Qafter) = max(U + R, O + inv(U), O + U + Qafter, R + 1),  inv(U) = U + (U - 1) // 63.
The rule, the placement of every ledger charge and the O1/O2 checks are those of certificate v4 (composition_v4.py,
sealed with CERTIFICATE-v4.sha256). What v5 changes is where the terms come from:
  - every protocol frame, including the GameHub child and outer frame, Bank.settleBet and its getters and the
    referral engine, is an exact-bytecode interpreter bound on this build (protocol/frames.py);
  - the module term is the interpreter bound recomputed on this build, with the round check M7;
  - the fixed ledger is re-derived for the launch-candidate storage (ledger/ledger.py);
  - reused reviewed components (token bodies, static module bounds, Vault frame constants) are bound to the code
    they were computed on (bindings/bindings.py).
Four measures as in v4: module term interpreter (main) or static (secondary), each with explicit or provisioned
boundaries below the Router. The main measure is interpreter + explicit; it must leave at least MARGIN_FLOOR.
"""
import json
import sys
from pathlib import Path

SENTRY = 2_301           # EIP-2200: SSTORE needs gasleft > 2,300
TOKEN_TRANSFERS = 2      # at most two balance-writing token calls per settlement (token topology review)
MARGIN_FLOOR = 50_000    # launch-candidate plan §10: main-measure margin

inv = lambda u: 0 if u == 0 else u + (u - 1) // 63


def need(U, O=0, R=0, Qafter=0):
    return max(U + R, O + inv(U), O + U + Qafter, R + 1 if R else 0)


def load(d):
    j = lambda rel: json.loads((d / rel).read_text())
    return (j('protocol/frame-bounds.json'), j('tree/suffix-skip-tree-component.json'), j('modules/module-bounds.json'),
            j('modules/module-rounds.json'), j('ledger/ledger.json'), j('bindings/component-bindings.json'),
            j('reused.json'))


def main():
    d = Path(sys.argv[1])
    frames, tree, modules, rounds, ledger, bindings, reused = load(d)
    assert bindings['allBindingsHold'], 'bindings do not hold'
    assert all(r['nonDecreasing'] and r['maximumAt25'] for r in rounds.values()), 'M7 fails'
    # The token bodies term covers the call topology the reviewed bound assumed; the frames stage counts it.
    tb, tv = frames['Bank']['settleBetTokenCalls'], frames['LiquidityVault']['applySettlementTokenCalls']
    top = reused['token']['topology']
    assert tb['transferFrom'] == 0 and tb['transfersOfEitherKind'] <= 1 and tv['transfersOfEitherKind'] <= 1, (tb, tv)
    assert tb['balanceOf'] + tv['balanceOf'] <= top['loss']['balanceOf'], (tb, tv)
    assert tb['transfer'] + tv['transfer'] <= top['loss']['transfer'], (tb, tv)
    assert tv['balanceOfWith_transferFrom'] is None or (
        tb['balanceOf'] + tv['balanceOfWith_transferFrom'] <= top['profit']['balanceOf']), (tb, tv)
    k = bindings['sourceConstants']
    C = k['VRFHub']['MAX_CALLBACK_GAS']                                        # consumer gas at VRFHub entry
    R_VRF = k['VRFHub']['CALLBACK_COMPLETION_GAS'] + k['VRFHub']['CALL_OVERHEAD_GAS']   # VRFHub keeps 55,000
    R_OUTER = k['GameHub']['CALLBACK_COMPLETION_GAS']                          # GameHub outer keeps 25,000
    L = ledger['frameSplit']
    V = ledger['vaultFrame']
    f = frames
    outer = f['GameHub']['onRandomWords']
    vault_getters = ('getReserve', 'lockedLiquidity', 'MAX_TREE_CAPITAL')
    TERMS = {
        'tree': tree['maxTreeBodyWithSelectorRootWarm'],
        # Vault frame: own instructions + PositionApplied + six warm calls + storage + cold local slots.
        'vaultFrame': (f['LiquidityVault']['applySettlement_kPositive']['total'] + V['positionApplied']
                       + V['warmCalls'] + V['storageKPositive'] + V['coldLocalSlots']),
        'tokenBodies': reused['token']['jointCalleeBodyBound'],
        'bankOwn': max(v['total'] for v in f['Bank']['settleBet'].values()),
        'bankGetters': f['Bank']['minPlayerTurnoverForUnlock']['total'] + f['Bank']['playerTurnover']['total'],
        'engine': f['DefaultReferralEngine']['allocate']['total'],
        'childOwn': f['GameHub']['finalizeFromCallback']['total'],
        'outerOwn': outer['total'],                 # includes the snapshot-to-call and after-call instructions
        'vrfOwn': f['VRFHub']['rawFulfillRandomWords']['toStop'],
        'vrfQafter': f['VRFHub']['rawFulfillRandomWords']['afterStop'],
        'getRequest': f['VRFHub']['getRequest']['total'],
        'acknowledge': f['VRFHub']['acknowledge']['total'] + f['SettlementRouter']['getPosition']['total'],
        'routerOwn': max(v['total'] for v in f['SettlementRouter']['settlePosition'].values()),
        # Callee frames of the Vault getters Bank._requireAccounting calls; their slots are warm by then.
        'vaultGetters': sum(f['LiquidityVault'][g]['total'] for g in vault_getters),
        'bankSentry': SENTRY,
        'tokenSentries': TOKEN_TRANSFERS * SENTRY,
    }
    # Outer frame around the only-self child call: O = instructions after the gas snapshot up to the call plus the
    # warm self-call access; Qafter = instructions after the call plus the guard reset.
    O_OUTER = outer['snapshotToCall'] + 100
    Q_OUTER = outer['fromCall'] + 100
    MODULES = {'interpreter (main)': max(m['bound'] for m in modules.values()),
               'static (reviewed 2026-10-04, secondary)': max(reused['staticModuleBounds']['bounds25'].values())}

    def compose(module, explicit):
        t = TERMS
        u_vault = t['tree'] + t['vaultFrame'] + t['tokenBodies'] + L['accessRest'] + SENTRY
        extra = 0
        if explicit:
            extra += (u_vault - 1) // 63 + SENTRY        # Bank->Vault 1/64 retention and the Vault's own sentry
            extra += t['tokenBodies'] // 63              # >= sum over token calls of (U_i - 1) // 63
            extra += sum((f['LiquidityVault'][g]['total'] - 1) // 63 for g in vault_getters)
        U_bank = (t['bankOwn'] + L['bankStorage'] + L['bankFirstTouch'] + L['bankEvents'] + L['accessRest']
                  + t['tokenBodies'] + t['vaultFrame'] + t['tree'] + t['bankSentry'] + t['tokenSentries']
                  + t['vaultGetters'] + extra)
        R_router = (t['routerOwn'] + L['routerStorage'] + L['routerFirstTouch'] + L['routerToBankAccess']
                    + need(U_bank, Qafter=L['routerEventAfterBank']))
        child_pre = (t['childOwn'] + L['childStorage'] + L['gamehubFirstTouch'] + L['childAccessBeforeRouter']
                     + module + t['engine'] + t['bankGetters'])
        child_after = (t['acknowledge'] + L['ackStorageDirty'] + L['ackEvent'] + L['ackAccess']
                       + L['childEventsAfterRouter'])
        U_child = child_pre + need(R_router, Qafter=child_after)
        U_outer = (t['outerOwn'] + L['outerStorage'] + L['outerEvent'] + L['getRequestAccess'] + t['getRequest']
                   + need(U_child, R=R_OUTER))
        vrf_pre = t['vrfOwn'] + L['vrfStorageBeforeCall'] + L['vrfFirstTouch'] + L['vrfEventBeforeCall']
        vrf_after = L['vrfEventAfterCall'] + L['vrfGuardReset'] + t['vrfQafter']
        total = vrf_pre + need(U_outer, O=L['vrfCallAccess'], R=R_VRF, Qafter=vrf_after)

        # O1/O2: gas guaranteed when each storage-writing frame runs its last SSTORE. Bank emits every event after
        # the Vault call returns, pays the player after it and resets its guard last.
        q_after_vault = L['bankEvents'] + t['bankSentry'] + SENTRY
        o1 = {'uVault': u_vault, 'provisionAfterVaultCall': q_after_vault, 'retentionNeeded': (u_vault - 1) // 63,
              'vaultSpareAtEnd': (63 * q_after_vault - u_vault) // 64}
        o1['foldValid'] = o1['retentionNeeded'] <= q_after_vault
        o1['vaultSentryHolds'] = explicit or o1['vaultSpareAtEnd'] >= SENTRY
        ack_frame = t['acknowledge'] + L['ackStorageDirty'] + L['ackEvent'] + L['ackAccess']
        child_spare = (R_router - 1) // 63 - child_after if inv(R_router) >= R_router + child_after else 0
        o2 = {
            f'VRFHub ({R_VRF:,} reserve)': R_VRF - L['vrfCallAccess'] - vrf_after,
            f'GameHub outer ({R_OUTER:,} reserve)': R_OUTER - O_OUTER - Q_OUTER,
            'GameHub child (1/64 retained at the Router call)': child_spare,
            'VRFHub.acknowledge (called from the child after the Router returns)':
                ((R_router - 1) // 63 - child_after) * 63 // 64 - ack_frame,
            'SettlementRouter (1/64 retained at the Bank call)': (U_bank - 1) // 63 - L['routerEventAfterBank'] - t['routerOwn'],
            'Bank (explicit sentry term)': t['bankSentry'],
            'LiquidityVault': SENTRY if explicit else o1['vaultSpareAtEnd'],
            'token transfers (explicit sentry terms)': SENTRY,
        }
        o2ok = all(v >= SENTRY for v in o2.values())
        return {'U_vault': u_vault, 'explicitBoundaryCharges': extra, 'U_bank': U_bank, 'R_router': R_router,
                'childPre': child_pre, 'childAfterRouter': child_after, 'U_child': U_child, 'U_outer': U_outer,
                'vrfPre': vrf_pre, 'requirementAtConsumerEntry': total, 'consumerBudget': C, 'margin': C - total,
                'O1': o1, 'O2guaranteedGasAtLastSstore': o2, 'O2allAboveSentry': o2ok,
                'closes': C - total >= 0 and (explicit or o1['foldValid']) and o1['vaultSentryHolds'] and o2ok}

    rows = []
    for mname, mval in MODULES.items():
        for explicit in (True, False):
            r = compose(mval, explicit)
            r.update({'moduleMeasure': mname, 'moduleBound': mval,
                      'boundaryTreatment': 'explicit' if explicit else 'provisioned'})
            rows.append(r)
    main_row = rows[0]
    void_gas = k['GameHub']['VOID_SETTLEMENT_GAS']
    ok = main_row['closes'] and main_row['margin'] >= MARGIN_FLOOR and main_row['U_child'] <= void_gas
    out = {'status': 'CLOSES_PENDING_INDEPENDENT_REVIEW' if ok else 'DOES_NOT_CLOSE',
           'mainMeasure': 'interpreter module bound (unrolled, all params length classes, M7), explicit boundaries',
           'marginFloor': MARGIN_FLOOR,
           'voidSettlement': {'VOID_SETTLEMENT_GAS': void_gas, 'mainChildRequirement': main_row['U_child'],
                              'covers': main_row['U_child'] <= void_gas},
           'moduleBoundsByModule': {'interpreter': {m: v['bound'] for m, v in modules.items()},
                                    'static': reused['staticModuleBounds']['bounds25']},
           'domain': 'k > 0 casino positions; see script/release/first-callback-domain-84532.json',
           'reserves': {'consumerBudget': C, 'vrfHub': R_VRF, 'gameHubOuter': R_OUTER, 'outerO': O_OUTER,
                        'outerQafter': Q_OUTER},
           'tokenCalls': {'Bank.settleBet': tb, 'LiquidityVault.applySettlement': tv, 'covered': top},
           'terms': TERMS, 'ledgerSplit': L, 'measures': rows}
    (d / 'composition.json').write_text(json.dumps(out, indent=2) + '\n')
    for r in rows:
        print(f"{r['moduleMeasure']:42s} {r['boundaryTreatment']:12s} requirement={r['requirementAtConsumerEntry']:>9,} "
              f"margin={r['margin']:>+9,} O1fold={r['O1']['foldValid']} vaultSentry={r['O1']['vaultSentryHolds']} "
              f"O2={r['O2allAboveSentry']} closes={r['closes']}")
    print('status', out['status'])
    for name, v in main_row['O2guaranteedGasAtLastSstore'].items():
        print(f'  O2 {name:72s} {v:>8,}')
    print('  O1', main_row['O1'])
    if not ok:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
