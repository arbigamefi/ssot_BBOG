# 首次回调 gas 证书（k>0 域）

日期：2026-10-12（v5）。编写方：实施接替方。本文不是独立审计结论，也不是发布批准。

**状态：v5，待证书复核方独立复核；域文件 `script/release/first-callback-domain-84532.json` 为 `PENDING_INDEPENDENT_REVIEW`。**

- v5 覆盖上线候选版（[`launch-candidate.zh-CN.md`](../release/launch-candidate.zh-CN.md) §10）。工作包 B 改了 GameHub、Bank、Router、VRFHub、
  PoolRegistry 与 Vault 的 runtime，v4 不再适用（ADR-0006 的重新认证触发）。
- 冻结提交 `1a5e9df00`（树 `5012ff6fc`），冻结运行 `freeze-2026-10-12/`（[证据索引](../release/evidence.md)）。
- 证据目录：`freeze-2026-10-12/certificate/`，由 `script/certificate/certify.py` 在冻结提交上一次算出；封存清单为其中的 `MANIFEST.sha256`
  （78 个文件，SHA-256 `5726389a84ea2348d3801328914e2cbf85354314bde83466cbce9d078f79f674`），副本在 `script/release/certificates/first-callback-v5/`。
- v4（2026-10-08 复核 ACCEPT）只覆盖工作包 B 之前的合约，复现见第 8 节。

## 1. 断言

在第 2 节的受证域内，对每一个已准入状态，第一次 VRF 回调都能在 consumer gas `c = 2,447,746` 内完成整条链路，不依赖重试：

wrapper → VRFHub → GameHub（外层与自调用子帧）→ SettlementRouter → Bank → LiquidityVault → 树与 token。

推导方法与 v4 相同：每一帧从冻结字节码得到可靠的过估计；自叶帧逐层套用 EIP-150 嵌套规则，组合出 consumer 入口处的需求并检查需求 ≤ c；
逐帧检查 EIP-2200 哨兵（每次 SSTORE 时剩余 gas 大于 2,300）。

## 2. 受证域（K0-1）

与 v4 相同的各行（网络、provider 快照、consumer gas、轮数 1–25、八个模块的 codehash、核心合约、token、赌场池最低注额 99、参数不超过 64 字节、
一个随机字、推荐奖励不超过 3 份、模块行为 M4、k > 0），机器检查也相同（发布核验、`CallbackDomainV16Test`、`CertifiedRuntime`）。v5 的变化：

- **核心合约**：VRFHub、GameHub、Router、Bank、Vault 与引擎的可执行代码与本证书分析的字节码逐字节一致（O3）：`certify.py` 的构建阶段用 Forge 产物
  记录的设置与本检出的源码编译，要求 runtime 与 `out/` 逐字节相同，之后的每一项都在这份编译输出上计算。域文件 `coreRuntimes` 另含
  `GovernanceTimelock`、`PoolRegistry` 与 `ReferralRegistry`，它们不在回调路径上。
- **上线候选版的新状态**不改变回调路径：每玩家持仓上限（Bank 的玩家槽，见第 6 节账本）、停用游戏（回调不读 `gameDisabled`）、作废窗口
  （回调不读 `voidCohortEnd`）。矩阵为此加了"同一玩家两笔持仓、结算时 2→1"与"受理后停用游戏"的病例：Keno 25 轮的两例与基线
  `keno25-thin` 逐 gas 相同（1,632,250），另两例叠加拒付或即时奖励，也都在预算内。
- **作废**：`voidBet` 给子帧恰好 `VOID_SETTLEMENT_GAS` = 10,000,000，远高于主口径的子帧需求（第 5 节），所以可入账的结果在作废交易里总能正常结算。

**P5（域引理）** 不变：注额不低于 99 时每个模块都有 r > s（`CallbackDomainP5Test`）；模块可执行码未变。**k = 0 不在域内**，K0-1 至 K0-5 不变。

## 3. 有效期

