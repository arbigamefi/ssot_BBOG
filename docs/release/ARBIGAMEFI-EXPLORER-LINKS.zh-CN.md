# ArbiGameFi Explorer Links

> 项目：`ArbiGameFi`
> 底层架构：`SSOT (Single Source of Truth)`
> 文档系列：`Release Materials`
> 文档编号：`AGF-REL-LINKS-2026.02`
> 状态：`current deployment snapshot`
> 语言：`zh-CN`
> 快照范围：`Base Sepolia / chainId 84532 / block 37393796`
> 目标读者：`partners / LPs / auditors / operators`
> 关联文档：
> - [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md)
> - [`../../deployments/latest.json`](../../deployments/latest.json)
> - [`../../deployments/release-latest.json`](../../deployments/release-latest.json)

## One-line Summary (EN)

This document provides direct Base Sepolia explorer links for the current ArbiGameFi deployment. It is a convenience layer only; the canonical truth remains the signed release artifacts.

## 1. 使用说明

这份文档只是“可点击入口清单”，不是事实源本身。

判断当前 release 的 canonical truth，仍然应以这几份 artifact 为准：

- [`../../deployments/latest.json`](../../deployments/latest.json)
- [`../../deployments/release-latest.json`](../../deployments/release-latest.json)
- [`../../deployments/frontend-manifest-latest.json`](../../deployments/frontend-manifest-latest.json)

Explorer links 的作用是让合作方、LP、审计方和运营方不用手工拼地址，能直接跳到当前链上对象。

## 2. 当前网络

| 字段 | 当前值 |
|---|---|
| Network | `Base Sepolia` |
| Chain ID | `84532` |
| Explorer | [sepolia.basescan.org](https://sepolia.basescan.org/) |
| Deployment block | [`37393796`](https://sepolia.basescan.org/block/37393796) |
| GOV / signer | [`0xc8eC9920d573893E888db5D30b2B3B3824B1b684`](https://sepolia.basescan.org/address/0xc8eC9920d573893E888db5D30b2B3B3824B1b684) |

## 3. Protocol core

| 模块 | 地址 | Explorer |
|---|---|---|
| GOV | `0xc8eC9920d573893E888db5D30b2B3B3824B1b684` | [Open](https://sepolia.basescan.org/address/0xc8eC9920d573893E888db5D30b2B3B3824B1b684) |
| Hub | `0x5e85C519DD4d2d39540D501444CBe134121B984e` | [Open](https://sepolia.basescan.org/address/0x5e85C519DD4d2d39540D501444CBe134121B984e) |
| VRFHub | `0x31a88594530CA3E4426594D0387113324b4bFa59` | [Open](https://sepolia.basescan.org/address/0x31a88594530CA3E4426594D0387113324b4bFa59) |
| Adapter | `0x3Ba8Af3C2A3B3a8dD04e507084de0cf93bD370f1` | [Open](https://sepolia.basescan.org/address/0x3Ba8Af3C2A3B3a8dD04e507084de0cf93bD370f1) |
| BankRegistry | `0x8bd920E5F2a42f145e5a9f6B03b886542F770B1E` | [Open](https://sepolia.basescan.org/address/0x8bd920E5F2a42f145e5a9f6B03b886542F770B1E) |
| ReferralRegistry | `0x32002Fd793087934088f2C94c5d9DB7370AeC598` | [Open](https://sepolia.basescan.org/address/0x32002Fd793087934088f2C94c5d9DB7370AeC598) |
| ReferralEngine | `0x917915575721b14A91eC96C679bF3D9d026d78B7` | [Open](https://sepolia.basescan.org/address/0x917915575721b14A91eC96C679bF3D9d026d78B7) |
| VRF Wrapper | `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed` | [Open](https://sepolia.basescan.org/address/0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed) |

## 4. Assets and banks

| 对象 | 地址 | Explorer |
|---|---|---|
| USDC asset | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | [Open](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| Bank (USDC) | `0x7C516Cd4e343664D5256E1ed04dD793790885593` | [Open](https://sepolia.basescan.org/address/0x7C516Cd4e343664D5256E1ed04dD793790885593) |

## 5. Game modules

| Game | Module | Explorer |
|---|---|---|
| Dice | `0x8Fb66Ccc25d07b252d282BE646D24444C062C667` | [Open](https://sepolia.basescan.org/address/0x8Fb66Ccc25d07b252d282BE646D24444C062C667) |
| Coin Toss | `0x1914DA7E7AAEE19771EB7d92A5591212B9C0bBCa` | [Open](https://sepolia.basescan.org/address/0x1914DA7E7AAEE19771EB7d92A5591212B9C0bBCa) |
| Roulette | `0x1EB246dB7d90a266b446a19108114BA39b3a5756` | [Open](https://sepolia.basescan.org/address/0x1EB246dB7d90a266b446a19108114BA39b3a5756) |
| Keno | `0x3DdE1a40A9fAe07375F9e129A9AC73E04c84F037` | [Open](https://sepolia.basescan.org/address/0x3DdE1a40A9fAe07375F9e129A9AC73E04c84F037) |

## 6. 发布验证入口

| 对象 | 链接 / 文件 |
|---|---|
| Deployment block | [Block 37393796](https://sepolia.basescan.org/block/37393796) |
| Release pack | [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md) |
| LP onboarding | [`ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`](ARBIGAMEFI-LP-ONBOARDING.zh-CN.md) |
| Deployment snapshot | [`../../deployments/latest.json`](../../deployments/latest.json) |
| Release lock | [`../../deployments/release-latest.json`](../../deployments/release-latest.json) |
| Release notes | [`../../deployments/release-notes-latest.md`](../../deployments/release-notes-latest.md) |
| Frontend manifest | [`../../deployments/frontend-manifest-latest.json`](../../deployments/frontend-manifest-latest.json) |
| Golden vectors | [`../../deployments/golden-vectors-latest.json`](../../deployments/golden-vectors-latest.json) |
| Verify helper | [`../../deployments/verify-latest.sh`](../../deployments/verify-latest.sh) |

## 7. 最后提醒

如果 explorer 上显示的链上内容与 release artifact 不一致，以 release artifact 和本地校验结果为准，再追查部署或验证问题。Explorer 是便利层，不是最终事实源。
