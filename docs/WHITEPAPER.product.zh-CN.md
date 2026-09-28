# ArbiGameFi 项目与商业白皮书

**项目尚未上线。** 本文面向战略、渠道和专业资金合作方，解释目标用户、价值交换与资源投入方向。实际发布条件见[发布说明](release/README.md)，机制见[技术白皮书](WHITEPAPER.zh-CN.md)。

## 项目命题

ArbiGameFi 建设单品牌、钱包原生的 casino 与 sportsbook。用户用自己的钱包确认交易，查看规则、费用、结果和支付凭证。娱乐体验是核心，可核对的资金与结算提供信任基础。

首批目标是假设中的一类用户：熟悉 EVM 钱包、稳定币和链上交易，并重视支出与结果透明度的成年人。首期聚焦 Base 与 USDC，以集中资本和服务资源。项目尚需验证他们是否愿意使用、接受实际费用并自主返回；不以链上机制或公开代码代替市场验证。

用户保管签名密钥，投注资金进入智能合约。钱包入口减少平台托管余额的需要，但不消除投注损失、合约、资产和治理风险。

## 产品组合

Casino 首先完成 Dice、Coin Toss、Roulette、Keno、Plinko、Sic Bo、Slots 和 Baccarat 的完整体验。规则、总费用、钱包确认、等待状态与收据要连贯；无法即时支付时，应明确欠款和领取入口。

Sportsbook 规划从赛前足球胜／平／负固定赔率单关起步。它共享品牌和钱包体验，采用独立资本、数据、结果和争议规则。体育需证明完整终结路径及自身经营条件后发布，casino 的准入和测试不能替代它。

LP 为指定池提供风险资本；渠道提供适合的用户和分发能力。首期不依赖平台代币、白标运营业务或跨链资金共担。

## 价值分配

当前 casino 模型按每笔实际使用流水计算理论 house edge，**LP 固定保留一半，推荐、玩家返水和协议费用共享另一半**。推荐比例合计不超过基础 edge 的 35%；无有效推荐人及推荐舍入的未分配部分归协议。LP 的固定份额不因渠道缺失而变化，详见 [ADR-0032](adr/0032-fixed-lp-share-operator-funded-referrals.md)。

该分配不等于本金收益率。LP 还承担游戏结果造成的盈亏、资金占用和尾部风险；正的理论期望不能保证有限期间盈利。协议和渠道收入按实际流水及适用条款计提，收入计提也不等于已经收到现金。

| 资金             | 角色                                                 |
| ---------------- | ---------------------------------------------------- |
| 玩家本金及应付款 | 按接受的游戏规则结算，未付款项不能充当运营预算       |
| LP 资本          | 指定池的赔付资本，持有人参与净资产变化               |
| 协议和推荐分配   | 支撑服务与有效分发，受独立债务和领取规则约束         |
| 项目运行资金     | 支付建设、keeper、基础设施、支持与研究，需要明确来源 |

LP 份额不代表公司股权或代币权利。企业或项目层面的融资须另行定义主体、用途和权利，不与池内资本混合宣传。

## LP 存入与退出

存入即时按活跃池账面价取得份额，参与当前期风险，不取得已封存历史期的权益。退出先请求，实际激活前仍承担活跃池结果。激活时隔离当前期完整准备金，为所有当时持有人保留历史风险和回收权，并立即确定申请者可领取的现金。以后释放的旧资金仍归原持有人，不会被后来入金或转账取得。

卡住的旧仓只影响对应历史资金，不阻止后来批次退出，也不因 LP 操作暂停下注。退出减少可用资本，资金不足和独立紧急暂停仍有约束；可领取现金可能为零，历史回收不保证金额或期限。页面分别展示活跃权益、排队估值、可领现金和历史回收，不把未来回收上限当作确定收益。定价、虚拟资本残差与舍入规则见 [ADR-0035](adr/0035-recovery-rights-without-exit-blocking.md)。

## 经营可持续性

玩家承担明确列示的交易和随机数成本。运营方支付自动结算、基础设施、维护及支持；keeper 的原生资产预算与池资产收入分别管理。补贴应有资金来源、额度与期限，不能侵占 LP 或已成立的用户债权。

资本配置依据最大赔付、并发义务、结果波动和退出情景。渠道投入依据来源明确的完整使用、回访及贡献。经营评估把捐赠、资本流入、奖励、服务成本和收入分开；流水、钱包连接和页面访问量都不能直接当作利润或需求。

项目不提供未经证实的 APY、回本期、估值或市场份额预测。若目标金额不能承担实际费用、资本风险无法得到补偿，或服务预算不足，应调整范围与成本后再扩张。

## 验证与合作

先完成玩家与 LP 的完整路径、准确账本和运行恢复，再以有限范围验证真实使用。观察自主回访时分开测试资金与真实资金、补贴与非补贴用户；钱包地址不等于独立自然人。扩大范围由需求、资本与服务能力共同决定。

| 合作方向   | 需要核对的条件                                       |
| ---------- | ---------------------------------------------------- |
| 渠道与内容 | 适用受众、体验、归因、报酬来源和实际贡献             |
| 专业 LP    | 池资产、资本风险、完整负债、退出条件、治理与验证证据 |
| 体育与服务 | 数据及报价责任、规则、成本、异常处理和可核对交付     |
| 战略资源   | 具体投入、用户价值、责任人、期限与衡量方式           |

合作方应核对实际主体、负责人、服务资格和能力，不从架构推断经营记录。本文不声称已有客户、资本承诺、营业收入、机构背书或上线部署。

[项目简介](ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md)提供快速入口，[路线图](roadmap.md)说明能力顺序，[技术白皮书](WHITEPAPER.zh-CN.md)支持机制尽调。

## English overview

ArbiGameFi is an unlaunched, single-brand wallet-native casino and sportsbook project. The initial product focus is Base and USDC, serving users familiar with EVM wallets and stablecoins. Demand, retention and sustainable operating costs remain hypotheses to validate.

The casino model retains half of turnover house edge for LPs; protocol fees and referral rewards share the other half. LPs bear pool outcomes and capital risk. Deposits are immediate. Redemption activation prices available cash and preserves historical risk and recovery for all snapshot holders. A stuck old position does not gate later exits or adequately funded betting; its associated recovery remains uncertain. No fixed yield or full-payment deadline is promised.

A separately funded sportsbook requires its own odds, evidence, terminal deadlines and operating acceptance. Cooperation should be evaluated against explicit responsibilities, costs and verifiable results. LP shares are not project equity, and neither source code nor local tests establish deployment or market traction.
