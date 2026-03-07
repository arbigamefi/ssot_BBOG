# ArbiGameFi LP Onboarding Note

> 项目：`ArbiGameFi`
> 底层架构：`SSOT (Single Source of Truth)`
> 文档系列：`Release Materials`
> 文档编号：`AGF-REL-LP-2026.02`
> 状态：`current deployment snapshot`
> 语言：`zh-CN`
> 快照范围：`Base Sepolia / chainId 84532 / block 37393796`
> 目标读者：`LPs / treasury allocators / strategic partners`
> 关联文档：
> - [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md)
> - [`ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`](ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md)
> - [`../WHITEPAPER.zh-CN.md`](../WHITEPAPER.zh-CN.md)

## One-line Summary (EN)

This note explains how LPs should read ArbiGameFi’s bankroll semantics: what backs LP shares, what does not, how reserves constrain optional outflows, and why `NAV = B - PF - XP` is the single most important accounting identity.

## 1. 这份文档是给谁看的

如果你的角色更接近下面任意一种，就先读这份文档，而不是直接钻进合约代码：

- 想评估是否给 bankroll 提供流动性的 LP
- 想理解风险边界的 treasury allocator
- 需要判断“这是不是黑盒池子”的合作方

这份文档不讨论 UI，不讨论增长，也不承诺收益。它只讨论 LP 最关心的那件事：你的份额到底由什么支撑、又会被什么约束。

## 2. LP 在这个系统里到底持有什么

LP 持有的不是“平台信用凭证”，而是某个具体资产域中的份额。

在当前 release 中：

- 只启用了一个资产域：`USDC`
- 对应一个独立 `Bank`
- 对应一个独立 LP token：`LP0`

这意味着 LP 风险不是跨资产混在一起的，而是限定在该资产域内部。

当前相关对象：

- Asset: `USDC` `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Bank: `0x7C516Cd4e343664D5256E1ed04dD793790885593`
- Explorer links: [`ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`](ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md)

## 3. LP 最该记住的 1 条公式

ArbiGameFi 当前会计模型里，LP 最重要的一条公式是：

```text
NAV = B - PF - XP
```

其中：

- `B`: Bank 当前真实托管资产余额
- `PF`: protocol fees payable
- `XP`: external payables total

对 LP 来说，这条式子的含义非常直接：

- 只有 `NAV` 才是 LP backing
- `PF` 不是 LP 的
- `XP` 也不是 LP 的

如果你只看 Bank 里躺着多少 token，而不扣掉 `PF` 和 `XP`，你会高估自己份额的真实支撑。

## 4. XP 为什么不是“虚的积分”

当前实现里，XP 不是营销层的空气值，而是外部负债。

它会体现在会计上，因为：

- XP 增加时，`NAV` 下降
- XP 被领取时，Bank 会真实转出资产
- XP 的 `accrued / locked / holdback` 只是成熟路径不同，不改变它是负债这件事

这就是为什么 ArbiGameFi 会把 XP 明确排除在 LP backing 之外。对 LP 而言，这是好事，因为账没有被混淆。

## 5. 还要看哪几个数

除了 `NAV` 以外，LP 还应该一起看这 3 个量：

### 5.1 `R` reserved

这是系统为已接受但尚未结算的下注预留的最坏情况负债。

它的意义不是“已经亏掉了”，而是“这部分不能被当成自由可提取流动性”。

### 5.2 `MinLiq`

```text
MinLiq = NAV * minLiquidityBps / 10000
```

这是最小流动性缓冲。当前 release 对 `USDC` 资产域的配置是：

- `minLiquidityBps = 1000`
- 即 `10%`

### 5.3 `free`

```text
free = max(NAV - R - MinLiq, 0)
```

它更接近“在当前状态下，系统理论上还能承受多少可选出金”的上界。

如果 `free` 很低或为零，不代表协议坏了，而是说明当前风险承载空间已经很紧。

## 6. 为什么 LP 不能把它当纯 ERC4626 来看

`Bank` 是 ERC4626-like，不是无条件 ERC4626。

它支持标准动作：

- `deposit`
- `mint`
- `withdraw`
- `redeem`

但它不是“任何时刻都可以自由退出”的简单收益金库，因为它同时承担：

- 已接受下注的准备金压力
- 协议费负债
- XP 外部负债
- 风控状态切换

所以 LP 行为最终服从的是风险域，而不是只服从份额换算。

## 7. 什么情况下 withdraw / redeem 可能被限制

### 7.1 风控域检查不通过

任何可选出金成功后，系统都必须满足：

```text
NAV_after >= R
NAV_after - R >= MinLiq(NAV_after)
```

也就是说，出金不能把系统打穿到准备金以下，也不能把最小流动性缓冲抽空。

### 7.2 资产处于 risk-in pause

当前设计允许在风险状态下暂停：

- 新下注
- LP withdraw / redeem
- 已归属 XP 领取
- 协议费提取

但下面这些 debt-out 路径仍需要活着：

- `finalize`
- `refund`
- `refundCredit`

这套语义的核心是：风险进入要能刹车，已形成的债务退出不能被卡死。

## 8. 当前 release 对 LP 的现实含义

基于当前 snapshot，这次 release 的现实边界是：

- 网络是 `Base Sepolia`，不是主网
- 资产域只有 1 个：`USDC`
- Treasury 还是零地址
- 推荐与 XP 负债路径已经存在，并会真实影响 `NAV`
- 风险边界与 release identity 已经可由外部验证

对 LP 来说，最重要的判断不是“收益承诺”，而是下面 4 个问题：

1. 账是不是清楚
2. 负债是不是显式
3. 出金限制是不是有规则而不是拍脑袋
4. 发布身份是不是能被外部独立验证

在这 4 件事上，当前版本已经给出了明确结构。

## 9. LP 尽调时建议看什么

最短尽调路径可以按这个顺序：

1. 先读 [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md)
2. 再看 [`ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`](ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md)
3. 核对 [`../../deployments/latest.json`](../../deployments/latest.json) 和 [`../../deployments/release-latest.json`](../../deployments/release-latest.json)
4. 本地运行 `make release-verify`
5. 再读 [`../WHITEPAPER.zh-CN.md`](../WHITEPAPER.zh-CN.md) 的会计、准备金、生命周期和 XP 章节

如果这 5 步都过了，再去讨论更高层的话题，比如 bankroll 规模、房间配置、主网计划和合作方式。

## 10. 不该误解的几件事

- 这不是收益承诺文档。
- 这不是主网上线公告。
- 这不是说 withdraw/redeem 一定随时可用。
- 这也不是说 XP 越大越好；对 LP 来说，XP 是要从 backing 里扣掉的负债。

如果有人把 `Bank` 余额直接等同于“LP 可以放心提出去的全部价值”，那就是读错了这套系统。

## 11. 一句话结论

ArbiGameFi 对 LP 真正有价值的地方，不是“它也是一个链上赌场”，而是它把 bankroll 的支撑、外部负债、准备金压力和可选出金限制明确写进了同一套可验证会计语义里。
