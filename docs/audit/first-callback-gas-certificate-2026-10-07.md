# 首次回调 gas 证书（k>0 域）

日期：2026-10-07。编写方：实施接替方。本文不是独立审计结论，也不是发布批准。

**状态：v4，已独立复核（ACCEPT，2026-10-08，复核清单 `d6c1619c…`）；域文件已于 2026-10-08 切换 `CERTIFIED`；发布状态 FROZEN_FOR_AUDIT，不可部署。**

**2026-10-11：** 上线候选版会改动受证的核心合约，本证书只作为证书 v5 的来源（[上线候选版](../release/launch-candidate.zh-CN.md) §10）。
文中的证据目录原在 `dist/` 下，现已归档（同文 §14），路径相对于归档中的 `dist/`。

- v3 经独立复核：树 DP（994,571）、帧分析器、字节码绑定和 P5 都已确认；复核发现的漏项（Bank 调用的三个 Vault getter 帧，2,274 gas）在 v3 中补上，主口径余量 +7,980。
- 2026-10-08 Owner 决定（D1–D4）：M4 用逐模块普查证明；余量标准统一为 ≥50,000，用模块包达到；证书政策写入 ADR-0006；签一份只含设计固有残余的风险接受书。
- v4 据此把主口径的模块项换成精确字节码解释器的界（M1、M3、M5、M6 已关闭，见第 6 节），主口径余量 +127,744（第 5 节）。
- 2026-10-08 证书复核方确认了 v4 与 M4 普查：**ACCEPT，无阻断条件**（`independent-review-certificate-v4-2026-10-08/`，MANIFEST 摘要 `d6c1619c…`）。只涉及措辞的发现记入 `landing-2026-10-08/certificate-v4-ERRATA.md`，封存件不动。
- 2026-10-08 Owner 确认接受书文本与勘误处理方式；`script/release/first-callback-domain-84532.json` 同日切换为 `CERTIFIED`，
  其 `certificateSeal` 块引用 v4 封存清单 `d67a7083…`、勘误和复核清单 `d6c1619c…`。发布状态仍为 REWORK，直到冻结运行完成。
- 发布状态仍为 **REWORK**。

- 证据目录：`landing-2026-10-08/certificate-v4/`，封存清单为 `CERTIFICATE-v4.sha256`。
- 旧封存都保持原样，不被覆盖：v3 在 `landing-2026-10-07-r2/certificate-v3/`（`4a1b245e…`）；v2 在
  `landing-2026-10-07/certificate-v2/`（`b4a2222b…`）；更早一版在 `takeover-2026-10-07/certificate/`（`f8fdd041…`）。
- 候选：工作区 `codex/v16-acceptance-closeout`（HEAD `d130b4de` 加未提交改动）；源清单
  `landing-2026-10-07-r2/R2_SOURCE.sha256`；Vault runtime `844ba36c…`，与 v2 相同。

## 1. 断言

在第 2 节的受证域内，对每一个已准入状态，第一次 VRF 回调都能在 consumer gas
`c = 2,447,746` 内完成整条链路，不依赖重试。链路是：

wrapper → VRFHub → GameHub（外层与自调用子帧）→ SettlementRouter → Bank → LiquidityVault → 树与 token。

推导方法：

- 每一帧都从冻结字节码得到可靠的过估计。
- 自叶帧逐层套用 EIP-150 嵌套规则，组合出 consumer 入口处的需求，并检查需求 ≤ c。
- 逐帧检查 EIP-2200 哨兵：每次 SSTORE 时剩余 gas 必须大于 2,300。

## 2. 受证域（K0-1）

