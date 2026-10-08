# 全新 Base Sepolia 部署：部署前检查

日期：2026-10-05。范围是全新合约、全新 Bank/Vault、全新部署快照、新数据库及匹配源码的应用。
旧合约地址和部署产物保留为历史，不作为本次协议实例的部署输入。

本页记录 2026-10-05 当天完成的部署前准备，保留为历史结果。用户随后在同日交接中明确决定
继续全状态首次回调 gas 上界验证；当前主线是该项验证，不能依据本页停止验证或启动部署。
未完成的上界证明及正式发布的 REWORK 裁决不变；这些准备不是验证通过、广播授权或对外资金上线验收。

## 已完成

| 部署前事项 | 本次结果 |
| --- | --- |
| 当前源码构建 | Solidity 0.8.37 / Cancun / viaIR / optimizer 500 独立编译通过 |
| ABI 与体积 | 19 份 ABI 与应用一致；18 个部署合约 runtime 均保留至少 1 KB 余量；Bank initcode 模板 33,653 bytes |
| 合约回归身份 | 之前 481 项通过结果对应的 209 项现存输入无变化，19 份合约的编译器、源码/依赖内容摘要、可执行 runtime 和 ABI 一致；本轮复核身份，没有重跑旧 gas 矩阵 |
| 发布工具 | 43 项当前 ABI、发布包、治理权限、manifest 和容器部署守卫通过 |
| 应用 | 当前工作区 lint、类型检查、单元测试、web/keeper 构建通过 |
| 本地真实合约集成 | SDK Anvil 4 项、八模块下注限额对照 8 项通过；keeper/PostgreSQL 断线、进程恢复、付款与退款集成通过 |
| 钱包浏览器 | 1 项完整 LP 与赌场流程通过，含授权、25 轮下注、本地 wrapper 回调、终态和资金核对 |
| 链上前置读取 | Base Sepolia 区块 47,683,340；预期 Safe 的代码、owner/control 摘要一致，2/3、无模块/guard；USDC 6 位精度，wrapper/coordinator 有代码 |
| 新部署演练 | 现有 `make deploy-dryrun` 完整模拟成功，38 笔交易，nonce 127–164，15 个顶层 CREATE 加 Bank 内部创建的 Vault；单 USDC Casino，Sports 不启用 |
| 独立交易核对 | 15 个 CREATE 和 23 个 CALL 的完整 input 与当前 artifact/参数逐字节一致；Vault 构造参数、内部创建地址及四项 Safe 治理提名一致 |

这次浏览器已实际执行赌场下注到本地回调。此前应用复盘中“仅 LP 浏览器验证”的说明属于旧证据范围，
不能继续作为当前本地接入缺口；公共 Chainlink 网络和新部署的端到端验收仍在部署后完成。

本次参数使用每轮最低 0.01 USDC、最多 25 轮、60% risk reserve、独立 10% PF/XP buffer、
一小时退款期限及常量 24 小时 NFT 冷却。八游戏的试运行 callback 参数均为当前链上可接受上限
2,447,746 gas；这是 wrapper/coordinator 的请求参数上限，不是所有允许状态都能首次完成的证明。
Bank 的 `setRiskInPaused(true)` 在池注册/路由开放前执行，部署序列结束仍暂停。

## 部署前还剩什么

0. 完成全状态首次回调 gas 上界证明，或给出具体反例和最小修复，并经独立复核。
   2026-10-08 的状态：反例与两项改动已落地；k>0 域的证书 v4 主口径余量 +127,744，已独立复核 ACCEPT；M4 已证明；域文件已切换 `CERTIFIED`；
   本地冻结运行全部通过，架构冻结签核 SIGN_OFF_WITH_CONDITIONS，发布状态 FROZEN_FOR_AUDIT，详见
   [首次回调 gas 证书](../audit/first-callback-gas-certificate-2026-10-07.md)。
   在此之前不形成发布 commit、不签名或广播，下面各项只是之后的顺序。
   `script/release/first-callback-domain-84532.json` 未标为 CERTIFIED 时，发布核验一律失败。
1. 把审阅确认的完整源码形成正式发布 commit。当前 HEAD `d130b4de` 不包含本轮累积改版；
   本地源码快照和逐文件摘要可以固定内容，但现有正式 audit/release packager 要求干净的已提交版本。
   本次没有把几百条既有工作区变更擅自提交，也没有把旧 HEAD 冒充新候选。
2. 在签名当时重新读取部署账户 latest/pending nonce、余额、Safe 控制和链参数；
   本次观测 nonce 为 127，原值 126 及据此预测的地址均不能用于新广播。
3. 用户在本机确认并解锁指定部署账户，审阅本次交易清单后签名广播。
   本次配置、源码快照、模拟清单均已单独准备；没有签名、广播或服务器写入。

## 必须等全新部署后完成

- 用新回执产生新快照，验证新合约源码、Bank/Vault 双向不可变绑定与 codehash；完成 Safe 治理接管。
- 用同一发布 commit 生成并认证新 release digest、manifest、ABI/实例清单，构建并固定 web/keeper 镜像。
- 使用新数据库和新 start block，执行公共网络的真实下注、VRF、到账、NFT 存取及恢复验收。
- 在对外资金准入前完成独立/外部审计和正式运营条件。当前未完成的 gas 资格仍按原记录披露。

本地证据：[全新部署准备目录](../../dist/fresh-deploy-preflight-2026-10-05/README.md)。
其中 `fresh-base-sepolia.env` 是独立的新部署参数草案，`deploy-dryrun.log` 和 `broadcast/` 是无广播模拟，
`chain-readback.json` 是本次只读链上快照；它们不是已部署地址或已签名发布件。
`dist` 为本地忽略目录，公开本页不表示证据包已公开托管。
