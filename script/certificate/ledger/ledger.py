#!/usr/bin/env python3
"""Fixed ledger of the first-callback path: storage writes, first touches, events and account access, by frame.

    python3 ledger.py <build directory> <output json>

The frame bounds price SLOAD at 100, SSTORE, LOG and account access at 0 (frame_bound.py), so these charges are
priced here, once. The components are the reviewed 2026-10-04 ledger (callback-cost-certificate-2026-10-04/
protocol/fixed-components.py) and its frame split (takeover-2026-10-07/certificate/composition.py), with one change
for the launch candidate: Bank keeps a player's settled turnover and open-hold count in one slot (ADR-0037 §5).
Prices are full warm SSTORE costs without refunds (EIP-2200, EIP-2929, EIP-3529): 20,000 for zero to nonzero when
the slot is clean, 2,900 for any other clean write, 100 for a dirty or unchanged write, and 2,100 for the first
touch of a slot. Branch maxima are summed per component, so the envelope need not be jointly reachable.

Event prices come from the ABIs in the build (375 per topic and for the log, 8 per data byte; memory expansion is
in the frame bounds). The Vault rows are not in the split: the Vault frame term of the composition carries them
(VAULT_FRAME below, h1-callback-cost-certificate-2026-10-04/protocol/vault-frame-review.md).
"""
import json
import sys
from pathlib import Path

FRESH, CLEAN, DIRTY, FIRST_TOUCH = 20_000, 2_900, 100, 2_100

STORAGE = {
    'VRFHub': {'freshSeed': FRESH, 'requestStateReceiveThenAck': CLEAN + DIRTY,
               'unbookedCountIncrementThenAck': FRESH + DIRTY, 'guard': CLEAN + DIRTY},
    'GameHub': {'freshRandomHash': FRESH, 'stateReadyThenSettled': CLEAN + DIRTY, 'resolvedAtPackedTimestampWord': CLEAN,
                'twoPackedTerminalWordsTwoWritesEach': 2 * (FRESH + DIRTY), 'guard': CLEAN + DIRTY},
    'SettlementRouter': {'heldToSettledPackedEdgeStateWord': CLEAN},
    'Bank': {
        # totalTurnover, totalPayoutGross, totalPayoutNet, totalRefunded, totalProtocolFeeAccrued, totalBetsSettled:
        # each may still be zero before this settlement.
        'sixLifetimeStats': 6 * FRESH,
        # _players[player]: openHolds >= 1 while this hold is open, so the slot is nonzero when the transaction starts.
        # _applyHold decrements openHolds (clean write); the turnover update rewrites the same, now dirty, slot.
        'playerAccountOpenHoldsThenTurnover': CLEAN + DIRTY,
        'pendingStakeAndReservedNonzeroRelease': 2 * CLEAN,
        'holdOpenPackedWord': CLEAN,
        'protocolFeesPayableAtMostTwoMonotoneAdds': FRESH + DIRTY,
        'playerPayableAndTotalOnRefusedPayment': 2 * FRESH,
        'guardEntryAndReset': CLEAN + DIRTY,
        'L0Accrued': FRESH,
        'L1AndL2PerPayeeBranchEnvelope': 2 * max(80_300, 66_200),
        # L0 plus up to two eligible immediate awards and two old holdback releases.
        'globalXPAccruedAtMostFiveMonotoneWrites': FRESH + 4 * DIRTY,
        'globalXPLockedAtMostTwoMonotoneWrites': FRESH + DIRTY,
        # A fresh total implies no old positive holdback to release; an old total may return to its original value.
        'globalXPHoldbackFreshVersusOldReleaseEnvelope': max(FRESH + DIRTY, 4 * CLEAN),
    },
}
DISTINCT_KEYS = {'VRFHub': 10, 'GameHub': 23, 'SettlementRouter': 9, 'Bank': 34}
EVENTS = {
    'VRFHub': {'ResultReceived': 1, 'ResultAcknowledged': 1, 'CallbackAttempt': 1},
    'GameHub': {'BetRandomReady': 1, 'HouseEdgeAllocated': 1, 'BetFinalized': 1},
    'SettlementRouter': {'PositionSettled': 1},
    'Bank': {'BetReserveReleased': 1, 'ProtocolCapitalAccrued': 1, 'PlayerPayableCreated': 1, 'XPAwarded': 3,
             'XPHoldbackReleased': 2, 'BetSettled': 1},
    'LiquidityVault': {'PositionApplied': 1},
}
# Direct calls on the path: 28 at most (VRFHub 1, GameHub outer 2, child 6, acknowledge 1, Router 1, Bank 11, Vault 6),
# five EXTCODESIZE checks, and seven callee accounts that can be cold (GameHub, module, Bank, engine, Router, Vault,
# USDC proxy). VRFHub, the consumer, is warm when the wrapper calls it.
ACCESS = {'directCalls': 28, 'extcodesize': 5, 'newColdAccounts': 7}
ACCESS_GAS = 100 * (ACCESS['directCalls'] + ACCESS['extcodesize']) + 2_500 * ACCESS['newColdAccounts']
# Vault rows moved into the composition's Vault frame term: storage 9,000, four first touches 8,400, PositionApplied,
# six warm calls and the optional EXTCODESIZE (700). The frame term charges, for k > 0: lockedLiquidity release 2,900,
# guard 3,000 and two updateId increments 3,000 (8,900); four cold local slots at 2,000 above the warm 100 (8,000);
# PositionApplied; six warm calls (600). The token's EXTCODESIZE runs only when a call returns no data, which the
# pinned USDC never does.
VAULT_OLD_ROWS = 9_000 + 4 * FIRST_TOUCH + 700
VAULT_FRAME = {'storageKPositive': 8_900, 'coldLocalSlots': 8_000, 'warmCalls': 600}


