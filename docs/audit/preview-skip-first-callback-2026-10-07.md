# 首次回调：预检跳过修复与 UNUSED_SUFFIX 补丁

日期：2026-10-07。范围：`codex/v16-acceptance-closeout` 本地工作区，HEAD `d130b4de` 加未提交候选。
本页由实施接替方编写，不是独立审计结论。没有提交、合并、签名、广播或部署。

**状态：两项改动已按架构裁决落到工作区，发布裁决仍为 REWORK。**

- 本轮在阈值早退候选（Vault `0776839c…`）上找到一个首次回调失败的合法状态，随后落入两项改动：
  1. k>0 的结算分配跳过原树预检；
  2. vendor 树加入第二个补丁 UNUSED_SUFFIX。
- 落地之后，又完成了两份独立复核：一份审补丁和落地，一份审证书。两份结论都是 ACCEPT_WITH_CONDITIONS，没有 Critical 或 High；它们提出的条件都已在 r2 中处理，见文末。
- 首次回调证书现为 v4，主口径余量 +127,744 gas，已独立复核 ACCEPT，域文件已于 2026-10-08 切换 `CERTIFIED`，见[首次回调 gas 证书](first-callback-gas-certificate-2026-10-07.md)。

## 反例

固定 Base Sepolia 区块 47,657,524 的真实 wrapper 与 USDC 本地 fork，主 gas fixture 的集中金额模式：

```json
{"name": "concentrated-keno25-full-predicate-reject-zero-share-pp",
 "GAME": 0, "ROUNDS": 25, "VARIANT": 31, "SEED": 1, "TREE": 4,
 "CUTOFF": 1649267441662, "LAST_USED": 2198753705984, "BLACKLIST": true,
 "AMOUNT_PROFILE": 1, "CUTOFF_RETAIN": 200359308, "EXPECT_PREDICATE": 2, "LATE_LARGE_USDC": 1000000000}
```

- 前缀资本略低于 k，阈值谓词必须走满 40 层才判定“不覆盖”，于是选择全池；setUp 断言了每层都不能提前判定。
- 全池很大、本次 LP 亏损较小，原树的充足性预检在末叶路径每个分叉上，左侧比例份额都向下取整为 0，
  于是一路走到底，每层还做一次后缀区间查询。
- Keno 25 轮、新 L0/L1/L2 奖励槽、玩家 USDC 拒付记 PP，与原 canonical 见证相同。

| 观测（候选 `0776839c`） | 数值 |
| --- | ---: |
| 首次 wrapper 回调 | 2,325,306 gas，未结算 |
| 子帧 `finalizeFromCallback` 获得并耗尽的预算 | 2,181,071 |
| 其中 Vault `applySettlement` | 1,375,136（完成），随后 Bank OutOfGas |
| 单独高 gas 重试（成功，但不算首次资格） | 2,263,479；子帧需要 2,218,608 |

失败按设计原子回滚：VRF 保留原 seed 与 Received，LP 未记账结果保护有效。触发条件是“亏损 × 前缀资本 < 池子”：
接近保本的小额 LP 亏损在约百万 USDC 的池子里即可满足，不依赖十亿量级资金。
它仍沿用 40 层压缩空编号的结构见证口径，不是线上事故或现实攻击成本证明。

## 改动一：k>0 跳过原树预检

`LiquidityVault.applySettlement` 改由 `_allocate` 分配结果：

- **k>0**：执行 `_addLimit`/`_removeLimit` 本来就会执行的同一次 `_push` 加 `_pushLazy`，跳过 O(depth²) 的充足性预检。
- **k=0**：只可能有利润（C≤s），仍调用原 `_addLimit`，其 vendor 预检回退照旧可达。
- 经济规则、H-1 同域规则、Bank、游戏模块、provider 参数和 40 层树都不变，外部 ABI 也不变。

**正确性依据。** 依据是 ADR-0034 修订（2026-10-07）中的定理和前提 P1–P5，核心是树不变量 I：每个正值内部节点至少有一个正值孩子。

- 此前本文把这一条写成"H-1 树组件复核已接受的源码定理"，这个说法不准确。那份复核同样默认树里没有滞留资本，没有写出不变量 I。
- 现在的证明由本次独立安全复核（不变量 I 及其归纳证明）和架构裁决 §3 给出。
- 失效条款：任何向空根记账、直接写树，或在 `nextNode` 之后写节点的新路径，都会让本优化和 UNUSED_SUFFIX 补丁失效。

