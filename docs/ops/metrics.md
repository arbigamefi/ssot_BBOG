# Metrics and reconciliation

Target monitoring inventory for the [accepted design](../design/lp-accounting-and-callback-implementation.md).
Keeper health now exports the two-custodian pool observations; full operational qualification remains pending.
A healthy keeper is a point-in-time observation,
not proof that every bet terminated or every debt was paid.

Label bets by (chainId, GameHub, betId), pools by (chainId, Bank, Vault), and deposits by
(chainId, Vault, depositId). Use signed asset decimals and separate native fees from asset payments.
Read related values at one numbered block; preserve baselines and account for reorgs.

## Bank and LiquidityVault

| Observation                | Meaning                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Bv and Bb                  | Actual Vault and Bank asset cash; neither alone is LP capital                                                                                 |
| L, P and G                 | Original-tree root L; unresolved player principal P held by Bank; betting basis G=L+P                                                         |
| R and K                    | Gross terminal reserve R; Vault net lock K=R−P; require R≥P and 0≤K≤L                                                                         |
| PF, XP and PP              | Fixed Bank liabilities; later payment does not allocate a second LP loss                                                                      |
| Sv and Sb                  | Diagnostic surplus: Bv−L and Bb−P−PF−XP−PP; negative values are deficits, not surplus                                                         |
| Accounting status          | Successful reads, reciprocal bindings and ledger validity; invalid/unavailable is not healthy zero                                            |
| Risk headroom              | Existing G-based new-bet predicate; distinct from LP free capital L−K and optional PF/XP outflow limits                                       |
| NFT position               | Owner, current leaf value, withdrawAfter, chain time, maturity and availability reason; NFT count is not money                                |
| Per-owner cash upper bound | Aggregate eligible owned values capped once by common L−K; percentage granularity can reduce executable cash; do not sum per-card global caps |
| Canonical unbooked results | Per-Bank count and original receipt age; Vault funding gate remains until terminal accounting                                                 |
| Pause and busy state       | Independent from maturity, liquidity or result gate; LP withdrawal does not schedule a betting pause                                          |
| Protocol capital           | Empty-root positive P&L separately recorded from gameplay fee revenue; accidental surplus is not included                                     |
| Open-position capacity     | All open positions count against 128; no active/historical split remains                                                                      |

After successful LP payment refresh root L, G and maximum bet at or after the receipt block.
A 24-hour timer is an eligibility condition, not a guarantee of cash availability. Partial-success
withdrawal restarts only that ID's timer; NFT transfer preserves it. Report zero-value live NFTs,
burned IDs and missing reads distinctly.

Capital history and NFT ownership history are different. A transfer has no protocol asset cash flow
and does not establish the receiver's acquisition cost. Mint/burn plus deposit/withdraw events in one
receipt must not double-count money. Finalized history may lag live reads; expose its coverage.

Track source-pinned tree allocation and the immutable per-bet cutoff. Prefix exhaustion can use the
whole-tree fallback, so a later deposit is not categorically excluded from old outcomes. Root/node
rounding, protocol-capital assignment and G's 2^108−1 bound belong in reconciliation tests.

## Casino and VRF

Measure accepted-to-terminal latency for all bets, including callbacks needing no keeper transaction.
Monitor pending requests, canonical results, failed Hub delivery/finalization, retry age/reason, complete
wrapper/Hub/Router/Bank/Vault/tree/ack gas, failure overhead and native refund credits.
A standalone finalize metric does not establish callback headroom.

GameHub PendingVRF alone cannot justify a refund: canonical seed must be absent and the fixed deadline
reached. A received result needs original-seed replay/finalization. Do not derive state by subtracting
possibly repeated ignored events. Unknown module failures are not successful fallback refunds.

Player terminal accounting and cash payment are independent observations: transferred, payable, none
and unknown require different evidence. Later PP payment changes Bank cash/debt without another tree loss.

## Keeper, database and application

Keep WS and HTTP coverage separate; observe last scans, lifecycle origins/cursors, finalized coverage,
backlog age, signer gas/nonces, database failures and actual send outcomes. An unrelated successful task
must not clear a failed path. Never log keys or provider credentials.

Already-terminal callbacks should not trigger sends. Record races separately from persistent failures.
Test terminal-before-ready notifications, duplicates, replay, several bets in one receipt and reorg
replacement. Event identity uses RPC logIndex; payout delimitation uses full-receipt array positions.

The keeper neither activates NFT maturity nor withdraws user deposits. Track NFT events through the
authenticated Vault; no user approval is required for public indexing. Business peak, p99 and denial-cost
thresholds are still unselected admission work. Local timings are not an on-chain/provider latency SLA.

Current `pools[]` health rows include Bank/Vault identity, cash, L/P/R/K/G/PF/XP/PP,
`accountingValid`, `openHolds`, `maxOpenHolds`, `capacityHeadroom`, `lpStatus`, `paused` and
`observedBlock`. An unbooked result is reported as a pool degradation; it must not look like
a healthy pool whose LP entry is inexplicably unavailable. Age/latency qualification is separate
from this state snapshot. See [local application evidence](../audit/nft-consumer-integration-review.md).

## Sports

Sports is separately admitted. Monitor result disclosure, market finality/challenge, missing reports,
tickets and correlated exposure. Casino's canonical VRF gate does not cover public sports outcomes.
See [Sports operations](runbooks/sportsbook-ops.md).
