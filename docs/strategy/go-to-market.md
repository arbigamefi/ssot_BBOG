# ArbiGameFi GTM execution plan

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

The project has not launched. This plan defines how to validate the product and its operating model; it claims no users, retention, revenue, deployment or capital commitments. The [master plan](project-master-plan.zh-CN.md) sets scope and the [release guide](../release/README.md) governs release evidence.

## Audience and scope

Begin with adults who already understand EVM wallets and stablecoins and are eligible for the eventual service. Base and USDC are the initial product focus. Casino establishes the first repeatable operating loop; a separately funded sportsbook has its own odds, evidence and release requirements.

The hypothesis is that enjoyable familiar games, understandable total costs, inspectable payments and reliable wallet flows can earn voluntary repeat use. Public source code alone does not validate that hypothesis.

## Work packages

| Work       | Required result                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Product    | Rules, authorization, submission, results, receipts and recovery work on intended wallet and mobile paths                                |
| Capital    | Vault tree equity, Bank principal/debts, net lock, NFT maturity and per-deposit cash/ownership history reconcile                         |
| Operations | Atomic callback, same-result retry, eligible refunds, payables, alerts and restart/WS/HTTP recovery are exercised with bounded resources |
| Economics  | Current 50% LP allocation, referral costs, player costs and operating budget reconcile across outcome and stress scenarios               |
| Research   | Defined participants, observation window and decision criteria precede usage or channel experiments                                      |
| Sports     | Independent rulebook, provider evidence, deadlines, bankroll and operation acceptance                                                    |

The [economic design](economic-design.md) fixes the allocation model. Calibration adjusts permitted parameters within it, not LP's fixed share. The [architecture](fullstack-product-architecture.md) defines implementation ownership.

## Demand research

Observe participants completing a test task from rules to receipt. Record abandonment, misunderstood costs and recovery friction. Ask prospective LPs to explain the 24-hour lock, partial-withdraw relock, unchanged transfer deadline, net free-capital limit, old-prefix P&L fallbacks and absence of a guaranteed full-exit time. Feedback is not a capital commitment.

Study voluntary return separately from incentive-driven activity. For channels, compare attributable completed use and retained contribution against actual rewards and acquisition spending. Set a campaign's scope and budget before execution.

## Measurement

| Question                  | Evidence                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Did interest become use?  | Rules viewed, wallet connection, authorization and accepted bet, by source and device                       |
| Did payment finish?       | Terminal state and actual transfer or player payable tracked separately                                     |
| Was service reliable?     | Accepted-to-terminal delay, unresolved and recorded-result-unbooked age, retries and index freshness        |
| Did users return?         | Fixed-window cohorts, with subsidized and unsubsidized use separated                                        |
| Was capital compensated?  | NFT node values and owner-at-event cash flows reconciled with tree P&L; transfers and surplus kept separate |
| Did a channel contribute? | Attributable protocol income less its service and acquisition costs                                         |

Wallet addresses are not unique people. Test funds are not real turnover or TVL. Partial history cannot establish investor returns. Targets, denominators and financial limits are fixed before the observation window.

## Resource decisions

Fund safety and debt recovery take priority over acquisition. High abandonment calls for diagnosing the task; poor contribution calls for reducing costs or revising scope. Any subsidy has a source, owner and end condition. Scale audience and capital only when player costs, LP risk, service capacity and channel contribution support doing so.

Public materials have distinct jobs: the [brief](../ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md) introduces the project, the [business whitepaper](../WHITEPAPER.product.zh-CN.md) supports cooperation assessment, and the [technical whitepaper](../WHITEPAPER.zh-CN.md) explains mechanisms. Guides explain concrete participation and recovery. None replaces release evidence or operating authorization.