**gas。**

- k>0 时，新执行等于旧执行去掉预检，因此在每个可达状态下都严格更便宜。
- 复核在冷启动样本上实测，k=0 的树操作贵 37–130 gas，原因是代码生成差异。对外不得说"所有路径都更便宜"。

## 改动二：vendor 补丁 UNUSED_SUFFIX

只有改动一时，证书在各口径下都不闭合：

- 用新模块解释器，差 1,500；
- 用已复核的静态模块界，差 121,264。

最大项是全池域的后缀查询，补丁去掉的正是它。补丁内容：

- `_pushLazy` 只改一行：范围终点 `r ≥ nextNode − 1` 时，跳过 `(r, end]` 的后缀查询，代之以 0。
- 只要懒更新区间非空（即至少用过一个叶子），被跳过的覆盖就只含整段位于最后已用叶之后的非根节点。按 P3'，这些节点恒为 0，所以跳过是精确的。这在 vendor 通用语义下就成立，包括空根记账的情形，不依赖不变量 I。
- 唯一的例外由落地复核发现：一棵从未存过款的树，根上有 `_add` 记入的资金，此时 vendor `_remove` 的区间为空，后缀覆盖恰好是根本身。补丁前它会下溢 revert，补丁后成功。Vault 不调用 `_remove`，只在已用的 cutoff 上结算，所以到达不了这种情形。这个例外已用测试钉住。
- `_isNeedUpdateWholeLeaves` 有意保持不动：只有 k=0 会走到它，而 k=0 不在受证域内。
- 哈希链：上游 `f8b05891…` → RANGE_SUM `26d612e9…` → UNUSED_SUFFIX `15fb55d3…`。两个补丁都可以逆向还原；
  `src/vendor/azuro-v3/README.md` 写有逆向核验方法、两个补丁论证类型的区别、adapter 依赖的内部函数清单，以及重钉时必须重跑的套件。

## 复核与裁决

**独立安全复核**（`dist/independent-review-preview-skip-2026-10-07/REVIEW.md`，MANIFEST 101 项）只覆盖改动一。

- 结论为 ACCEPT_WITH_CONDITIONS，没有 Critical/High/Medium/Low 发现。
- 复核者独立完成了以下工作：
  - 反例逐 gas 复现；
  - 1,435 万个状态的引理穷举；
  - 1,826 万次 k>0 结算的归纳步检查；
  - 8 叶、32 叶和 40 层的链式差分。
- 提出四项发现：
  - F-1：写明不变量 I；
  - F-2：k=0 更贵，证书须在新 runtime 上完成；
  - F-3：k=0 分支的健壮性；
  - F-4：把链式差分收入回归套件。

**架构裁决**（`dist/architecture-decision-preview-skip-2026-10-07/DECISION.md`）：

- 改动一为 ACCEPT_WITH_CONDITIONS（FINAL）。
- 改动二为 ACCEPT_WITH_CONDITIONS，授权落地；冻结前须另行独立复核（S6）。
- `_isNeedUpdateWholeLeaves` 不改。
- 新模块解释器只作佐证，不作证书主干。
- 证书只覆盖 k>0，k=0 的排除要落实为发布核验和治理规程。

各项条件的落实情况：

