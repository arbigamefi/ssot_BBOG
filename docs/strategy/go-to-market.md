# ArbiGameFi go-to-market working plan

> Updated: 2026-09-25 · Status: Working proposal, not a launch authorization
>
> Baseline: v1.5 / `aaa5c807d09f72e972bfad286901c3bb3e88b9ee`
>
> Sources: [release facts](../release/STATUS-v1.5.zh-CN.md), [product whitepaper](../WHITEPAPER.product.zh-CN.md), [system review](../audit/RepositoryReview-2026-09-25.zh-CN.md)

This revision supersedes the earlier growth draft. Historical turnover/APY examples,
LP “earn the house edge” claims and unimplemented rewards are not current product
facts. Retrieve the previous draft through Git when reviewing past decisions.

## Current scope

The v1.5 release contains eight casino games on Base and Base Sepolia. Public
mainnet betting remains disabled in the website; the USDC contracts are not
paused at the recorded blocks. Sportsbook code is not deployed in this release.
The present acquisition use case is testnet experience and feedback.

## Audiences and messages

| Audience | Useful message                                                    | Evidence / condition                                                         |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Players  | Inspect game rules, fees and settlement receipts                  | A complete first-use path and clear testnet/mainnet labeling                 |
| LPs      | Understand pool assets, liabilities, shares and withdrawal limits | A separate economic assessment; no fixed or inherently positive return claim |
| Partners | Share a room link and understand binding and reward conditions    | Preserve network/referral context; distinguish accrued, locked and holdback  |

Do not equate house edge with LP income. The current casino model separately
accrues PF/XP against turnover. Under the fair Coin Toss example in the technical
whitepaper, LP expectation is zero before other costs while bearing variance.
LP compensation and sustainable liquidity supply need a deliberate decision;
copywriting cannot create a missing fee-sharing mechanism.

## Delivery sequence

1. Align the brief, whitepapers, homepage, footer and FAQ with release facts.
2. Make network, assets, gas/VRF costs, approval and bet signatures understandable.
3. Verify referral links and real mobile wallet handoffs on new-user sessions.
4. Correct LP metric labels and the scope of local responsible-play settings.
5. Publish readable documentation from the same Markdown source; prioritize a
   complete English brief and first-use/fees/verification guides.
6. Instrument the consent-aware funnel and use actual failures and feedback to
   choose subsequent improvements.
7. Consider limited mainnet access only after liquidity, economic disclosure,
   operation and unresolved review findings are addressed for that scope.

## Proposed measurement, not an existing dashboard

Measure landing → room → wallet connected → correct network → approval confirmed
→ bet confirmed → settlement/receipt. Split by environment and device category.
Record cancellation, insufficient funds, RPC failures and unknown submission as
distinct outcomes; do not encourage repeated bets to compensate for failures.

The analytics provider exists but business funnel calls are not yet wired. Do not
claim conversion percentages until measurement is implemented and validated.
Do not collect wallet secrets or private signing data for attribution.

## Promotion materials

Use real, labeled screenshots and receipts, game rules, a short product explanation,
and a link to current status. Existing OG images and share tools can be reused.
Testnet funds are not TVL or real-money turnover. No fabricated activity, guaranteed
returns, assumed airdrops, false urgency, or loss-chasing incentives.

Publication of campaign materials and a future mainnet opening are separate
operational actions; this plan does not enable either automatically.
