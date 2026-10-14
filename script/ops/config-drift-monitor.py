#!/usr/bin/env python3
"""K0-4: push timelock operations, configuration drift and settlement anomalies of a release to the alert channels.

Every run works up to a confirmed block, the last one at least DRIFT_CONFIRMATION_SECONDS older than the chain head:

1. Event scan. One eth_getLogs per page reads every release contract: the GovernanceTimelock, PoolRegistry, GameHub,
   ReferralRegistry, SettlementRouter, VRFHub, each Bank and Vault, and the USDC proxy. Logs after the last delivered
   block are classified as
   - recertification triggers (ADR-0006 "Validity and recertification"): GameRegistered; MinBetAmountSet;
     PoolRegistered, and PoolActiveSet, HubRegistered or HubAllowedForPoolSet set to true; edge and referral changes;
     RiskReserveBpsSet and WithdrawalBufferBpsSet away from the Owner policy; USDC Upgraded and AdminChanged;
   - settlement anomalies: CallbackSettlementFailed, an undelivered CallbackAttempt, PositionApplied with released = 0
     (the k = 0 path), BetVoided, VoidWindowOpened, an issuer pause of USDC and a blacklisted Bank or Vault;
   - unbooked results: VRFHub's ResultReceived, ResultAcknowledged and ResultVoided, which move unbookedResultCount, and
     the void windows (step 7);
   - governance or authority changes: governance transfers, SentinelSet, GuardianSet, timelock roles and delay, pauses,
     GameDisabled, pools, hubs and routes set to false, the other Bank and GameHub setters and the one-shot wiring;
   - timelock operations: CallScheduled, CallExecuted and Cancelled.
   The events that the release's own wiring or activation emits as it executes are counted with that execution.
2. Timelock operations (ADR-0037 D5). Each scheduled call is decoded (target, function, arguments, value) with the
   operation's predecessor and delay. The operation is named as the release's declared wiring or activation or as
   undeclared, and its ready time comes from getTimestamp at the confirmed block. Open operations are kept in the
   state file: they are announced again DRIFT_READY_WARNING_SECONDS before they become ready, reminded every
   ALERT_REMIND_SECONDS while ready but unexecuted, and their execution or cancellation is reported.
3. Admission review (ADR-0037 D4) of every scheduled call against the domain file and the release snapshot:
   - registerPool: casino domain; the certified token; a Bank whose runtime is the certified Bank with its immutables
     zeroed, whose immutables hold that token, its decimals and the Bank's Vault (also read through vault()), whose
     minimum bet is at or above the certified floor, and which is bound to no SettlementRouter yet or to the release's
     with no randomness consumer other than the release VRFHub; a Vault with the certified runtime holding the token
     and the Bank;
   - setHubRegistered(true) and setHubAllowedForPool(true): a hub with the certified GameHub runtime whose immutables
     are the release's SettlementRouter, VRFHub, ReferralRegistry and referral engine; a hub other than the release's
     must also carry the release's house edge, referral schedule and refund timeout, with no edge change pending;
   - registerGame: a certified module codehash, a round limit within 1..maxBetCountCeiling, the certified callback gas;
   - one-shot wiring must name the release's contracts and setMinBetAmount must stay at or above the floor;
   - transferGovernance and acceptGovernance always fail: the first hands governance to someone who then acts without
     delay, the second adopts a contract (a hub with its own games, a Bank with its own router) whose earlier
     configuration nobody reviewed; any target, selector or argument the monitor cannot review fails as well.
   A failed review is the most severe alert and is reminded until the operation is cancelled or executed.
4. Live release verification (ADR-0037 §10), when RELEASE_PATH and GOVERNANCE_CHECKPOINT_PATH are set. The record's
   checkpointSha256 authenticates the checkpoint (verify_governance.load_checkpoint). A verification replays the
   authorization events after its starting checkpoint with verify_governance's own functions and judges the result
   with verify_permissions in live mode. The first starts from the signed checkpoint, later ones from the checkpoint
   the previous verification produced, so each replay covers only the blocks since. It runs every
   DRIFT_GOVERNANCE_CHECK_SECONDS, on arming and after any governance, recertification or operation event. A failure is
   pushed, reminded and cleared like a domain violation; changed notes (pauses, inactive pools, pending operations) are
   reported.
5. Certified domain check, every DRIFT_DOMAIN_CHECK_SECONDS, on arming and after a recertification trigger or an
   executed operation: USDC implementation and code; VRF wrapper, coordinator and gas parameters; module runtimes; each
   certified game's module, callback gas and round limit once the wiring has executed; each pool's minimum bet.
6. Capacity, every run: each Bank's openHolds() against DRIFT_OPEN_HOLDS_ALERT, because a rejected bet emits no log
   (ADR-0037 §5).
7. Unbooked results and voids (ADR-0037 §7.3 rule 4). A result that stays unbooked after the transaction that received
   it is kept in the state file, with its bet, hub and receipt time from VRFHub.getRequest and the block header and its
   vrfRequestedAt from GameHub.getBet (at most DRIFT_RESULT_READS_PER_RUN results are loaded per run, oldest first).
   Eligibility follows GameHub.voidBet: VOID_DELAY after the request for a bet in the cohort of a void window, not
   before the window opened, otherwise PUBLIC_VOID_DELAY after the request, and never before the result was received.
   Standing conditions: a result unbooked for DRIFT_UNBOOKED_ALERT_SECONDS; an eligible bet still unbooked
   DRIFT_VOID_ATTEMPT_SECONDS after it became eligible (any voidBet that runs either settles the bet or voids it,
   so an eligible bet that is still unbooked has had no attempt); and a VRFHub unbookedResultCount that differs from
   the tracked results, which covers results received before the monitor armed. One-shot alerts: every
   VoidWindowOpened, an unbooked result on the 7-day path DRIFT_PUBLIC_VOID_WARNING_SECONDS before it reaches 7 days,
   and an eligible bet that settles after a bet on the same path (same Bank, same window, or both by the 7-day limit)
   was voided.

Each run sends at most one message per channel. The event cursor and all alert state advance only after every
configured channel accepted its message, or when no channel is configured and the journal is the only sink; after a
failed delivery the next run sends the same findings again. Standing conditions (live verification failure, domain
violation, capacity) are pushed when they appear, reminded every ALERT_REMIND_SECONDS and cleared with a recovery
message. A failed run changes no state; after DRIFT_ALERT_AFTER_FAILURES consecutive failed runs the monitor reports
itself stalled, and later recovered. Timelock operations, admission reviews, void windows, bets settled after a void on
the same path and the stall and recovery notices also go to the public channel, without the host name.

Environment (config-drift-alert.sh sources ALERT_CONFIG_FILE first):
  SNAPSHOT_PATH                    release snapshot, latest-v16.json of the release bundle (required)
  RPC_URL                          HTTP JSON-RPC endpoint of the chain (required)
  CALLBACK_DOMAIN_PATH             certified domain file (default: first-callback-domain-<chainId>.json beside the
                                   verifiers)
  RELEASE_PATH                     signed release record, release-latest-v16.json; set with GOVERNANCE_CHECKPOINT_PATH
  GOVERNANCE_CHECKPOINT_PATH       the record's checkpoint, governance-checkpoint-latest-v16.json
  RELEASE_TOOLS_DIR                directory of verify_governance.py, verify_callback_provider.py and the domain file
                                   (default: this script's directory when they are there, else ../../script/release)
  DRIFT_STATE_FILE                 state file (default /var/lib/arbigamefi/config-drift.state.json)
  DRIFT_CONFIRMATION_SECONDS       age of the confirmed block below the head (24)
  DRIFT_MAX_BLOCKS_PER_RUN         blocks scanned per run (50000)
  DRIFT_DOMAIN_CHECK_SECONDS       domain check interval (3600)
  DRIFT_GOVERNANCE_CHECK_SECONDS   live verification interval (3600)
  DRIFT_READY_WARNING_SECONDS      warning before an operation becomes ready (43200)
  DRIFT_OPEN_HOLDS_ALERT           open holds of one Bank that raise the capacity alert (96, of 128)
  DRIFT_UNBOOKED_ALERT_SECONDS     age of an unbooked result that raises its alert (3600)
  DRIFT_PUBLIC_VOID_WARNING_SECONDS  warning before an unbooked result reaches 7 days (43200)
  DRIFT_VOID_ATTEMPT_SECONDS       time an eligible bet may stay unattempted (600)
  DRIFT_RESULT_READS_PER_RUN       unbooked results whose details are read per run (32)
  DRIFT_ALERT_AFTER_FAILURES       consecutive failed runs before the stall alert (3)
  ALERT_REMIND_SECONDS             reminder interval (21600)
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   ops channel, through alert-notify.py
  ALERT_WEBHOOK_URL                ops webhook: POST {"text": ...}, accepted on 2xx, redirects not followed
  TELEGRAM_PUBLIC_CHAT_ID          public channel of the same bot, for timelock operations, admission reviews and voids
  ALERT_PUBLIC_WEBHOOK_URL         public webhook for the same messages
  TELEGRAM_API_BASE                Telegram API base (default https://api.telegram.org)
  GOVERNANCE_LOG_PAGE_BLOCKS       blocks per eth_getLogs page (verify_governance; default: the provider's under
                                   with-ops-rpc.sh, Infura 10000, else 200)
  RPC_MAX_ATTEMPTS, RPC_BACKOFF_SECONDS   RPC retries (verify_governance.Rpc; defaults 6 and 1)
Nothing printed or delivered contains the RPC URL, a webhook URL or the bot token.
"""
import argparse
import copy
import functools
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
# In an install directory the release verifiers and the domain file sit next to this script; in the repository they
# live in script/release. RELEASE_TOOLS_DIR overrides both.
RELEASE_DIR = Path(os.environ.get('RELEASE_TOOLS_DIR')
                   or (HERE if (HERE / 'verify_governance.py').exists() else HERE.parents[1] / 'script/release'))
sys.path.insert(0, str(RELEASE_DIR))
from verify_governance import (  # noqa: E402
    CHECKPOINT_SCHEMA, GAMES, ZERO, Release, Rpc, VerificationError, address, call, checkpoint_document, data_words,
    decode_state, events, hex_word, last_block_at_or_before, load_checkpoint, quantity, replay, require, role,
    signature, verify_permissions, word)
from verify_callback_provider import verify_provider  # noqa: E402

NOTIFY = HERE / 'alert-notify.py'
STATE_SCHEMA = 'ARBIGAMEFI_CONFIG_DRIFT_STATE_V2'
RECORD_SCHEMA = 'SSOT_RELEASE_DIGEST_V16'
MAX_LINES = 40  # per event class; the rest is counted, not dropped silently
MAX_TEXT = 3500  # channel text, so that subject, body and alert-notify's host line stay under Telegram's 4096
MAX_OPEN_HOLDS = 128  # Bank.MAX_OPEN_HOLDS
DONE_TIMESTAMP = 1  # TimelockController.getTimestamp of an executed operation
OPERATION_STATES = ('unset', 'waiting', 'ready', 'done')  # TimelockController.OperationState
VOID_DELAY = 24 * 3600  # GameHub.VOID_DELAY: a bet in a void window's cohort is eligible this long after its request
PUBLIC_VOID_DELAY = 7 * 24 * 3600  # GameHub.PUBLIC_VOID_DELAY: any bet is eligible this long after its request
# Word positions in the static return tuples of VRFHub.getRequest (IVRFHub.RequestInfo) and GameHub.getBet
# (SSOTTypes.Bet); the tests check them against the sources.
REQUEST_WORDS, REQUEST_BANK, REQUEST_HUB, REQUEST_BET = 8, 0, 1, 2
BET_WORDS, BET_ID, BET_BANK, BET_REQUEST, BET_REQUESTED_AT = 26, 0, 4, 19, 23