下列任一项变化都使本证书失效，必须重新认证：受证字节码变化或新增模块；USDC 实现升级；wrapper 或 coordinator 参数变化；硬分叉改变 gas 计价；
`minBetAmount`、轮数或回调 gas 变化。证书按网络区分，Base 主网另行认证。

**推荐与边际参数（架构复审 A-1，冻结签核 FZ-7）。** 回调路径上的这些参数都来自存储读取或引擎的入参：下注时记录的 `houseEdgeBps`、
`_refCfg[referralConfigId]` 的 L0/L1/L2/holdback 比例、Bank 的 `minPlayerTurnoverForUnlock` 与 `holdbackVestingSeconds`。v5 的每一帧都由解释器在
未知值上穷举分支得到，所以上界对这些参数的**任意取值**都成立，不止已校验的范围；它们也不影响任何循环次数（奖励份数由引擎结构限定为至多 3，
轮数由 `registerGame` 限定为至多 25）。请证书复核方确认这一读法（FZ-7）；确认之后，`createReferralConfig`、`setActiveReferralConfig` 与
`queueEdgeChange` 不再是重新认证触发，确认之前仍按重新认证处理。

## 4. 组件上界

账本约定不变：存储、首次访问、事件和账户访问计在固定账本里，逐帧拆分；指令界里 SLOAD 计 100，SSTORE、LOG 和调用访问费计 0。

| 项 | v5 上界 | v4 | 来源 | 状态 |
| --- | ---: | ---: | --- | --- |
| 树与选域，根节点已暖 | 994,531 | 994,571 | `tree/suffix-skip-tree-component.json`，分析器与 v4 相同、锚点改为函数相对（B4 删去 `k == 0` 分支，−40） | 新算，方法已复核 |
| Vault 帧 | 25,118 | 25,118 | 本帧指令（`frame-bounds.json`）+ PositionApplied + 6 次暖调用 600 + 存储 8,900 + 4 个冷键 8,000 | 新算 + 复用常数 |
| Vault getter | 2,274 | 2,274 | `getReserve`、`lockedLiquidity`、`MAX_TREE_CAPITAL` | 新算，方法已复核 |
| token 被调用方合计 | 78,394 | 78,394 | 2026-10-04 token 交叉检查，绑定域文件钉住的 USDC runtime；调用拓扑在构建上机械计数（第 6 节） | 复用（已复核） |
| Bank 本帧 / getter | 34,377 / 2,344 | 30,189 / 2,172 | 解释器，`settleBet` 至多 3 份奖励 | 新算，待复核 |
| 推荐引擎 | 9,577 | 10,312 | 解释器，`allocate` 全部入参未知（可执行码未变） | 新算，待复核 |
| GameHub 子帧 / 外层 | 12,667 / 4,565 | 13,092 / 4,541 | 带环境模型的解释器（第 6 节） | 新算，待复核 |
| VRFHub 与 Router 各帧 | 见 `frame-bounds.json` | | 2,843 + 349；getRequest 2,161；acknowledge 3,006；getPosition 2,691；settlePosition（3 份奖励）5,104 | 新算，方法已复核 |
| 模块（主口径） | 206,201 | 206,201 | 解释器，25 轮完全展开、全部参数长度类（`modules/module-bounds.json`），M7 见第 6 节 | 新算，方法已复核 |
| 模块（次口径） | 324,094 | 324,094 | 2026-10-04 静态界，绑定未变的模块可执行码 | 复用（已复核） |
| 固定账本（拆分合计） | 769,082 | 786,082 | `ledger/ledger.json`；Bank 存储 453,000 → 436,000（第 6 节） | 新算，待复核 |

八个模块的解释器界与 v4 逐值相同：CoinToss 24,857；Dice 36,007；Roulette 37,108；Slots 55,168；SicBo 83,747；Plinko 128,852；Baccarat 131,917；
Keno 206,201。

## 5. 组合与余量

嵌套规则、各项的放置、两种边界处理与 O1/O2 检查与 v4 相同（`composition.py`）；VRFHub 保留 55,000（`CALLBACK_COMPLETION_GAS` 45,000 加
`CALL_OVERHEAD_GAS` 10,000），GameHub 外层保留 25,000，两者与 consumer gas 都从编译源码读取。