| 维度 | 受证值 | 机器检查 |
| --- | --- | --- |
| 网络 | Base Sepolia 84532 | 发布核验比较 `chainId` |
| provider 快照 | 区块 47,657,524；wrapper overhead 13,400；coordinator 上限 2,500,000，由此得出 `c = 2,447,746` | 发布核验：在线比对 coordinator 地址和两个 gas 参数，离线比对 wrapper 地址。2026-10-07 在区块 47,795,947 上实跑 `verify_callback_provider.py`，结果 verified（封存于 r2 的 `live-provider-check.json`） |
| consumer gas | 每个游戏的 `callbackGasLimit` 都等于 2,447,746 | 发布核验 |
| 轮数 | 1–25 | 发布核验 |
| 模块 | 八个模块的 runtime 与 `script/release/first-callback-domain-84532.json` 中的 codehash 一致；已登记的游戏恰好是这八个 | 发布核验（离线比对 codehash，在线回放 `GameRegistered`）；`CallbackDomainV16Test` 把域文件钉到当前构建，remapping 已在 `foundry.toml` 中写死 |
| 核心合约 | VRFHub、GameHub、Router、Bank、Vault 和引擎的可执行代码与本证书分析的字节码逐字节一致（O3），也与固定账本所绑定的构建一致 | `certificate-v4/bindings/component-bindings.json`；发布核验：域文件 `coreRuntimes` 钉住八个核心合约的编译产物哈希与 immutable 槽位，`CertifiedRuntime` 在 fork 上比对已部署代码、槽位值与构造接线（2026-10-10 独立审计 F-01 的修复） |
| token | Base Sepolia USDC 代理与实现（已复核的区域与身份） | 发布核验：在线比对实现槽、代理和实现的代码哈希；离线比对赌场池资产 |
| 赌场池最低注额 | 每轮不少于 99 个原始单位（官方值 10,000） | 发布核验 |
| 其它 | 参数不超过 64 字节；一个随机字；推荐奖励不超过 3 份（L0/L1/L2） | GameHub 准入 |
| 模块行为 | 已准入投注的 `resolve` 不会因 gas 以外的原因失败，且通过 GameHub 的后置检查（M4） | [`m4-resolve-census-2026-10-08.md`](m4-resolve-census-2026-10-08.md)；`CallbackDomainM4Test` |
| **仓位** | **k = reserved − stake > 0** | 下方引理 P5 |

**P5（域引理）：注额不低于 99 时，每个模块都有 r > s。**

- 每个模块的 `maxPayout` 都是 `floor(s·f)`，且 f > 1。
- 因为 `floor(s·f) − s` 随 s 单调不减，所以只需检查 s = 99。
- 各模块的最小系数如下：

| 模块 | 最小系数 f |
| --- | --- |
| Dice | 100/99（目标 99 的 under，或目标 1 的 over） |
| Roulette | 37/36（36 个号码的位图；37 个号码会被拒绝） |
| Keno | 1.5（选 1 个号码） |
| Plinko | 1.5264 |
| SicBo | 2.0571（大或小） |
| Baccarat | 2.1813 |
| CoinToss | 2 |
| Slots | 64 |

- `CallbackDomainP5Test` 采用独立复核方的完整参数域穷举：每个参数取遍其 ABI 类型的全部取值；Roulette 的位图按 popcount 等价类取代表，因为 `maxPayout` 只依赖 popcount。每个参数都按 GameHub 的顺序先 `validate` 再 `maxPayout`。
- 下界是紧的：Dice 在注额 98 时 r = s，即 k = 0；在 99 时 k = 1。

**k = 0 不在域内。** 这一裁定见架构裁决 §12.2，执行条件 K0-1 至 K0-5 如下：

- k=0 的分配仍走带 vendor 预检、可能两次 push 的 `_addLimit`，本证书不覆盖它。
- 以下操作必须先重新认证：
  - 把赌场池的 `minBetAmount` 降到 99 以下；
  - 执行任何 `registerGame`，包括新模块、换模块、改轮数上限或改回调 gas。
- 治理手册见 [governance-safe-setup.md](../ops/runbooks/governance-safe-setup.md)。
- 对外只能说"在受证配置下，首次回调可以完成"。

## 3. 有效期