GOVERNANCE = ('GovernanceTransferStarted(address,address)', 'GovernanceTransferred(address,address)')
SENTINEL = 'SentinelSet(address)'
SCHEDULED = 'CallScheduled(bytes32,uint256,address,uint256,bytes,bytes32,uint256)'
EXECUTED = 'CallExecuted(bytes32,uint256,address,uint256,bytes)'
CANCELLED = 'Cancelled(bytes32)'
RECEIVED = 'ResultReceived(uint256,address,uint256)'
ACKNOWLEDGED = 'ResultAcknowledged(uint256,address)'
VOIDED = 'ResultVoided(uint256,address)'
WINDOW = 'VoidWindowOpened(uint64,address,uint64,address)'
# The logs read from each kind of release contract. Every address is asked for all of them, so that a log a contract
# was not expected to emit is reported instead of failing the run.
EVENTS = {
    'timelock': (SCHEDULED, EXECUTED, CANCELLED, 'RoleGranted(bytes32,address,address)',
                 'RoleRevoked(bytes32,address,address)', 'RoleAdminChanged(bytes32,bytes32,bytes32)',
                 'MinDelayChange(uint256,uint256)'),
    'registry': ('PoolRegistered(uint64,address,address,uint8)', 'PoolActiveSet(uint64,bool)',
                 'HubRegistered(address,bool)', 'HubAllowedForPoolSet(uint64,address,bool)', SENTINEL) + GOVERNANCE,
    'hub': ('GameRegistered(bytes32,address,uint32,uint32)', 'GameDisabled(bytes32,address)', WINDOW,
            'BetVoided(uint256,address,uint256,bytes32)',
            'CallbackSettlementFailed(uint256,bytes32)', 'RefundTimeoutSet(uint256)',
            'EdgeChangeQueued(uint16,uint16,uint64)', 'EdgeChangeApplied(uint16,uint16)',
            'EdgeChangeCancelled(uint16,uint16)', 'ReferralConfigCreated(uint32,uint16,uint16,uint16,uint16)',
            'ActiveReferralConfigSet(uint32,uint32)', SENTINEL) + GOVERNANCE,
    'bank': ('MinBetAmountSet(uint256)', 'RiskReserveBpsSet(uint256)', 'WithdrawalBufferBpsSet(uint256)',
             'HoldbackVestingSecondsSet(uint256)', 'MinPlayerTurnoverForUnlockSet(uint256)', 'GuardianSet(address)',
             'RiskInPausedSet(bool,address)', 'SettlementRouterSet(address)', 'RandomnessConsumerSet(address)',
             SENTINEL) + GOVERNANCE,
    'referral': ('BinderSet(address)',) + GOVERNANCE,
    'router': ('RandomnessConsumerBound(address,address)',),
    # The result events mirror VRFHub.unbookedResultCount: received adds one, acknowledged or voided removes it.
    'vrfhub': ('CallbackAttempt(uint256,bool,uint8,bytes32)', RECEIVED, ACKNOWLEDGED, VOIDED),
    'vault': ('PositionApplied(uint48,uint128,uint128,uint128,uint128)',),
    # FiatTokenProxy upgrades and FiatToken issuer controls.
    'token': ('Upgraded(address)', 'AdminChanged(address,address)', 'Pause()', 'Unpause()', 'Blacklisted(address)',
              'UnBlacklisted(address)'),
}
WATCHED = tuple(sorted({name for names in EVENTS.values() for name in names}))
# The events that the release's wiring and activation emit as they execute.
FOLDED = {'BinderSet', 'SettlementRouterSet', 'RandomnessConsumerSet', 'RandomnessConsumerBound', 'GuardianSet',
          'SentinelSet', 'WithdrawalBufferBpsSet', 'MinPlayerTurnoverForUnlockSet', 'HoldbackVestingSecondsSet',
          'PoolRegistered', 'HubRegistered', 'HubAllowedForPoolSet', 'GameRegistered', 'PoolActiveSet'}

GOVERNABLE = ('registry', 'hub', 'bank', 'referral')
# Every governed function of ADR-0037 §3 and the timelock's own role and delay functions, with the kinds of contract
# that have them. Any other selector fails the review.
FUNCTIONS = {
    'transferGovernance(address)': GOVERNABLE,
    'acceptGovernance()': GOVERNABLE,
    'setSentinel(address)': ('registry', 'hub', 'bank'),
    'registerPool(uint64,address,address,uint8)': ('registry',),
    'setPoolActive(uint64,bool)': ('registry',),
    'setHubRegistered(address,bool)': ('registry',),
    'setHubAllowedForPool(uint64,address,bool)': ('registry',),
    'setRefundTimeout(uint256)': ('hub',),
    'queueEdgeChange(uint16)': ('hub',),
    'activateEdgeChange()': ('hub',),
    'cancelEdgeChange()': ('hub',),
    'createReferralConfig(uint16,uint16,uint16,uint16)': ('hub',),
    'setActiveReferralConfig(uint32)': ('hub',),
    'registerGame(bytes32,address,uint32,uint32)': ('hub',),
    'disableGame(bytes32)': ('hub',),
    'openVoidWindow(uint64)': ('hub',),
    'voidBet(uint256)': ('hub',),
    'setRiskInPaused(bool)': ('bank',),
    'setMinBetAmount(uint256)': ('bank',),
    'setRiskReserveBps(uint256)': ('bank',),
    'setWithdrawalBufferBps(uint256)': ('bank',),
    'setHoldbackVestingSeconds(uint256)': ('bank',),
    'setMinPlayerTurnoverForUnlock(uint256)': ('bank',),
    'setGuardian(address)': ('bank',),
    'rescueToken(address,address,uint256)': ('bank',),
    'claimProtocolFees(uint256,address)': ('bank',),
    'setSettlementRouterOnce(address)': ('bank',),
    'setRandomnessConsumerOnce(address)': ('bank',),
    'setBinderOnce(address)': ('referral',),
    'updateDelay(uint256)': ('timelock',),
    'grantRole(bytes32,address)': ('timelock',),
    'revokeRole(bytes32,address)': ('timelock',),
    'renounceRole(bytes32,address)': ('timelock',),
}
# Certified runtimes (coreRuntimes) that a governed call may target although the snapshot does not name them, such as
# the Bank of a new pool.
GOVERNED_RUNTIMES = (('bank', 'Bank'), ('hub', 'GameHub'), ('registry', 'PoolRegistry'),
                     ('referral', 'ReferralRegistry'), ('timelock', 'GovernanceTimelock'))
CLASS_TITLE = {
    'recertify': 'RECERTIFICATION TRIGGER (set the domain file back to PENDING until recertified)',
    'voidwindow': 'VOID WINDOW OPENED (the Bank\'s bets requested through the cohort end may be voided once 24 hours '
                  'old and still unbookable, ADR-0037 §7.3)',
    'settlement': 'SETTLEMENT ANOMALY',
    'governance': 'GOVERNANCE OR AUTHORITY CHANGE',
}
# Event classes that also go to the public channel: a void window is the operator's discretion that ADR-0037 R-5
# discloses, so LPs and players see it as it happens.
PUBLIC_CLASSES = frozenset({'voidwindow'})
GROUPS = ('governance', 'domain', 'capacity', 'unattempted', 'unbooked', 'untracked')
GROUP_TITLE = {
    'governance': 'LIVE RELEASE VERIFICATION FAILED (the deployed release no longer matches the signed release)',
    'domain': 'CERTIFIED DOMAIN VIOLATED (release verification would fail now)',
    'capacity': 'BANK CAPACITY (bets revert once a Bank holds 128 open positions)',
    'unattempted': ('ELIGIBLE BET NOT ATTEMPTED (anyone may void it; the operator\'s keeper attempts every eligible '
                    'bet in request order, ADR-0037 §7.3 rule 3)'),
    'unbooked': ('UNBOOKED RESULT OLDER THAN {threshold} (the Bank\'s LP deposits and withdrawals stay closed while '
                 'any result is unbooked)'),
    'untracked': 'UNBOOKED RESULTS NOT TRACKED (the VRFHub count differs from the results the monitor tracks)',
}
GROUP_RECOVERED = {
    'governance': 'Live release verification passes again; previously reported:',
    'domain': 'Certified domain restored; previously reported:',
    'capacity': 'Bank capacity is below the alert level again; previously reported:',
    'unattempted': 'Settled or voided since; previously reported as not attempted:',
    'unbooked': 'Booked or voided since; previously reported as unbooked:',
    'untracked': 'The VRFHub count matches the tracked results again; previously reported:',
}
PUBLIC_SUBJECT = 'ArbiGameFi governance timelock, chain {chain}'
PUBLIC_STALLED = ('The monitor that posts these alerts is failing. Until it recovers, operations scheduled on the '
                  'governance timelock are not announced here; read the timelock directly.')
PUBLIC_RESUMED = ('The monitor runs again. Operations scheduled while it was down are announced as it catches up.')
# Message sections in severity order.
ORDER = ('failed', 'group:governance', 'group:domain', 'group:unattempted', 'group:unbooked', 'voidorder', 'voidsoon',
         'recertify', 'armed', 'scheduled', 'soon', 'ready', 'executed', 'cancelled', 'voidwindow', 'settlement',
         'governance',
         'group:capacity', 'group:untracked', 'notes', 'recovered')


class RpcUnavailable(VerificationError):
    """An RPC request failed after its retries. The run fails and changes no state."""


class GuardedRpc:
    """Marks every failure of the underlying RPC, so that a verification never mistakes one for a finding."""

    def __init__(self, rpc):
        self.rpc = rpc

    def __call__(self, method, params):
        try:
            return self.rpc(method, params)
        except RpcUnavailable:
            raise
        except VerificationError as error:
            raise RpcUnavailable(str(error)) from None


def utc(timestamp):
    return time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime(timestamp))


def hours(seconds):
    return f'{seconds / 3600:.1f} h'


def as_address(value):
    require(0 <= value < 2**160, 'invalid address value')
    return '0x' + format(value, '040x')


@functools.lru_cache(maxsize=64)
def keccak(data):
    """Keccak-256 of 0x-prefixed bytes. The bytes go through stdin, so large runtimes stay off the command line."""
    result = subprocess.run(['cast', 'keccak'], input=data, capture_output=True, text=True, timeout=60)
    digest = result.stdout.strip().lower()
    require(result.returncode == 0 and re.fullmatch(r'0x[0-9a-f]{64}', digest) is not None, 'cast keccak failed')
    return digest


def setting(env, name, default, minimum=1):
    value = env.get(name, str(default)).strip()
    require(re.fullmatch(r'[0-9]+', value) is not None and int(value) >= minimum,
            f'{name} must be an integer of at least {minimum}')
    return int(value)


def argument_types(fn):
    return [kind for kind in fn[fn.index('(') + 1:-1].split(',') if kind]


class Names:
    """Readable names for the release's addresses, games, roles and declared operations."""

    def __init__(self, snap, domain, release):
        self.labels = {}
        for key, label in (('governanceTimelock', 'GovernanceTimelock'), ('poolRegistry', 'PoolRegistry'),
                           ('gameHub', 'GameHub'), ('refRegistry', 'ReferralRegistry'), ('refEngine', 'ReferralEngine'),
                           ('settlementRouter', 'SettlementRouter'), ('vrfHub', 'VRFHub'),
                           ('vrfWrapper', 'VRF wrapper'),
                           ('gov', 'Safe'), ('guardian', 'guardian'), ('treasury', 'treasury'), ('keeper', 'keeper'),
                           ('deployer', 'deployer'), ('releaseSigner', 'release signer')):
            self._put(snap.get(key), label)
        for _, key in GAMES:
            self._put(snap.get(key), key)
        for pool, (_, bank, _) in release.pools.items():
            self._put(bank, f'Bank pool {pool}')
            self._put(release.vaults[bank], f'Vault pool {pool}')
        self._put(domain['token']['proxy'], 'USDC')
        self.games = {word(signature(name)): name for name, _ in GAMES}
        self.roles = {word(role(name)): name for name in
                      ('DEFAULT_ADMIN_ROLE', 'PROPOSER_ROLE', 'CANCELLER_ROLE', 'EXECUTOR_ROLE')}
        self.operations = {release.wiring: 'release wiring', release.activation: 'release activation'}

    def _put(self, value, label):
        if isinstance(value, str) and re.fullmatch(r'0x[0-9a-fA-F]{40}', value) and int(value, 16):
            self.labels.setdefault(value.lower(), label)

    def address(self, value):
        return self.labels.get(value, value)

    def thing(self, kind, value):
        """'Bank pool 1' for a release contract, 'Bank 0x...' for any other address."""
        label = self.labels.get(value)
        return label if label else f'{kind} {value}'

    def game(self, value):
        return self.games.get(value, hex_word(value))

    def role(self, value):
        return self.roles.get(value, hex_word(value))

    def operation(self, op):
        return self.operations.get(op, 'undeclared')


