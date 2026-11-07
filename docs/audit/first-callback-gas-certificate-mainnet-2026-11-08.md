# Base 主网首次回调 gas 证书（2026-11-08）

状态：**主口径计算闭合，PENDING_INDEPENDENT_REVIEW**。不构成主网部署批准；`first-callback-domain-8453.json` 不得标为 CERTIFIED，直至独立复核接受且封存引用齐备。

## 范围与身份

受证候选仍为当前 40 层树、k > 0 的赌场结算、最多 25 轮、每轮最低 0.01 USDC、L0/L1/L2、24 小时 LP 冷却与 H1 同域规则。编译器仍为 Solc 0.8.37/Cancun/viaIR/optimizer 500；`riskReserveBps` 为 6000。合约源码未改。

沿用已接受的 v5 方法和非 gas 前提，不把“gas 足够”扩大成任意 token/provider、无效账目或不可结算状态也必定成功。原 v5 只接受 Base Sepolia；本文另绑定链 8453 的 USDC/provider，不借用其链级接受结论。

## 主网输入

本轮只读固定区块 **54,423,335**，哈希 `0x343323a2528b7cc60e4bc2a1fe3c35894db36c6544145f5d705440d162468317`，为 Denim 后 finalized 块，读取结束核对哈希不变。19 个区块间隔共 4 秒、同一秒最多 5 块，毫秒时间戳步进 200；BaseTime 正常、tx[1] 为其存款，块 gas 上限 40,000,000。原始读数在 `dist/mainnet-certificate-2026-11-08/readings/`；这些是窄状态观测，不是网络升级或发布验收。

- USDC：`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`；实现 `0x2ce6311ddae708829bc0784c967b7d77d19fd779`。两份 runtime SHA-256 与 10-14 主网输入逐字节相同，和 Sepolia 不同。
- wrapper：`0xb0407dbe851f8318bd31404A49e658143C982F23`；coordinator：`0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`。配置仍为 wrapper 开销 13,400、coordinator 上限 2,500,000；完整读数按固定块记录。
- consumer 预算为 2,447,746；加 EIP-150 与 wrapper 开销恰好到 provider 上限，provider 外层仍零余量。主口径的结算余量须至少 50,000，二者不得混淆。
- token 体界的主网计算与代理区域映射来自 `dist/mainnet-certificate-inputs-2026-10-14/`，联合上界 78,394，按 token 调用拓扑、非 admin 调用、健康 custody、余额/授权等原前提使用，**待独立复核**。

官方地址依据：[Chainlink VRF v2.5 支持网络](https://docs.chain.link/vrf/v2-5/supported-networks)、[Circle USDC 地址](https://developers.circle.com/stablecoins/usdc-contract-addresses)；Denim 时间依据 [Base v1.5.1](https://github.com/base/base/releases/tag/v1.5.1)。本轮使用链上读数核对具体配置和代码，网页地址说明不代替代码绑定。

## 计算与验证记录

计算代码提交 `5cc1199bd08dc6959f106529d6b86ddf7d6cae63`，tree `82662c29f6cf184897efc19e4290cd9d06b324fe`。相对原 v5 冻结提交，`src/`、`lib/`、`foundry.toml`、`deps.lock` 均未变。

派生证书 `dist/mainnet-certificate-2026-11-08/certificate/`，清单 SHA-256 `17c8ab971e393fe598ff18b957339ec2b11beaceb4f94e8143deb989b2f123b4`；副本 `script/release/certificates/first-callback-mainnet-v1/CERTIFICATE.sha256`。域文件仅在计算后补入此封存引用，计算字段与本次输入逐字节一致，仍为 PENDING；没有复核封存引用或 CERTIFIED 切换。

| 口径 | consumer 入口需求 | 余量 |
| --- | ---: | ---: |
| 解释器、显式边界（主口径） | 2,305,547 | 142,199 |
| 解释器、按供给 | 2,283,374 | 164,372 |
| 静态、显式边界（次口径） | 2,425,311 | 22,435 |
| 静态、按供给（次口径） | 2,403,139 | 44,607 |

主口径达到 50,000 门槛；两项次口径低于该门槛，如实保留，按 ADR-0006 不控制状态切换。O1：Vault 供给 24,502 ≥ 保留需求 17,570，末次写入余量 6,823；O2 各项均 ≥ 2,301。GameHub 子帧需求 2,111,156 ≤ 作废结算预算 10,000,000。

**重算与沿用分开。** 本轮重跑构建、协议帧、树、账本、主网 token 绑定与组合。模块阶段的界、M7 检查点、M1 访问分析、M6 oracle 输入明确沿用已接受 v5：原 78 项清单核对通过，所有 14 个合约的编译器、编译输入/输出与 runtime 记录逐字节相同，四个模块分析器脚本逐字节相同，M6 输入与当前 EVM 用例一致。`CARRIED_COMPONENTS.json` 和 `DERIVATION.py` 记录检查；没有把 324 个模块任务记成本轮重跑，也没有把 Sepolia 的链级接受结论移到主网。

**验证（实施方，不是独立复核）：**

- 证书工具 25/25，覆盖链选择、主网 token pin、禁止串用 Sepolia 绑定、原失效门槛。
- 主网固定区块的严格矩阵 137/137：语义与 provider 回调预算全部通过，输入清单前后相同；每例独立 setUp/test，不循环复用脏存储。样本不代替最坏界。
- 同一区块直连真实 wrapper/coordinator 4/4、真实主网 USDC 作废 2/2。均为本地分叉和 impersonation，不是实链广播、VRF 证明、计费或 oracle SLA 验收。
- 当前构建的 M4/P5、module oracle 与既有域/运行时回归共 31/31（nightly profile）。M4 结构证明沿用 `m4-resolve-census-2026-10-08.md`：纯模块、Bank 的 2^108 资本约束、1–25 轮与最低注额前提不变，并绑定同一字节码；有限测试不代替该结构论证。域回归中接受的仍是 Sepolia 域，不冒称主网 PENDING 域已获准发布。
- 全部分叉结束后，固定块哈希仍相同；区块 54,434,445 上再次核对 token/provider 配置及 wrapper/coordinator 代码仍与本域一致，末尾哈希复核通过。

原主网 token 计算、v5 清单与其独立复核、M4 证明、固定代码源归档和全部本轮日志随复核包提交。只有 gas 模型和组件来源逐项经独立确认，才满足主网认证的接受条件。

独立复核应覆盖主网 token 体界与映射、chainId/域选择不能串链、编译绑定、沿用组件有效性、M4 与四种组合口径、50,000 余量和作废预算，以及测试及实链观测的实际边界。
