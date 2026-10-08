# Sportsbook Production Roadmap

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

The project is unlaunched. Sportsbook is a separate product and release decision, with an independent bankroll. Casino tests and casino settlement deadlines do not establish sports readiness. See the [current constitution](../constitution/SSOT.v1.6.md), [release guide](../release/README.md) and [sports operations runbook](../ops/runbooks/sportsbook-ops.md).

## Initial scope

The proposed first service is pre-match fixed-odds football 1X2 singles, one chain and one approved asset. It does not include live betting, parlays, props, futures or shared casino/sports capital.

```text
Market discovery -> signed odds -> accepted ticket -> tracker
  -> result evidence and finality -> settlement or refund -> payment receipt
```

SportsHub owns tickets and result lifecycle; SportsRiskEngine enforces exposure limits. Signed odds bind price, market version, expiry, nonce and risk parameters. Signatures establish authorization, while source evidence and the rulebook determine what a result means.

## Admission and capital

The accepted casino target uses a dedicated ERC-721 LiquidityVault and fixed 24-hour locks.
Withdrawal is bounded by a mature NFT's node and L-K; partial success relocks the remainder and
transfer preserves its deadline. Bet P&L uses the opening deposit-ID prefix with whole-tree fallbacks;
zero-root profit goes to protocol capital. No fungible share price, extra LP buffer or last-NFT rule
applies. Normal withdrawals introduce no planned betting pause.

Sports needs its own LP pricing review: a real-world result, reporter proposal or disputed outcome
may be public long before a ticket books its loss. Casino's stored-VRF-seed fence does not establish
that Sports deposits or exits are safe in those intervals. Resolve valuation and ordering rules for
those known-result states, independently from the casino callback implementation.

Admission also requires complete deadlines and public terminal paths for missing reports, disputes,
cancellation and voids. No timeout may silently replace a valid winner's entitlement with a refund.
Until these controls and tests are complete, Sports remains outside first-release casino Banks.
Calibrate pool, market and correlated-event limits and deposit cutoff semantics against independent Sports capital; no historical
LP pocket, forced haircut or compatibility mode is introduced.

## Required release evidence

| Area               | Required result                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Player path        | Market selection, quote expiry, placement, ticket tracking and readable receipt work on intended wallets |
| Rules and evidence | First market class has fixed rules, reproducible source evidence and explicit cancellation semantics     |
| Authorization      | Odds, reporting, challenge and arbitration keys have identified roles and custody                        |
| Terminalization    | Result finality, settlement, refunds and deadline recovery complete under failures and restarts          |
| Capital            | Limits cover maximum liability, correlated events, simultaneous withdrawals and public-result LP pricing |
| Operations         | Responsible operators, independent recovery access, funding, alerts and escalation are exercised         |
| Release identity   | Exact code, ABI, configuration and deployed dependencies are verified in the target environment          |

Receipts distinguish terminal economics from actual cash payment or player payable. Raw hashes can be available for inspection without being the primary player explanation. Normal users should not need operator screens to understand their ticket.

## Sequence

Complete rules and terminal deadlines alongside the player journey. Then validate provider evidence, custody, risk limits and operating recovery. Assemble the current release artifacts and run bounded acceptance in the intended environment before any public opening. Expand market classes only after the first scope has demonstrated reliable service and sustainable costs.

Existing SportsHub, SportsRiskEngine, frontend and keeper suites provide regression coverage; release evidence must state the exact revision, configuration, scenarios and limits verified. No dated status memo or passing unrelated casino suite substitutes for that evidence.
