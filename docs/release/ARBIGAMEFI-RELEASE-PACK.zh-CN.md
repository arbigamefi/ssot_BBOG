# ArbiGameFi Release Pack

> 项目：`ArbiGameFi`
> 底层架构：`SSOT (Single Source of Truth)`
> 文档系列：`Release Materials`
> 文档编号：`AGF-REL-PACK-2026.02`
> 状态：`current deployment snapshot`
> 语言：`zh-CN`
> 快照范围：`Base Sepolia / chainId 84532 / block 37393796`
> 快照时间：`2026-02-08 21:04:40 CST` / `2026-02-08 13:04:40 UTC`
> 目标读者：`LPs / partners / auditors / technical integrators`
> 关联文档：
> - [`../WHITEPAPER.zh-CN.md`](../WHITEPAPER.zh-CN.md)
> - [`README.md`](README.md)
> - [`checklist.md`](checklist.md)
> - [`ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`](ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md)
> - [`ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`](ARBIGAMEFI-LP-ONBOARDING.zh-CN.md)
> - [`../../deployments/release-latest.json`](../../deployments/release-latest.json)
> - [`../../deployments/frontend-manifest-latest.json`](../../deployments/frontend-manifest-latest.json)

## Abstract (EN)

This document is the outward-facing release pack for the current ArbiGameFi deployment. It summarizes the canonical deployment snapshot, release digest, signer, contract addresses, supported games and assets, proof artifacts, and the exact steps a partner, LP, or auditor can use to independently verify what is deployed today.

## 1. 文档目的

这不是市场宣传稿，也不是内部 release checklist 的重复版本。

这份文档的用途是把当前这次部署中最重要的事实一次性讲清楚：

- 现在链上到底部署了什么
- 哪些地址和参数才是当前有效事实
- 外部合作方应该如何独立验证
- LP 和合作方最该关注的风险边界是什么

如果收件人只想快速判断“这套系统是否足够透明、是否能被外部验证、是否适合继续技术或流动性讨论”，先读这份文档，再看技术白皮书。

## 2. 当前发布快照

### 2.1 Canonical release identity

| 字段 | 当前值 |
|---|---|
| Network | `Base Sepolia` |
| Chain ID | `84532` |
| Deployment block | `37393796` |
| Deployment timestamp | `2026-02-08 21:04:40 CST` / `2026-02-08 13:04:40 UTC` |
| Release digest | `0xe0e8bdc3ffc7ba52c7b3409a2bb1cb46c1d8ad20b6e9631ba4f267d490a8bc21` |
| Digest schema | `SSOT_RELEASE_DIGEST_V1` |
| Schema hash | `0x901cfc8e1c29392cc3ebfb99f4ae8720ec67900c240caf9ad43476b0479b64ec` |
| Signer / GOV | `0xc8eC9920d573893E888db5D30b2B3B3824B1b684` |
| Release lock artifact | [`../../deployments/release-latest.json`](../../deployments/release-latest.json) |
| Deployment snapshot | [`../../deployments/latest.json`](../../deployments/latest.json) |

### 2.2 Release lock signature

| 字段 | 当前值 |
|---|---|
| `v` | `27` |
| `r` | `0x0e727355c7a2d9a63b839465f59a23aeb463bdd77c47540c8548ec3e7caa1dd7` |
| `s` | `0x7c52ab10e33901e1b21d5ac113937e80ea9a9a277c563968c57fd17344647198` |

这意味着第三方可以不依赖 GitHub 页面、不依赖前端站点，仅基于 snapshot JSON 和 release lock JSON，在本地独立重算并验证这次发布身份。

## 3. 核心合约地址

### 3.1 Protocol core

| 模块 | 地址 | 角色 |
|---|---|---|
| GOV | `0xc8eC9920d573893E888db5D30b2B3B3824B1b684` | 当前治理与发布签名主体 |
| Hub | `0x5e85C519DD4d2d39540D501444CBe134121B984e` | 全局 bet registry、生命周期与结算中枢 |
| VRFHub | `0x31a88594530CA3E4426594D0387113324b4bFa59` | 随机数请求映射、transport 与 refundCredit |
| Adapter | `0x3Ba8Af3C2A3B3a8dD04e507084de0cf93bD370f1` | 外部 VRF provider 适配层 |
| BankRegistry | `0x8bd920E5F2a42f145e5a9f6B03b886542F770B1E` | 资产到 Bank 的注册表 |
| ReferralRegistry | `0x32002Fd793087934088f2C94c5d9DB7370AeC598` | 推荐关系注册表 |
| ReferralEngine | `0x917915575721b14A91eC96C679bF3D9d026d78B7` | 推荐预算与 XP 负债计算引擎 |

