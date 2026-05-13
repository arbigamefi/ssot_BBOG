# ArbiGameFi Mainnet Release Template

> 项目：`ArbiGameFi`
> 底层架构：`SSOT (Single Source of Truth)`
> 文档系列：`Release Materials`
> 文档编号：`AGF-REL-MAINNET-2026.03`
> 状态：`template`
> 语言：`zh-CN`
> 目标读者：`operators / release managers / auditors / partners`
> 关联文档：
> - [`README.md`](README.md)
> - [`checklist.md`](checklist.md)
> - [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md)
> - [`ARBIGAMEFI-RELEASE-HISTORY.zh-CN.md`](ARBIGAMEFI-RELEASE-HISTORY.zh-CN.md)

## One-line Summary (EN)

This is the mainnet-facing release template for ArbiGameFi. Use it only after generating fresh canonical release artifacts from a real mainnet deployment; do not copy testnet values by hand.

## 1. 这份模板怎么用

这不是一份可以手填几行就发出去的“市场文案模板”。

它的正确用法是：

1. 先完成主网 proof gates、deploy、release-digest、release-notes、frontend manifest、golden vectors。
2. 确认主网 release artifacts 已经生成并可验证。
3. 再把下面这份模板中的占位字段，替换成**由 artifact 导出的事实**。

换句话说：

- 先生成事实
- 再生成文档

不能反过来。

## 2. 绝对不能手工继承 testnet 的字段

下面这些字段不允许从 testnet 文档直接复制后只改一半：

- `Network`
- `Chain ID`
- `Deployment block`
- `Deployment timestamp`
- `Release digest`
- `Signer / GOV`
- `VRF wrapper`
- `Treasury`
- 所有核心合约地址
- 所有资产与 Bank 地址
- 所有 explorer links

如果这些字段不是从主网 release artifact 和主网 explorer 重新生成的，这份文档就不可信。

## 3. 主网发布前最少要完成什么

发布前至少应完成：

- `make pr`
- `make nightly`
- `FORK_RPC_URL=... FORK_VRF_WRAPPER=... make fork`
- `make release-digest`
- `make release-notes`
- `make release-frontend-manifest`
- `make release-golden-vectors`
- `make release-verify`
- `STRICT=1 make release-check`

并且应具备：

- `deployments/latest-v13.json`
- `deployments/release-latest-v13.json`
- `deployments/release-notes-latest.md`
- `deployments/frontend-manifest-latest-v13.json`
- `deployments/golden-vectors-latest-v13.json`
- `deployments/verify-latest-v13.sh`

## 4. 主网 release pack 模板

下面是主网对外发布包的推荐骨架。

将尖括号内容替换成主网 release artifact 导出的事实值。

---

# ArbiGameFi Release Pack

> 项目：`ArbiGameFi`
> 底层架构：`SSOT (Single Source of Truth)`
> 文档系列：`Release Materials`
> 文档编号：`AGF-REL-PACK-<YYYY.MM>`
> 状态：`mainnet deployment`
> 语言：`zh-CN`
> 快照范围：`<NETWORK NAME> / chainId <CHAIN_ID> / block <BLOCK_NUMBER>`
> 快照时间：`<LOCAL TIME>` / `<UTC TIME>`
> 目标读者：`LPs / partners / auditors / technical integrators`
> 关联文档：
> - [`../WHITEPAPER.zh-CN.md`](../WHITEPAPER.zh-CN.md)
> - [`README.md`](README.md)
> - [`checklist.md`](checklist.md)
> - [`ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`](ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md)
> - [`ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`](ARBIGAMEFI-LP-ONBOARDING.zh-CN.md)
> - [`../../deployments/release-latest-v13.json`](../../deployments/release-latest-v13.json)
> - [`../../deployments/frontend-manifest-latest-v13.json`](../../deployments/frontend-manifest-latest-v13.json)

## Abstract (EN)

This document is the outward-facing release pack for the current ArbiGameFi mainnet deployment. It summarizes the canonical deployment snapshot, release digest, signer, contract addresses, supported games and assets, proof artifacts, and the exact steps a partner, LP, or auditor can use to independently verify what is deployed today.

## 1. 文档目的

这份文档用于说明当前主网上链事实，而不是产品愿景。

## 2. 当前发布快照

### 2.1 Canonical release identity

| 字段 | 当前值 |
|---|---|
| Network | `<NETWORK NAME>` |
| Chain ID | `<CHAIN_ID>` |
| Deployment block | `<BLOCK_NUMBER>` |
| Deployment timestamp | `<LOCAL TIME>` / `<UTC TIME>` |
| Release digest | `<DIGEST>` |
| Digest schema | `SSOT_RELEASE_DIGEST_V1` |
| Schema hash | `<SCHEMA_HASH>` |
| Signer / GOV | `<GOV_ADDRESS>` |
| Release lock artifact | [`../../deployments/release-latest-v13.json`](../../deployments/release-latest-v13.json) |
| Deployment snapshot | [`../../deployments/latest-v13.json`](../../deployments/latest-v13.json) |