| 条件 | 内容 | 状态 |
| --- | --- | --- |
| FC1 / F-1 | 写明不变量 I、P1–P5 和失效条款 | ADR-0034 修订、ExecutableSSOT L4、invariants-map、v1.6-audit-scope、`_allocate` NatSpec |
| FC2 / C3 / F-4 | 测试常驻守护 | 见下方测试清单 |
| FC5 / F-3 | NatSpec 写明"isSub 只在 maxLoss>0 时出现"，并补单测 | `test_lossWithZeroReleasedCapitalIsRejected`；`_allocationLeaf` 的死分支按裁决留到下一版删除 |
| S1 / S2 | 补丁形态与来源追溯 | 补丁只有原型那一行；`UNUSED_SUFFIX.patch`；MANIFEST 同时钉住两个补丁；README 写明哈希链；更新 `AzuroTreeProperties` 的哈希钉 |
| S3 | 差分测试 | 收入 unit 套件，PR 跑 256 轮，release 跑 4,096 轮；每步断言 P3；有 off-by-one 负对照 |
| S4 | 排查注入存储的测试 | 跳号类 harness（`vm.store`、`forceNextNode`、`nextForStructuralFixture`、`jump`、`hJumpTo`）都只把编号往前移，保持 P3；写原始节点的 harness（`setRaw`、`rawForArithmeticFixture`、`inject`）只服务只读谓词与查询，从不到达 `_pushLazy`。两类都已在注释中写明。落地复核逐个核对过（L-3） |
| S5 | 在最终字节码上重跑 | 见下一节 |
| C6 | fixture 中静默的 setup 重试 | 改为计数并写入日志，`NFT_GAS_REQUIRE_FIT` 下非零即失败 |
| C7 / O4 | 证据封存不可变 | 新证据在 `dist/landing-2026-10-07/`，有独立清单；旧封存不动 |
| C8 | 文档与术语 | "全池域"指 H-1 的全部已用叶；"vendor 预检回退"指树内部的回退；`GAS_QUALIFICATION.md` 写明集中金额模式、setup 重试策略和合法组合表 |
| K0-1 / K0-5 | 证书域表；对外表述 | 见证书第 2 节 |
| K0-2 | 发布核验机器检查域假设 | 离线：`VerifyCallbackDomainV16` 加域文件，在签名前运行，比对 wrapper 与赌场资产。在线：`verify_governance.py` 回放 `GameRegistered`，要求恰好是受证的八个游戏；`verify_callback_provider.py` 在签名前比对 USDC 实现与 provider 参数（两份复核的 M-1 / L-1 / L-2） |
| K0-3 | 治理手册 | `docs/ops/runbooks/governance-safe-setup.md`，含赌场池登记与放行（落地复核 L-4） |
| K0-4（建议） | 配置漂移告警 | **未实现** |

FC2 / C3 / F-4 的测试清单：

- `testFuzz_settlementMatchesPinnedLimitOperation`：单次结算与原限额操作等价；
- `LiquidityVaultChainedDifferential`：生产 Vault 上的链式历史，8 叶和 32 叶窗口加 40 层全深度，每步断言不变量 I、根等于已用叶之和、P3，并把前缀整形到 k−1/k/k+1/0；
- `AzuroUnusedSuffixEquivalence`；
- `BankInvariants` 的两条新不变式；
- vendor 哈希钉。

关于 FC2 的一处取舍：复核方的小树差分需要 Vault 和树的派生副本，共 5 份。本仓库不放这些副本，而是在 40 层树上用 8 叶和 32 叶的密集窗口代替小树。

- 窗口可以放在开头、末尾（会耗尽叶空间）或随机位置。
- 参照物是同一状态下快照内执行的原限额操作。
- 测的是生产源码编译进测试合约后的字节码，语义与 `844ba36c…` 相同。

落地复核认为这一替代"有条件充分"。r2 已补齐它的条件：

- 写明摘要的完备性（P3''）；
- 断言 k=0 回退和协议资本两项覆盖；
- 加入两个负对照（丢掉 push、k=0 也跳过预检），都能被检出；
- 窗口配置偏向小额。

## 落地后的验证

证据目录为 `dist/landing-2026-10-07/`。封存清单是 `EVIDENCE.sha256`，共 150 项，清单 SHA-256 为 `869c4133…`。

- 运行时的源清单是 `LANDING_SOURCE.sha256`。
- 最终源清单是 `FINAL_SOURCE.sha256`，与运行时的清单只差一个测试文件 `CallbackDomainV16.t.sol`：其中新增了 P5 逐模块引理。