class Config:
    def __init__(self, env):
        self.snapshot = json.loads(Path(env['SNAPSHOT_PATH']).read_text())
        require(self.snapshot['architectureVersion'] == 'v1.6-nft-liquidity', 'unsupported release architecture')
        self.release = Release(self.snapshot)
        self.chain = self.snapshot['chainId']
        domain_path = env.get('CALLBACK_DOMAIN_PATH') or str(RELEASE_DIR / f'first-callback-domain-{self.chain}.json')
        self.domain = json.loads(Path(domain_path).read_text())
        require(self.domain['chainId'] == self.chain, 'domain file is for another chain')
        require(all(key in self.domain for key in ('coreRuntimes', 'moduleCodeHashes', 'consumerCallbackGasLimit',
                                                   'maxBetCountCeiling', 'casinoMinBetAmountFloor', 'ownerPolicy',
                                                   'token', 'providerReference')),
                'domain file lacks the admission review inputs')
        require(all(type(self.snapshot.get(key)) is int for key in (
            'defaultHouseEdgeBps', 'refundTimeoutSeconds', 'refL0Bps', 'refL1Bps', 'refL2Bps', 'refHoldbackBps')),
            'snapshot lacks the release parameters')
        self.rpc_url = env['RPC_URL']
        self.state_file = Path(env.get('DRIFT_STATE_FILE', '/var/lib/arbigamefi/config-drift.state.json'))
        self.confirmation_seconds = setting(env, 'DRIFT_CONFIRMATION_SECONDS', 24, 0)
        self.max_blocks = setting(env, 'DRIFT_MAX_BLOCKS_PER_RUN', 50000)
        self.domain_interval = setting(env, 'DRIFT_DOMAIN_CHECK_SECONDS', 3600, 0)
        self.governance_interval = setting(env, 'DRIFT_GOVERNANCE_CHECK_SECONDS', 3600, 0)
        self.warning_seconds = setting(env, 'DRIFT_READY_WARNING_SECONDS', 43200, 0)
        self.holds_alert = setting(env, 'DRIFT_OPEN_HOLDS_ALERT', 96)
        self.after_failures = setting(env, 'DRIFT_ALERT_AFTER_FAILURES', 3)
        self.remind_seconds = setting(env, 'ALERT_REMIND_SECONDS', 21600, 0)
        self.unbooked_seconds = setting(env, 'DRIFT_UNBOOKED_ALERT_SECONDS', 3600)
        self.public_void_warning = setting(env, 'DRIFT_PUBLIC_VOID_WARNING_SECONDS', 43200, 0)
        self.attempt_seconds = setting(env, 'DRIFT_VOID_ATTEMPT_SECONDS', 600)
        self.result_reads = setting(env, 'DRIFT_RESULT_READS_PER_RUN', 32)
        require(self.holds_alert <= MAX_OPEN_HOLDS, 'DRIFT_OPEN_HOLDS_ALERT exceeds the Bank limit of 128')
        token = env.get('TELEGRAM_BOT_TOKEN', '').strip()
        self.telegram = bool(token and env.get('TELEGRAM_CHAT_ID', '').strip())
        self.webhook = env.get('ALERT_WEBHOOK_URL', '').strip()
        self.public_chat = env.get('TELEGRAM_PUBLIC_CHAT_ID', '').strip() if token else ''
        self.public_webhook = env.get('ALERT_PUBLIC_WEBHOOK_URL', '').strip()
        record_path = env.get('RELEASE_PATH', '').strip()
        checkpoint_path = env.get('GOVERNANCE_CHECKPOINT_PATH', '').strip()
        require(bool(record_path) == bool(checkpoint_path),
                'RELEASE_PATH and GOVERNANCE_CHECKPOINT_PATH must be set together')
        self.checkpoint = self.checkpoint_sha256 = None
        if record_path:
            record = json.loads(Path(record_path).read_text())
            require(isinstance(record, dict) and record.get('schema') == RECORD_SCHEMA
                    and record.get('chainId') == self.chain
                    and record.get('blockNumber') == self.snapshot['blockNumber'],
                    'release record belongs to another release')
            self.checkpoint_sha256 = str(record.get('checkpointSha256', '')).lower().removeprefix('0x')
            checkpoint = load_checkpoint(checkpoint_path, self.checkpoint_sha256)
            require(checkpoint.get('schema') == CHECKPOINT_SCHEMA and checkpoint.get('chainId') == self.chain
                    and checkpoint.get('historyStart') == self.release.start
                    and checkpoint.get('governanceTimelock') == self.release.timelock
                    and checkpoint.get('poolRegistry') == self.release.registry
                    and checkpoint.get('gameHub') == self.release.hub, 'checkpoint belongs to another release')
            number = checkpoint.get('blockNumber')
            require(type(number) is int and number >= self.release.start
                    and number == record.get('checkpointBlockNumber')
                    and str(checkpoint.get('blockHash', '')).lower()
                    == str(record.get('checkpointBlockHash', '')).lower(),
                    'checkpoint differs from the release record')
            decode_state(checkpoint.get('state'))
            self.checkpoint = checkpoint
        self.names = Names(self.snapshot, self.domain, self.release)
        self.watch = watch_list(self)


def watch_list(config):
    """{address: contract kind} of every contract whose logs the monitor reads."""
    snap, release = config.snapshot, config.release
    targets = {release.timelock: 'timelock', release.registry: 'registry', release.hub: 'hub',
               release.referral: 'referral', address(snap['settlementRouter']): 'router',
               address(snap['vrfHub']): 'vrfhub', address(config.domain['token']['proxy']): 'token'}
    for bank in release.banks:
        targets[bank] = 'bank'
        targets[release.vaults[bank]] = 'vault'
    require(ZERO not in targets and len(targets) == 7 + 2 * len(release.banks), 'duplicate or missing release contract')
    return targets


def certified_runtime(spec, code):
    """(reason, immutables). The reason is None when `code` is the certified runtime of the coreRuntimes entry `spec`;
    the immutables then map each immutable's name to its value, which every slot of that name must hold."""
    runtime = bytearray.fromhex(code[2:])
    if not runtime:
        return 'has no code', {}
    if len(runtime) != spec['runtimeBytes']:
        return f'runtime is {len(runtime)} bytes, not the certified {spec["runtimeBytes"]}', {}
    values = {}
    for item in spec.get('immutables') or []:
        for at in item['offsets']:
            if at + 32 > len(runtime):
                return 'runtime is not the certified code', {}
            value = int.from_bytes(runtime[at:at + 32], 'big')
            if values.setdefault(item['value'], value) != value:
                return f'immutable {item["value"]} differs between its slots', {}
            runtime[at:at + 32] = bytes(32)
    if keccak('0x' + runtime.hex()) != spec['keccakWithImmutablesZeroed'].lower():
        return 'runtime is not the certified code', {}
    return None, values


class Context:
    """The reads of one run at the confirmed block; the code of each address is fetched once."""

    def __init__(self, config, rpc, block):
        self.config, self.rpc, self.block = config, rpc, block
        self.snap, self.domain, self.names, self.release = config.snapshot, config.domain, config.names, config.release
        self._code, self._runtimes, self._times = {}, {}, {}

    def time(self, number):
        """The timestamp of block `number`."""
        if number not in self._times:
            head = self.rpc('eth_getBlockByNumber', [hex(number), False])
            require(isinstance(head, dict) and quantity(head.get('number')) == number, 'invalid block response')
            self._times[number] = quantity(head.get('timestamp'))
        return self._times[number]

    def code(self, target):
        target = address(target)
        if target not in self._code:
            code = self.rpc('eth_getCode', [target, hex(self.block)])
            require(isinstance(code, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{2})*', code) is not None,
                    'invalid eth_getCode response')
            self._code[target] = code.lower()
        return self._code[target]

    def runtime(self, name, target):
        key = (name, address(target))
        if key not in self._runtimes:
            spec = self.domain['coreRuntimes'].get(name)
            self._runtimes[key] = (certified_runtime(spec, self.code(target)) if spec
                                   else (f'the domain file pins no {name} runtime', {}))
        return self._runtimes[key]

    def operation_state(self, op):
        value = call(self.rpc, self.release.timelock, 'getOperationState(bytes32)', [op], self.block)
        require(value < len(OPERATION_STATES), 'invalid timelock operation state')
        return OPERATION_STATES[value]


class Report:
    """The sections of one run's message; operation and void sections also go to the public channel."""

    def __init__(self):
        self.sections = []

    def add(self, order, title, lines, public=False):
        lines = [line for line in lines if line]
        if lines:
            self.sections.append((ORDER.index(order), len(self.sections), title, lines, public))

    def text(self, public=False, limit=None):
        sections = [(title, lines) for _, _, title, lines, shared in sorted(self.sections) if shared or not public]
        full = '\n\n'.join('\n'.join([title] + lines) for title, lines in sections)
        if limit is None or len(full) <= limit:
            return full
        budget, parts, used, omitted = limit - 100, [], 0, 0
        for title, lines in sections:
            gap = 2 if parts else 0
            if used + gap + len(title) > budget:
                omitted += len(lines)
                continue
            block, size = [title], used + gap + len(title)
            for i, line in enumerate(lines):
                if size + 1 + len(line) > budget:
                    omitted += len(lines) - i
                    break
                block.append(line)
                size += 1 + len(line)
            parts.append('\n'.join(block))
            used = size
        return '\n\n'.join(parts) + (f'\n\n... {omitted} more line(s) not shown; the monitor journal has the full '
                                     'message')


# ---- event classification ------------------------------------------------------------------------------------------

def fields(row):
    """The indexed values after the event topic and the data words of a log."""
    topics = row.get('topics')
    require(isinstance(topics, list) and topics, 'invalid log topics')
    return [word(topic) for topic in topics[1:]], data_words(row)


def need(values, count):
    require(len(values) >= count, 'invalid log fields')
    return values[:count] if count > 1 else values[0]


def flag(value):
    require(value in (0, 1), 'invalid log boolean')
    return bool(value)