下列任一项变化都会使本证书失效，必须重新认证。推荐与边际参数一项的治理入口已列入治理手册：`GameHub.createReferralConfig`、`setActiveReferralConfig`、`queueEdgeChange`。在证书复核方确认"已校验范围内的参数不影响上界"这一读法之前，按需重新认证处理（架构复审 A-1）：

- 任何受证字节码变化，或新增模块；
- USDC 实现升级（发行方可以单方面升级）；
- wrapper 或 coordinator 参数变化；
- 硬分叉改变 gas 计价；
- `minBetAmount`、轮数、回调 gas 或推荐奖励参数变化。

证书按网络区分。Base 主网的 USDC、wrapper 和参数都不同，不能沿用本证书。

## 4. 组件上界

账本约定：存储、首次访问、事件和账户访问的费用都计在固定账本里，合计 811,982，逐帧拆分。
指令界里 SLOAD 计 100，SSTORE、LOG 和调用访问费计 0，这样不会重复计费。

| 项 | 上界 | 来源（均按 SHA-256 绑定，见 `composition-inputs.sha256.json`） | 复核状态 |
| --- | ---: | --- | --- |
| 树与选域，含 UNUSED_SUFFIX，根节点已暖 | 994,571 | `certificate-v4/tree/suffix-skip-tree-component.json`（与 v3 逐字节相同）；最大情形为亏损且前缀覆盖 k | 已独立复核：操作式模拟器穷举 h=1..9；h=40 复现最坏形状；真实字节码上 18 个探针 |
| Vault 帧 | 25,118 | 本帧指令 5,469（`frame-bounds.json`，最终 runtime）+ PositionApplied 2,149 + 6 次暖调用 600 + 存储 8,900 + 4 个冷键 8,000 | 已独立复核（与实测逐 gas 相等） |
| Bank 调用的 Vault getter | 2,274 | `getReserve` 624 + `lockedLiquidity` 829 + `MAX_TREE_CAPITAL` 821（`frame-bounds.json`） | v3 新增（复核 M-1） |
| token 被调用方合计 | 78,394 | 2026-10-04 token 独立交叉检查 | 已复核 |
| Bank 本帧 / getter | 30,189 / 2,172 | `h1-callback-cost-certificate-2026-10-04/protocol/bank-settle-bound.json` | 已复核 |
| 推荐引擎 | 10,312 | `engine-bound.json` | 已复核 |
| GameHub 子帧 / 外层 | 13,092 / 4,541 | `gamehub-{finalize,outer}-bound.json` | 已复核 |
| VRFHub 与 Router 各帧 | 2,843 + 349；getRequest 2,161；acknowledge 2,994；getPosition 2,669；settlePosition（3 份奖励）5,104 | `frame-bounds.json` | 已独立复核 |
| 模块（主口径，v4） | 206,201（Keno 25 轮） | 精确字节码解释器，每个模块在 25 轮下完全展开，取全部参数长度类的最大值（`certificate-v4/modules/module-bounds-v4.json`）；前提 M1、M3、M5、M6 见第 6 节 | 已独立复核（2026-10-08 v4 复核） |
| 模块（次口径） | 324,094（Keno 25 轮） | 2026-10-04 静态界，独立复核，runtime 逐字节相同 | 已复核 |

八个模块的解释器界（25 轮；各模块在其全部参数长度类下的界相同）：CoinToss 24,857；Dice 36,007；Roulette 37,108；
Slots 55,168；SicBo 83,747；Plinko 128,852；Baccarat 131,917；Keno 206,201。

## 5. 组合与余量

嵌套规则 `need(U; O, R, Q) = max(U+R, O+inv(U), O+U+Q, R+1)`，其中 `inv(U) = U + ⌊(U−1)/63⌋`。
VRFHub 保留 55,000，GameHub 外层保留 25,000。Router 以下的调用边界有两种处理：