| 项目 | 结果 |
| --- | --- |
| 严格首次回调（真实 wrapper 和 USDC，`--require-fit`，99 例） | 99/99 首次成功，0 次 retry，setup 阶段失败计数全为 0，运行前后源清单不变；最大值 1,867,374。逐例与隔离副本原型的结果相同 |
| PR profile 全量（不含 fork，`--threads 1`） | 运行时清单：80 个套件，497/497 通过；最终清单：498/498 通过，0 skipped，运行后源码无漂移 |
| release profile 的树等价门槛（`make tree-equivalence-release`，4,096 轮） | 8 个套件，48/48 通过，0 skipped。链式差分的 8 叶、32 叶和 40 层配置各跑 4,096 轮；结算等价、后缀差分和前缀重放同样 4,096 轮 |
| 真实 wrapper 集成 | 4/4 通过 |
| 运维与发布工具（`test/ops`） | 110 项通过 |
| 体积 | Vault runtime 15,708 bytes（+57）；Bank initcode 33,817 bytes |
| ABI | 不变（只改了内部函数和注释） |
| 字节码身份 | Vault 的 Forge 构建与 pinned solc 的标准 JSON 构建逐字节相同（`844ba36c…`）；与原型的可执行代码相同 |

这些仍是有限样本和测试，不是上界。上界见证书。

## 主 fixture 的集中金额模式

压力见证原先存在三份 fixture 副本：交接隔离版，以及并行工作的 canonical 与 full-traversal 副本。
现在统一为主 fixture 的显式参数：

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `NFT_GAS_AMOUNT_PROFILE` | 0 | 0 为均匀存款；1 为集中金额亏损见证 |
| `NFT_GAS_CUTOFF_RETAIN` | 0 | cutoff NFT 保留比例（1e12 分之几） |
| `NFT_GAS_EXPECT_PREDICATE` | 0 | 1 断言走满 40 层后覆盖 k，2 断言走满 40 层后拒绝 |
| `NFT_GAS_LATE_LARGE_USDC` | 1,000,000 | 末个后入大额 NFT 的 USDC 金额 |

集中金额模式下，其余 NFT 各存 5 个最小单位；cutoff NFT 存 2,000,000 USDC；还会执行一笔占储备 24.9% 的真实历史 Coin 盈利，并清零旧 XP 与协议费，使目标的奖励和费用槽从零开始。

默认参数下，原文件只有 3 行被等值表达式替换。原 canonical 输入现在用显式实际 seed 1，不再在 fixture 中搜索。
在修复前的同一 Vault 上，三个历史输入逐 gas 复现：2,156,147、1,988,497、2,085,950。
病例见 `test/helpers/nft-callback/gas-concentrated-amount-cases.json`。

## 两份独立复核与 r2 修正

**落地复核**（`dist/independent-review-landing-2026-10-07/`）结论为 ACCEPT_WITH_CONDITIONS：1 个 Medium，5 个 Low。

- M-1（Medium）：发布核验看不到额外登记的游戏。r2 在 `verify_governance.py` 中回放 `GameRegistered`，要求登记集合恰好是受证的八个。
- L-1：补丁的通用精确性有一个例外，即 vendor `_remove` 作用在从未用过的树上。r2 修正了 vendor README、ADR 和本文的表述，并把它作为已知例外钉进测试。
- L-2：codehash 依赖构建环境。r2 在 `foundry.toml` 中关闭 auto-detect，写死 7 条 remapping。在 `lib` 为符号链接的副本中验证，15 个合约的字节码全部不变。
- L-3、L-4、L-5：
  - 为注入存储的 harness 补了注释；
  - 治理手册补上赌场池路径；
  - release 工作流中，树门槛拆成单独 job，限时 240 分钟；release job 与 nightly 的限时都提高到 150 分钟。这些时长都没有在 runner 上实测。
- Informational：
  - 统一 fallback 术语；
  - 补全 invariants-map 中不变量 I 的定义与失效条款；
  - 修正 CI 轮数的表述；
  - 写明 UNUSED_SUFFIX 之后单调性不再成立；
  - P5 改用复核方的完整穷举测试 `CallbackDomainP5Test`；
  - 离线核验 wrapper 与赌场资产；
  - 域核验提前到签名之前。

**证书复核**（`dist/independent-review-certificate-2026-10-07/`）结论为 ACCEPT_WITH_CONDITIONS。树 DP、帧分析器、绑定和 P5 都由复核方独立确认。