def describe(ctx, name, row):
    """(class, text) for one log of a release contract, or None when it is routine."""
    short = name.split('(')[0]
    ind, dat = fields(row)
    n, snap, domain, release = ctx.names, ctx.snap, ctx.domain, ctx.release
    policy = domain['ownerPolicy']
    if short == 'GovernanceTransferStarted':
        old, new = (as_address(v) for v in need(ind, 2))
        return 'governance', (f'CRITICAL GovernanceTransferStarted from {n.address(old)} to {n.address(new)}: once it '
                              'accepts, the new governance acts without the timelock')
    if short == 'GovernanceTransferred':
        old, new = (as_address(v) for v in need(ind, 2))
        if old == ZERO and new == release.timelock:
            return 'governance', 'GovernanceTransferred to the GovernanceTimelock (construction)'
        return 'governance', f'CRITICAL GovernanceTransferred from {n.address(old)} to {n.address(new)}'
    if short == 'SentinelSet':
        sentinel = as_address(need(ind, 1))
        return 'governance', f'SentinelSet {n.address(sentinel)}' + (
            '' if sentinel == release.safe else ' (not the Safe)')
    if short == 'GuardianSet':
        guardian = as_address(need(ind, 1))
        return 'governance', f'GuardianSet {n.address(guardian)}' + (
            '' if guardian == release.guardian else ' (not the release guardian)')
    if short in ('RoleGranted', 'RoleRevoked'):
        role_id, account, sender = need(ind, 3)
        account = as_address(account)
        released = account in release.roles.get(hex_word(role_id), set())
        granted = short == 'RoleGranted'
        note = (' (a release role)' if released else ' (not a release role)') if granted else (
            ' (removes a release role)' if released else '')
        return 'governance', (f'{short} {n.role(role_id)} {"to" if granted else "from"} {n.address(account)} by '
                              f'{n.address(as_address(sender))}{note}')
    if short == 'RoleAdminChanged':
        role_id, previous, new = need(ind, 3)
        return 'governance', f'RoleAdminChanged {n.role(role_id)}: admin {n.role(previous)} -> {n.role(new)}'
    if short == 'MinDelayChange':
        old, new = need(dat, 2)
        return 'governance', f'MinDelayChange {old} -> {new} s' + (' (construction)' if old == 0 else '')
    if short == 'PoolRegistered':
        pool, asset, bank = need(ind, 3)
        return 'recertify', (f'PoolRegistered pool {pool}, asset {n.address(as_address(asset))}, '
                             f'Bank {n.address(as_address(bank))}, domain {need(dat, 1)}')
    if short == 'PoolActiveSet':
        if flag(need(dat, 1)):
            return 'recertify', f'PoolActiveSet pool {need(ind, 1)} -> True (admits or reactivates the pool)'
        return 'governance', f'PoolActiveSet pool {need(ind, 1)} -> False'
    if short == 'HubRegistered':
        registered = flag(need(dat, 1))
        return ('recertify' if registered else 'governance',
                f'HubRegistered {n.address(as_address(need(ind, 1)))} -> {registered}')
    if short == 'HubAllowedForPoolSet':
        pool, hub = need(ind, 2)
        allowed = flag(need(dat, 1))
        return ('recertify' if allowed else 'governance',
                f'HubAllowedForPoolSet pool {pool} {n.address(as_address(hub))} -> {allowed}')
    if short == 'GameRegistered':
        game_id, module = need(ind, 2)
        count, gas = need(dat, 2)
        flags = ((', round limit outside the certified range' if not 1 <= count <= domain['maxBetCountCeiling']
                  else '')
                 + (', callback gas is not the certified value' if gas != domain['consumerCallbackGasLimit'] else ''))
        return 'recertify', (f'GameRegistered {n.game(game_id)} module {n.address(as_address(module))} maxBetCount '
                             f'{count} callbackGasLimit {gas}{flags}')
    if short == 'GameDisabled':
        game_id, caller = need(ind, 2)
        return 'governance', f'GameDisabled {n.game(game_id)} by {n.address(as_address(caller))}'
    if short == 'VoidWindowOpened':
        pool, bank, caller = need(ind, 3)
        return 'voidwindow', (f'VoidWindowOpened pool {pool} ({n.address(as_address(bank))}) for bets requested '
                              f'through {utc(need(dat, 1))} by {n.address(as_address(caller))}')
    if short == 'BetVoided':
        position, caller = need(ind, 2)
        stake, prefix = need(dat, 2)
        return 'settlement', (f'BetVoided position {position} by {n.address(as_address(caller))}: stake {stake} '
                              f'refunded as a player payable, settlement error prefix {hex_word(prefix)}')
    if short == 'CallbackSettlementFailed':
        return 'settlement', (f'CallbackSettlementFailed: position {need(ind, 1)}, error prefix '
                              f'{hex_word(need(dat, 1))}')
    if short == 'CallbackAttempt':
        delivered, state, prefix = need(dat, 3)
        if flag(delivered):
            return None
        return 'settlement', (f'CallbackAttempt not delivered: request {need(ind, 1)}, state {state}, failure '
                              f'{hex_word(prefix)}')
    if short == 'PositionApplied':
        released, stake, cost = need(dat, 3)
        if released != 0:
            return None
        return 'settlement', (f'PositionApplied with released = 0 (k = 0 path, outside the certified domain): cutoff '
                              f'{need(ind, 1)}, stake {stake}, cost {cost}')
    if short == 'MinBetAmountSet':
        value, floor = need(dat, 1), domain['casinoMinBetAmountFloor']
        text = f'MinBetAmountSet {value}' + (f' BELOW the certified floor {floor}' if value < floor else '')
        return 'recertify', text + ('' if value == policy['casinoMinBetAmount']
                                    else f' (Owner policy {policy["casinoMinBetAmount"]})')
    if short in ('RiskReserveBpsSet', 'WithdrawalBufferBpsSet'):
        value = need(dat, 1)
        expected = policy['riskReserveBps' if short == 'RiskReserveBpsSet' else 'withdrawalBufferBps']
        if value == expected:
            return 'governance', f'{short} {value}'
        return 'recertify', f'{short} {value} (Owner policy {expected})'
    if short == 'RiskInPausedSet':
        return 'governance', f'RiskInPausedSet -> {flag(need(dat, 1))} by {n.address(as_address(need(ind, 1)))}'
    if short in ('SettlementRouterSet', 'RandomnessConsumerSet', 'BinderSet'):
        expected = address(snap[{'SettlementRouterSet': 'settlementRouter', 'RandomnessConsumerSet': 'vrfHub',
                                 'BinderSet': 'gameHub'}[short]])
        value = as_address(need(ind, 1))
        return 'governance', f'{short} {n.address(value)}' + (
            '' if value == expected else ' (not the release contract)')
    if short == 'RandomnessConsumerBound':
        bank, consumer = need(ind, 2)
        return 'governance', (f'RandomnessConsumerBound {n.address(as_address(bank))} -> '
                              f'{n.address(as_address(consumer))}')
    if short in ('Upgraded', 'AdminChanged', 'Blacklisted', 'UnBlacklisted'):
        values = [as_address(v) for v in ind + dat]
        if short == 'Upgraded':
            implementation = need(values, 1)
            certified = implementation == address(domain['token']['implementation'])
            return 'recertify', f'Upgraded to {implementation}' + (
                ' (the certified implementation)' if certified else ' (not the certified implementation)')
        if short == 'AdminChanged':
            return 'recertify', 'AdminChanged ' + ' -> '.join(values)
        account = need(values, 1)
        if ctx.config.watch.get(account) not in ('bank', 'vault'):
            return None
        return 'settlement', f'{short} {n.address(account)}' + (
            ': its USDC transfers fail; treat the freeze as transient for at most 7 days (ADR-0037 §7.3 rule 1)'
            if short == 'Blacklisted' else '')
    if short == 'Pause':
        return 'settlement', ('paused by the issuer: transfers fail; deactivate the pool or pause the Bank and open no '
                              'void window (ADR-0037 §7.3 rule 1)')
    if short == 'Unpause':
        return 'settlement', 'unpaused by the issuer'
    if short in ('HoldbackVestingSecondsSet', 'MinPlayerTurnoverForUnlockSet', 'RefundTimeoutSet'):
        return 'governance', f'{short} {need(dat, 1)}'
    if short == 'EdgeChangeQueued':
        old, new, at = need(dat, 3)
        return 'recertify', f'EdgeChangeQueued {old} -> {new} bps, activates at {utc(at)}'
    if short == 'EdgeChangeApplied':
        old, new = need(dat, 2)
        return 'recertify', f'EdgeChangeApplied {old} -> {new} bps'
    if short == 'EdgeChangeCancelled':
        active, cancelled = need(dat, 2)
        return 'governance', f'EdgeChangeCancelled {cancelled} bps (the edge stays {active})'
    if short == 'ReferralConfigCreated':
        return 'recertify', f'ReferralConfigCreated {need(ind, 1)}: ' + ' '.join(str(v) for v in need(dat, 4))
    if short == 'ActiveReferralConfigSet':
        old, new = need(dat, 2)
        return 'recertify', f'ActiveReferralConfigSet {old} -> {new}'
    raise VerificationError(f'no description for {name}')


def scan(ctx, rows):
    """Split the scanned logs into timelock operation events, findings (class, block, log index, text) and the result
    and void-window logs that track unbooked results. The events that a transaction executing only the release's
    declared operations emits are counted per transaction instead."""
    release, watch = ctx.release, ctx.config.watch
    declared = {release.wiring, release.activation}
    executions = {}
    for target, name, row in rows:
        if watch[target] == 'timelock' and name == EXECUTED:
            require(len(row['topics']) == 3, 'invalid timelock operation log')
            executions.setdefault(row.get('transactionHash'), set()).add(hex_word(word(row['topics'][1])))
    release_txs = {tx for tx, ops in executions.items() if ops <= declared}
    operations, findings, folded, results = [], [], {}, []
    for target, name, row in rows:
        kind = watch[target]
        if kind == 'timelock' and name in (SCHEDULED, EXECUTED, CANCELLED):
            operations.append((name, row))
            continue
        if kind == 'vrfhub' and name in (RECEIVED, ACKNOWLEDGED, VOIDED):
            results.append((name, row))
            continue
        if kind == 'hub' and name == WINDOW:
            results.append((name, row))
        tx = row.get('transactionHash')
        if tx in release_txs and kind != 'token' and name.split('(')[0] in FOLDED:
            folded[tx] = folded.get(tx, 0) + 1
            continue
        if name in EVENTS[kind]:
            found = describe(ctx, name, row)
        else:
            ind, dat = fields(row)
            found = 'governance', f'unexpected {name} from this contract: ' + ' '.join(hex_word(v) for v in ind + dat)
        if found:
            block = quantity(row['blockNumber'])
            findings.append((found[0], block, quantity(row['logIndex']),
                             f'{ctx.names.address(target)}: {found[1]} (block {block}, tx {tx})'))
    return operations, findings, folded, results


def add_findings(report, findings, cls, start, end):
    lines = [text for severity, _, _, text in sorted(findings, key=lambda f: (f[1], f[2])) if severity == cls]
    shown = ['- ' + line for line in lines[:MAX_LINES]]
    if len(lines) > MAX_LINES:
        shown.append(f'- ... and {len(lines) - MAX_LINES} more in blocks {start}-{end}')
    report.add(cls, CLASS_TITLE[cls], shown, public=cls in PUBLIC_CLASSES)


# ---- timelock operations and admission review ------------------------------------------------------------------------

def abi_bytes(data, offset):
    require(offset % 32 == 0, 'invalid ABI offset')
    start = 2 + 2 * offset
    require(len(data) >= start + 64, 'invalid ABI bytes')
    length = int(data[start:start + 64], 16)
    body = data[start + 64:start + 64 + 2 * length]
    require(len(body) == 2 * length, 'invalid ABI bytes')
    return '0x' + body.lower()


def operation_event(name, row):
    """(id, index, target, value, call data, predecessor, delay) of a CallScheduled or CallExecuted log."""
    topics = row['topics']
    require(len(topics) == 3, 'invalid timelock operation log')
    scheduled = name == SCHEDULED
    words = data_words(row, 6 if scheduled else 4)
    return (hex_word(word(topics[1])), word(topics[2]), as_address(words[0]), words[1],
            abi_bytes(row['data'], words[2]), hex_word(words[3]) if scheduled else None,
            words[4] if scheduled else None)


_SELECTORS = {}


def function_for(selector):
    if not _SELECTORS:
        _SELECTORS.update({signature(fn)[:10]: fn for fn in FUNCTIONS})
    return _SELECTORS.get(selector)


def decode_arguments(fn, calldata):
    """The argument values of a static-argument call, or None when the data does not decode as `fn`."""
    types = argument_types(fn)
    body = calldata[10:]
    if len(body) < 64 * len(types):
        return None
    values = []
    for i, kind in enumerate(types):
        value = int(body[64 * i:64 * i + 64], 16)
        bits = re.fullmatch(r'uint(\d+)', kind)
        if (kind == 'address' and value >= 2**160) or (kind == 'bool' and value > 1) or (
                bits and value >= 2**int(bits.group(1))):
            return None
        values.append(as_address(value) if kind == 'address' else bool(value) if kind == 'bool' else value)
    return values


def render_argument(names, fn, kind, value, position):
    if kind == 'address':
        return names.address(value)
    if kind == 'bool':
        return 'true' if value else 'false'
    if kind == 'bytes32':
        return names.game(value) if fn.split('(')[0] in ('registerGame', 'disableGame') else names.role(value)
    if fn.startswith('registerPool(') and position == 3:
        return 'casino' if value == 1 else f'domain {value}'
    return str(value)