- **显式**：Router 以下的边界全部显式计入，包括 Bank→Vault 的 1/64、每个 token 调用和 Vault getter 的 1/64，
  以及 Vault 自身的 EIP-2200 哨兵，合计 21,151。
  - Router 以下不依赖任何下界论证。
  - Router 以上仍按代码顺序上的后续供给合并。涉及的调用有：模块、引擎、Bank getter、acknowledge、getPosition、
    getRequest。这些调用之后的需求都远大于 U/63。
  - VRFHub 的首触费 21,000 计在顶层，但有一部分冷读发生在更深的帧。这样放置仍然安全：VRFHub→outer 这一层由
    55,000 的保留决定，63/64 条件的余地为 55,000 − 2,600 − ⌊(U_outer−1)/63⌋：主口径（U_outer = 2,193,603）17,581，静态口径（2,313,367）15,680，都远大于 21,000/64 ≈ 328。
- **按供给**：边界并入调用方，O1 与 O2 用"组合在调用后已供给的需求加代码顺序"证明，同样不需要执行量的下界。

两种处理都对两次 token 转账各显式计入 2,301 的哨兵。

| 模块口径 | 边界处理 | consumer 入口需求 | 余量 |
| --- | --- | ---: | ---: |
| 解释器（v4，已复核） | **显式（主口径）** | 2,320,002 | **+127,744**（5.22%） |
| 解释器（v4，已复核） | 按供给 | 2,297,829 | +149,917（6.12%） |
| 静态（已复核，次口径） | 显式 | 2,439,766 | +7,980（0.33%） |
| 静态（已复核，次口径） | 按供给 | 2,417,593 | +30,153（1.23%） |

主口径（v4）下各层的需求：Bank 1,709,500，Router 1,763,638，GameHub 子帧 2,125,409，外层 2,193,603。
v3 与 v4 的四个口径都经复核方用自己的组合实现复算，逐值相同；v4 只换了模块项，其余各项与 v3 相同。

**观测与上界的比较。**

- 复核方按 DP 的最坏树形状构造了 6 个病例，已收进 `gas-certificate-witness-cases.json`，并纳入 105 例严格矩阵。
- 最重的是病例 `witness-dp-argmax-covers-loss-keno25-pp`：亏损、前缀覆盖 k、谓词走满 40 层、Keno 25 轮、新的 L0/L1/L2 奖励槽、拒付记 PP。
  - wrapper 毛 gas 为 2,005,280；
  - consumer 层实际耗费 1,984,563，比 consumer 入口的上界低约 45.5 万。
- 差距主要来自固定账本，它按各分支的最大值相加。
- 复核方逐组件给出了观测值与上界的距离：
  - Bank 存储包络：79,300；
  - Keno 静态界：124,957；
  - Keno 解释器界（v4 主口径）：7,064（206,201 对观测的 199,137）；
  - 树：43,325；
  - 其余各项多数为 0 到几千。
- 样本只能说明上界没有被违反，不能当作上界使用。

**余量政策（Owner 2026-10-08 决定 D2，写入 ADR-0006）。** 每个网络都不低于 50,000，Sepolia 不例外。v4 主口径 +127,744 达标，
前提是第 6 节的 M1、M3、M5、M6 关闭证据和 M4 证明经证书复核方确认。Bank 的存储包络（453,000，各分支最大值之和）没有收紧，
仍是上界里最松的一项；它不是达标的必要条件。

## 6. 架构裁决义务的状态

- **O1（Bank→Vault 合并计算）**：在按供给口径下证明。
  - Bank 的全部事件都在 `_vault.applySettlement` 返回之后发出：`settleBet → _applyHold`，以及之后的 `_payPlayer`、XP 循环和 `BetSettled`。
  - 付款转账的哨兵和 Bank 的守卫复位也都在 Vault 返回之后。
  - 因此 Vault 返回后的供给至少是 19,900 + 2,301 + 2,301 = 24,502。
  - 这个值不小于 Vault 调用需要的保留量 ⌊(U_vault−1)/63⌋ = 17,571，其中 U_vault ≤ 1,106,984。
  - Vault 在最后一次写存储时，至少还剩 (63·24,502 − U_vault)/64 = 6,822，高于 2,301。
  - 三个 Vault getter 之后还有 `BetSettled`（3,548），足以吸收它们的 1/64。
  - 显式口径不需要 O1。