| 模块口径 | 边界处理 | consumer 入口需求 | 余量 | v4 余量 |
| --- | --- | ---: | ---: | ---: |
| 解释器 | **显式（主口径）** | 2,305,547 | **+142,199** | +127,744 |
| 解释器 | 按供给 | 2,283,374 | +164,372 | +149,917 |
| 静态 | 显式 | 2,425,311 | +22,435 | +7,980 |
| 静态 | 按供给 | 2,403,139 | +44,607 | +30,153 |

主口径下各层的需求：Bank 1,696,647，Router 1,750,581，GameHub 子帧 2,111,156，外层 2,179,148。余量政策（ADR-0006，Owner 2026-10-08 D2）要求每个网络
不低于 50,000，主口径达标。逐项对照 v4：`python3 script/certificate/compare.py <v4 composition-v4.json> composition.json`。

**观测与上界。** 137 例严格矩阵（固定区块 fork、真实 wrapper 与 USDC，冻结运行的 `full-matrix/`）全部首次回调成功、0 次重试，最大 wrapper 毛 gas
1,989,307（`witness-dp-argmax-covers-loss-keno25-pp`；v1.6 合约上为 2,005,280）。样本只说明上界没有被违反，不能当作上界使用。

**作废分支。** 主口径的子帧需求 2,111,156 远低于 `VOID_SETTLEMENT_GAS`。试结算花光预算后，作废分支在 600,000 的预留上完成：真实 USDC 的 fork 测量
（`test/fork/VoidBetUsdcFork.t.sol`，隔离）其余开销 174,970，两倍不超过预留；USDC 冻结 Vault 时相同。

## 6. 义务状态与 v5 的新论证

- **O1、O2**：主口径下每个写存储的帧在最后一次 SSTORE 时保证剩余的 gas：

  | 帧 | 保证剩余 |
  | --- | ---: |
  | VRFHub（55,000 保留） | 50,058 |
  | GameHub 外层（25,000 保留） | 24,565 |
  | GameHub 子帧（Router 调用时保留的 1/64） | 14,611 |
  | VRFHub.acknowledge | 6,785 |
  | SettlementRouter（Bank 调用时保留的 1/64） | 18,927 |
  | Bank、Vault、两次 token 转账 | 2,301（显式哨兵项） |

  O1：Vault 返回后的供给 24,502 不小于 Vault 调用需要的保留量；Vault 最后一次写存储时至少剩 6,823。
- **O3（绑定）**：分析对象就是本检出的构建（构建阶段逐字节核对 `out/`）。复用的组件逐项绑定（`bindings/component-bindings.json`）：静态模块界绑定
  八个模块未变的可执行码；token 体界绑定域文件钉住的 USDC 代理与实现 runtime；Vault 帧常数与账本组件引用封存的复核文件。复合所用的保留量、
  consumer gas、轮数上限与作废试结算 gas 都从编译源码读取。
- **O4（证据不可变）**：v5 在新目录中封存；`certify.py` 拒绝已存在的输出目录。
- **帧分析器（新）**：v4 的 GameHub 与 Bank 帧是人工整理的物理并集界。v5 全部改用解释器：`env_frame_bound.py` 在 `frame_bound.py` 之上声明环境——
  逐调用点的返回字（规范编码：模块 2 字、getter 1 字、引擎 6 字加偏移 0xe0、奖励份数与每份 6 字、getRequest 8 字）、bet 参数长度槽（32–64 字节
  按长格式存储，槽值 2·len + 1）、immutable 一律视为未知——其余语义与价格不变。没有模型的调用使分析中止。子帧对奖励 0–3 份与参数长度 32–64
  字节取最大。交叉核对：同一模型在 H1（2026-10-04）字节码上给出子帧 12,645、外层 4,456，不超过当时复核过的人工界 13,092、4,541；Bank 两个 getter
  与人工界 525 + 1,647 逐值相同；immutable 视为未知与视为 0 的结果逐值相同。请复核方确认环境模型与引擎、模块、getter 的实际编码一致。