class Call:
    """One decoded call of a timelock operation. Problems fail the admission review; notes only inform."""

    def __init__(self, ctx, target, value, calldata):
        self.target, self.value, self.calldata = target, value, calldata
        self.problems, self.notes, self.fn, self.args = [], [], None, []
        self.kind, self.label = ctx.config.watch.get(target), ctx.names.address(target)
        if self.kind is None:
            if ctx.code(target) == '0x':
                self.problems.append('the target has no code: not reviewed')
            else:
                for kind, name in GOVERNED_RUNTIMES:
                    if name in ctx.domain['coreRuntimes'] and ctx.runtime(name, target)[0] is None:
                        self.kind, self.label = kind, f'new {name} {target}'
                        break
                else:
                    self.problems.append('the target is neither a release contract nor a certified runtime: not '
                                         'reviewed')
        selector = calldata[:10] if len(calldata) >= 10 else None
        fn = function_for(selector) if selector else None
        if fn is None:
            self.text = f'{self.label}.<unknown selector {selector or calldata}>'
            self.problems.append(f'unknown function selector {selector or "(none)"}: not reviewed')
            return
        if self.kind is not None and self.kind not in FUNCTIONS[fn]:
            self.text = f'{self.label}.{fn}'
            self.problems.append(f'{fn} is not a governed function of {self.label}: not reviewed')
            return
        args = decode_arguments(fn, calldata)
        name = fn.split('(')[0]
        if args is None:
            self.text = f'{self.label}.{name}(<undecodable>)'
            self.problems.append(f'the call data does not decode as {fn}: not reviewed')
            return
        types = argument_types(fn)
        self.fn, self.args = fn, args
        self.text = f'{self.label}.{name}(' + ', '.join(
            render_argument(ctx.names, fn, kind, value, i) for i, (kind, value) in enumerate(zip(types, args))) + ')'
        if len(calldata) > 10 + 64 * len(types):
            self.notes.append('extra call data after the arguments')

    def entry(self, index):
        return {'line': f'{index}. {self.text}', 'problems': self.problems, 'notes': self.notes}


def call_words(ctx, target, fn, args, count):
    data = signature(fn)[:10] + ''.join(format(value, '064x') for value in args)
    result = ctx.rpc('eth_call', [{'to': target, 'data': data}, hex(ctx.block)])
    require(isinstance(result, str) and re.fullmatch(r'0x(?:[0-9a-fA-F]{64})+', result) is not None
            and len(result) >= 2 + 64 * count, f'invalid {fn} result')
    return [int(result[2 + 64 * i:66 + 64 * i], 16) for i in range(count)]


def check_hub(ctx, hub, problems):
    """setHubRegistered(true) and setHubAllowedForPool(true): the certified GameHub wired to the release. A hub other
    than the release's must also carry the release's edge, referral schedule and refund timeout, which its constructor
    set (ADR-0006 counts edge and referral changes as recertification triggers)."""
    reason, values = ctx.runtime('GameHub', hub)
    label = ctx.names.thing('hub', hub)
    if reason:
        problems.append(f'{label}: {reason}')
        return
    for immutable, key in (('settlementRouter', 'settlementRouter'), ('vrfHub', 'vrfHub'),
                           ('refRegistry', 'refRegistry'), ('refEngine', 'refEngine')):
        expected = address(ctx.snap[key])
        if values.get(immutable) != int(expected, 16):
            problems.append(f'{label}: immutable {immutable} is not the release {ctx.names.address(expected)}')
    if hub == ctx.release.hub or problems:
        return
    snap = ctx.snap
    for fn, key in (('defaultHouseEdgeBps()', 'defaultHouseEdgeBps'),
                    ('refundTimeoutSeconds()', 'refundTimeoutSeconds')):
        actual = call(ctx.rpc, hub, fn, [], ctx.block)
        if actual != snap[key]:
            problems.append(f'{label}: {key} {actual} is not the release value {snap[key]}')
    if call_words(ctx, hub, 'pendingEdgeChange()', [], 2)[1]:
        problems.append(f'{label}: an edge change is pending')
    active = call(ctx.rpc, hub, 'activeReferralConfigId()', [], ctx.block)
    schedule = call_words(ctx, hub, 'getReferralConfig(uint32)', [active], 4)
    release = [snap[key] for key in ('refL0Bps', 'refL1Bps', 'refL2Bps', 'refHoldbackBps')]
    if schedule != release:
        problems.append(f'{label}: referral schedule {schedule} is not the release schedule {release}')


def check_register_pool(ctx, call_, planned):
    """registerPool: the certified Bank and Vault of the certified token in the casino domain, bound to the release's
    SettlementRouter and VRFHub or not bound yet."""
    _, asset, bank, domain_id = call_.args
    problems, label = call_.problems, ctx.names.thing('Bank', bank)
    token = address(ctx.domain['token']['proxy'])
    if domain_id != 1:
        problems.append(f'pool domain {domain_id} is not casino (1)')
    if asset != token:
        problems.append(f'asset {asset} is not the certified token {token}')
    reason, values = ctx.runtime('Bank', bank)
    if reason:
        problems.append(f'{label}: {reason}')
        return
    missing = [name for name in ('poolAsset', 'poolVault', 'poolAssetDecimals') if name not in values]
    if missing:
        problems.append(f'the certified Bank has no {", ".join(missing)} immutable')
        return
    if values['poolAsset'] != int(asset, 16):
        problems.append(f'{label}: its asset immutable is not the registered asset')
    decimals = next((ctx.snap[f'poolAssetDecimals_{i}'] for i in range(ctx.snap['numPools'])
                     if address(ctx.snap[f'poolAsset_{i}']) == token), None)
    if values['poolAssetDecimals'] != decimals:
        problems.append(f'{label}: its decimals immutable is not the certified token\'s')
    if values['poolVault'] >= 2**160:
        problems.append(f'{label}: its Vault immutable is not an address')
        return
    vault = as_address(values['poolVault'])
    if call(ctx.rpc, bank, 'vault()', [], ctx.block) != values['poolVault']:
        problems.append(f'{label}: vault() differs from its Vault immutable')
    router, consumer = address(ctx.snap['settlementRouter']), address(ctx.snap['vrfHub'])
    bound = call(ctx.rpc, bank, 'settlementRouter()', [], ctx.block)
    if bound not in (0, int(router, 16)):
        problems.append(f'{label}: its SettlementRouter is {as_address(bound)}, not the release SettlementRouter')
    elif bound and call(ctx.rpc, router, 'settlementConsumer(address)', [bank], ctx.block) \
            not in (0, int(consumer, 16)):
        problems.append(f'{label}: the SettlementRouter binds it to a randomness consumer other than the release '
                        'VRFHub')
    minimum = planned.get(('setMinBetAmount(uint256)', bank))
    if minimum is None:
        minimum = call(ctx.rpc, bank, 'minBetAmount()', [], ctx.block)
    floor = ctx.domain['casinoMinBetAmountFloor']
    if minimum < floor:
        problems.append(f'{label}: minimum bet {minimum} below the certified floor {floor}')
    reason, vault_values = ctx.runtime('LiquidityVault', vault)
    vault_label = ctx.names.thing('Vault', vault)
    if reason:
        problems.append(f'{vault_label}: {reason}')
        return
    if vault_values.get('poolAsset') != int(asset, 16):
        problems.append(f'{vault_label}: its asset immutable is not the registered asset')
    if vault_values.get('poolBank') != int(bank, 16):
        problems.append(f'{vault_label}: its Bank immutable is not {label}')


def check_register_game(ctx, call_, declared):
    """registerGame: a certified module, round limit and callback gas."""
    game_id, module, count, gas = call_.args
    domain, problems, label = ctx.domain, call_.problems, ctx.names.thing('module', module)
    code = ctx.code(module)
    if code == '0x':
        problems.append(f'{label} has no code')
    else:
        certified = {value.lower(): key for key, value in domain['moduleCodeHashes'].items()}
        key = certified.get(keccak(code))
        if key is None:
            problems.append(f'{label}: its runtime is not a certified module')
        elif key != label:
            call_.notes.append(f'certified {key} runtime')
    if not 1 <= count <= domain['maxBetCountCeiling']:
        problems.append(f'maxBetCount {count} outside 1..{domain["maxBetCountCeiling"]}')
    if gas != domain['consumerCallbackGasLimit']:
        problems.append(f'callbackGasLimit {gas} is not the certified {domain["consumerCallbackGasLimit"]}')
    if not declared and game_id in ctx.names.games:
        call_.notes.append('the release already registered this game id, so the call reverts')


def review_call(ctx, call_, planned, declared):
    """The admission review of one decoded call of a known kind of contract."""
    if call_.fn is None or call_.kind is None:
        return
    name, args, notes, problems = call_.fn.split('(')[0], call_.args, call_.notes, call_.problems
    snap, domain, names, release = ctx.snap, ctx.domain, ctx.names, ctx.release
    policy = domain['ownerPolicy']

    def recertify(what):
        if not declared:
            notes.append(f'recertification trigger: {what} (ADR-0006)')

    if name == 'registerPool':
        check_register_pool(ctx, call_, planned)
        recertify('a new pool')
    elif name in ('setHubRegistered', 'setHubAllowedForPool'):
        hub, admits = (args[0], args[1]) if name == 'setHubRegistered' else (args[1], args[2])
        if admits:
            check_hub(ctx, hub, problems)
            recertify('a hub admission' if name == 'setHubRegistered' else 'a pool route')
        else:
            notes.append('risk-reducing; the sentinel can do it at once')
    elif name == 'registerGame':
        check_register_game(ctx, call_, declared)
        recertify('any registerGame')
    elif name == 'setPoolActive':
        if args[1]:
            recertify('admits or reactivates a pool')
        else:
            notes.append('risk-reducing; the sentinel can do it at once')
    elif name == 'setMinBetAmount':
        floor = domain['casinoMinBetAmountFloor']
        if args[0] < floor:
            problems.append(f'minimum bet {args[0]} below the certified floor {floor} (the k = 0 path)')
        if args[0] != policy['casinoMinBetAmount']:
            notes.append(f'the Owner policy is {policy["casinoMinBetAmount"]}')
        recertify('a minimum bet change')
    elif name in ('setRiskReserveBps', 'setWithdrawalBufferBps'):
        expected = policy['riskReserveBps' if name == 'setRiskReserveBps' else 'withdrawalBufferBps']
        if args[0] != expected:
            notes.append(f'the Owner policy is {expected}')
            recertify('an Owner policy change')
    elif name in ('setSettlementRouterOnce', 'setRandomnessConsumerOnce', 'setBinderOnce'):
        expected = address(snap[{'setSettlementRouterOnce': 'settlementRouter', 'setRandomnessConsumerOnce': 'vrfHub',
                                 'setBinderOnce': 'gameHub'}[name]])
        if args[0] != expected:
            problems.append(f'{names.address(args[0])} is not the release {names.address(expected)}')
    elif name == 'transferGovernance':
        problems.append(f'moves the governance of {call_.label} away from the timelock: once this executes, '
                        f'{names.address(args[0])} can accept at any time and then acts without delay')
    elif name == 'acceptGovernance':
        problems.append(f'the timelock adopts {call_.label}, which another governance configured: nothing it did there '
                        'was reviewed (release contracts are built with the timelock as governance)')
    elif name == 'setSentinel':
        if args[0] != release.safe:
            notes.append('not the Safe: the live release verification fails once this executes')
    elif name == 'setGuardian':
        if args[0] != release.guardian:
            notes.append('not the release guardian: the live release verification fails once this executes')
    elif name in ('grantRole', 'revokeRole', 'renounceRole'):
        notes.append('changes the timelock roles: the live release verification fails once this executes')
    elif name == 'updateDelay':
        notes.append(f'the new delay of {args[0]} s applies to operations scheduled afterwards')
    elif name == 'setRiskInPaused':
        notes.append('pauses the Bank; the sentinel or guardian can do that at once' if args[0]
                     else 'unpauses the Bank')
    elif name in ('queueEdgeChange', 'createReferralConfig', 'setActiveReferralConfig'):
        recertify('an edge or referral change')
    elif name in ('disableGame', 'cancelEdgeChange'):
        notes.append('risk-reducing; the sentinel can do it at once'
                     + ('; irreversible' if name == 'disableGame' else ''))
    elif name == 'openVoidWindow':
        notes.append(f'opens a void window for pool {args[0]}')
    elif name == 'rescueToken':
        notes.append(f'transfers {args[2]} of {names.address(args[0])} to {names.address(args[1])}')
    elif name == 'claimProtocolFees':
        notes.append(f'pays {args[0]} of protocol fees to {names.address(args[1])}')
    elif name == 'setRefundTimeout':
        if args[0] != snap['refundTimeoutSeconds']:
            notes.append(f'the release value is {snap["refundTimeoutSeconds"]}')
    if call_.value:
        notes.append(f'sends {call_.value} wei')