- **O2（逐帧 EIP-2200 哨兵）**：下表是主口径下每个写存储的帧在最后一次 SSTORE 时保证剩余的 gas，均不低于 2,301。

  | 帧 | 保证剩余 | 来源 |
  | --- | ---: | --- |
  | VRFHub | 50,058 | 55,000 保留减去调用前后的工作 |
  | GameHub 外层 | 24,594 | 25,000 保留 |
  | GameHub 子帧 | 14,853 | Router 调用时保留的 1/64，减去 Router 返回后的全部工作 |
  | VRFHub.acknowledge | 7,057 | 子帧在 Router 返回后可用 gas 的 63/64，减去自身需求 |
  | SettlementRouter | 19,131 | Bank 调用时保留的 1/64，减去事件和本帧全部指令 |
  | Bank、Vault、两次 token 转账 | 2,301 | 显式哨兵项 |

- **O3（复用的前提）**：已完成，并经独立复核。v3 把固定账本自身绑定的 Bank 构建也纳入了检查（复核 I-2）。2026-10-04 各组件界所分析的字节码，与当前构建逐字节一致：
  - VRFHub、Router、GameHub、引擎、Vault 和八个模块：全部字节一致。
  - Bank：只有元数据不同，因为它导入了 Vault 源码；可执行代码一致。
  - 证据：`bindings/component_bindings.py`。
- **O4（证据不可变）**：已完成。v3 在新目录中封存，旧封存 v2（`b4a2222b`）和 `f8fdd041` 都没有改动。
  - 更早的封存 `e1253354` 在 13:11 被原地覆盖成了 `f8fdd041`。O4 这条义务正是由此产生。
  - 它的 `composition.py` 可以由架构裁决目录中的 `verification/composition-sealed-e1253354.py` 逐字节重建。
  - 此后的每一版都在新目录中封存。
- **分析器加固（复核 I-1、I-3）**：段分析器对写死的 PC 断言了操作码、跳转目标与 JUMPDEST；输出与 v2 逐字节相同。帧分析器写明了 M2（重定位不变）假设。
- **模块解释器的 M1–M6（v4 主口径的前提）**：Owner 采纳 ≥50,000 门槛后它们都是阻断项。v4 已逐项关闭，并经 2026-10-08 的证书复核确认（M1 插桩、M3 真实 EVM 对拍、M6 自生成用例、M4 独立核算）；证据在 `certificate-v4/README.md`、勘误和复核报告。
  - M1（未知地址的内存访问不扩张内存）：编译闭包 23 个源文件里的内联汇编共 12 块，全部在三个 OpenZeppelin 文件里：`Math.sol` 10 块（`add512`、`mul512`、`tryMul`、`tryDiv`、`tryMod`、`mulDiv` 两块、`tryModExp` 两块、`log2`），
    `Panic.sol` 1 块（`panic`，写 0x00/0x20 后 revert），`SafeCast.sol` 1 块（`toUint`，纯算术）。其中只有 `tryModExp` 会写空闲内存并调用预编译 0x05；模块只调用 `Math.mulDiv`，编译器不会把未被引用的 `tryModExp` 放进任何模块 runtime。
    模块、Params 库、RNG 与 StopLogic 本身没有内联汇编。源码层面的这项统计只是辅助；决定性的证据是下面按路径的记录。
    解释器逐模块记录了地址未知的 MLOAD/MSTORE：七个模块为零；Keno 有两处（PC 628 MLOAD、PC 682 MSTORE），都是 `_draw` 里 `uint8[15] memory available` 的下标读写，
    地址由 PC 2569 的子程序 `memory_array_index_access_uint8` 计算，它先检查下标小于 15，否则 Panic(0x32)。`keno_index_access.py` 重新编译封存输入、核对字节码后机械地给出这一归属。
    数组分配在空闲指针之下，访问不扩张内存。
  - M2（重定位不变）：帧分析器写明的假设，不变。
  - M3（参数长度类）：一字模块按 32、33、64 三类分别求界，二字模块只有 64；八个模块在各长度类下的界相同。
  - M4（已准入投注的 `resolve` 不会因 gas 以外的原因 revert）：由 [`m4-resolve-census-2026-10-08.md`](m4-resolve-census-2026-10-08.md) 证明，
    `CallbackDomainM4.t.sol` 机械对照（完整参数域 31,259 个参数值加 6,912 个格点，日志 `landing-2026-10-08/m4/`）。
    2026-10-04 的静态界复核曾把它列为范围外；证书复核的抽样（69,984 个准入组合加 20,000 次 fuzz）现在只是旁证。
  - M5（Baccarat 完全展开）：25 轮 131,917，独立运行与驱动脚本的结果一致；v4 不再使用轮摘要法的任何结果。
  - M6（价格表与 calldata 模型）：192 个全具体输入在 Foundry 中与 `vm.lastCallGas().gasTotalUsed` 逐 gas 相等，赔付与退款相等。
