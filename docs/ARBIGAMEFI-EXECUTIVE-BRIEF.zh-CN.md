# ArbiGameFi 项目简介

> AGF-BRIEF-2026.10-r4 · 2026-10-11 · 中文与英文 · 内部审阅稿，尚未对外发布
>
> **读者**：首次接触项目的用户、合作方、媒体与研究者

## 用自己的钱包参与游戏，看清每一次投入与结算

ArbiGameFi 正在建设单品牌、钱包原生的 casino，**项目尚未上线**。它把熟悉的玩法与可核对的规则、费用、结果和支付结合起来，首期聚焦 Base 网络与 USDC。

**为谁而做。** 已有 EVM 钱包与稳定币经验、所在地允许参与、重视支出透明度的成年人。产品能否赢得自主使用与回访，还需要实际验证；公开代码不等于市场需求。

**产品。** Casino 围绕八种玩法完成报价、钱包确认、自动结算与收据。

**资金怎样运作。**

- **投注**：玩家保管自己的钱包密钥，投注资金进入合约，按公开规则结算。
- **LP 的收益与风险**：LP 为资金池提供赔付资本，每笔存款对应独立 NFT，按实际游戏盈亏与公开费用规则记账。NFT 不是项目股权，也不保证收益；LP 承担游戏结果、合约与资产风险。
- **LP 存入与退出**：存入即时生效并承保，24 小时成熟后按池的可用资本同步提现；部分提款使余款重新冷却 24 小时。NFT 转让保留原到期时间。退出不暂停下注，但已退出部分不再承担以后入账的旧投注损失；这些损益按剩余树与回退规则分配，退出时机可能增加留存 LP 的损失。用户已选择保留规则、接受并披露该排序风险；24 小时锁定不消除它，后入资金也可能分到旧投注利润。外部 LP 仍须满足独立的 gas、审计与网络验收条件。
- **转账失败**：无法当场支付的玩家款项可保留为固定玩家应付款，支持代为领取；成功到账仍取决于资产可转账及有人提交领取交易。收据分别说明结果与实际支付。

**现状。** NFT 流动性、回调结算及 SDK、页面、keeper 接入已完成对应版本的本地验证；最终候选集成、回调 gas 资格、已接受排序风险的披露、全新 Base Sepolia 验收与外部审计仍需按[审计范围](audit/v1.6-audit-scope.md)与[测试网清单](deploy/v16-sepolia-acceptance.md)关闭。测试不代表正式运营、用户需求或营收。牌照、辖区与强制合规措施仍在准备中，完成之前不开放真实资金服务。

| 阅读目的           | 入口                                      |
| ------------------ | ----------------------------------------- |
| 判断合作与资源投入 | [商业白皮书](WHITEPAPER.product.zh-CN.md) |
| 了解机制与信任假设 | [技术白皮书](WHITEPAPER.zh-CN.md)         |
| 核对当前发布条件   | [发布说明](release/README.md)             |
| 跟踪能力建设       | [项目路线图](roadmap.md)                  |

## English — ArbiGameFi at a glance

**Play from your wallet. Understand each stake and settlement.**

ArbiGameFi is an unlaunched, single-brand, wallet-native casino. It starts on Base with USDC, for adults experienced with EVM wallets and stablecoins who are eligible to take part where they live. Familiar games, clear costs and inspectable payments are the proposition; demand and retention still require validation.

**Product.** The casino connects quotes, wallet actions, automatic settlement and readable receipts across eight games.

**How the money works.**

- Players keep their keys; accepted stakes are held by contracts and settled by public rules.
- Each LP deposit creates a separate NFT supplying payout capital. Its value reflects actual game outcomes and public fee rules. It is neither equity nor a guaranteed-return product; pool, contract and asset risks remain.
- Deposits underwrite immediately and mature after 24 hours. Withdrawals pay synchronously within available capital; a partial withdrawal relocks the remainder for 24 hours, while NFT transfers preserve maturity. Exits do not pause betting. Exited capital bears no subsequently booked loss, including old bets; remaining deposits and tree fallback absorb those outcomes. The user accepted this ordering tradeoff with public disclosure. The 24-hour lock does not remove it, and later capital may also receive old profit. Gas, external audit and network acceptance remain independent outside-LP admission conditions.
- Unpaid player amounts can remain fixed-player payables and be claimed on their behalf. Payment still requires a transferable asset and someone submitting a claim transaction.

**Status.** NFT liquidity, callback settlement and the SDK, application and keeper integration have corresponding local verification. Final-candidate integration, callback gas qualification, disclosure of the accepted ordering risk, fresh Base Sepolia acceptance and external audit still need closure under the audit scope and acceptance checklist. Tests do not establish production operation, demand or revenue. Licensing, jurisdictions and enforced compliance controls are still being prepared, and no real-money service opens before they are complete.

Read the [business whitepaper](WHITEPAPER.product.zh-CN.md) to assess cooperation, the [technical whitepaper](WHITEPAPER.zh-CN.md) for mechanisms and trust assumptions, and the [release guide](release/README.md) for current release conditions.