def review_operation(ctx, op, raw_calls):
    """Decode and review the calls of one scheduled operation, in index order."""
    declared = op in (ctx.release.wiring, ctx.release.activation)
    calls = [Call(ctx, target, value, data) for _, target, value, data in sorted(raw_calls, key=lambda c: c[0])]
    # The last value each setter of this operation leaves (the minimum bet a registerPool review counts).
    planned = {(c.fn, c.target): c.args[0] for c in calls if c.fn and c.args}
    for c in calls:
        review_call(ctx, c, planned, declared)
    return [c.entry(i + 1) for i, c in enumerate(calls)]


def call_line(entry, failures_only=False):
    if failures_only and not entry['problems']:
        return None
    text = '  ' + entry['line']
    if entry['problems']:
        text += ' -> FAILED: ' + '; '.join(entry['problems'])
    if entry['notes'] and not failures_only:
        text += ' [' + '; '.join(entry['notes']) + ']'
    return text


def summary(entry, count=3):
    calls = entry['calls']
    shown = '; '.join(c['line'].split('. ', 1)[1] for c in calls[:count])
    return f'{len(calls)} call(s): {shown}' + (f'; and {len(calls) - count} more' if len(calls) > count else '')


def readiness(entry, now):
    ready = entry['readyAt']
    if ready is None:
        return {'done': 'already executed by the confirmed head',
                'unset': 'no longer pending at the confirmed head'}.get(entry['status'], 'ready time unknown')
    return f'ready {utc(ready)} ({ready})' if now < ready else f'ready since {utc(ready)} ({hours(now - ready)} ago)'


def new_operation(label, block=None, tx=None, predecessor=None, delay=None):
    return {'label': label, 'block': block, 'tx': tx, 'predecessor': predecessor, 'delay': delay, 'readyAt': None,
            'status': 'unknown', 'calls': [], 'failed': False, 'warned': False, 'readyAlertedAt': 0,
            'failedAlertedAt': 0}


def set_status(ctx, op, entry):
    ready = call(ctx.rpc, ctx.release.timelock, 'getTimestamp(bytes32)', [op], ctx.block)
    if ready > DONE_TIMESTAMP:
        entry['readyAt'], entry['status'] = ready, 'waiting'
    else:
        entry['readyAt'], entry['status'] = None, 'done' if ready == DONE_TIMESTAMP else 'unset'


def predecessor_note(names, entry):
    predecessor = entry.get('predecessor')
    if not predecessor or int(predecessor, 16) == 0:
        return ''
    return f', after {names.operation(predecessor)} {predecessor}'


def operation_header(op, entry, now, names):
    delay = '' if entry['delay'] is None else f', delay {entry["delay"]} s'
    where = f', scheduled in block {entry["block"]}, tx {entry["tx"]}' if entry['block'] is not None else ''
    return (f'- {op} ({entry["label"]}): {len(entry["calls"])} call(s), {readiness(entry, now)}{delay}'
            f'{predecessor_note(names, entry)}{where}')


def add_failure(report, op, entry, now, remark=''):
    ready = entry['readyAt']
    if ready is not None and now < ready:
        title = f'ADMISSION REVIEW FAILED: cancel before {utc(ready)}'
    elif ready is not None:
        title = f'ADMISSION REVIEW FAILED: ready since {utc(ready)}, anyone can execute it now'
    else:
        title = 'ADMISSION REVIEW FAILED'
    failing = sum(1 for c in entry['calls'] if c['problems'])
    where = f', scheduled in block {entry["block"]}, tx {entry["tx"]}' if entry['block'] is not None else ''
    lines = [f'- operation {op} ({entry["label"]}): {failing} of {len(entry["calls"])} call(s) failed{where}{remark}']
    lines += [call_line(c, failures_only=True) for c in entry['calls']]
    report.add('failed', title, lines, public=True)


def process_operations(ctx, ops, rows, folded, now, report):
    """Apply this scan's timelock events to the open operations `ops`; return (any event, any execution)."""
    names, config = ctx.names, ctx.config
    fresh, executed, cancelled = {}, {}, {}
    for name, row in rows:
        block, tx = quantity(row['blockNumber']), row.get('transactionHash')
        if name == CANCELLED:
            require(len(row['topics']) == 2, 'invalid timelock operation log')
            op = hex_word(word(row['topics'][1]))
            cancelled[op] = (block, tx)
            ops.pop(op, None)
            continue
        op, index, target, value, calldata, predecessor, delay = operation_event(name, row)
        if name == SCHEDULED:
            if index == 0 or op not in fresh:
                fresh[op] = new_operation(names.operation(op), block, tx, predecessor, delay)
                fresh[op]['raw'] = []
                ops[op] = fresh[op]
            fresh[op]['raw'].append((index, target, value, calldata))
        else:
            executed.setdefault(op, {'block': block, 'tx': tx, 'calls': []})['calls'].append(
                (index, target, value, calldata))
            ops.pop(op, None)
    lines = []
    for op, entry in fresh.items():
        entry['calls'] = review_operation(ctx, op, entry.pop('raw'))
        entry['failed'] = any(c['problems'] for c in entry['calls'])
        set_status(ctx, op, entry)
        ready = entry['readyAt']
        entry['warned'] = ready is None or now >= ready - config.warning_seconds
        entry['readyAlertedAt'] = now if ready is not None and now >= ready else 0
        entry['failedAlertedAt'] = now if entry['failed'] else 0
        lines.append(operation_header(op, entry, now, names))
        lines += [call_line(c) for c in entry['calls']]
        lines.append('  admission review: ' + (f'FAILED ({sum(1 for c in entry["calls"] if c["problems"])} call(s))'
                                               if entry['failed'] else 'passed'))
        if entry['failed'] and op in ops:
            add_failure(report, op, entry, now)
    report.add('scheduled', 'TIMELOCK OPERATION SCHEDULED (anyone can execute it once ready; cancel it while it waits)',
               lines, public=True)
    lines = []
    for op, record in executed.items():
        events_note = f' ({folded[record["tx"]]} events of the operation in that transaction)' \
            if folded.get(record['tx']) else ''
        lines.append(f'- {op} ({names.operation(op)}): {len(record["calls"])} call(s) executed in block '
                     f'{record["block"]}, tx {record["tx"]}{events_note}')
        if op not in fresh:
            decoded = [Call(ctx, target, value, data) for _, target, value, data in sorted(record['calls'])]
            lines += [f'  {i + 1}. {c.text}' for i, c in enumerate(decoded)]
    report.add('executed', 'TIMELOCK OPERATION EXECUTED', lines, public=True)
    report.add('cancelled', 'TIMELOCK OPERATION CANCELLED',
               [f'- {op} ({names.operation(op)}) cancelled in block {block}, tx {tx}'
                for op, (block, tx) in cancelled.items()], public=True)
    return bool(fresh or executed or cancelled), bool(executed)


def remind_operations(ctx, ops, now, report):
    """Ready-time warnings, ready-but-unexecuted reminders and failed-review reminders for the open operations."""
    config, names = ctx.config, ctx.names
    soon, ready_lines = [], []
    for op, entry in sorted(ops.items(), key=lambda item: (item[1]['readyAt'] or 0, item[0])):
        ready = entry['readyAt']
        warn = ready is not None and not entry['warned'] and ready - config.warning_seconds <= now < ready
        due = ready is not None and now >= ready and (
            not entry['readyAlertedAt'] or now - entry['readyAlertedAt'] >= config.remind_seconds)
        if entry['failed']:
            if not (warn or due or now - entry['failedAlertedAt'] >= config.remind_seconds):
                continue
            state = ctx.operation_state(op)
            if state not in ('waiting', 'ready'):
                continue  # executed or cancelled beyond the scanned blocks: its event reports it
            add_failure(report, op, entry, now, f'; becomes ready in {hours(ready - now)}' if warn else ' (reminder)')
            entry['failedAlertedAt'] = now
            entry['warned'] = entry['warned'] or warn
            if due and state == 'ready':
                entry['readyAlertedAt'] = now
        elif warn:
            soon.append(f'- {op} ({entry["label"]}): becomes ready at {utc(ready)}, in {hours(ready - now)}; '
                        f'{summary(entry)}{predecessor_note(names, entry)}')
            entry['warned'] = True
        elif due and ctx.operation_state(op) == 'ready':
            ready_lines.append(f'- {op} ({entry["label"]}): ready since {utc(ready)} ({hours(now - ready)} ago); '
                               f'{summary(entry)}{predecessor_note(names, entry)}')
            entry['readyAlertedAt'] = now
    report.add('soon', 'TIMELOCK OPERATION READY SOON (cancel it now if it must not run: once ready anyone can execute '
               'it)', soon, public=True)
    report.add('ready', 'TIMELOCK OPERATION READY, NOT EXECUTED (execute it promptly or cancel it; a cancellation now '
               'races any executor)', ready_lines, public=True)


def seed_operations(ctx, ops, replayed, now, report):
    """On arming, open the operations that the live verification found pending: the event scan never sees them."""
    lines = []
    for op, status in sorted((replayed or {}).items()):
        if status != 'scheduled' or op in ops:
            continue
        entry = new_operation(ctx.names.operation(op))
        if op == ctx.release.activation:
            entry['calls'] = [{'line': f'{i + 1}. PoolRegistry.setPoolActive({pool}, true)', 'problems': [],
                               'notes': []} for i, pool in enumerate(ctx.release.pools)]
        elif op == ctx.release.wiring:
            entry['calls'] = [{'line': '1. the release wiring batch (V16Batches; the operation id fixes its calls)',
                               'problems': [], 'notes': []}]
        else:
            entry['calls'] = [{'line': '1. calls not decoded', 'notes': [], 'problems': [
                'scheduled before the monitor armed, so not reviewed: re-arm with --from-block at or before its '
                'CallScheduled block']}]
        entry['failed'] = any(c['problems'] for c in entry['calls'])
        set_status(ctx, op, entry)
        if entry['status'] != 'waiting':
            continue
        ops[op] = entry
        entry['warned'] = now >= entry['readyAt'] - ctx.config.warning_seconds
        entry['readyAlertedAt'] = now if now >= entry['readyAt'] else 0
        entry['failedAlertedAt'] = now if entry['failed'] else 0
        lines.append(operation_header(op, entry, now, ctx.names))
        lines += [call_line(c) for c in entry['calls']]
        if entry['failed']:
            add_failure(report, op, entry, now)
    report.add('armed', 'TIMELOCK OPERATIONS PENDING WHEN THE MONITOR ARMED', lines, public=True)


# ---- unbooked results and voids (ADR-0037 §7.3 rule 4) --------------------------------------------------------------

def fresh_voids():
    """Unbooked results by request id, void windows by Bank ([cohortEnd, block, log index]; block None for a window
    opened before the monitor armed) and the first void on each eligibility path."""
    return {'unbooked': {}, 'windows': {}, 'voided': {}}


def load_result(ctx, key, entry):
    """Fill in an unbooked result's bet, hub, receipt time and vrfRequestedAt from the contracts, once."""
    if entry['loaded']:
        return
    request = call_words(ctx, address(ctx.snap['vrfHub']), 'getRequest(uint256)', [int(key)], REQUEST_WORDS)
    require(as_address(request[REQUEST_BANK]) == entry['bank'], 'VRFHub request differs from its result log')
    entry.update(hub=as_address(request[REQUEST_HUB]), betId=request[REQUEST_BET], receivedAt=ctx.time(entry['block']),
                 requestedAt=None, loaded=True)
    if entry['hub'] == ctx.release.hub:
        bet = call_words(ctx, ctx.release.hub, 'getBet(uint256)', [entry['betId']], BET_WORDS)
        require(bet[BET_ID] == entry['betId'] and bet[BET_REQUEST] == int(key)
                and as_address(bet[BET_BANK]) == entry['bank'], 'GameHub bet differs from its VRF request')
        entry['requestedAt'] = bet[BET_REQUESTED_AT]