def event_gas(abi, name):
    e = next(x for x in abi if x['type'] == 'event' and x['name'] == name)
    assert all(not i['type'].endswith(']') and i['type'] not in ('bytes', 'string') for i in e['inputs']), name
    topics = 1 + sum(i['indexed'] for i in e['inputs'])
    data = 32 * sum(not i['indexed'] for i in e['inputs'])
    return {'topics': topics, 'dataBytes': data, 'gasExcludingMemory': 375 * (1 + topics) + 8 * data}


def check_layout(build):
    """The Bank change rests on PlayerAccount being one slot holding both counters."""
    o = json.loads((build / 'Bank-solc-output.json').read_text())
    layout = o['contracts']['src/core/Bank.sol']['Bank']['storageLayout']
    labels = {s['label']: s for s in layout['storage']}
    assert '_playerTurnover' not in labels
    struct = layout['types'][layout['types'][labels['_players']['type']]['value']]
    members = {m['label']: (m['slot'], m['offset'], m['type']) for m in struct['members']}
    assert struct['numberOfBytes'] == '32' and members == {'turnover': ('0', 0, 't_uint248'),
                                                           'openHolds': ('0', 31, 't_uint8')}, members
    return {'players': labels['_players']['type'], 'struct': struct['label'], 'members': members}