### 3.2 VRF dependency

| 组件 | 地址 | 说明 |
|---|---|---|
| VRF Wrapper | `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed` | 当前 release 绑定的外部随机数 wrapper |
| Treasury | `0x0000000000000000000000000000000000000000` | 当前 snapshot 中 treasury 未设置 |

这里最重要的一点不是地址多，而是职责清晰：

- `Bank` 负责资产会计与偿付边界
- `Hub` 负责 bet 生命周期事实源
- `VRFHub` 负责随机数 transport 与费用退款语义
- `Module` 只负责纯游戏语义

这种拆分是 ArbiGameFi 能被外部审计和验证的前提。

## 4. 当前支持的资产与游戏

### 4.1 Assets and banks

当前 release 只启用了 1 个资产域。

| Asset | Symbol | Decimals | Bank | LP token |
|---|---|---|---|---|
| `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `USDC` | `6` | `0x7C516Cd4e343664D5256E1ed04dD793790885593` | `LP Share #0` / `LP0` |

这意味着当前所有 bankroll、准备金、协议费、XP 负债和 LP 份额都在同一个 `USDC -> Bank` 资产域内结算。

### 4.2 Games and modules

| Game | Slug | Game ID | Module | 参数编码 |
|---|---|---|---|---|
| Dice | `dice` | `0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b` | `0x8Fb66Ccc25d07b252d282BE646D24444C062C667` | `abi.encode(uint8 cap)` |
| Coin Toss | `coin-toss` | `0x6e800792927dde77598bf8cf4e8d9832799fbff08d7fbb3989225097ac6fa4e7` | `0x1914DA7E7AAEE19771EB7d92A5591212B9C0bBCa` | `abi.encode(bool isHeads)` |
| Roulette | `roulette` | `0x41541f350c1da9780d719f9ebc2dd9d5883bf8c8df895243a1696bede4a708c0` | `0x1EB246dB7d90a266b446a19108114BA39b3a5756` | `abi.encode(uint40 legacyMask)` or `abi.encode(uint8 kind, uint40 payload)` |
| Keno | `keno` | `0xb4aacd27778fcc813ac1737807c34d5d4193c514f0d91a0caeeada2d6752baf0` | `0x3DdE1a40A9fAe07375F9e129A9AC73E04c84F037` | `abi.encode(uint40 numbersPacked)` |

### 4.3 Frontend truth artifacts

前端不应该凭 UI 手工猜地址或编码规则，而是直接消费这些 release artifacts：

- [`../../deployments/frontend-manifest-latest.json`](../../deployments/frontend-manifest-latest.json)
- [`../../deployments/golden-vectors-latest.json`](../../deployments/golden-vectors-latest.json)

其中：

- `frontend-manifest` 定义地址、资产、房间和参数编码
- `golden-vectors` 定义前端编码必须对齐的 exact-hex 基准

这两份文件是“前端不偏离合约发布事实”的关键约束。

## 5. 当前关键参数

### 5.1 Hub-level parameters

| 参数 | 当前值 | 含义 |
|---|---|---|
| `refundTimeoutSeconds` | `3600` | 超时退款窗口基准 |
| `defaultHouseEdgeBps` | `200` | 默认 house edge |
| `maxAffiliateDeltaBps` | `0` | 当前 release 不允许 affiliate delta 偏移 |
| `requestGasPriceWei` | `0` | 当前 snapshot 原始配置值 |

### 5.2 Bank-level parameters

| 参数 | 当前值 | 含义 |
|---|---|---|
| `bankMinLiqBps_0` | `1000` | 最小流动性缓冲占比 |
| `bankHoldbackVestingSeconds_0` | `86400` | holdback 线性释放时长 |
| `bankMinTurnoverForUnlock_0` | `20000000000000000000` | 当前 release 的原始 unlock turnover 阈值 |

### 5.3 Referral / XP parameters

| 参数 | 当前值 |
|---|---|
| `refBaseBudgetBps` | `10000` |
| `refDeltaBudgetBps` | `10000` |
| `refHoldbackBps` | `3000` |
| `refLevels` | `2` |
| `refLevel0Bps` | `0` |
| `refLevel1Bps` | `10000` |
| `refLevel2Bps` | `0` |
| `refLevel3Bps` | `0` |
| `refLevel4Bps` | `0` |
| `refLevel5Bps` | `0` |

