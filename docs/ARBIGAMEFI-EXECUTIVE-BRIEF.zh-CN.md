# ArbiGameFi 项目简介

> 文档编号：AGF-BRIEF-2026.09-r1 · 状态：Review Copy
>
> 项目：ArbiGameFi · 架构：SSOT · 发布基线：v1.5
>
> 代码基线：`aaa5c807d09f72e972bfad286901c3bb3e88b9ee`
>
> 日期：2026-09-25 · 语言：zh-CN，附英文摘要
>
> 读者：首次了解项目的玩家、LP、推广伙伴与技术合作方

## 一句话说明

**ArbiGameFi 是一个通过钱包访问、游戏规则和结算凭证可在链上核对的 casino 项目。**

当前 v1.5 包含 Dice、Coin Toss、Roulette、Keno、Plinko、Sic Bo、Slots、Baccarat 八款游戏，部署于 Base 与 Base Sepolia。测试网面向体验与反馈；主网已完成八款各一笔真实单轮验收，网站主网投注仍未开放。Sportsbook 代码保留，但未包含在当前部署中。

这一开放状态是 2026-09-25 的快照，后续以[发布事实表](release/STATUS-v1.5.zh-CN.md)、实际网络和池状态为准。

## 玩家怎样使用

选择网络和游戏，准备该网络的游戏资产及 ETH，核对金额、赔率与费用，再连接钱包签署交易。授权不足时先授权 Bank，然后另行签署投注。授权成功不等于已经下注。

下注资金进入 Bank 智能合约；随机数到达并完成结算后支付净派彩，满足条件的部分退款可随结算返还。仍在等待随机数且已满足超时条件时，可走本金退款路径。款项支付到记录的玩家钱包。用户无需向平台账户预充值，平台不保管私钥，但智能合约持有资金期间仍有代码、治理与资产风险。

可在 `/portfolio/activity` 查看回合凭证，结合 VRF 请求、结果和结算交易核对。网络、随机数和 keeper 状态会影响等待时间；不承诺即时结算或无条件退款。

## 三类参与者

| 参与者   | 可以做什么                           | 需要理解什么                                           |
| -------- | ------------------------------------ | ------------------------------------------------------ |
| 玩家     | 选择八款游戏、检查报价与结果         | 投注可能损失；gas 和 VRF 请求费独立于投注金额          |
| LP       | 向单一资产 Bank 提供流动性并持有份额 | 收益不保证；提现受准备金、缓冲和暂停约束               |
| 推广伙伴 | 分享链接、核对绑定和奖励             | 本地归因不等于链上绑定；奖励可能尚未解锁、成熟或可领取 |

**庄家优势不能直接当作 LP 回报。** 协议费与推荐负债从 NAV 中扣除，LP 净值取决于实际派彩和负债计提。技术白皮书中的公平二选一示例在理想条件下 LP 期望为零，仍承担波动。LP 补偿与商业可持续性需要继续评估，当前不承诺固定 APY 或稳定正收益。

## 怎样核对可信度

- 查看公开源码、部署地址、release 身份和合约源码匹配类别。
- 查看单个 Bank 的净资产、预留和负债，避免用全站总额替代某个池的能力。
- 查看真实投注、VRF 和最终支付凭证；区分链上事实与可能延迟的索引统计。
- 查看治理与退出条件：关键 casino 治理由 2/3 Safe 控制，guardian 仅能暂停。该门槛不证明三个独立组织共同治理。

现有测试和小额验收不是无漏洞证明，也不是第三方审计认证。已完成什么、未覆盖什么均列入[系统复盘](audit/RepositoryReview-2026-09-25.zh-CN.md)。

## 接下来做什么

先统一首页和资料的事实，再完善新用户与真实手机钱包流程、推广网络归因和 LP 指标；主网公开前继续处理经济评估、流动性及运行条件。当前可围绕测试网体验和可验证机制招募反馈，不宣传尚未开放的功能或未来代币权益。

## English overview

ArbiGameFi is a wallet-accessible casino project with on-chain rules and inspectable settlement receipts. The v1.5 release includes eight casino games on Base and Base Sepolia. Testnet experience and feedback are the current public focus. Mainnet acceptance covers one real single-round bet per game, while public mainnet betting remains disabled in the website. Sportsbook code is not deployed in the current release.

Users control their wallets, but betting and LP deposits transfer assets into Bank smart contracts. Gas, randomness fees, governance, asset behavior and conditional exits remain relevant. House-edge deductions are not equivalent to LP yield: protocol and referral liabilities reduce NAV. No fixed return, token entitlement, unconditional refund or security certification is promised.

## 继续阅读

- [产品与商业白皮书](WHITEPAPER.product.zh-CN.md)：参与路径、费用、LP 与推荐、阶段计划。
- [技术白皮书](WHITEPAPER.zh-CN.md)：资金、状态机、权限、经济公式与限制。
- [发布事实表](release/STATUS-v1.5.zh-CN.md)：当前版本、网络、配置与证据。
