# Configuration drift alerts (K0-4)

The release is governed by its `GovernanceTimelock` ([ADR-0037](../../adr/0037-launch-candidate-authority-pause-capacity-void.md)).
Every change that adds risk waits 72 hours in its queue, and either canceller, the Safe or the guardian, can stop it
while it waits. Once an operation is ready, anyone can execute it. The queue protects LPs only if the cancellers and the
LPs hear of each operation in time, and only if someone checks what the operation admits. The
[first-callback gas certificate](../../audit/first-callback-gas-certificate-2026-10-07.md) also holds only inside its
certified domain, which governance and the USDC issuer can both leave after release. ADR-0006 requires these alerts
before any network that carries real funds.

[`config-drift-monitor.py`](../../../script/ops/config-drift-monitor.py) runs every 5 minutes through
[`config-drift-alert.sh`](../../../script/ops/config-drift-alert.sh). The RPC key allocation assigns K0-4 to the
operator's own machine, which runs it under launchd with `INFURA_API_KEY_OPS`; a Linux host can run it under systemd
instead ([Install](#install)). It pushes to the ops channel of the health notifier ([alerts](../alerts.md)). Timelock
operations, admission reviews, void windows and bets settled after a void on the same path also go to a public channel
that LPs and players can read (ADR-0037 D5 and R-5).

## What it reports

Each run reads new logs up to a confirmed block, by default the last block at least 24 seconds older than the head
(`DRIFT_CONFIRMATION_SECONDS`). One `eth_getLogs` per page covers
every release contract: the timelock, PoolRegistry, GameHub, ReferralRegistry, SettlementRouter, VRFHub, each Bank and
Vault, and the USDC proxy. A message lists its sections in this order:

| Section                                   | Cause                                                                                                                                                                                                                                                                             | Response                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admission review failed                   | A scheduled call that admits an uncertified Bank, Vault, asset, hub or module, leaves the certified domain, moves governance to or from the timelock, or cannot be reviewed                                                                                                       | The Safe or the guardian cancels the operation before the ready time in the title. Reminded until it is cancelled or executed                                                                                                                                                                                                                           |
| Live release verification failed          | The deployed release no longer matches the signed release: roles, delay, governance, sentinel, guardian, pools, hubs, routes or games differ, or an active pool lacks the release activation                                                                                      | Treat it as an incident unless the change is part of a new release being signed. Reminded while it lasts; a recovery message follows                                                                                                                                                                                                                    |
| Certified domain violated                 | Live state outside the domain file: USDC implementation or code, VRF wrapper, coordinator or gas parameters, a module runtime, a game's module, callback gas or round limit, a pool's minimum bet; or a coordinator minimum of request confirmations above the 3 GameHub requests | Release verification would fail now. Stop releases and recertify ([ADR-0006](../../adr/0006-vrf-callback-settlement.md) "Validity and recertification"). A coordinator minimum above 3 rejects every new bet's VRF request (the bet transaction reverts, nothing is held); that needs a provider change, not a recertification. Reminded while it lasts |
| Eligible bet not attempted                | A bet eligible for `voidBet` is still unbooked `DRIFT_VOID_ATTEMPT_SECONDS` (600) after it became eligible                                                                                                                                                                        | The operator's keeper attempts every eligible bet in request order (ADR-0037 §7.3 rule 3): restore it, or void the bet. Anyone may. Reminded while it lasts; cleared when the bet settles or is voided                                                                                                                                                  |
| Unbooked result older than 1 h            | A VRF result received but not booked for `DRIFT_UNBOOKED_ALERT_SECONDS` (3,600)                                                                                                                                                                                                   | The LP fence of that Bank stays closed. Retry the same seed and find the failure ([casino finalization](game-finalization-diffs.md)); open a void window only under the rules of ADR-0037 §7.3. Reminded while it lasts                                                                                                                                 |
| Bet settled after a void on the same path | An eligible bet settled after another bet of the same Bank and the same window, or both by the 7-day limit, was voided                                                                                                                                                            | The execution order decided which bets were voided (residual R-5). Record the bets and their order for the disclosure                                                                                                                                                                                                                                   |
| Unbooked result reaches 7 days soon       | An unbooked result on the 7-day path is within `DRIFT_PUBLIC_VOID_WARNING_SECONDS` (12 h) of 7 days                                                                                                                                                                               | After 7 days anyone may void it once a settlement attempt fails. Book it first if the failure has ended                                                                                                                                                                                                                                                 |
| Recertification trigger                   | `GameRegistered`; `MinBetAmountSet`, flagged below the floor of 99; `PoolRegistered` and pools, hubs or routes set active; risk reserve or withdrawal buffer away from the Owner policy; USDC `Upgraded` or `AdminChanged`                                                        | Set the domain file back to `PENDING_INDEPENDENT_REVIEW` and recertify before the next release                                                                                                                                                                                                                                                          |
| Timelock operation                        | Scheduled (decoded), ready within 12 hours, ready but not executed, executed, cancelled                                                                                                                                                                                           | Execute promptly once ready, or cancel while it waits (decision D5). See [Timelock operations](#timelock-operations)                                                                                                                                                                                                                                    |
| Settlement anomaly                        | `CallbackSettlementFailed`; undelivered `CallbackAttempt`; `PositionApplied` with `released = 0` (the k = 0 path); `BetVoided`; `VoidWindowOpened`; an issuer pause of USDC; a Bank or Vault blacklisted by the issuer                                                            | Follow [casino finalization](game-finalization-diffs.md) and the void rules of ADR-0037 §7.3. Never replace a received result. An issuer freeze is transient for at most 7 days: deactivate the pool or pause the Bank, open no window                                                                                                                  |
| Governance or authority change            | Governance transfers (a started transfer is marked CRITICAL), `SentinelSet`, `GuardianSet`, timelock roles and delay, pauses, `GameDisabled`, pools, hubs and routes set inactive, edge and referral changes, other Bank and GameHub setters, one-shot wiring                     | Compare with the reviewed operation or the sentinel's or guardian's own action. Treat an unexpected change as an incident ([pause and drift](pause-config-drift.md)). Edge and referral changes do not void the certificate (its v5 review)                                                                                                             |
| Bank capacity                             | A Bank holds 96 or more of its 128 open positions; a rejected bet emits no log, so the monitor reads `openHolds()` every run                                                                                                                                                      | Check for one party filling the Bank (residual R-4). Reminded while it lasts                                                                                                                                                                                                                                                                            |
| Unbooked results not tracked              | The VRFHub's `unbookedResultCount` of a Bank differs from the results the monitor tracks, for example results received before it armed                                                                                                                                            | Re-arm with `--from-block` at or before their receipt to track them, or wait until they are booked. Reminded while it lasts                                                                                                                                                                                                                             |
| Release state notes changed               | The live verification passed, but its notes changed: a paused Bank, an inactive pool, a disabled game, a void window, a pending or cancelled operation                                                                                                                            | Confirm each note matches a known action                                                                                                                                                                                                                                                                                                                |

The events of the release's own wiring and activation are counted under that operation's execution, not listed again. A
log that a contract is not expected to emit is reported as a governance change.

## Timelock operations

Every `CallScheduled` is decoded into its target, function and arguments, with the operation's predecessor and delay.
Release contracts appear by name, such as `Bank pool 1` or `GameHub`. A contract outside the snapshot whose runtime is
a certified one appears as, for example, `new Bank 0x…`. The operation is named as the release wiring, the release
activation or undeclared, and its ready time comes from `getTimestamp` at the confirmed block. A message about one
operation looks like this:

```text
TIMELOCK OPERATION SCHEDULED (anyone can execute it once ready; cancel it while it waits)
- 0x5c…e1 (undeclared): 1 call(s), ready 2026-10-21 09:00 UTC (1792573200), delay 259200 s, scheduled in block …, tx …
  1. Bank pool 1.setMinBetAmount(5000) [the Owner policy is 10000; recertification trigger: a minimum bet change (ADR-0006)]
  admission review: passed
```

Open operations stay in the state file. The monitor reports each one again 12 hours
(`DRIFT_READY_WARNING_SECONDS`) before it becomes ready. While it is ready but not executed, the reminder repeats every
6 hours (`ALERT_REMIND_SECONDS`). Executions and cancellations close it. A cancellation is reliable only while the
operation waits: once it is ready, any executor can come first. Operations that were already pending when the monitor
armed are opened from the live verification. Their calls are unknown and they fail the review, except the release's
own wiring and activation, whose calls follow from the snapshot. Re-arm with `--from-block` at or before an operation's
schedule block to review it.

### Admission review

Each scheduled call is checked against the domain file and the release snapshot (decision D4):

- `registerPool`: the casino domain and the certified token. The Bank's runtime must be the certified Bank with its
  immutables zeroed (`coreRuntimes.Bank`). Its immutables must hold that token, the token's decimals and the Bank's
  Vault, and `vault()` must return the same Vault. Its minimum bet must be at or above the floor of 99, counting a
  `setMinBetAmount` in the same operation. It must be bound to no SettlementRouter yet or to the release's, and then to
  no randomness consumer other than the release VRFHub. The Vault's runtime must be the certified LiquidityVault holding
  the token and that Bank.
- `setHubRegistered(hub, true)` and `setHubAllowedForPool(pool, hub, true)`: the hub's runtime must be the certified
  GameHub, and its immutables must be the release's SettlementRouter, VRFHub, ReferralRegistry and referral engine. A
  hub other than the release's must also carry the release's house edge, referral schedule and refund timeout, with no
  edge change pending, because its constructor set them.
- `registerGame`: the module's code hash must be one of `moduleCodeHashes`. The round limit must be within
  1..`maxBetCountCeiling` and the callback gas must equal `consumerCallbackGasLimit`.
- `setSettlementRouterOnce`, `setRandomnessConsumerOnce` and `setBinderOnce` must name the release's contracts.
- `setMinBetAmount` below the floor fails, because it reaches the uncertified k = 0 path.
- `transferGovernance` always fails: once it executes, the new governance can accept at any time and act without delay.
- `acceptGovernance` always fails. Release contracts are built with the timelock as governance, so adopting a contract
  means that another governance configured it first, for example a hub with its own registered games or a Bank with
  its own router. The runtime checks above cannot see that configuration.
- A target that is neither a release contract nor a certified runtime fails, as do a target without code, a selector
  outside the governed functions of ADR-0037 §3, and arguments that do not decode.

Other calls pass with notes, for example a recertification trigger or a role change after which the live verification
will fail. The release wiring passes this review. The review compares code and arguments with the certified artifacts;
it does not simulate execution. It reads code at the confirmed block after scheduling, so a target deployed later still
fails.

## Live release verification

With the signed release record and its checkpoint installed, the monitor runs `verify_permissions` of
[`verify_governance.py`](../../../script/release/verify_governance.py) in live mode. It runs every hour
(`DRIFT_GOVERNANCE_CHECK_SECONDS`), on arming, and after any governance, recertification or operation event. The
record's `checkpointSha256` authenticates the checkpoint. The first verification replays the authorization events from
the signed checkpoint. Later ones replay from the checkpoint the previous verification produced, which the state file
keeps. If that checkpoint's block has left the chain, the monitor returns to the signed one. The checkpoint advances
whenever the replay succeeds, even when the verification then fails, so a lasting failure does not lengthen each
replay.

Live mode accepts changes that only reduce risk and reports them as notes. A pause, an inactive pool, a deregistered hub
or route, a disabled game or a void window is a note. Any addition is a failure: a new pool, game or hub, a role or
delay change, a sentinel other than the Safe, a guardian other than the release guardian, a governance transfer, or an
active pool without the release activation. Such a change stays a failure until a new release is signed and
installed.

## Unbooked results and voids

ADR-0037 §7.3 rule 4 asks for five alerts about results that cannot be booked. The monitor tracks each unbooked result
from VRFHub's `ResultReceived`, `ResultAcknowledged` and `ResultVoided`, the events that move `unbookedResultCount`. A
result booked in the transaction that received it, which is every normal settlement, is never unbooked and is not
tracked. For a tracked result the monitor reads the bet and hub from `VRFHub.getRequest`, the receipt time from the
block header and `vrfRequestedAt` from `GameHub.getBet`, at most `DRIFT_RESULT_READS_PER_RUN` (32) new results per run,
oldest first. Eligibility follows `GameHub.voidBet`: a bet requested at or before a void window's `cohortEnd` is eligible
24 hours after its request but not before the window opened; any other bet 7 days after its request; and no bet before
its result was received. A bet's path is the window or the 7-day limit, whichever made it eligible first. Ages and
deadlines use the timestamp of the confirmed block.

| Rule 4                                                          | Alert                                                                     | Kind                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| Every `VoidWindowOpened`                                        | Settlement anomaly                                                        | Once                        |
| An unbooked result older than one hour                          | Unbooked result older than 1 h (`DRIFT_UNBOOKED_ALERT_SECONDS`)           | Standing: reminded, cleared |
| Some hours before an unbooked result reaches 7 days             | Unbooked result reaches 7 days soon (`DRIFT_PUBLIC_VOID_WARNING_SECONDS`) | Once per result             |
| An eligible bet unattempted 10 minutes after it became eligible | Eligible bet not attempted (`DRIFT_VOID_ATTEMPT_SECONDS`)                 | Standing: reminded, cleared |
| An eligible bet settles after a bet on its path was voided      | Bet settled after a void on the same path                                 | Once                        |

Limits of what logs and views show:

- A `voidBet` that settles the bet emits the same logs as `retry` or `finalize`, so the monitor cannot tell which call
  settled it. For the not-attempted alert this does not matter: a `voidBet` that runs either settles the bet or voids
  it, and one that reverts is no attempt. An eligible bet that is still unbooked has therefore had no attempt.
- The not-attempted alert compares the eligibility time with the confirmed block's timestamp minus
  `DRIFT_VOID_ATTEMPT_SECONDS`. Block timestamps are whole seconds and never decrease; since Base Denim about five
  consecutive blocks share one, which changes neither this comparison nor the confirmed block.
- A late VRF response that arrives and settles in one transaction was never unbooked; the settled-after-a-void alert
  does not count it.
- The 7-day warning is given only for bets on the 7-day path: a bet in a window's cohort is eligible already.
- Results received before the monitor armed are only counted, through the not-tracked alert. Of the windows opened
  before it armed, only the latest is known (the Bank's `voidCohortEnd`), so the settled-after-a-void alert treats the
  bets of earlier windows as that window's cohort. Arm the monitor before the release takes bets, or re-arm with
  `--from-block`.
- The results of a hub outside the release are aged, but their eligibility is not tracked.

## Delivery and state

Each run sends at most one message per channel: the ops channel gets every section, the public channel only the timelock
operations, admission reviews, void windows and bets settled after a void on the same path. The event cursor and all alert state advance only after every configured channel
accepts its message. A failed delivery on any channel changes nothing, and the next run sends the same findings to every
channel again.

- **No channel configured.** The system log is the only sink, and that mode gives no remote notification.
- **Failed runs.** A failed run, for example an RPC failure after its retries, changes no state. After three
  consecutive failed runs the monitor reports itself as stalled, and it announces recovery when runs succeed again.
  Both notices also go to the public channel, so that its silence is not read as an empty queue.
- **Message length.** A channel message is cut at about 3,500 characters and says how many lines it left out; the
  system log has the full message.

Messages and logs never include the RPC URL, a webhook URL or the bot token. The public channel message carries no host
name.

The first run arms the monitor at the confirmed head and announces it with the live verification's result. History
before that block belongs to the release verification. To replay from an earlier block on a fresh state file, run the
wrapper once with `--from-block N`. `--dry-run` prints what would be sent and changes nothing. The state file is bound
to the release's chain and timelock; to monitor another release, move the old file away.

## Install

Both installs use the same files and settings. `cast` and Python 3.9 or later must be on `PATH`.

1. Put these files in one directory:
   - from a checkout of the release commit: `script/ops/config-drift-alert.sh`, `config-drift-monitor.py` and
     `alert-notify.py`; `script/release/verify_governance.py`, `verify_callback_provider.py` and
     `first-callback-domain-<chainId>.json`;
   - from the release bundle whose SHA-256 was approved and whose import passed: `deployments/latest-v16.json`,
     `release-latest-v16.json` and `governance-checkpoint-latest-v16.json`.

   The monitor reads its verifiers and the domain file from its own directory; `RELEASE_TOOLS_DIR` and
   `CALLBACK_DOMAIN_PATH` override that. It checks the checkpoint against the record's digest, but it does not check the
   record's signature, which the bundle import does.

2. Write the alert configuration (`ALERT_CONFIG_FILE`, mode 0600) in that directory. The wrapper sources it with
   `bash`, so quote paths that contain spaces. `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` and `ALERT_WEBHOOK_URL` are the
   health notifier's; `TELEGRAM_PUBLIC_CHAT_ID` names a public channel where the bot can post (or set
   `ALERT_PUBLIC_WEBHOOK_URL`). The wrapper's header lists every other setting and its default.

### On the operator's machine (macOS, launchd)

The directory is `~/Library/Application Support/arbigamefi/config-drift/` (mode 0700), and the alert configuration is
`alert.env` in it:

```sh
DIR="$HOME/Library/Application Support/arbigamefi/config-drift"
SNAPSHOT_PATH="$DIR/latest-v16.json"
RELEASE_PATH="$DIR/release-latest-v16.json"
GOVERNANCE_CHECKPOINT_PATH="$DIR/governance-checkpoint-latest-v16.json"
DRIFT_STATE_FILE="$DIR/state.json"
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_PUBLIC_CHAT_ID=@...
```

It sets no `RPC_URL`. [`with-ops-rpc.sh`](../../../script/tools/with-ops-rpc.sh) builds the endpoint from
`INFURA_API_KEY_OPS` in the repository's `.env`, passes it as `OPS_RPC_URL`, which the wrapper prefers to `RPC_URL`, and
replaces the key in everything the command prints. Run these from the repository root, with `<network>` `base-sepolia`
or `base`:

```sh
DIR="$HOME/Library/Application Support/arbigamefi/config-drift"
export ALERT_CONFIG_FILE="$DIR/alert.env"
script/tools/with-ops-rpc.sh infura <network> "$DIR/config-drift-alert.sh" --dry-run   # prints, changes nothing
script/tools/with-ops-rpc.sh infura <network> "$DIR/config-drift-alert.sh"             # arms the monitor
```

The second command sends the armed message; check that it arrived and reports a passed live verification. Then
install the agent from [`com.arbigamefi.config-drift.plist`](../../../script/ops/launchd/com.arbigamefi.config-drift.plist),
which runs the same command every 300 seconds and logs to `~/Library/Logs/arbigamefi-config-drift.log`:

```sh
sed -e "s|__HOME__|$HOME|g" -e "s|__REPO__|$PWD|g" -e "s|__NETWORK__|<network>|g" \
  script/ops/launchd/com.arbigamefi.config-drift.plist > ~/Library/LaunchAgents/com.arbigamefi.config-drift.plist
plutil -lint ~/Library/LaunchAgents/com.arbigamefi.config-drift.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.arbigamefi.config-drift.plist
launchctl print "gui/$(id -u)/com.arbigamefi.config-drift" | grep -E 'state|runs|last exit code'
```

`launchctl bootout "gui/$(id -u)/com.arbigamefi.config-drift"` stops it. The agent runs only while the user is logged
in and the machine is awake. A run missed during sleep happens on wake and catches up from the cursor, but every alert
that depends on time (the 12-hour warning, ready reminders, result ages, block counts) is late by as long as the machine
slept. Keep the machine awake while the monitor is the K0-4 control, or also run it on a host.

### On a Linux host (systemd)

Use `/opt/arbigamefi/ops/` as the directory and `/opt/arbigamefi/ops/alert.env` as the alert configuration, with the
same settings as above, `DRIFT_STATE_FILE=/var/lib/arbigamefi/config-drift.state.json` and `RPC_URL` set to an
endpoint that the RPC key allocation provides for the host. Run `/opt/arbigamefi/ops/config-drift-alert.sh --dry-run`,
then `/opt/arbigamefi/ops/config-drift-alert.sh` to arm, check the armed message, then install
`script/ops/systemd/arbigamefi-config-drift.{service,timer}` into `/etc/systemd/system/` and run
`systemctl enable --now arbigamefi-config-drift.timer`. `journalctl -t arbigamefi-config-drift` shows each run.

### Before the release is signed

While the wiring waits in the queue, the monitor can run without `RELEASE_PATH` and `GOVERNANCE_CHECKPOINT_PATH`. It
then reviews the wiring as it is scheduled, and the live verification is off. Add both settings after signing and keep
the state file.

**RPC budget.** Base makes five blocks a second since Denim (Base Sepolia 2026-10-21, mainnet November 2026), so a
run every 300 seconds finds about 1,500 new blocks. Through `with-ops-rpc.sh infura` a log page is 10,000 blocks
(`GOVERNANCE_LOG_PAGE_BLOCKS`; 200 on any other endpoint, under the 201 of Base's public RPC). With one pool a routine run
makes about 14 calls: chain id, block number, about 9 block headers to find the confirmed block, one `eth_getLogs`,
`openHolds()` and `unbookedResultCount()`. That is about 4,000 calls a day, 288 of them `eth_getLogs`. The hourly domain
check adds about 40 calls and the hourly live verification about 25, with two `eth_getLogs` pages for its 18,000
blocks: about 5,600 calls a day. While results stay unbooked, each run reads one or two block headers more, and each
newly tracked result costs three reads. A scheduled operation adds a few code reads and calls per reviewed call.
Catching up after downtime takes up to 5 pages per run (`DRIFT_MAX_BLOCKS_PER_RUN`, 50,000 blocks, about 2.8 hours).
The first verification after arming replays from the signed checkpoint, about 44 pages per day since signing. Do not
put the monitor on the keeper's RPC quota.

## Before relying on it

Test the monitor on the deployed chain before claiming the K0-4 condition is met:

1. Confirm the armed message arrives on the ops channel with a passed live verification.
2. Have the Safe schedule a harmless operation, for example `setRefundTimeout` with the current value. Confirm the
   decoded alert on both channels, then have the guardian cancel it and confirm the cancellation report. The testnet
   acceptance's unpause and guardian replacement through the timelock exercise the warning, ready and execution alerts.
3. Schedule a call that must fail the review, such as `registerGame` with an uncertified module, confirm the
   `ADMISSION REVIEW FAILED` alert, and cancel it.
4. Confirm that stopping the RPC produces the stall message, and restoring it produces the recovery message.
5. On the operator's machine, confirm with `launchctl print` that the agent runs every 300 seconds and that a run after
   waking from sleep catches up.
6. If the testnet acceptance leaves a result unbooked or opens a void window, confirm the unbooked-result alert after
   an hour, the not-attempted alert while the keeper is stopped, and its clearing once the bet is voided.

The unit tests (`test/ops/test_config_drift_monitor.py`) cover the operation alerts and reminders, the admission review
including the release wiring, live verification failures and recovery, the unbooked-result and void alerts,
classification, the domain and capacity checks, cursor discipline, delivery retry and secret hygiene against a local
chain model. They do not prove delivery to the real channels, the launchd or systemd schedule, or coverage of the
deployed addresses.