- M-1（Medium）：Bank 调用的三个 Vault getter 漏计了 2,274 gas。证书 v3 已补上，主口径余量 +7,980，与复核方的修正数逐值相同。
- L-2：发布核验不检查 USDC 与 provider。r2 新增 `verify_callback_provider.py`，由 `release-domain-check` 在签名前调用。它没有放进 `verify_governance.py`，因为后者也服务发布导入，而本地测试链上没有受证的 provider。2026-10-07 在 Base Sepolia 区块 47,795,947 上实跑，USDC 实现、wrapper 与 coordinator 参数都与证书一致（封存于 r2 的 `live-provider-check.json`）。
- L-3：矩阵没有覆盖最坏树形状。复核方的 6 个最坏形状病例已收进 `gas-certificate-witness-cases.json`，严格矩阵扩到 105 例。
- I-1 至 I-4：
  - 分析器断言写死的 PC；
  - 绑定纳入固定账本；
  - 写明 M2 假设；
  - 收窄"显式口径"的表述。

r2 证据目录为 `dist/landing-2026-10-07-r2/`。封存清单 `EVIDENCE.sha256` 共 156 项，清单 SHA-256 为 `863c7540…`。
源清单为 `R2_SOURCE.sha256`；最终清单为 `R2_FINAL_SOURCE.sha256`，与前者只差发布工具和测试。证书在 `certificate-v3/`，清单为 `4a1b245e…`。

r2 的运行结果如下：

| 项目 | 结果 |
| --- | --- |
| 严格矩阵（105 例） | 全部首次成功，0 次 retry，setup 阶段失败计数为 0，源清单不变；最大值 2,005,280 |
| PR 全量回归 | 81 个套件，511/511 通过，0 skipped |
| 4,096 轮树门槛 | 8 个套件，53/53 通过，0 skipped；三种链式配置各 4,096 轮，负对照通过 |
| 真实 wrapper 集成 | 4/4 |
| ops | 114 项通过 |
| `verify_callback_provider.py` 实跑 Base Sepolia | verified，区块 47,795,947 |

## 架构复审（DECISION-2）

裁决文件：`dist/architecture-decision-preview-skip-2026-10-07/DECISION-2.md`，`MANIFEST-2.sha256` 清单哈希为 `5cd99dbc…`。原 `DECISION.md` 未改动。

- 工程侧条件已全部关闭，或降为小残余：S1–S7、FC1、FC2、FC5、K0-1/2/3/5、C6–C8、O1–O4、M2。
- 两份复核的必做项都已关闭：落地复核的 M-1、L-1、L-2；证书复核的 C-1、C-4、C-5。
- FC2 的窗口替代方案满足要求。
- v3 可以直接作为证书主文本。
- 本轮新发现 A-1 至 A-7，都只涉及文档和 CI，已处理：
  - A-1：推荐与边际参数的治理入口（`createReferralConfig`、`setActiveReferralConfig`、`queueEdgeChange`）列入重新认证清单；
  - A-2：证书的复现步骤改为在临时副本中执行，并实跑一次，结果与封存件逐字节相同；
  - A-3：如实写明 `e1253354` 当时被原地覆盖；
  - A-4：区块号统一为封存实跑值 47,795,947；
  - A-5：release 工作流加了汇合 job `release-ready`；
  - A-6：链式差分的 docstring 已更正；
  - A-7：冻结运行不得有并发改动，列为冻结规程；
  - C8 的残余术语也已统一。

r2 封存之后，源码只改了两处说明文字：`foundry.toml` 的 `[fmt]` 注释，以及链式差分的 docstring。改完后已核验：编译通过，Vault 仍是 `844ba36c…`，域测试 13/13 通过。冻结运行会在冻结清单上整体重跑。

## 2026-10-08：Owner 的四项决定与实施

Owner 于 2026-10-08 确认了实施方提出的一揽子方案，而不是架构复审建议的轻量路径：