def main():
    build, target = Path(sys.argv[1]), Path(sys.argv[2])
    sources = {'VRFHub': 'src/core/VRFHub.sol', 'GameHub': 'src/core/GameHub.sol',
               'SettlementRouter': 'src/core/SettlementRouter.sol', 'Bank': 'src/core/Bank.sol',
               'LiquidityVault': 'src/core/LiquidityVault.sol'}
    events = {}
    for name, counts in EVENTS.items():
        abi = json.loads((build / f'{name}-solc-output.json').read_text())['contracts'][sources[name]][name]['abi']
        rows = {e: {**event_gas(abi, e), 'countBound': n} for e, n in counts.items()}
        events[name] = {'events': rows, 'envelope': sum(r['countBound'] * r['gasExcludingMemory'] for r in rows.values())}
    storage = {name: {'components': c, 'envelope': sum(c.values()), 'distinctKeys': DISTINCT_KEYS[name],
                      'firstTouch': FIRST_TOUCH * DISTINCT_KEYS[name]} for name, c in STORAGE.items()}
    assert storage['Bank']['envelope'] == 436_000 and storage['VRFHub']['envelope'] == 46_100
    assert storage['GameHub']['envelope'] == 69_100 and ACCESS_GAS == 20_800
    ev = lambda c, e: events[c]['events'][e]['gasExcludingMemory']

    split = {
        'vrfStorageBeforeCall': FRESH + CLEAN + FRESH + CLEAN,   # fresh seed, state Received, unbooked++, guard entry
        'ackStorageDirty': DIRTY + DIRTY,                        # state Terminal, unbooked-- (dirty in this tx)
        'vrfGuardReset': DIRTY,
        'vrfFirstTouch': storage['VRFHub']['firstTouch'],
        'vrfEventBeforeCall': ev('VRFHub', 'ResultReceived'),
        'vrfEventAfterCall': ev('VRFHub', 'CallbackAttempt'),
        'ackEvent': ev('VRFHub', 'ResultAcknowledged'),
        'outerStorage': FRESH + CLEAN + CLEAN + DIRTY,           # randomHash, state RandomReady, guard entry and reset
        'outerEvent': ev('GameHub', 'BetRandomReady'),
        'childStorage': DIRTY + CLEAN + 2 * (FRESH + DIRTY),     # state Settled (dirty), resolvedAt word, terminal words
        'gamehubFirstTouch': storage['GameHub']['firstTouch'],   # all GameHub keys charged at the deeper child
        'childEventsAfterRouter': ev('GameHub', 'HouseEdgeAllocated') + ev('GameHub', 'BetFinalized'),
        'routerStorage': storage['SettlementRouter']['envelope'],
        'routerFirstTouch': storage['SettlementRouter']['firstTouch'],
        'routerEventAfterBank': ev('SettlementRouter', 'PositionSettled'),
        'bankStorage': storage['Bank']['envelope'],
        'bankFirstTouch': storage['Bank']['firstTouch'],
        'bankEvents': events['Bank']['envelope'],
        # Account access without the Vault's 700, split by caller frame.
        'vrfCallAccess': 2_600,                                  # VRFHub -> GameHub (cold)
        'getRequestAccess': 100,                                 # GameHub -> VRFHub.getRequest (warm)
        'childAccessBeforeRouter': 2_600 + 2_600 + 100 + 2_600 + 2_600,   # module, Bank getters (cold, warm), engine, Router
        'ackAccess': 100 + 100,                                  # child -> VRFHub.acknowledge, -> Router.getPosition
        'routerToBankAccess': 100,
    }
    split['accessRest'] = ACCESS_GAS - 700 - sum(split[k] for k in ['vrfCallAccess', 'getRequestAccess',
                                                                     'childAccessBeforeRouter', 'ackAccess',
                                                                     'routerToBankAccess'])
    assert split['accessRest'] >= 0
    assert split['vrfStorageBeforeCall'] + split['ackStorageDirty'] + split['vrfGuardReset'] == storage['VRFHub']['envelope']
    assert split['outerStorage'] + split['childStorage'] == storage['GameHub']['envelope']
    assert split['vrfEventBeforeCall'] + split['vrfEventAfterCall'] + split['ackEvent'] == events['VRFHub']['envelope']
    assert split['outerEvent'] + split['childEventsAfterRouter'] == events['GameHub']['envelope']
    subtotal = (sum(s['envelope'] + s['firstTouch'] for s in storage.values()) + 9_000 + 4 * FIRST_TOUCH
                + sum(e['envelope'] for e in events.values()) + ACCESS_GAS)
    assert sum(split.values()) == subtotal - VAULT_OLD_ROWS - ev('LiquidityVault', 'PositionApplied')
    out = {'prices': {'fresh': FRESH, 'clean': CLEAN, 'dirtyOrUnchanged': DIRTY, 'firstTouch': FIRST_TOUCH,
                      'refundsApplied': False},
           'storage': storage, 'events': events, 'access': {**ACCESS, 'gas': ACCESS_GAS},
           'bankPlayerAccountLayout': check_layout(build),
           'componentSubtotalWithVaultRows': subtotal, 'frameSplit': split, 'frameSplitTotal': sum(split.values()),
           'vaultFrame': {**VAULT_FRAME, 'positionApplied': ev('LiquidityVault', 'PositionApplied')},
           'changeFromCertificateV4': {'bankStorage': [453_000, storage['Bank']['envelope']],
                                       'reason': 'ADR-0037 §5 PlayerAccount slot: fresh turnover write 20,000 '
                                                 'becomes openHolds decrement 2,900 plus dirty turnover write 100'}}
    target.write_text(json.dumps(out, indent=2) + '\n')
    print(json.dumps({'componentSubtotalWithVaultRows': subtotal, 'frameSplitTotal': out['frameSplitTotal'],
                      'bankStorage': split['bankStorage'], 'bankEvents': split['bankEvents']}))


if __name__ == '__main__':
    main()
