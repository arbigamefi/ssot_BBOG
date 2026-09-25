# ArbiGameFi 项目简介

> 文档编号：AGF-BRIEF-2026.09-r2 · 设计状态：Design Draft（设计草案）· 编辑状态：Review Copy
>
> 日期：2026-09-26 · 语言：zh-CN，附英文说明 · 读者：玩家、LP、推广伙伴与产品合作方

## 项目愿景

**ArbiGameFi 要成为一个钱包原生的 casino 与 sportsbook：玩家看得懂规则、核对得到结算，资金提供者和推广伙伴拥有清楚的参与机制。**

产品以单品牌 B2C 形态服务用户。底层采用 SSOT 结算架构，将资产账本、游戏规则、体育结果和支付流程分开，使消费产品可以逐步扩展，同时保留可核对的资金与结果依据。

本文说明项目要做成什么，以及如何推进。新增经济和治理机制仍属设计提案；哪些功能已经交付，另见[发布事实表](release/STATUS-v1.5.zh-CN.md)。

## 产品为谁创造价值

| 参与者     | 核心需求                                 | 产品设计                                                   |
| ---------- | ---------------------------------------- | ---------------------------------------------------------- |
| 玩家       | 容易开始，清楚成本，知道结果与钱去了哪里 | 钱包访问、签名前报价、正常自动结算、可核对的凭证和异常处理 |
| LP         | 知道承保风险、如何获得补偿、何时可以退出 | 明确经济分配、按池资本与负债、份额权益、损失情景和退出能力 |
| 推广伙伴   | 归因清楚，合作条件稳定，奖励可对账       | 明确绑定、预算内奖励、资格与成熟规则、可追溯支付           |
| 产品运营者 | 能持续提供服务并控制扩张风险             | 有来源的运营预算、可观察的业务链路、资本与服务能力约束     |

这些价值需要一起成立。顺畅下注应由可用资本和可靠结算支撑；渠道增长应建立在用户体验与有边界的奖励预算上；LP 提供风险资本，应在经济设计中有明确补偿来源。

## 产品怎样工作

玩家选择游戏或体育市场，核对网络、金额、规则、潜在派彩与费用，用自己的钱包签署。授权不足时先授权，再签署投注。下注资金进入 Bank 智能合约，按接受时的规则结算到记录的钱包；无需向平台托管账户预充值。用户保管私钥，合约持有资金期间仍需承担其代码、治理与资产风险。

Casino 通过随机数和公开规则决定结果，正常结算由自动化服务推进。Sportsbook 通过固定赔率票据、赛事结果证据及争议/作废规则结算，是一条需要独立建设的产品线。两者共享资金规则，不混用结果可信度和退款承诺。

LP 向选定资产池提供资本，持有剩余净资产的份额，并承担赔付波动。产品应让 LP 看清份额价值、负债、预留和退出限制。推广伙伴可核对归因与奖励；奖励属于有资金来源的支出。

## 商业与经济设计

项目需要从透明定价中形成足以补偿 LP、维持服务并支持获客的收入预算。**Casino 推荐评估的模型是：将实际派彩扣减的一部分保留给 LP，其余在协议和推广预算间分配。** Sportsbook 则需结合固定赔率与赛事风险单独确定分配机制。对比方案、守恒公式和压力测试要求见[技术白皮书](WHITEPAPER.zh-CN.md)。

具体费率、分配比例、返佣条件和资本上限尚需定案。LP 收益取决于实际结果、费用与风险承担，正的理论期望也不是固定 APY 或盈利保证。玩家仍可能损失投注本金，并支付独立的链上与随机数费用。项目商业模式不以未来代币升值或未定义的补贴作为前提。

## 实现路线

1. **设计定案：**确定经济分配、LP 权益、退出规则与各方成本，使团队有共同的实施依据。
2. **Casino 用户闭环：**完成从理解产品、手机钱包连接、报价签名到结果和异常恢复的完整体验。
3. **LP 与渠道闭环：**把已定经济模型、真实财务指标和推荐对账做成可使用的产品。
4. **有边界地增长：**先在明确资本和运行范围内验证服务，再按留存、结算质量和经济结果扩展。
5. **Sportsbook 产品发布：**需求和规则研究可并行，发布独立通过赔率、赛事证据、争议与风险验收。
6. **需求驱动扩展：**在核心业务验证后，再决定新玩法、资产、网络或合作集成。

上述是本稿建议的阶段安排。经济与 LP 设计前置于扩大资本和渠道增长，Sportsbook MVP 可并行推进、独立发布；这些阶段不构成日期或收益承诺。当前实现提供起点，产品目标决定还需要补齐什么。

## English overview

ArbiGameFi aims to be a wallet-native casino and sportsbook where players can understand pricing and verify settlement, LPs can evaluate their economic rights and risk, and partners can reconcile referral rewards. A single-brand consumer product is supported by a shared settlement kernel with separate casino and sports lifecycles.

The proposed roadmap starts with economic and participant-rights decisions, then completes casino usage, LP and referral products and bounded operation. Sportsbook development can proceed in parallel, with an independently validated release and its own economic model. Allocation from actual casino payout deductions, with an explicit LP share, is a proposed model under evaluation. This brief describes the intended product; it does not claim that proposed mechanisms are approved or deployed. Betting and LP capital are at risk, and no fixed yield or unconditional exit is promised.

## 继续阅读

- [产品与商业白皮书](WHITEPAPER.product.zh-CN.md)：用户需求、产品设计、商业逻辑与阶段目标。
- [技术白皮书](WHITEPAPER.zh-CN.md)：资金、经济分配、生命周期、风险与治理设计。
- [项目路线图](roadmap.md)：实现依赖与阶段退出标准。
- [发布事实表](release/STATUS-v1.5.zh-CN.md)：指定日期的版本、部署和开放状态。