### 2.2 Release lock signature

| 字段 | 当前值 |
|---|---|
| `v` | `<V>` |
| `r` | `<R>` |
| `s` | `<S>` |

## 3. 核心合约地址

### 3.1 Protocol core

| 模块 | 地址 | 角色 |
|---|---|---|
| GOV | `<GOV_ADDRESS>` | 当前治理与发布签名主体 |
| GameHub | `<GAMEHUB_ADDRESS>` | 全局 bet registry、生命周期与结算中枢 |
| VRFHub | `<VRFGAMEHUB_ADDRESS>` | 随机数请求映射、transport 与 refundCredit |
| Adapter | `<ADAPTER_ADDRESS>` | 外部 VRF provider 适配层 |
| PoolRegistry | `<POOLREGISTRY_ADDRESS>` | 资产到 Bank 的注册表 |
| ReferralRegistry | `<REFREGISTRY_ADDRESS>` | 推荐关系注册表 |
| ReferralEngine | `<REFENGINE_ADDRESS>` | 推荐预算与 XP 负债计算引擎 |

### 3.2 VRF dependency

| 组件 | 地址 | 说明 |
|---|---|---|
| VRF Wrapper | `<VRF_WRAPPER_ADDRESS>` | 当前 release 绑定的外部随机数 wrapper |
| Treasury | `<TREASURY_ADDRESS>` | 当前 release treasury |

## 4. 当前支持的资产与游戏

### 4.1 Assets and banks

| Asset | Symbol | Decimals | Bank | LP token |
|---|---|---|---|---|
| `<ASSET_0>` | `<SYMBOL_0>` | `<DECIMALS_0>` | `<BANK_0>` | `<LP_NAME_0>` / `<LP_SYMBOL_0>` |

如有多个资产域，按同一结构继续补齐。

### 4.2 Games and modules

| Game | Slug | Game ID | Module | 参数编码 |
|---|---|---|---|---|
| `<GAME_1>` | `<SLUG_1>` | `<GAME_ID_1>` | `<MODULE_1>` | `<PARAMS_1>` |

按实际 manifest 全量列出，不要只列“最常用”的几个。

## 5. 当前关键参数

### 5.1 GameHub-level parameters

| 参数 | 当前值 | 含义 |
|---|---|---|
| `refundTimeoutSeconds` | `<REFUND_TIMEOUT>` | 超时退款窗口基准 |
| `defaultHouseEdgeBps` | `<HOUSE_EDGE_BPS>` | 默认 house edge |
| `maxAffiliateDeltaBps` | `<MAX_AFFILIATE_DELTA_BPS>` | affiliate delta 允许范围 |

### 5.2 Bank-level parameters

| 参数 | 当前值 | 含义 |
|---|---|---|
| `bankMinLiqBps_<i>` | `<MIN_LIQ_BPS_i>` | 最小流动性缓冲占比 |
| `bankHoldbackVestingSeconds_<i>` | `<HOLDBACK_SECONDS_i>` | holdback 线性释放时长 |
| `bankMinTurnoverForUnlock_<i>` | `<TURNOVER_THRESHOLD_i>` | unlock turnover 阈值 |

## 6. 外部验证怎么做

1. 读取 `deployments/latest-v13.json`
2. 读取 `deployments/release-latest-v13.json`
3. 运行 `make release-verify`
4. 使用 `deployments/verify-latest-v13.sh` 或 `make verify`
5. 对照 `frontend-manifest-latest-v13.json` 和 `golden-vectors-latest-v13.json`

## 7. 当前 release 的边界与未承诺事项

这里必须写“主网当前已经实现什么”和“主网当前没有承诺什么”，而不是重复 testnet 口径。

例如：

- 是否多资产已启用
- treasury 是否仍为零地址
- 是否已有实际 LP domain
- 是否已有 production VRF dependency
- 哪些产品层仍未纳入当前 release 承诺

## 8. 附带文件

- `deployments/latest-v13.json`
- `deployments/release-latest-v13.json`
- `deployments/release-notes-latest.md`
- `deployments/frontend-manifest-latest-v13.json`
- `deployments/golden-vectors-latest-v13.json`
- `deployments/verify-latest-v13.sh`
- `docs/release/ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`
- `docs/release/ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`

---

## 5. 模板完成后还要做什么

主网 release 文档生成后，至少还要同步 3 件事：

1. 在 [`ARBIGAMEFI-RELEASE-HISTORY.zh-CN.md`](ARBIGAMEFI-RELEASE-HISTORY.zh-CN.md) 追加新条目。
2. 在 `CHANGELOG.md` 写入对应版本说明和 digest 行。
3. 重新生成主网 explorer links 文档，而不是沿用 testnet links。

## 6. 一句话结论

主网发布包不能通过“复制 testnet 文档 + 手工改地址”完成。它必须是主网 release artifact 的派生物，否则就不具备 ArbiGameFi 所要求的可验证性。
