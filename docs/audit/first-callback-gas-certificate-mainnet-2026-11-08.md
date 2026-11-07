# Base 主网首次回调 gas 证书（2026-11-08）

状态：**准备与计算中，PENDING_INDEPENDENT_REVIEW**。不构成主网部署批准；`first-callback-domain-8453.json` 不得标为 CERTIFIED，直至独立复核接受且封存引用齐备。

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

完整记录、固定代码提交、组件来源、组合结果、137 例矩阵、直连 wrapper 与真实 USDC 作废分叉结果将在本轮计算完成后填入。沿用的组件必须逐项证明代码、编译输入与分析器一致，并引用原封存；不得把沿用记成重算或把有限矩阵记成全状态证明。

独立复核应覆盖主网 token 体界与映射、chainId/域选择不能串链、编译绑定、沿用组件有效性、M4 与四种组合口径、50,000 余量和作废预算，以及测试及实链观测的实际边界。
