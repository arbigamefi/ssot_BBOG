# ArbiGameFi Release History

> 项目：`ArbiGameFi`
> 底层架构：`SSOT (Single Source of Truth)`
> 文档系列：`Release Materials`
> 文档编号：`AGF-REL-HISTORY-2026.03`
> 状态：`append-only release ledger`
> 语言：`zh-CN`
> 目标读者：`operators / auditors / partners / LPs`
> 关联文档：
> - [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md)
> - [`ARBIGAMEFI-MAINNET-RELEASE-TEMPLATE.zh-CN.md`](ARBIGAMEFI-MAINNET-RELEASE-TEMPLATE.zh-CN.md)
> - [`../../deployments/release/`](../../deployments/release/)
> - [`../../CHANGELOG.md`](../../CHANGELOG.md)

## One-line Summary (EN)

This is the append-only ledger of canonical ArbiGameFi releases. `CHANGELOG.md` tracks code evolution; this document tracks deployed release artifacts and their identities.

## 1. 这份文档记录什么

`CHANGELOG.md` 记录的是代码演进。

这份文档记录的是另一件事：哪些 release 已经形成了 canonical deployment artifact，且这些 artifact 的身份是什么。

因此它只应该记录：

- 链
- 区块
- digest
- signer
- 资产域
- 游戏域
- 核心 artifact

而不应该写成长篇功能介绍。

## 2. 维护规则

这份文档应保持 append-only：

- 新 release 追加在顶部
- 旧条目不重写事实
- 如果后续补了新的解释，应新增“补注”而不是改掉原始记录

如果某次 release 最终被判定为无效或废弃，也不删除记录，而是在条目里明确标记状态。

## 3. 当前已记录 release

### Release 001

| 字段 | 当前值 |
|---|---|
| Status | `active testnet reference release` |
| Network | `Base Sepolia` |
| Chain ID | `84532` |
| Deployment block | `37393796` |
| Deployment time | `2026-02-08 21:04:40 CST` / `2026-02-08 13:04:40 UTC` |
| Digest | `0xe0e8bdc3ffc7ba52c7b3409a2bb1cb46c1d8ad20b6e9631ba4f267d490a8bc21` |
| Schema | `SSOT_RELEASE_DIGEST_V1` |
| Signer / GOV | `0xc8eC9920d573893E888db5D30b2B3B3824B1b684` |
| Treasury | `0x0000000000000000000000000000000000000000` |
| Assets | `1` |
| Games | `4` |

#### Asset domain

- `USDC` asset: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `USDC` bank: `0x7C516Cd4e343664D5256E1ed04dD793790885593`

#### Game domain

- Dice
- Coin Toss
- Roulette
- Keno

#### Core protocol addresses

- Hub: `0x5e85C519DD4d2d39540D501444CBe134121B984e`
- VRFHub: `0x31a88594530CA3E4426594D0387113324b4bFa59`
- Adapter: `0x3Ba8Af3C2A3B3a8dD04e507084de0cf93bD370f1`
- BankRegistry: `0x8bd920E5F2a42f145e5a9f6B03b886542F770B1E`
- ReferralRegistry: `0x32002Fd793087934088f2C94c5d9DB7370AeC598`
- ReferralEngine: `0x917915575721b14A91eC96C679bF3D9d026d78B7`

#### Key parameters

- `refundTimeoutSeconds = 3600`
- `defaultHouseEdgeBps = 200`
- `maxAffiliateDeltaBps = 0`
- `bankMinLiqBps_0 = 1000`
- `bankHoldbackVestingSeconds_0 = 86400`

#### Canonical artifacts

- Release pack: [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md)
- Explorer links: [`ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`](ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md)
- LP onboarding: [`ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`](ARBIGAMEFI-LP-ONBOARDING.zh-CN.md)
- Deployment snapshot: [`../../deployments/latest.json`](../../deployments/latest.json)
- Immutable release lock: [`../../deployments/release/release-84532-37393796.json`](../../deployments/release/release-84532-37393796.json)
- Immutable frontend manifest: [`../../deployments/release/frontend-manifest-84532-37393796.json`](../../deployments/release/frontend-manifest-84532-37393796.json)
- Immutable golden vectors: [`../../deployments/release/golden-vectors-84532-37393796.json`](../../deployments/release/golden-vectors-84532-37393796.json)
- Immutable release notes: [`../../deployments/release/release-notes-84532-37393796.md`](../../deployments/release/release-notes-84532-37393796.md)

#### Why this entry matters

这是第一条真正被整理成对外 release materials 的 canonical release 记录。它的意义不在于“已经主网上线”，而在于：

- deployment facts 已经可锁定
- digest 已经可离线验证
- 前端 truth artifacts 已经独立成文
- LP 和合作方的尽调口径已经可以围绕同一组 artifact 展开

## 4. 下一个 release 追加时必须补什么

每追加一个新条目，最少要同步补下面 6 项：

1. 新链 / 新区块 / 新 digest / 新 signer
2. 新 release pack
3. 新 explorer links
4. `CHANGELOG.md` 对应版本与 digest 行
5. `deployments/release/` 下的 immutable artifacts
6. 当前条目的状态说明，例如 `active`, `superseded`, `deprecated`, `testnet only`

## 5. 不要把这份文档写成什么

不要把它写成：

- 产品路线图
- 功能待办列表
- 宣传新闻稿
- 审计报告替代品

它只是一份 release ledger。

## 6. 一句话结论

`CHANGELOG.md` 告诉你代码怎么变，`ARBIGAMEFI-RELEASE-HISTORY.zh-CN.md` 告诉你哪些链上发布事实真正成立过。这两者必须同时存在，发布纪律才完整。