- **k=0 范围（K0-1 至 K0-5）**：
  - K0-1：本文第 2 节。
  - K0-2：已落实，并按两份复核补齐：
    - 离线部分 `VerifyCallbackDomainV16.verify` 在签名前运行（`release-domain-check`，也在 `release-check` 中）：比对 wrapper、赌场资产，以及 Owner 固定参数（每轮最低 10,000、`riskReserveBps` 6000、`withdrawalBufferBps` 1000；域文件 `ownerPolicy`，审计 F-02）；
    - 在线部分：`VerifyCallbackDomainV16.run` 在 `RPC_URL` 下 fork 链，用 `CertifiedRuntime` 比对八个核心合约的已部署 runtime（每个 immutable 槽位先与快照值比对再置零，余下代码的 keccak 与受证编译产物一致，长度一致）和构造接线（审计 F-01）；无 `RPC_URL` 时打印 WARNING 并只跳过这一部分，`CALLBACK_REQUIRE_FORK=1`（fork gate 设置）使之直接失败（修复复核 R-2）；`verify_governance.py` 回放 `GameRegistered`；`verify_callback_provider.py` 比对 USDC 实现与 provider 参数；`fork_release_gate.sh` 在治理区块再跑一次核心 runtime 比对；Release Gate 工作流拒绝 tree 不等于 `audited_source_tree` 输入的 tag。
    - 域文件引用的封存清单与复核清单已复制到 `script/release/certificates/first-callback-v4/`，`CallbackDomainV16Test` 核对它们的摘要等于域文件所引用的值。
    - 域文件状态已于 2026-10-08 切换为 `CERTIFIED`；任何重新认证触发都把它改回 `PENDING_INDEPENDENT_REVIEW`，使发布核验失败。
  - K0-3：治理手册已更新，并补了赌场池的登记与放行路径。
  - K0-4：配置变更告警属于建议项，**尚未实现**。
  - K0-5：本文第 2 节。

## 7. 复核结论与剩余条件

两份独立复核都已完成：

- `independent-review-certificate-2026-10-07/`：证书，ACCEPT_WITH_CONDITIONS。
- `independent-review-landing-2026-10-07/`：补丁与落地，ACCEPT_WITH_CONDITIONS。

两份复核提出的代码、测试和文档条件，都已在 `landing-2026-10-07-r2/` 中处理，包括：

- 组合漏项；
- 游戏集合、USDC 与 provider 的在线核验；
- remapping 写死；
- 补丁适用范围的限定；
- 负对照；
- 最坏形状病例入矩阵。