| 决定 | 内容 | 实施 |
| --- | --- | --- |
| D1 M4 | 做逐模块 revert 普查，不接受为残余风险 | [`m4-resolve-census-2026-10-08.md`](m4-resolve-census-2026-10-08.md)：从七条准入事实证明八个模块的 `resolve` 不会因 gas 以外的原因失败，且通过 GameHub 的后置检查。机械对照 `test/unit/CallbackDomainM4.t.sol`：完整参数域 31,259 个参数值在最低注额下全部 resolve；6,912 个格点（参数类 × 注额 × 轮数 × 止盈止损 × 随机字）全部通过，其中 2,226 个触发提前停止 |
| D2 余量 | 统一标准 ≥50,000，Sepolia 不例外；用模块包达到 | 证书 v4（`dist/landing-2026-10-08/certificate-v4/`）：关闭 M1、M3、M5、M6，主口径改用解释器界 |
| D3 政策 | 修订 ADR-0006 的 "Qualification and limits"，不开新号 | 已改写：证明标准、受证域与机器核验、有效期与重新认证触发、余量政策、证据不可变、M4 的地位、重试路径的定位 |
| D4 接受书 | 一份，只含设计固有的残余 | 写在 ADR-0006 同一节的 "Owner risk acceptance" 小节：R1、R6、k>0 范围、应急顺序、按网络区分。不含 M4 和余量例外。Owner 于 2026-10-08 逐字确认，域文件同日切换 `CERTIFIED` |

参数域工具 `test/utils/CasinoParameterDomain.sol` 由 P5 与 M4 两个测试共用，`CallbackDomainP5Test` 改为继承它。
`VerifyCallbackDomainV16` 不受影响。治理手册补上了推荐与边际参数的治理入口（架构复审 A-1）。

**模块包（证书 v4）。**

- M1：编译闭包里只有 OpenZeppelin `Math.mulDiv`（纯算术）和 `Panic.panic`（revert 路径）含内联汇编；解释器记录到的未知地址内存访问，七个模块为零，Keno 有两处，都是 `_draw` 里 `uint8[15]` 数组经越界检查子程序的下标读写（`keno_index_access.py` 机械归属）。
- M3：一字模块按 32、33、64 三个参数长度类分别求界，二字模块只有 64；八个模块在各长度类下的界完全相同。
- M5：Baccarat 完全展开，25 轮为 131,917，独立运行与驱动脚本的结果一致（轮摘要曾给 135,344）。1–7 轮的展开值都低于轮摘要的界；观察到摘要的每轮项 M 在第 7 轮已被实际增量超过，总界成立只是因为退出项多算了约一轮。v4 不再使用轮摘要的任何结果。
- M6：字节精确的具体执行器与抽象解释器共享价格表；192 个全具体输入（含最低注额、最大注额、三种止损形态和随机输入）在 Foundry 中用 `vm.lastCallGas()` 逐 gas 对拍，全部相等，赔付与退款也全部相等。
- 组合 v4：主口径（解释器界，显式边界）余量 **+127,744**，按供给 +149,917；次口径静态 +7,980 / +30,153。封存清单 `CERTIFICATE-v4.sha256`（SHA-256 `d67a7083…`）。待证书复核方确认。

## 2026-10-10：独立审计与修复

独立审计（AI 复核，`dist/independent-audit-2026-10-10/`，清单 `864b383f…`）对 bf4d04d85 的结论：无 Critical/High，1 项 Medium（F-01），3 项 Low，3 项信息级；合约层面没有发现可利用的资金类漏洞。Owner 决定只改发布工具修 F-01，顺带 F-02、F-06、F-07，出 v7 重跑；F-03、F-04、F-05 涉及合约改动，列入下一版。

| 发现 | 修复 |
| --- | --- |
| F-01 发布核验只钉模块 runtime | 域文件 `coreRuntimes`（`gen_certified_runtimes.py` 从受证编译产物生成：哈希、长度、immutable 槽位及其应取值）；`CertifiedRuntime.sol` 在 fork 上核对八个核心合约：槽位先与快照值比对再置零，keccak 与编译产物一致，长度一致，构造接线经 getter 回读；`VerifyCallbackDomainV16.run` 在 `RPC_URL` 下执行，`fork_release_gate.sh` 在治理块再执行；Release Gate 新增 `audited_source_tree` 输入；封存清单副本进仓库并由测试核对摘要。测试：`CertifiedRuntime.t.sol`（真实部署通过；改一字节、改一个 immutable 值、改长度、无代码各被拒），`CallbackDomainV16Test` 核对钉值与编译产物逐项一致 |
| F-02 Owner 参数无机器门槛 | 域文件 `ownerPolicy`；`VerifyCallbackDomainV16.verify` 要求赌场池 minBet = 10,000、riskReserveBps = 6000、withdrawalBufferBps = 1000 |
| F-06 依赖按可变 tag 安装 | `deps.lock` 记录 commit 与内容摘要，`install_deps.sh` 安装后校验 |
| F-07 对账表条目数 | 重新交付时更正 |
| F-03、F-04、F-05 | 下一版（合约改动需重新认证）；白皮书第 18 行措辞已改；F-03 的准入时间锁待 Owner 决定 |