这里最需要强调的是：XP 和推荐负债并不计入 LP backing。ArbiGameFi 的会计恒等式仍然是 `NAV = B - PF - XP`，这也是 LP 侧判断风险边界时最应该看的那条线。

## 6. 外部验证怎么做

### 6.1 最短验证路径

合作方、LP 或审计方最少做下面 4 步，就能确认“当前 release 是否自洽”：

1. 读取 [`../../deployments/latest.json`](../../deployments/latest.json)，确认链、区块、地址和关键参数。
2. 读取 [`../../deployments/release-latest.json`](../../deployments/release-latest.json)，确认 digest、schema 和 signer。
3. 本地运行 `make release-verify`，离线验证 digest 与签名是否成立。
4. 使用 [`../../deployments/verify-latest.sh`](../../deployments/verify-latest.sh) 或 `make verify` 检查链上合约字节码与构造参数。

### 6.2 前端与编码验证

如果对接方还要验证“前端是否正确调用合约”，继续做下面 2 步：

1. 对照 [`../../deployments/frontend-manifest-latest.json`](../../deployments/frontend-manifest-latest.json) 检查前端用到的地址、slug、asset、编码说明。
2. 对照 [`../../deployments/golden-vectors-latest.json`](../../deployments/golden-vectors-latest.json) 做 exact-hex 编码比对，确认 `placeBet` calldata 不偏移。

### 6.3 发布严谨性验证

如果要验证这次 release 是否满足仓库定义的正式发布纪律，再做这 2 步：

1. 阅读 [`README.md`](README.md) 和 [`checklist.md`](checklist.md)，确认 release 流程定义。
2. 在目标 commit 上运行 `STRICT=1 make release-check`，确认 snapshot、release lock、release notes、frontend manifest、golden vectors 之间相互匹配。

## 7. LP 和合作方最该关注的风险边界

### 7.1 当前 release 已经明确的边界

- 这是一个 `per-asset Bank` 会计模型，不是混池。
- `PF` 和 `XP` 都不是 LP backing。
- 新下注和可选出金属于 `risk-in` 域，可在风险状态下被暂停。
- `finalize`、`refund`、`refundCredit` 这类 debt-out 路径需要保持活性。
- 游戏模块不负责 custody，会计与生命周期由 `Bank + Hub + VRFHub` 负责。

### 7.2 当前 release 没有承诺的事

- 这份文档不承诺主网发布状态；当前 snapshot 对应的是 `Base Sepolia`。
- 这份文档不承诺额外资产域；当前只启用了 `USDC` 单资产域。
- 这份文档不承诺多 treasury 分润结构；当前 snapshot 中 treasury 仍为零地址。
- 这份文档不承诺所有外围产品层都已完成；它描述的是当前合约与 release artifacts 已经锁定的事实。

## 8. 交付给外部方时应附带哪些文件

建议把下面这些文件一起给合作方、LP 或审计对接人：

| 文件 | 用途 |
|---|---|
| [`../../deployments/latest.json`](../../deployments/latest.json) | canonical deployment snapshot |
| [`../../deployments/release-latest.json`](../../deployments/release-latest.json) | canonical release lock |
| [`../../deployments/release-notes-latest.md`](../../deployments/release-notes-latest.md) | human-readable release notes |
| [`../../deployments/frontend-manifest-latest.json`](../../deployments/frontend-manifest-latest.json) | frontend truth source |
| [`../../deployments/golden-vectors-latest.json`](../../deployments/golden-vectors-latest.json) | encoding proof vectors |
| [`../../deployments/verify-latest.sh`](../../deployments/verify-latest.sh) | bytecode verification helper |
| [`../WHITEPAPER.zh-CN.md`](../WHITEPAPER.zh-CN.md) | 技术白皮书 |
| [`../ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md`](../ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md) | 对外执行摘要 |

## 9. 还应该补什么

如果要把这套 release materials 继续提升到“更适合 BD / LP / 审计 kickoff”的等级，下一步最值得补的是：

1. 一份主网前发布模板，明确 testnet 与 mainnet 的口径区别。
2. 一份 release-by-release 变更摘要，把 digest、参数、模块变化串起来。
3. 一页 mainnet explorer links 模板，避免后续重新手拼。
4. 一份面向 LP 的指标面板读数指南，和前端 liquidity 页形成一一对应。

## 10. 一句话结论

当前这次 ArbiGameFi 部署的核心价值不在于“已经上线了几个页面”，而在于：它已经具备一套外部可重算、可验签、可验码、可校验前端编码正确性的 release artifact 体系。对于任何想认真评估这套协议的人，这比单纯的 UI 展示更有意义。
