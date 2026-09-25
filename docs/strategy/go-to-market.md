# ArbiGameFi GTM execution plan

> Revision: 2026.09-r3 · Updated: 2026-09-26 · Audience: internal product, growth and operations leads
>
> Strategy: [project master plan](project-master-plan.zh-CN.md). This is the execution plan, not a public whitepaper.

## Objective and initial segment

Validate whether wallet-experienced adults who already use EVM networks and
stablecoins choose and return to ArbiGameFi for an understandable entertainment
experience with inspectable costs and settlement. Serve only the intended
operating audience; language or a public URL does not establish service
eligibility in a jurisdiction.

Focus the initial commercial validation on Base and USDC. This concentrates
capital and support rather than making a market-size claim. Casino is the first
repeatable usage and operating loop; the initial sportsbook remains a separate
fixed-odds product with independent bankroll and result controls.

The user proposition combines enjoyable familiar games, usable wallet flows,
clear total cost and reliable payments. Verifiability is a trust foundation;
it is not evidence that users will choose or retain the product.

## Materials and their jobs

| Material             | Decision it supports                                   | Delivery                                                                          |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Brief                | Is this relevant, and where do I go next?              | Concise Chinese introduction with a complete English counterpart in the same file |
| Business whitepaper  | Is a resource or cooperation discussion worthwhile?    | Market hypothesis, differentiation, economics, distribution and execution case    |
| Technical whitepaper | Are the mechanisms and trust assumptions acceptable?   | Design rationale and a route to implementation evidence                           |
| Player help          | Can I use the available product and recover a problem? | Rules, fees, network/wallet steps and receipts                                    |
| LP disclosure        | Do I understand this specific pool's capital terms?    | Current economic rights, risks, liabilities and exit limits                       |
| Partner guide        | How do attribution, compensation and settlement work?  | Actual applicable terms and reconcilable examples                                 |

Player, LP and partner guides are targeted participation materials, not three
new whitepapers. Their public interfaces must use current release terms. A
next-version allocation model is not a current LP offer.

## Work packages

| Package | Required output                                                                                 | Dependency                                                        | Completion decision                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| WP      | Audience-led whitepapers, brief, internal strategy and aligned navigation                       | Existing positioning and research                                 | Separate business and technical reviewers can identify the intended reader and decision                       |
| E1      | Accurate LP metrics and explanatory copy for the existing release                               | Read-only accounting findings                                     | GGR, partial cash-flow history and asset-level series cannot be mistaken for investor returns                 |
| E2      | Chosen economic model, calibrated parameters, accounting/event specification and migration path | [Economic design](economic-design.md) and actual cost evidence    | Per-outcome budget, reserve and cost analysis supports an implementable specification                         |
| U1      | Complete first/returning-player flow and targeted help                                          | Can proceed independently of E2 where terms do not change         | Approval, uncertain submission, automatic settlement, receipts and actual mobile paths have relevant evidence |
| V1      | Bounded usage and operating validation                                                          | Relevant E1/E2/U1 requirements, defined capital and service scope | Results are reviewed against targets set before the observation window                                        |
| S1      | Initial sportsbook service                                                                      | Independent data, rulebook, capital and risk design               | Sportsbook-specific readiness and acceptance; casino evidence does not substitute                             |

Existing frontend priorities are implemented within U1; the
[frontend plan](../design/frontend-implementation-roadmap.md) holds technical
detail. Financially misleading metrics are corrected in E1 without waiting for
an entirely new protocol economy. E2 is followed by separately reviewed code,
release and migration work before the new terms are used.

## Demand research and growth experiments

The following are planned experiments, not completed customer research.

1. **Problem and task observation.** Ask eligible participants about their
   existing choices, then observe a testnet task from rules through a receipt.
   Record why they choose, abandon or misunderstand, without coaching them into
   a positive answer. Small samples identify friction, not population conversion.
2. **Return motivation.** Observe subsequent voluntary use with the incentive
   condition recorded. Separate entertainment interest, trust preference and
   reward-seeking. A return visit is not necessarily a funded completed round.
3. **LP comprehension.** Have a potential capital provider explain the pool's
   economic rights, loss scenario and exit limits back in their own words.
   Feedback does not constitute a capital commitment.
4. **Partner economics.** Prepare a limited campaign model based on attributable
   users, retained contribution and actual channel costs. Begin execution only
   within a defined operating and spending scope. Prepare materials before any
   outreach; this documentation work has not contacted third parties.

Do not treat all channels as interchangeable. Education about wallet-native
use and receipts can serve discovery; community relationships can support
feedback; affiliate campaigns must justify their incremental cost. Paid reach,
airdrop expectations and referral volume are not substitutes for retention.

## Measurement specification

| Question                               | Definition                                                                           | Required segmentation                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Did interest become a usable session?  | Discovery to rules viewed, wallet connected and intended network                     | Source, device path, testnet/mainnet; consent-aware collection               |
| Did the player complete a bet?         | Approval, accepted bet and paid/refunded terminal state tracked separately           | Chain, game, transaction stage; exclude duplicate observations               |
| Was the service dependable?            | Accepted-to-terminal delay distribution, unresolved age, recoveries, index freshness | Chain, observation period and relevant incident conditions                   |
| Did the person return voluntarily?     | Cohort return and completed use, with denominators and window fixed first            | Incentivized/unincentivized, test/real funds, channel                        |
| Was capital compensated?               | Pool NAV and share changes reconciled with flows and external liabilities            | Bank, asset, valuation points; incomplete history remains incomplete         |
| Was the channel contribution positive? | Protocol contribution after attributable service and acquisition costs               | Channel cohort and attribution window; prevent double-counted referral costs |

Do not call wallet addresses unique people. Do not combine test tokens with
real-money turnover or TVL. Choose observation windows, targets and financial
limits before V1 starts. No measured conversion or retention is claimed by this
plan; the current analytics wiring and data quality need their own verification.

## Capacity and spending decisions

Maintain two principal engineering streams: player/settlement quality and
economics/capital accounting. Material preparation and research are a supporting
stream. Keep sports design moving at a scope that does not consume the resources
needed to close the first operating loop.

Before increasing audience, capital or spend, assess total player costs, LP
risk/compensation, protocol service costs and acquisition contribution together.
If one leg depends on an unbounded subsidy, revise the operating scope or design.
A subsidy has a source, owner and end condition and is reported separately.

A fund-safety or debt-recovery defect preempts acquisition work. High abandonment
without a financial defect calls for task diagnosis before buying more traffic.
Low retained contribution calls for a channel or pricing change before broader
expansion. The purpose of the measurements is to change decisions, not decorate
a progress report.

## Current evidence and next execution

Use the dated [release facts](../release/STATUS-v1.5.zh-CN.md) to determine what
can actually be offered, and the [repository review](../audit/RepositoryReview-2026-09-25.zh-CN.md)
for existing rework evidence. Re-read release and chain state before an operating
change; this plan does not treat a historical status as current verification.

The present delivery is WP. E1 and the independent parts of U1 follow, while E2
produces the economic implementation specification. The
[sportsbook plan](sportsbook-production-roadmap.md) remains the specialized S1
reference. Public materials use capability milestones; detailed tasks and
internal alternatives stay here and in the economic design record.