架构复审（`architecture-decision-preview-skip-2026-10-07/DECISION-2.md`）已判定：

- 工程侧条件已全部关闭；
- 本文档的 A-2 至 A-4 修正后，v3 可以直接作为证书主文本；
- 以后若出现 v4，仍须证书复核方确认。

Owner 于 2026-10-08 作出四项决定（D1–D4，见本文开头），v4 据此产出。切换 `first-callback-domain-84532.json` 为 `CERTIFIED` 的两项前提及其完成情况：

1. ~~证书复核方确认 v4~~ 已完成：2026-10-08 **ACCEPT，无阻断条件**（`independent-review-certificate-v4-2026-10-08/`，MANIFEST 摘要 `d6c1619c…`）。复核方在隔离副本复现了八个模块界（含 Keno 与 Baccarat 25 轮），用自己的组合实现复算四个口径，在真实 EVM 上补做了 32/33/64 字节的 M3 对拍和 1,440 个自生成具体用例，并对 Keno 全部抽象状态插桩验证 M1 的数组基址都在已扩张内存内。非阻断发现见勘误。
2. ~~Owner 确认接受书文本及勘误处理方式~~ 已完成：2026-10-08 Owner 逐字确认 ADR-0006 "Owner risk acceptance" 小节（按同日修订后的余量措辞），并选择以勘误而非重新封存处理复核的措辞发现。

2026-10-08 的切换在域文件的 `certificateSeal` 块中引用了 v4 封存清单 `CERTIFICATE-v4.sha256`（SHA-256 `d67a7083…`）、勘误 `certificate-v4-ERRATA.md` 和复核清单（`d6c1619c…`）。如果出现反例，按架构裁决的应急顺序处理。

## 8. 复现

v4 的树、帧与绑定文件与 v3 逐字节相同，v4 新增的是模块包与组合。模块界的完全展开很重：Keno 约 46 分钟、峰值内存 10 GB；
Baccarat 约 2 小时、峰值 31 GB。比较时不用 `diff -r`：`module-bounds-v4.json` 与 `baccarat-unrolled-*.json` 带有耗时和峰值内存字段，
用 `compare_v4.py` 比较其余全部内容。封存清单 `CERTIFICATE-v4.sha256`（51 个文件）的 SHA-256 为
`d67a7083a9f3676514339432cc5f690d3cc4de0253935d431c8d9631f8873491`。

复现依赖的证据目录 `landing-2026-10-08/`、`callback-cost-certificate-2026-10-04/`、`h1-callback-cost-certificate-2026-10-04/`
与 `takeover-2026-10-07/` 已归档，摘要见[证据索引](../release/evidence.md)。在任一检出上运行：

```sh
python3 script/certificate/reproduce_first_callback_v4.py --modules rerun
```

脚本先按 `docs/release/evidence-index.sha256` 校验两个归档，把四个证据目录解到新的工作目录（封存副本只读），
再按 `script/release/certificates/first-callback-v4/CERTIFICATE-v4.sha256`（域文件引用的那份）校验封存包；
然后构建本检出，在副本中以本检出为仓库根，原样重跑封存的脚本：由本检出重建 Vault 的 solc 输入并用 `deps.lock`
钉住的 solc 编译、三项 CFG 分析与树 DP、协议帧、模块（`--modules rerun` 时含完全展开）、对本检出 `out/` 的 O3 绑定、
输入钉定与组合，最后用封存包自带的 `compare_v4.py` 比较并打印关键数值。只有两处在内存中适配：`run_frames.py`
里原工作站的绝对路径指向解出的副本，`keno_index_access.py` 经 `SOLC` 变量取钉住的 solc。`--modules sealed`
保留封存的模块界与 Baccarat 展开，其余照常重跑，用时约 10 秒。所有分析都在临时副本里重跑，绝不写入封存目录（架构复审 A-2）。