- **Bank 本帧比 v4 宽**：解释器不使用"引擎至多产生两个锁定/延付分支"的语义，三份奖励都可走全部分支，所以 34,377 高于人工界 30,189。
  在 H1 的分支域下（第一份奖励没有锁定与延付部分），同一方法在 H1 字节码上给出 28,171，不超过人工界；在本构建上为 28,901（多出的 730 是持仓计数的代码）。
- **token 调用拓扑（机械）**：在 Bank 与 Vault 的帧上把资产 immutable 设为标记地址，按调用入参长度（36、68、100 字节）计数每条成功路径上的
  balanceOf、transfer、transferFrom：Bank 至多 6 次 balanceOf、1 次 transfer；Vault 在 transfer 路径上至多 5 次 balanceOf，在 transferFrom 路径上
  至多 3 次，任一路径至多一次转账。合起来亏损 11 次 balanceOf 加 2 次 transfer，盈利 9 次 balanceOf 加 transfer 与 transferFrom 各一次，
  与复用的 token 体界所覆盖的拓扑一致。
- **固定账本（重推）**：上线候选版把玩家的已结算流水与持仓数放在同一个槽（ADR-0037 §5，存储布局在 `ledger.py` 中机械核对）。持仓打开时该槽
  必非零，所以结算交易开始时它不是零：`_applyHold` 减持仓数是一次 clean 写（2,900），随后加流水是 dirty 写（100）；v4 账本按新建写 20,000 计。
  Bank 存储包络 453,000 → 436,000，其余组件、首次访问键数、事件费（由构建的 ABI 重算）与外部调用访问费均不变（回调路径上的存储写入、事件与
  调用在 VRFHub、Router、GameHub 的源码中未变，Bank 只有这一处）。
- **M1–M7**：M1（未知地址的内存访问）、M3（参数长度类）、M5（完全展开）、M6（192 例逐 gas 对拍，现为 `test/unit/ModuleGasOracle.t.sol`）与 v4 相同，
  在本构建上重跑。**M7（新）**：模块界随轮数不减、最大值在 25 轮——六个模块逐轮 1–25 全部长度类，Keno 与 Baccarat 在 1、2、5、10、15、20、24 与
  1–7、10、15、20、24 轮（`modules/module-rounds.json`）。**M4**：GameHub `_finalize` 的后置检查与算术源码自 v4 未变，`CallbackDomainM4Test` 在本构建上
  通过（冻结运行的回归阶段）；范围按勘误 E8 理解。
- **k=0 范围（K0-1 至 K0-5）**：与 v4 相同。

## 7. 复核要求

v5 待证书复核方独立复核。除常规复算（`certify.py` 在冻结提交的全新检出上重跑，与封存件比较；四个口径用复核方自己的组合实现复算）外，请特别确认：

1. 环境模型（第 6 节）与各被调用方的实际返回编码、参数长度域一致；
2. Bank 玩家槽的账本论证（结算时该槽必非零）；
3. token 调用拓扑的计数方法；
4. M7 的抽点与"每轮执行同一段循环体"的结构理由；
5. 第 3 节对推荐与边际参数的读法（FZ-7）。

复核通过前，域文件保持 `PENDING_INDEPENDENT_REVIEW`，任何发布核验都失败。

## 8. 复现

```sh
forge build src
python3 script/certificate/certify.py <新目录>
```

约 1.5 小时，几乎都在模块阶段（冻结运行用 90 GiB、12 个进程，82 分钟；Baccarat 25 轮每进程约 31 GB，`--memory-gib`、`--jobs` 控制并行）。比较时忽略模块 JSON 中的耗时与峰值内存字段；
各阶段的脚本随输出一起封存。

v4 的复现：在 `4a5762aa3`（最后一个带 v4 合约的提交）的检出上运行该提交中的 `script/certificate/reproduce_first_callback_v4.py`，证据从归档恢复
（[证据索引](../release/evidence.md)）。
