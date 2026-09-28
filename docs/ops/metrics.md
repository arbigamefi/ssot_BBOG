# Metrics and reconciliation

This is the current monitoring inventory, not a claim that every series already has an exporter.
The implemented keeper health snapshot and web `/api/healthz` are described in the
[keeper README](../../frontend/apps/keeper/README.md). Contract reconciliation requires separate
fixed-block reads and event processing.

Label records with chain ID and contract address. Use `(chainId, GameHub, betId)` for casino bets,
`(chainId, SportsHub, ticketId)` for Sports tickets and `(chainId, Bank)` for LP accounting. A pool ID,
bet ID or address without its chain is insufficient. Convert asset units only using the verified
asset decimals; keep ETH fees separate from asset-denominated payout amounts.

## Bank

| Observation          | Source and meaning                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash and liabilities | `getSSOT().B`, PF, XP; separate `exitPayable`, `playerPayableTotal` and `recoveryBacking` reads                                                                                                                            |
| NAV and backing      | `NAV = B - PF - XP - exitPayable - playerPayableTotal - recoveryBacking`; verify active NAV >= activeReserved and cash covers fixed debts, recoveryBacking and activeReserved (without double counting historical reserve) |
| Risk capacity        | `riskReserveBps`, `riskReserve`, `riskFree`, R; new hold capacity is not an LP cash entitlement                                                                                                                            |
| Optional outflow     | `withdrawalBufferBps`, `withdrawalBuffer`, `withdrawable`; reserve/buffer headroom, not a per-claim cap. PF/XP claims enforce the post-payment NAV domain; priced LP claims draw from exit payable                         |
| Open holds           | `openHolds = totalBetsHeld - totalBetsSettled - totalBetsRefunded`; do not substitute R == 0                                                                                                                               |
| Redemption           | `currentEpoch`, its queued `redeemBatch`, escrowed shares, fixed exits and paginated historical recovery                                                                                                                   |
| Recovery age         | Chain timestamp minus actual epoch activation, with remaining holds and complete discovery state; survives worker restart                                                                                                  |
| Pause                | Bank pause bit, pool active state and active-capital insufficiency are distinct; LP queue/recovery state cannot gate risk-in                                                                                               |
| Performance          | Lifetime turnover, payouts and fee counters describe settled accounting; they do not alone prove cash transfer                                                                                                             |

Read related values at the same numbered block. Counter differences over a window must preserve the
starting baseline and handle reorgs. Reconcile liability movements against actual transfer events;
failed player transfers may become payable debt while the bet is already terminal.

## Casino and VRF

Track PendingVRF and RandomReady counts, oldest placement/random-ready timestamps, terminal outcomes,
refunds, module fallback refunds and failed finalization errors. Measure queue and lifecycle recovery
coverage independently: an empty live-event queue may still leave historical bets unresolved.

For PendingVRF, derive refund readiness from `placedAt + current refundTimeoutSeconds`, using chain
time. RandomReady age is a finalization concern, not timeout-refund eligibility. Record the actual
simulation/send gas and admission configuration when investigating failures.

Track VRF Requested, Fulfilled, Detached, HubCallbackFailed and Ignored events with request identity.
Derive active work from actual request/Hub state; Ignored callbacks can repeat and are not one-for-one
request completions. Monitor payer refund credits and claims separately. VRFHub ETH balances can
back those credits and are not required to be zero.

## Keeper, database and application

Track health snapshot age, queue depth, last successful scans, recovery coverage origins/cursors,
oldest unresolved work, write errors, transaction outcomes, RPC throttling and per-Bank queued activation and historical recovery state.
Watch each `degradedBy` cause independently; an unrelated success cannot clear a failed recovery or
activation or historical discovery path. Observe signer gas balance and nonce progress without logging keys or provider tokens.

Database checks include connectivity, storage capacity, cursor advancement relative to confirmed
chain head, duplicate/reorg reconciliation and backup age. Receipt APIs must distinguish unavailable
proof from an actual zero payment. The provider ledger requires Bank identity; its history does not
replace on-chain current balances.

The health endpoint aggregates release, keeper and database checks. Its healthy response is a point
in time observation, not proof that every bet ended or every payable was claimed.

## Sports

If Sports is admitted, monitor market state, lock/finality/challenge timestamps, result hashes,
reporter quorum, outstanding tickets and pool/event exposure. Track keeper history coverage and
pending ticket pages through terminalization. Missing reports and repeated reopenings require an
owner; they have no universal finite timeout. See [Sports operations](runbooks/sportsbook-ops.md).
