# Sportsbook Production Roadmap

The project is unlaunched. Sportsbook is a separate product and release decision, with an independent bankroll. Casino tests and casino settlement deadlines do not establish sports readiness. See the [current constitution](../constitution/SSOT.v1.6.md), [release guide](../release/README.md) and [sports operations runbook](../ops/runbooks/sportsbook-ops.md).

## Initial scope

The proposed first service is pre-match fixed-odds football 1X2 singles, one chain and one approved asset. It does not include live betting, parlays, props, futures or shared casino/sports capital.

```text
Market discovery -> signed odds -> accepted ticket -> tracker
  -> result evidence and finality -> settlement or refund -> payment receipt
```

SportsHub owns tickets and result lifecycle; SportsRiskEngine enforces exposure limits. Signed odds bind price, market version, expiry, nonce and risk parameters. Signatures establish authorization, while source evidence and the rulebook determine what a result means.

## Admission and capital

The Bank prices available redemption cash at activation and segregates current-position backing with its original holders' recovery rights. LP exits do not stop adequately funded betting, and unresolved historical positions do not gate later exits. Sports admission independently requires complete deadlines and public terminal paths for missing results, disputes, cancellation and voids: retaining recovery rights does not establish timely player payment. No timeout may silently replace a valid winning entitlement with a refund.

Until those conditions and their tests are complete, sports pools are not admitted to the casino Banks. A generic reserve haircut does not resolve ownership of a later release and is not part of the design. Pool, market and correlated-event limits must be calibrated against independent sports capital.

## Required release evidence

| Area               | Required result                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Player path        | Market selection, quote expiry, placement, ticket tracking and readable receipt work on intended wallets |
| Rules and evidence | First market class has fixed rules, reproducible source evidence and explicit cancellation semantics     |
| Authorization      | Odds, reporting, challenge and arbitration keys have identified roles and custody                        |
| Terminalization    | Result finality, settlement, refunds and deadline recovery complete under failures and restarts          |
| Capital            | Limits cover maximum liability, correlated events and simultaneous LP requests                           |
| Operations         | Responsible operators, independent recovery access, funding, alerts and escalation are exercised         |
| Release identity   | Exact code, ABI, configuration and deployed dependencies are verified in the target environment          |

Receipts distinguish terminal economics from actual cash payment or player payable. Raw hashes can be available for inspection without being the primary player explanation. Normal users should not need operator screens to understand their ticket.

## Sequence

Complete rules and terminal deadlines alongside the player journey. Then validate provider evidence, custody, risk limits and operating recovery. Assemble the current release artifacts and run bounded acceptance in the intended environment before any public opening. Expand market classes only after the first scope has demonstrated reliable service and sustainable costs.

Existing SportsHub, SportsRiskEngine, frontend and keeper suites provide regression coverage; release evidence must state the exact revision, configuration, scenarios and limits verified. No dated status memo or passing unrelated casino suite substitutes for that evidence.