合约字节码未变，证书 v4 继续有效；工具改动以 v7 重新冻结并重跑。

## 尚未完成

1. ~~证书复核方确认 v4~~ 已完成：2026-10-08 ACCEPT，无阻断条件（`dist/independent-review-certificate-v4-2026-10-08/`，MANIFEST 摘要 `d6c1619c…`）；非阻断发现记入 `dist/landing-2026-10-08/certificate-v4-ERRATA.md`。
2. ~~Owner 确认接受书文本及勘误处理方式~~ 已完成（2026-10-08）。
3. ~~把域文件切换为 `CERTIFIED`~~ 已完成（2026-10-08；`certificateSeal` 引用 `d67a7083…`、勘误与复核清单 `d6c1619c…`；`CallbackDomainV16` 测试改为对待定变体断言失败）。
4. ~~冻结运行（本地部分）~~ 已完成：2026-10-08，`dist/freeze-2026-10-08/`，冻结清单 247 个文件、摘要 `e0213230…`，阶段间五次核对清单均一致，期间无任何改动：
   - 回归：pr profile，不含 fork，单线程，82 个套件 519/519；
   - 证明门槛（与 release 工作流相同）：nightly profile，unit 492/492、diff 11/11、invariants 16/16；
   - 树门槛：release profile 4,096 轮，53/53，2,535 秒；
   - 严格矩阵：105/105 首次回调成功，0 次 retry，最大 2,005,280（`witness-dp-argmax-covers-loss-keno25-pp`），隔离构建，源清单前后不变；
   - 真实 wrapper：4/4（区块 47,638,466）；
   - ops：`unittest discover -s test/ops`，114 项通过。
   本地无法执行、留给后续：`make audit-package`（要求干净的已提交树）；`release-check`、`release-domain-check` 与 fork release gate
   （要求全新部署的 `v1.6-nft-liquidity` 快照）；GitHub runner 上的 release 工作流（要求提交并推送，由 Owner 执行，同时关闭 L-5 和 A-5）。
   本条记录本身是冻结运行之后对本文件的唯一改动，列在 `dist/freeze-2026-10-08/FREEZE_DELTA.json`。
   架构冻结签核（`dist/architecture-decision-freeze-2026-10-08/`，SIGN_OFF_WITH_CONDITIONS，状态 FROZEN_FOR_AUDIT）的 FZ-2 按 Owner 决定选项 A：
   修正六处过时陈述（D-1 至 D-6，只改文档）后以 `FREEZE_MANIFEST-v2.sha256` 重新冻结并完整重跑；重跑结果只记录在 `dist/freeze-2026-10-08/v2/`，
   本文件在 v2 冻结之后不再改动。
5. ~~架构冻结签核~~ 已完成（2026-10-08，SIGN_OFF_WITH_CONDITIONS，FROZEN_FOR_AUDIT）；~~独立审计~~ 已完成（2026-10-10，见上节）。
   接下来：审计方对 v7 工具改动做修复复核（fix review），重新交付（更正 F-07 的条目数），然后全新 Base Sepolia 无广播 preflight，最后作部署决策。
6. 进入任何承载真实资金的网络之前，还需要：
   - 单独的主网证书；
   - M4 的证明；
   - 余量不低于 50,000；
   - K0-4 配置告警和 `CallbackSettlementFailed` 告警。
7. 不阻断的改进：
   - 把 `_prepareLargeHistoricalProfit` 搜到的 seed 写入病例文件；
   - 统一测试侧的两份谓词参照；
   - 下一版删除 `_allocationLeaf` 的死分支；
   - 下一版处理审计 F-03（准入时间锁，待 Owner 决定）、F-04（guardian NatSpec）、F-05（每玩家持仓上限），均需重新认证；
   - 下一版升级 Foundry 到 1.8.x（钉版本、修 ops 夹具的 gas 上限、anvil 显式钉硬分叉），并让 forge 测试不依赖网络（先预装 solc）；
   - 模块界驱动脚本加入逐轮单调性检查（复核 E4）。