def eligibility(entry, windows, before=None):
    """(path, since) of a bet of the release hub, following GameHub.voidBet: in the cohort of the first void window
    whose cohortEnd is at or after vrfRequestedAt the bet is eligible VOID_DELAY after its request, but not before the
    window opened (cohortEnd is the opening time); otherwise PUBLIC_VOID_DELAY after its request. The path is the one
    it became eligible on first, and it is never eligible before its result was received. `before` (block, log index)
    leaves out windows opened later."""
    requested = entry['requestedAt']
    public = requested + PUBLIC_VOID_DELAY
    path, since = 'public', public
    for window in sorted(windows, key=lambda w: w[0]):
        if window[0] < requested or not (before is None or window[1] is None or (window[1], window[2]) < before):
            continue
        start = max(requested + VOID_DELAY, window[0])
        if start <= public:
            path, since = f'window {window[0]}', start
        break
    return path, max(since, entry['receivedAt'])


def path_label(path):
    return 'the 7-day path' if path == 'public' else f'the path of the window opened {utc(int(path.split()[1]))}'


def track_results(ctx, voids, rows, report):
    """Apply this scan's result and void-window logs, in chain order, and report every bet that settled while eligible
    after a bet on the same eligibility path (same Bank, same window or both by the 7-day limit) was voided.

    A result that is acknowledged in the transaction that received it was never unbooked and is not tracked. Settling
    inside voidBet and settling through retry or finalize emit the same logs, so any settlement of an eligible bet
    counts."""
    unbooked, windows, voided = voids['unbooked'], voids['windows'], voids['voided']
    later = []
    for name, row in rows:
        ind, dat = fields(row)
        block, index, tx = quantity(row['blockNumber']), quantity(row['logIndex']), row.get('transactionHash')
        if name == WINDOW:
            windows.setdefault(as_address(need(ind, 2)[1]), []).append([need(dat, 1), block, index])
            continue
        request, bank = need(ind, 2)
        key, bank = str(request), as_address(bank)
        if name == RECEIVED:
            unbooked[key] = {'bank': bank, 'block': block, 'logIndex': index, 'tx': tx, 'loaded': False,
                             'warned': False}
            continue
        entry = unbooked.pop(key, None)
        # Skip a result received before tracking began (the count check reports those) and one booked in the
        # transaction that received it.
        if entry is not None and not (name == ACKNOWLEDGED and entry['tx'] == tx):
            later.append((name, key, entry, block, index, tx))
    lines = []
    for name, key, entry, block, index, tx in later:
        if name == ACKNOWLEDGED and not any(path.startswith(entry['bank'] + '|') for path in voided):
            continue
        load_result(ctx, key, entry)
        if entry['requestedAt'] is None:
            continue  # a hub outside the release: its void eligibility is not tracked
        path, since = eligibility(entry, windows.get(entry['bank'], []), (block, index))
        # Logs are applied in chain order, so a void already recorded for the path happened before this settlement.
        void = voided.get(f'{entry["bank"]}|{path}')
        if name == VOIDED:
            voided.setdefault(f'{entry["bank"]}|{path}', [block, index, entry['betId']])
        elif void and since <= ctx.time(block):
            lines.append(f'- {ctx.names.thing("Bank", entry["bank"])}: position {entry["betId"]} settled in block '
                         f'{block} (tx {tx}) while eligible on {path_label(path)}, after position {void[2]} on that '
                         f'path was voided in block {void[0]}')
    report.add('voidorder', 'BET SETTLED AFTER A VOID ON THE SAME PATH (the execution order decided which bets were '
               'voided, ADR-0037 R-5)', lines, public=True)


def result_conditions(ctx, voids, caught_up, report):
    """(unbooked, unattempted, untracked) standing conditions at the confirmed block, and the one-shot warnings before
    an unbooked result reaches 7 days. Loads at most DRIFT_RESULT_READS_PER_RUN new results per run, oldest first."""
    config, names, unbooked = ctx.config, ctx.names, voids['unbooked']
    for _, _, key in sorted((e['block'], e['logIndex'], k) for k, e in unbooked.items() if not e['loaded'])[
            :config.result_reads]:
        load_result(ctx, key, unbooked[key])
    late, idle, soon, eligible = {}, {}, [], []
    now = ctx.time(ctx.block) if unbooked else None
    for key, entry in sorted(unbooked.items(), key=lambda item: (item[1]['block'], item[1]['logIndex'])):
        if not entry['loaded']:
            continue
        bank = names.thing('Bank', entry['bank'])
        if now - entry['receivedAt'] >= config.unbooked_seconds:
            late[key] = (f'{bank}: request {key} (position {entry["betId"]}) unbooked since '
                         f'{utc(entry["receivedAt"])}, {hours(now - entry["receivedAt"])}'
                         + ('' if entry['requestedAt'] is not None
                            else ' (a hub outside the release: not tracked further)'))
        if entry['requestedAt'] is None:
            continue
        path, since = eligibility(entry, voids['windows'].get(entry['bank'], []))
        public = entry['requestedAt'] + PUBLIC_VOID_DELAY
        if path == 'public' and not entry['warned'] and public - config.public_void_warning <= now < public:
            soon.append(f'- {bank}: position {entry["betId"]} (request {key}), requested {utc(entry["requestedAt"])}, '
                        f'reaches 7 days at {utc(public)}, in {hours(public - now)}')
            entry['warned'] = True
        if since <= now:
            eligible.append((key, entry, path, since))
    if eligible:
        lag = ctx.time(ctx.block) - config.attempt_seconds
        for key, entry, path, since in eligible:
            if since <= lag:
                idle[key] = (f'{names.thing("Bank", entry["bank"])}: position {entry["betId"]} (request {key}) '
                             f'eligible since {utc(since)} on {path_label(path)}, still unbooked '
                             f'{config.attempt_seconds} seconds later')
    untracked = {}
    for _, bank, _ in ctx.release.pools.values():
        count = call(ctx.rpc, address(ctx.snap['vrfHub']), 'unbookedResultCount(address)', [bank], ctx.block)
        tracked = sum(1 for entry in unbooked.values() if entry['bank'] == bank)
        if caught_up and count != tracked:
            untracked[bank] = (f'{names.thing("Bank", bank)}: {count} unbooked result(s) on chain, {tracked} tracked; '
                               'results received before the monitor armed are not tracked (re-arm with --from-block '
                               'at or before their receipt)')
    report.add('voidsoon', 'UNBOOKED RESULT REACHES 7 DAYS SOON (anyone may then void it once a settlement attempt '
               'fails)', soon)
    return late, idle, untracked


# ---- standing checks -------------------------------------------------------------------------------------------------

def domain_violations(ctx):
    """Every live deviation from the certified domain at the confirmed block, as {key: text}."""
    rpc, snap, domain, block, release = ctx.rpc, ctx.snap, ctx.domain, ctx.block, ctx.release
    found = []
    try:
        verify_provider(rpc, snap, block, domain)
    except RpcUnavailable:
        raise
    except VerificationError as error:
        found.append(f'provider: {error}')
    # No game is registered before the wiring executes; the module runtimes are checked regardless.
    wired = call(rpc, release.timelock, 'isOperationDone(bytes32)', [release.wiring], block) == 1
    for name, key in GAMES:
        module = address(snap[key])
        if wired:
            game_id = word(signature(name))
            if call(rpc, release.hub, 'gameModule(bytes32)', [game_id], block) != int(module, 16):
                found.append(f'game {name}: module differs from the release')
            if call(rpc, release.hub, 'gameCallbackGasLimit(bytes32)', [game_id], block) \
                    != domain['consumerCallbackGasLimit']:
                found.append(f'game {name}: callback gas is not the certified value')
            if not 1 <= call(rpc, release.hub, 'gameMaxBetCount(bytes32)', [game_id], block) \
                    <= domain['maxBetCountCeiling']:
                found.append(f'game {name}: round limit outside the certified range')
        code = ctx.code(module)
        if code == '0x' or keccak(code) != domain['moduleCodeHashes'][key].lower():
            found.append(f'game {name}: module runtime is not the certified code')
    for pool, (_, bank, _) in release.pools.items():
        minimum = call(rpc, bank, 'minBetAmount()', [], block)
        if minimum < domain['casinoMinBetAmountFloor']:
            found.append(f'pool {pool}: minimum bet {minimum} below the certified floor')
    return {text: text for text in sorted(found)}


def capacity_conditions(ctx):
    found = {}
    for pool, (_, bank, _) in ctx.release.pools.items():
        holds = call(ctx.rpc, bank, 'openHolds()', [], ctx.block)
        if holds >= ctx.config.holds_alert:
            found[f'pool {pool} open holds'] = (f'Bank pool {pool}: {holds} of {MAX_OPEN_HOLDS} open holds (alert at '
                                                f'{ctx.config.holds_alert})')
    return found


def checkpoint_base(config, rpc, state):
    """The checkpoint the next live verification starts from: the monitor's own last checkpoint, if it descends from
    the installed signed checkpoint and its block is still on the chain, otherwise the signed one."""
    rolling = state.get('governanceCheckpoint')
    if (isinstance(rolling, dict) and rolling.get('schema') == CHECKPOINT_SCHEMA
            and state.get('signedCheckpointSha256') == config.checkpoint_sha256):
        try:
            decode_state(rolling.get('state'))
        except VerificationError:
            return config.checkpoint
        head = rpc('eth_getBlockByNumber', [hex(rolling['blockNumber']), False])
        if isinstance(head, dict) and str(head.get('hash', '')).lower() == rolling.get('blockHash'):
            return rolling
    return config.checkpoint


def verify_live(config, rpc, base, block):
    """Live release verification at `block` (ADR-0037 §10).

    Replays the authorization events after `base` (verify_governance.replay), so that the checkpoint advances even when
    the judgement fails, then lets verify_permissions judge the state in live mode from the checkpoint at `block`,
    which replays nothing more. RPC failures propagate; any other VerificationError is the
    finding.
    """
    release, snap = config.release, config.snapshot
    result = {'problem': None, 'notes': [], 'checkpoint': None, 'operations': None}
    try:
        state = replay(rpc, release, block, base)
        head = rpc('eth_getBlockByNumber', [hex(block), False])
        require(isinstance(head, dict) and quantity(head.get('number')) == block, 'invalid block response')
        word(head.get('hash'))
        result['checkpoint'] = checkpoint_document(snap, state, block, head['hash'])
        result['operations'] = {op: entry['state'] for op, entry in state['operations'].items()}
        _, _, result['notes'] = verify_permissions(rpc, snap, block, result['checkpoint'], 'live')
    except RpcUnavailable:
        raise
    except VerificationError as error:
        result['problem'] = str(error)
    return result


def standing(report, state, group, current, now, config):
    """Add the sections of one standing condition group; return whether its alert time moves."""
    previous = state['conditions'][group]
    changed = set(current) != set(previous)
    remind = bool(current) and now - state['conditionsAlertedAt'][group] >= config.remind_seconds
    if current and (changed or remind):
        report.add(f'group:{group}', GROUP_TITLE[group].format(threshold=hours(config.unbooked_seconds)),
                   [('- NEW ' if key not in previous else '- ') + text for key, text in sorted(current.items())])
    report.add('recovered', GROUP_RECOVERED[group], ['- ' + text for key, text in sorted(previous.items())
                                                      if key not in current])
    return changed or remind


# ---- state and delivery ----------------------------------------------------------------------------------------------

def fresh_state(config):
    return {'schema': STATE_SCHEMA, 'chainId': config.chain, 'governanceTimelock': config.release.timelock,
            'failures': 0, 'stallAlertedAt': 0, 'domainCheckedAt': 0, 'governanceCheckedAt': 0,
            'conditions': {group: {} for group in GROUPS}, 'conditionsAlertedAt': {group: 0 for group in GROUPS},
            'governanceNotes': [], 'operations': {}, 'voids': fresh_voids()}


def load_state(config):
    try:
        state = json.loads(config.state_file.read_text())
    except FileNotFoundError:
        return fresh_state(config)
    require(isinstance(state, dict) and state.get('schema') == STATE_SCHEMA,
            'the state file is not from this monitor version: move it away to re-arm')
    require(state.get('chainId') == config.chain and state.get('governanceTimelock') == config.release.timelock,
            'the state file belongs to another release: move it away to re-arm')
    for group in GROUPS:
        state['conditions'].setdefault(group, {})
        state['conditionsAlertedAt'].setdefault(group, 0)
    state.setdefault('voids', fresh_voids())
    return state


def save_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name + '.')
    with os.fdopen(fd, 'w') as handle:
        json.dump(state, handle, indent=1, sort_keys=True)
    os.replace(tmp, path)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect is not a delivery (docs/ops/alerts.md); urllib then raises HTTPError for the 3xx."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPEN = urllib.request.build_opener(_NoRedirect).open


def post_webhook(url, text, opener, channel):
    request = urllib.request.Request(url, json.dumps({'text': text}).encode(), {'content-type': 'application/json'},
                                     method='POST')
    try:
        with opener(request, timeout=15) as response:
            accepted = 200 <= response.status < 300
    except (urllib.error.URLError, OSError, ValueError):
        accepted = False
    if not accepted:
        print(f'{channel} webhook delivery failed', file=sys.stderr)  # never the URL
    return accepted


def post_public_telegram(config, env, text, opener):
    """Through alert-notify's own API call, but without its host line, which a public channel must not show."""
    spec = importlib.util.spec_from_file_location('alert_notify', NOTIFY)
    notify = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(notify)
    api = env.get('TELEGRAM_API_BASE', notify.DEFAULT_API_BASE).rstrip('/')
    try:
        body = notify.call(api, env['TELEGRAM_BOT_TOKEN'].strip(), 'sendMessage',
                           {'chat_id': config.public_chat, 'text': text[:notify.MAX_TEXT]}, opener)
        if isinstance(body, dict) and body.get('ok'):
            return True
        print('public telegram delivery failed: not ok', file=sys.stderr)
    except urllib.error.HTTPError as error:
        print(f'public telegram delivery failed: HTTP {error.code}', file=sys.stderr)
    except (urllib.error.URLError, OSError, ValueError) as error:
        print(f'public telegram delivery failed: {type(error).__name__}', file=sys.stderr)
    return False


def deliver(config, channel, subject, text, env, opener):
    """True when every configured channel of `channel` ('ops' or 'public') accepted the message, or none is set."""
    ok = True
    if channel == 'ops':
        if config.telegram:
            # The token reaches alert-notify through its environment, never argv.
            result = subprocess.run([sys.executable, str(NOTIFY), '--subject', subject], input=text, text=True,
                                    env=env, capture_output=True, timeout=60)
            if result.returncode:
                print('telegram delivery failed', file=sys.stderr)
            ok = result.returncode == 0
        if config.webhook:
            ok = post_webhook(config.webhook, subject + '\n' + text, opener, 'ops') and ok
    else:
        if config.public_chat:
            ok = post_public_telegram(config, env, subject + '\n' + text, opener)
        if config.public_webhook:
            ok = post_webhook(config.public_webhook, subject + '\n' + text, opener, 'public') and ok
    return ok


def error_detail(error):
    """A failure description that cannot carry a secret: verifier messages are written for that, nothing else is."""
    if isinstance(error, VerificationError):
        return str(error)
    if isinstance(error, KeyError):
        return f'missing key {error.args[0]!r}' if error.args and isinstance(error.args[0], str) else 'KeyError'
    if isinstance(error, json.JSONDecodeError):
        return f'invalid JSON ({error.msg}, line {error.lineno})'
    # A file path names the missing input or the missing cast binary; a URLError may carry a URL instead.
    if isinstance(error, OSError) and not isinstance(error, urllib.error.URLError) and isinstance(error.filename, str):
        return f'{type(error).__name__} for {error.filename}'
    if isinstance(error, subprocess.SubprocessError):
        return f'{type(error).__name__} (cast failed)'
    frames = traceback.extract_tb(error.__traceback__)
    return type(error).__name__ + (f' at {Path(frames[-1].filename).name}:{frames[-1].lineno}' if frames else '')


def armed_text(config, verification, safe):
    lines = ['Events after this block are watched; scheduled timelock operations are reviewed; the certified domain '
             'and the live release state are checked.']
    if config.checkpoint is None:
        lines.append('Live release verification is off: no signed release record is configured.')
    elif verification is None:
        lines.append('Live release verification waits until the confirmed head reaches the signed checkpoint block '
                     f'{config.checkpoint["blockNumber"]} (now {safe}).')
    elif verification['problem'] is None:
        notes = verification['notes']
        lines.append('Live release verification from the signed checkpoint at block '
                     f'{config.checkpoint["blockNumber"]} passed at block {safe}'
                     + (': ' + '; '.join(notes) if notes else '.'))
    else:
        lines.append(f'Live release verification FAILED at block {safe}: {verification["problem"]}')
    return '\n'.join(lines)


def run(config, rpc, env, now=None, dry_run=False, from_block=None, opener=OPEN):
    now = int(time.time()) if now is None else now
    try:
        state = load_state(config)
    except (VerificationError, OSError, ValueError) as error:
        print(f'config drift monitor state unreadable: {error_detail(error)}', file=sys.stderr)
        return 2
    rpc, chain, new, report = GuardedRpc(rpc), config.chain, copy.deepcopy(state), Report()
    try:
        require(quantity(rpc('eth_chainId', [])) == chain, 'RPC is on another chain')
        ctx = Context(config, rpc, None)
        head = quantity(rpc('eth_blockNumber', []))
        floor = config.snapshot['blockNumber']
        # Base makes five blocks a second since Denim: start that far back.
        safe = last_block_at_or_before(ctx.time, ctx.time(head) - config.confirmation_seconds, head, floor - 1,
                                       5 * config.confirmation_seconds + 5)
        require(safe >= floor, 'chain is behind the release snapshot')
        ctx.block = safe
        armed = 'cursor' not in state
        if armed:
            # First run: arm at an explicit block or at the confirmed head; history before it is the release's.
            cursor = (from_block - 1) if from_block is not None else safe
            require(config.snapshot['blockNumber'] - 1 <= cursor <= safe, 'invalid starting block')
        else:
            cursor = state['cursor']
        end = min(safe, cursor + config.max_blocks)
        rows = events(rpc, {target: WATCHED for target in config.watch}, cursor + 1, end) if end > cursor else []
        operation_rows, findings, folded, result_rows = scan(ctx, rows)
        voids = new['voids']
        if armed:
            # A window opened before the monitor armed is known only by the Bank's latest cohortEnd.
            for _, bank, _ in config.release.pools.values():
                cohort = call(rpc, config.release.hub, 'voidCohortEnd(address)', [bank], safe)
                if cohort:
                    voids['windows'][bank] = [[cohort, None, None]]
        track_results(ctx, voids, result_rows, report)
        ops = new['operations']
        operation_events, executed = process_operations(ctx, ops, operation_rows, folded, now, report)
        classes = {cls for cls, *_ in findings}
        verification = None
        if config.checkpoint is not None and (
                armed or now - state['governanceCheckedAt'] >= config.governance_interval or operation_events
                or classes & {'recertify', 'governance'}):
            base = checkpoint_base(config, rpc, state)
            if base['blockNumber'] <= safe:
                verification = verify_live(config, rpc, base, safe)
        if armed and verification is not None:
            seed_operations(ctx, ops, verification['operations'], now, report)
        remind_operations(ctx, ops, now, report)
        domain_due = (armed or now - state['domainCheckedAt'] >= config.domain_interval or executed
                      or 'recertify' in classes)
        violations = domain_violations(ctx) if domain_due else state['conditions']['domain']
        capacity = capacity_conditions(ctx)
        unbooked, unattempted, untracked = result_conditions(ctx, voids, end == safe, report)
    except Exception as error:  # noqa: BLE001 - reported without its message unless a verifier wrote it
        detail = error_detail(error)
        print(f'config drift monitor run failed: {detail}', file=sys.stderr)  # never the RPC URL
        if dry_run:
            return 1
        state['failures'] = state.get('failures', 0) + 1
        due = (state['failures'] >= config.after_failures
               and now - state.get('stallAlertedAt', 0) >= config.remind_seconds)
        if due:
            delivered = [deliver(config, 'ops', f'K0-4 drift monitor STALLED on chain {chain}',
                                 f'{state["failures"]} consecutive failed runs; last error: {detail}', env, opener)]
            if config.public_chat or config.public_webhook:
                # Silence on the public channel must not read as an empty queue.
                delivered.append(deliver(config, 'public', PUBLIC_SUBJECT.format(chain=chain), PUBLIC_STALLED, env,
                                         opener))
            if all(delivered):
                state['stallAlertedAt'] = now
        save_state(config.state_file, state)
        return 1

    governance = state['conditions']['governance']
    if verification is not None:
        governance = {verification['problem']: verification['problem']} if verification['problem'] else {}
    current = {'governance': governance, 'domain': violations, 'capacity': capacity, 'unattempted': unattempted,
               'unbooked': unbooked, 'untracked': untracked}
    advance = {group: standing(report, state, group, current[group], now, config) for group in GROUPS}
    for cls in CLASS_TITLE:
        add_findings(report, findings, cls, cursor + 1, end)
    if not armed and verification is not None and verification['problem'] is None \
            and verification['notes'] != state['governanceNotes']:
        report.add('notes', 'RELEASE STATE NOTES CHANGED (the live release verification passed)',
                   [('- NEW ' if note not in state['governanceNotes'] else '- ') + note
                    for note in verification['notes']]
                   + ['- no longer: ' + note for note in state['governanceNotes'] if note not in verification['notes']])

    subjects, bodies = [], []
    if armed:
        subjects.append(f'K0-4 drift monitor armed on chain {chain} at block {cursor}')
        bodies.append(armed_text(config, verification, safe))
    recovered = state.get('failures', 0) >= config.after_failures
    if recovered:
        subjects.append(f'K0-4 drift monitor recovered on chain {chain}')
        bodies.append(f'Runs succeed again at block {safe}.')
    if report.sections:
        subjects.append(f'K0-4 config drift: chain {chain}, ' +
                        (f'blocks {cursor + 1}-{end}' if end > cursor else f'block {safe}'))
    messages = []
    if subjects:
        subject = ' | '.join(subjects)
        head = '\n\n'.join(bodies)
        limit = max(500, MAX_TEXT - len(subject) - len(head) - 2)
        messages.append(('ops', subject, '\n\n'.join(filter(None, [head, report.text()])),
                         '\n\n'.join(filter(None, [head, report.text(limit=limit)]))))
    public = report.text(public=True)
    resumed = PUBLIC_RESUMED if recovered and (config.public_chat or config.public_webhook) else ''
    if public or resumed:
        subject = PUBLIC_SUBJECT.format(chain=chain)
        limit = MAX_TEXT - len(subject) - len(resumed) - 2
        messages.append(('public', subject, '\n\n'.join(filter(None, [resumed, public])),
                         '\n\n'.join(filter(None, [resumed, report.text(public=True, limit=limit)]))))
    for channel, subject, full, _ in messages:
        print(('[public channel] ' if channel == 'public' else '') + subject + '\n' + full, flush=True)  # journal
    if dry_run:
        if not messages:
            print('no findings')
        return 0
    if not all([deliver(config, channel, subject, text, env, opener) for channel, subject, _, text in messages]):
        # Persist nothing from this run: the same range and alerts are evaluated and sent again next run.
        return 2

    new.update(cursor=max(cursor, end), failures=0, stallAlertedAt=0, lastRunAt=now)
    if domain_due:
        new['domainCheckedAt'] = now
    new['conditions'] = current
    for group in GROUPS:
        if advance[group]:
            new['conditionsAlertedAt'][group] = now if new['conditions'][group] else 0
    if verification is not None:
        new['governanceCheckedAt'] = now
        if verification['checkpoint'] is not None:
            new['governanceCheckpoint'] = verification['checkpoint']
            new['signedCheckpointSha256'] = config.checkpoint_sha256
        if verification['problem'] is None:
            new['governanceNotes'] = verification['notes']
    save_state(config.state_file, new)
    return 0


def main(argv=None, env=None):
    env = dict(os.environ if env is None else env)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--dry-run', action='store_true', help='print what would be sent; change no state')
    parser.add_argument('--from-block', type=int, help='first block to watch when no state exists yet')
    args = parser.parse_args(argv)
    try:
        config = Config(env)
    except (KeyError, OSError, ValueError, VerificationError, subprocess.SubprocessError) as error:
        print(f'config drift monitor misconfigured: {error_detail(error)}', file=sys.stderr)
        return 2
    return run(config, Rpc(config.rpc_url), env, dry_run=args.dry_run, from_block=args.from_block)


if __name__ == '__main__':
    sys.exit(main())
