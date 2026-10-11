# NFT 存款、24 小时冷却与回调结算实施方案

日期：2026-10-04。**用户已确认产品方向；核心合约与 SDK/页面/keeper 已接通并进行本地验证，发布准入尚未完成。**

源码基线仍为 `d130b4de62218c6b8749bef623f12a59fa7c825b`，树为
`54c5bcc52591c3043f904b23b0969b733abc7f73`。本次直接替换前一稿的 ERC20 LP 设计，不保留两套目标、
兼容入口或迁移方案。设计变更不更新已部署合约，不复用旧候选测试结果作为新模型证据。

规范：[NFT 会计 ADR](../adr/0034-nft-liquidity-deposits.md)、
[资金分配 SSOT](../constitution/SSOT.v1.6.md)、[可执行义务](../constitution/ExecutableSSOT.v1.6.md)、
[回调状态机](../adr/0006-vrf-callback-settlement.md)。
本文固定复用边界、接口、工作顺序和待交付证据。

当前状态与上线前的全部工作见[发布说明](../release/README.md)。
真实 Bank/Vault/VRFHub/GameHub 已接通，原型 Bank/VRF 替身已删除。
真实合约回调证明部分 100 轮配置超预算，不能沿用原轮数和 gas 参数；轮数已由用户确定为最多 25，每轮最低 0.01 USDC。
首次回调 gas 由[首次回调 gas 证书](../audit/first-callback-gas-certificate-2026-10-07.md)界定，上线候选版须重做（v5）；
纯玩法测试通过不能替代完整回调准入，也不能由降低轮数直接宣称任意树历史预算合格。

SDK、Earn、赌场预检、keeper、Vault 流水与双托管健康检查已实现。

## 1. 采用什么

采用已核对的 Azuro V3 **存款 NFT、LiquidityTree、按存款范围分摊盈亏、自由资本同步提款**
这一完整 LP 模型。每次入金独立计时，首版固定 24 小时。成功退出部分不承担此后盈亏，
也不保留旧风险、未来回收或其他个人应收权。

正常回调结算、失败保存原结果、玩家应付款兜底继续实施。赌场使用自己的 GameHub/Router、
既定赔率和固定 50% LP edge 分配，不导入 Azuro 体育 Core、其奖励罚款体系或升级治理。

这会移除 ERC20 LP 份额、统一 share price、虚拟偏移、ERC-4626/7540 接口及最后份额保护。
NFT 的 ERC721 `balanceOf` 代表凭证数量，绝不能在页面或 SDK 中当成资金余额。

## 2. 复用来源与明确适配

### 2.1 固定代码，避免把不同版本拼在一起

以 Base 区块 **52,126,392** 对应的已验证实现为研究基线：

- LP 实现：`0x47cF51A24aFe4B79e613DA8aF8485BF0dBB8411D`。
- Vault 实现：`0xD1025891129F02f0E66D5126fC73e52Aecb918C3`。
- 主体材料：`azuro-code-review-2026-10-03/sources/v3base/contracts/`（已归档，见[上线候选版](../release/launch-candidate.zh-CN.md) §14）。
- 本地证据包括原 LP/Vault/Tree 加 mock Core 的测试，不是当前 Azuro Core 或本项目的新实现验收。

| 来源文件                     | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| LP.sol                       | `141895db8058743effd207c022b60be4afca33d739d7ab92f516d481270420bd` |
| Vault.sol                    | `321903bf04fa9d5931d2c852ca3ea90bca8a8de19e920fdb9c56870cf9e3ecc0` |
| utils/LiquidityTree.sol      | `f8b05891ad5a99dba2b315d69b78c515e8e9319679ba8667e0da4f02bcc9ae57` |
| libraries/FixedMath.sol      | `3edae4d9e0ccae6920c20bf08feaea1a923a8538dcdb4e116e147a0580e41f49` |
| interface/ILiquidityTree.sol | `1ddf0b4e71845c56c57c626168711d62c4cc58d13baf5255623bcc2109d38708` |

实施时将 Tree、FixedMath、ILiquidityTree 固定收入受版本控制的 vendor 目录，并保存来源、哈希和原 GPL-3.0 标识。
不能让生产构建依赖被忽略的 dist，也不跟踪浮动 main。复用原区间树算法；所有必要改动必须有逐项差异和差分测试。
当前 Tree 有两项已明确记录的实现优化，各自是可逆的独立补丁：

- RANGE_SUM：`_getLeavesAmount` 改用标准迭代区间求和，两个调用点删除不再需要的内部参数。读取的 canonical 节点集合、懒更新原值和 checked uint128 累加均不变。
  差分测试：`test/unit/AzuroRangeSumEquivalence.t.sol`。
- UNUSED_SUFFIX（2026-10-07）：当范围终点不早于最后已用叶时，`_pushLazy` 跳过恒为 0 的后缀查询。
  等价测试：`test/unit/AzuroUnusedSuffixEquivalence.t.sol`；Vault 一侧的论证见 [ADR-0034 修订](../adr/0034-nft-liquidity-deposits.md#amendment-2026-10-07-k0-allocation-without-the-vendor-preview)。

在 vendor 文件内部，分摊、取整、限额操作自带的预检回退、存储与外部接口都不变。上表是上游身份；
当前应用版本以 `src/vendor/azuro-v3/MANIFEST.sha256` 为准，两个补丁可依次反向还原上游哈希。

NFT 使用项目已锁定的 OpenZeppelin 5.5.0 ERC721Enumerable，不另写 ERC721 或替换为上游 upgradeable 依赖。

参考：[已验证 LP](https://basescan.org/address/0x47cF51A24aFe4B79e613DA8aF8485BF0dBB8411D#code)、
[已验证 Vault](https://basescan.org/address/0xD1025891129F02f0E66D5126fC73e52Aecb918C3#code)、
[官方树说明](https://gem.azuro.org/knowledge-hub/how-azuro-works/liquidity-tree)、
[ERC-721](https://eips.ethereum.org/EIPS/eip-721)。源码行为优先于说明页或旧注释。

### 2.2 本项目适配清单

| 项目             | 本次确定的规则                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| 市场与投注的映射 | Bank 接受每个仓位时，记录当时 Vault 的 lastDepositId；这是赌场适配，不声称已验证 Azuro 当前 Core 在同一时点取截点 |
| 托管             | 每个 Bank 一个独立 LiquidityVault：Vault 存 LP 资本；Bank 存投注本金与各类固定债务                                |
| 部署和治理       | Bank 构造时创建不可升级的 Vault；互相不可变绑定，不引入 Azuro beacon、可更换 admin 或可调冷却治理                 |
| 冷却             | 首版常量 86,400 秒；存入及成功部分提款重新计时，转让不改期限                                                      |
| 下注风险         | 保留全池 riskReserveBps 公式，使用 G；新部署默认 6000 bps；不复制 Azuro Core 的具体赔率或 reinforcement 参数      |
| LP 提款          | 按 Azuro 自由资本 L−K 限额，取消额外 LP 比例提款缓冲；PF/XP 的可选出金政策单列保留                                |
| 费用和玩家债务   | 沿用本项目的 edge、PF/XP 分配和 USDC 支付失败记 PP；不复制上游奖励账户罚款机制                                    |
| 空树利润         | 结算前 L=0 的正收益归明确的协议资本，不向空树注入无人拥有的利润                                                   |
| 无意义交易       | 拒绝 0% 和取整后零金额的部分提款；到期零余额 NFT 可通过 100% 提款销毁                                             |
| 数值边界         | 不改 Tree 数学，入口限制 G≤2^108−1，并检查 uint128/uint48/uint64 边界                                             |
| 回调与 LP 状态   | 已知结果未记账时 LP 存取受保护；Vault 与 Bank 互锁，内部结算不被 LP gate 拦截                                     |

上述差异是为接入赌场、不可升级部署和 USDC 所作的明确适配，不称为逐字复制 Azuro 全协议。
当前 Core 的源码缺口不靠猜测填补；我们固定自己的投注截点并单独验证。

## 3. LP 的完整用户流程

### 入金

用户授权 **LiquidityVault** 转移资产，调用 `addDeposit(amount)` 或 `addDepositFor(owner, amount)`。
实际到账必须等于金额，新建一个树叶和同 ID 的 NFT，`withdrawAfter[id]=block.timestamp+86400`。
资金立即参与符合范围的承保；冷却期间仍有盈亏。每次追加资金都产生新 NFT，不合并旧 NFT，
不延长旧存款的期限，不保留向旧 ID 追加本金的隐藏入口。

写好树、NFT 对应期限及全部账目后才允许 NFT 接收回调；入金整体受重入锁保护。
接收者拒绝 NFT 时资金与状态全部回滚。零金额、零 owner、Bank/Vault 自身作为存款 owner 被拒绝。
首版合约不新增大额最低 LP 入金要求，正数资产基础单位即可；资产、数值与状态限制仍适用。

### 到期提款

`withdrawDeposit(depositId, percent)` 使用上游比例精度 `ONE=10^12`，不是 bps：
50% 为 `5×10^11`，100% 为 `10^12`。仅当前 NFT owner 可以调用，资产固定付给该 owner。

执行时检查 NFT 存在、owner、期限、比例、暂停/结算/会计状态以及可用资本。
金额按原树当前叶子金额与比例向下取整，不按存入时本金或统一份额价格计算。

- 成功部分提款：扣该叶子和全池资本、实际付款；剩余存款从本次交易起重新锁定 24 小时。
- 成功全提：提走当前整笔余额并烧 NFT，不再保留任何权益。已归零且到期的 NFT 可以同入口关闭。
- 资金不够：整笔拒绝，不自动缩小提款、不占队列、不先退出承保；失败也不改期限。
- UI 签署的是余额比例；显示的资产金额是当前估算，交易前重新读取并模拟，不能承诺资产绝对数额不随已结盈亏变化。

24 小时是入金或成功部分提款后的期限，**不是先提交提款申请再等一天**。
不设置 LP 退出触发的全池停注。提款减少资本，可能使后续大额下注不满足准备金条件。

### 转让和授权

NFT 转让带走该笔剩余资本及其未来范围权益，期限随 ID 保留。
未成熟 NFT 不能靠转让提前提款；成熟 NFT 转给别人仍然成熟。
第三方赠送新 NFT 不会改变受赠者已有 NFT 的期限。

ERC721 approval/operator 可以转移 NFT，也就能转走其经济权利；不能宣传这种授权是无风险的。
协议现金提款不直接接受 approved/operator，官方 Earn 提款不请求 NFT 授权，keeper 不持有用户 NFT 权限。
转让不是协议入金或提款，也不证明双方支付过成交价。

## 4. 两个托管地址，一个可核对的账本

### 4.1 定义与现金覆盖

| 符号         | 定义                                          |
| ------------ | --------------------------------------------- |
| L            | Vault 的 `getReserve()`：LiquidityTree 根资本 |
| P            | Bank 所有未终结仓位的原始本金总和             |
| R            | Bank 所有未终结仓位的最大组合终结成本准备金   |
| K            | Vault 锁定的 LP 资本，`K=R−P`                 |
| G            | 下注偿付基数，`G=L+P`                         |
| PF / XP / PP | Bank 的协议、推荐和玩家应付款                 |
| Bv / Bb      | Vault / Bank 各自实际资产余额                 |
| Sv / Sb      | 各地址未记入权益或债务的意外转入余额，仅诊断  |

在读数成功、资产符合准入假设的有效状态：

```text
R >= P
0 <= K = R-P <= L
G = L+P >= R
Bv = L + Sv
Bb = P + PF + XP + PP + Sb
Sv >= 0, Sb >= 0
```

Tree 根是 LP 会计真相，不能把 token.balanceOf 或单地址 Bank NAV 当成 L。
意外转账不自动铸 NFT、不分配到树、不增加 G，也不会奖励下一位存款人。本轮不新增 surplus 提取或分配接口。
现金少于已记账金额、读取失败和数值失配必须显式报错/标记不可用，禁止新风险、LP 存取和可选出金。
合法终结和玩家债务按其实际授权、资金与完整原子性判断，不能由统一故障开关无条件阻断。

NFT 接口不冒充 ERC-4626，不保留四个 max 方法、虚拟偏移或异常零 NAV sentinel。
读模型明确区分已归零叶子、已烧 NFT、锁定、余额不足、结算处理中与读取失败。

### 4.2 接受投注

要求 L>0、仓位有效、`r>=s`。Bank 精确收到玩家经 Hub 转来的 s，
记录仓位 s、r 和 Vault 当前 lastDepositId，再锁定 `k=r−s`：

```text
P_after = P+s
R_after = R+r
K_after = K+(r-s)
G_after = L+P_after
R_after + floor(G_after*riskReserveBps/10000) <= G_after
```

下注风险公式保持不变，新部署默认 `riskReserveBps=6000`，按收到本次本金后的 G 保留 60%；
K 的净资本口径不改变 R 的组合最大支出口径。PF/XP 领取的 `withdrawalBufferBps` 部署默认独立保持
`1000`，不得把这两个比例加到 NFT 提款的 `L-K` 条件上。
L=0 时拒绝新投注，也避免给从未有存款的树记录非法截点。
资金、锁资、Router 仓位与 VRF 请求任一步失败，接受交易全回滚。

### 4.3 每个仓位只记一次实际盈亏

```text
C = payoutNet + refundAmount + PF_new + XP_new
delta = stake-C
P_after = P-stake
R_after = R-reserved
K_after = K-(reserved-stake)
```

- delta>0 且原 L>0：Bank 将 delta 转入 Vault，在 allocationLeaf 范围内加到树上。
- delta<0：Vault 在 allocationLeaf 范围内从树上扣除 -delta，并把 -delta 转入 Bank。
- 上述两项在 k>0 时直接执行原树的 `_push` 与 `_pushLazy`，即 `_addLimit`/`_removeLimit` 去掉充足性预检。
  所选范围的有效资本至少为 k、亏损不超过 k，预检在本域只会回答“不回退”；差分测试要求结果树与原限额操作逐节点相同。
  k=0 只有利润，仍调用原 `_addLimit` 并保留空前缀回退。
- delta=0：不改树资本，只释放本金与锁资。
- delta>0 且原 L=0：不调用空树加利润；资金留在 Bank，额外记协议资本 PF 并发独立事件，不算玩法协议费。
- 玩家支出失败时记 PP，而不抹除赢家或重抽随机数；以后付款只减少 Bb/PP，不再扣树。

Bank 与 Vault 的树更新、现金转移、K/P/R 释放、PF/XP/PP 入账、Router/Hub 终态和 VRF ack
在同一个可回滚终结子调用中完成。Vault 提供一个 onlyBank 的原子结算入口，不能让外部逐步解锁、改树或提款。

有 LP 资本时 `L_after=L+stake−C`、`G_after=G−C`。
空树正收益由上述协议资本分支接收，此时 L_after=0、G_after=G−stake，不能继续套用增加 L 的公式。
完整退款 C=stake 时不改变 L，只退本金或记等额 PP。

### 4.4 范围分配与最后一个 LP

每仓 cutoff 与原始 k=reserved-stake 在接受时固定。Vault 结算时以当前前缀资本选择 allocationLeaf，调用者不能自选：

- 前缀资本 >= k 时，利润与亏损都使用 cutoff；否则两者都使用最后一个已用叶子，即当前全树。
- 阈值只能是原始最大 LP 亏损 k，不得用当笔实际盈亏；等于 k 时仍使用前缀。
- k=0 保留 cutoff 与原树空前缀回退；全树为空的利润另走协议资本分支。
- 只读重放树的整数拆分计算前缀资本，不写树；原树分配/取整不变。前一仓结算会改变后一仓的当前范围，不承诺顺序无关；收益预期与风险都会随范围变化。
- 已完全退出的 NFT 不会复活，不另建旧风险或回收凭证。

必须按锁定源代码的精确整数条件，测试全池域选择与 k=0 的 vendor 预检回退，不能只凭上述概要另写比例算法。
不能宣传“新 LP 永远不承担旧风险”或“开仓时的风险永远留在原地址”。

LP 可付资产上限为 `min(nodeValue, L-K)`，再受期限和状态约束。
**不叠加此前 LP withdrawalBuffer 比例，不保留最后 ERC20 share 的规则。**
K>0 时自然不能提空资本；K=0 时允许全部退出，即使仍有净资本占用为零的旧仓。
只有结算时 L=0 的正收益走协议分支；若新 LP 已经进入，仍执行原树的范围与全池域规则。
PF/XP 可选出金继续走其单独的政策，不能借由领取已记债务再扣 LP 树。

### 4.5 数值和舍入

保留上游树的 `uint128 amount`、`uint48 node`、`uint64 updateId` 和 40 层叶子空间。
所有转换检查范围。原 FixedMath 某些路径有 `amount×nodeAmount×10^12` 中间乘积，仅 uint128 检查不够。
wrapper 统一要求 **G≤2^108−1**：新 LP 入金和新投注本金增加 G 时都检查，未来全部本金变为利润也受这个上界覆盖。
历史 lazy 节点可能高于当前根金额，证明使用上述固定历史上界，不能用当前 G 代替。
两金额各不超过该界时，乘积再乘 10^12 小于 2^256。不靠改写上游数学实现来规避证明。
计数器、最后叶子、部分提款向下取整、全损归零、最后正余额叶子及残差归属都要单独验收。

## 5. 合约接口与依赖

目标入口只有一套：

| 合约           | 面向谁                 | 职责                                                                                               |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| LiquidityVault | LP                     | addDeposit、addDepositFor、withdrawDeposit；按 id 查询金额、期限、可提状态；标准 ERC721/Enumerable |
| LiquidityVault | Bank                   | 锁定净资本和原子 applySettlement；没有外部任意记利润/扣本金的权限                                  |
| Bank           | Router                 | hold/settle/refund；维护 P/R、原始仓位 cutoff、PF/XP/PP                                            |
| Bank           | Vault/SDK              | 汇总 L/K/G/P/R、双地址现金和 LP status                                                             |
| Router         | Bank                   | 查询该池 canonical VRFHub 已收到未记账计数                                                         |
| VRFHub         | wrapper / public retry | 认证、保存唯一 seed、有界尝试、同 seed 重试、恰好一次 ack                                          |

自定义只读存款状态必须给出 owner、当前金额、期限、受限原因、当前最大可执行比例及对应金额，
不能把资产上限直接伪装成可执行金额。设 `V=nodeValue`、`F=L−K`、`ONE=10^12`，在期限和状态允许时：

- V>0 且 F≥V：最大比例为 ONE。
- V>0 且 F<V：最大比例为 `floor(((F+1)×ONE−1)/V)`；实际报价为 `floor(V×percent/ONE)`。
- 最大比例或所得金额为零：没有可付现金的操作；不能把零金额 partial 当成提款成功。
- V=0 的成熟 NFT：可执行 ONE 的关闭操作，报价为零，明确显示“关闭凭证”。

SDK 使用同一整数规则，模拟用户选定比例。所有 NFT 共享 F，组合资金上限只能扣一次，
且还受上述比例粒度影响；多笔独立交易不保证后笔仍有相同可用额。

Bank 构造时直接创建 `LiquidityVault(asset, address(this))`，Bank.vault 与 Vault.bank/asset 不可改。
Vault 构造期间不反向调用尚在构造的 Bank。没有“部署后等管理员绑定”的开放窗口。Vault 用户入金直接收款，不经 Bank facade 多转一次。
部署需验证 Bank 创建代码含子合约后的 initcode 与每个 runtime 的尺寸和 gas。

Vault 的 LP 资金入口读取 Bank 的 pause、accounting、canonical seed gate 和 Bank busy 状态；
Bank 正在 hold/settle/refund 时不允许外部插入 LP 变动。
Vault 的 onlyBank 锁资/终结入口有自身重入保护，**不检查阻断 LP 的 seed gate**，否则收到结果反而无法结算。
Vault LP 入口执行期间，任何重入 Bank 再尝试修改 Vault 的调用也必须被互锁阻止。
NFT 铸造/接收者回调只发生在存款，不在树分配路径；LP 的接收合约不能阻断后来正常结算。

## 6. 回调结算保留并扩展验收

VRFHub 直接使用锁定的 Chainlink wrapper consumer；先持久化唯一 seed 与每 Bank 未记账计数，
再有界调用 GameHub 的同一终结实现。固定下注时模块、费率、推荐快照和存款 cutoff。
终结与 ack 同子调用，任何 Vault/Bank/Router/ack 失败都回滚该次记账，外层 seed 留存。
未知 resolve 错误、无效 tuple、OOG 不转为退款。

收到 seed 后，即使 GameHub 仍显示 PendingVRF，也禁止缺失随机数退款。
1 小时仍表示真正未收到随机数的仓位何时开始可退款，不是退款权利过期。
暂停不阻断合法 callback、retry、terminalization、missing-seed refund 和玩家债务偿付。

NFT 入金和提款在已知结果未记账期间拒绝，普通 NFT 转让保留。
24 小时不能消除已成熟 NFT 的有信息退出，也不能使购买成熟 NFT 变成安全行为。
fulfillment 上链前的排序、范围空缺时新资金承接旧利润/亏损仍需独立经济复核。

## 7. 实施次序

### 阶段 0：固定依赖，验证可行性

在全面改 SDK/页面前先完成：

1. 将固定 Tree 原件与出处纳入 vendor，保留许可；给所有适配逐项 diff，不重写 segment tree。
2. 原 LP/Vault/Tree 的锁定测试作为行为对照；我们的两托管最小集成 fixture 独立验证本金、费用、PP 和净损益。
3. 覆盖成熟 NFT 先退后亏、买入成熟 NFT、空 prefix 后新 LP、同区块顺序及 callback 之前的信息优势。
   这是待评估的经济行为，不能用“冷却了一天”把反例判成无效。
4. 用新双托管＋原 40 层树测完整 wrapper callback。包含高度分散的存款范围、最大推荐奖励、
   成功/拒收/耗 gas 的 token、冷存储、全池域、空树协议分支和保留 seed 的失败路径。
5. 检验上述 2^108−1 上限、cast/计数器边界、构造代码/运行代码大小及可重复部署。

已有原树小 fixture 只能说明语义和成本量级，不是新部署预算。
Base Sepolia 此前读取的 coordinator 上限为 2,500,000 gas，wrapper 还需要开销；发布前重新读实际参数。
**不得承诺 100 轮原样保留。** 若完整路径装不下，先优化适配；仍不满足则降低接注前公布的游戏轮数上限。
不接受明知正常 callback 必失败的投注后，把 keeper 当正常结算方式。
用户进一步明确：**所有允许状态（含原树生命周期历史）都必须首次回调完成**。
随后用户提出先比较降低至 25/50 轮的简单路线；provider 研究暂停。新增同历史对比中 25 轮
8/8 首次完成，50 轮 6/8，建议选 25 轮。
这组测量尚未覆盖任意历史，不能当作此前严格要求已满足。原 seed 保留和故障恢复机制仍用于
异常隔离，不代替正常路径的 gas 与终结性证明。
如果树与规定网络上限根本不相容，先形成具体测量结论和取舍，不把后续大改当作已获技术验证。

### 阶段 A：Vault 和 Bank 核心

新增 `src/core/LiquidityVault.sol` 与必要接口，固定第三方树源码；Bank 删除 ERC20/4626/7540、
虚拟偏移、份额 rescue/allowance、批次、epoch、旧风险和领取路径。
保留资产精度元数据，但不能继续把它命名为 NFT share decimals。

新增单一 `pendingStakeTotal`、总 R、每仓 cutoff，Vault K 与 R−P 对账。
将原单地址 NAV 检查改为双托管覆盖与显式 L/G。
保留 PP、PF/XP、固定 edge、玩家付款权限与 Router 组合成本上限。
删除 LP 比例提款缓冲使用；PF/XP 的同名参数保留其限定用途，页面不得用于缩减 NFT 可提额。
128 个未结仓容量仍按全体未结仓计数，不创建 retired 类型。

重写资金守恒与 NFT 性质测试，不保留 `BankAsyncRedemption`、旧 recovery model 的目标断言。
原漏洞证据改成资金归属回归；新选定的退出后旧损益分配须明确作为经济规则测试。

### 阶段 B：回调、互锁与真实 gas

按 ADR-0006/0021 删除 adapter 双模式，原 seed + bounded callback + atomic ack，
增加 Vault 状态/互锁与最坏树成本。A/B 合成一个验收边界，不能单独发布未接 gate 的提款实现。
真实 wrapper native 报价、多付返还与 credit 守恒沿用。

### 阶段 C：SDK、Earn、索引

| 文件范围                                              | 改动                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `frontend/packages/ssot/src/domain/bank.ts`、sdk 类型 | NFT position 与 Bank/Vault 汇总；删除所有 ERC20 LP/4626 quote、batch、recovery 类型            |
| `sdk/create.ts`、交易流水线                           | LP spender=Vault；按 NFT id/percent 提款；同区块读 L/K/G/P/R，下注仍用 G                       |
| `sdk/bankRedemption.ts`、`bankRecovery.ts`            | 删除旧实现，不保留兼容 wrapper                                                                 |
| Earn 页面与 hooks/panels                              | 按笔列金额、入金时间、withdrawAfter、当前owner、可提额和原因；新增资金新 NFT                   |
| 钱包和游戏页面                                        | NFT 数量不作余额，删除 share price；提款成功后按收据区块刷新 L/G 与下注上限                    |
| `ssot/src/indexer/`                                   | NFT Transfer、deposit/withdraw 事件与资本更新；没有 ERC20 Transfer 别名                        |
| `bet-index/src/`、provider ledger/API                 | 主键含 chain/Bank/Vault/depositId；资本现金与 NFT 所有权分别记账；移除 shares/sharePrice/epoch |
| 元数据、所有语言、OG                                  | 24h起算/部分重锁、按比例提款和转让风险；不再“无冷却/统一分摊/最后份额”                         |

NFT 转让不计入金/提款。受让者成本不可从 Transfer 推断，不能伪造其收益率。
协议现金记录按实际付款 owner 与 depositId 归属；同 tx 的 mint/burn/资本事件不能重复算现金。
查询按有限分页；可以复用 ERC721Enumerable 提供的 owner 枚举，不遍历所有持有人或全部历史叶子。

### 阶段 D：keeper 与恢复

继续 Alchemy WS 驱动、Infura HTTP 补漏、重组、重启、原结果重试、合格超时退款与玩家债务。
正常回调终结不发 keeper finalize；竞态终态和真实故障分开计数。
删除 batch/pocket workers，不新增 NFT 到期自动提款或 keeper 用户授权。
到期显示由链时间和 id deadline 推导，不用 keeper 改到期状态。
保留同交易 Ready+Finalized、多 bet 收据、RPC logIndex 与收据数组位置的既有正确区分。

### 阶段 E：发布与全新部署

DeployV16、V16Snapshot、manifest、两个 digest 定义、schema、ABI导出、验证器和 smoke
新增每池必填 Vault 地址/hash/构造参数，核验 Bank↔Vault/asset 不可变关系。
Registry 仍以 Bank 为池身份，从 Bank 推导唯一 Vault，不新增另一套可变注册真相。
删除 adapter、LP share metadata、批次/回收字段和相应旧 schema。
资产 decimals/symbol 来自经验证的资产元数据，不从 ERC721 的 name/symbol 推断金额精度。

继续 Solidity 0.8.37、Cancun、viaIR、optimizer500 和锁定依赖。
使用新 schema、新部署和一致源码构建，不加数据库迁移、旧地址 fallback 或双套 ABI。
保持已选 Safe、guardian、发布签名者和 RPC 分工；实际签名、部署、重启不属于本次文档改动。

## 8. 验收矩阵

以下是**完整新实现的验收义务**。已完成的局部证据和范围见核心集成报告；
尚未接入生产调用链的项目不能据此标为整体验收通过：

| 边界         | 必须证明                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| 原树复用     | 源件哈希、适配diff、原算法差分；uint128/uint48/uint64和高上限                                                 |
| NFT生命周期  | 每存新ID；24h恰好边界；partial成功重锁、失败不重锁；transfer不改时间；owner-only现金；approval转让权限        |
| 舍入与空余额 | 比例1e12、最大可执行比例与资产报价一致、向下取整、partial0拒绝、全提烧毁、全损NFT关闭、树根与有效叶子金额守恒 |
| 双托管       | Bv/Bb、L/K/P/R、全部债务逐操作守恒；玩家本金不抬LP资本；surplus不被首存拿走                                   |
| 旧范围       | 截点与k固定；结算时前缀>=k则两侧用前缀，否则两侧用全树；k0保留空prefix回退；多仓顺序与资本边界                |
| 全退出       | K>0不可提空；K0可全退；空树正收益明确归协议；有新资本时按原全池域规则；无已烧NFT复活                            |
| 报价与下注   | LP自由额度L−K；无额外LP buffer；新注保持G基础risk规则；提款后资本与最大下注立即变化                           |
| 回调原子性   | seed/count先保存；Bank/Vault/Hub/Router/ack全成功或全回滚；同seed重试、重复与迟到回调不双付                   |
| 跨合约重入   | safeMint、NFT transfer、asset/token、原生返还回调；Vault LP入口与Bank忙状态互锁，内部结算不自锁               |
| 玩家权益     | 原seed未终结不超时退款；PP归固定玩家；未知错误不把赢家改成退款                                                |
| 经济排序     | 成熟NFT有信息退出、成熟NFT购买、新资金遇空prefix，独立无临时LP对照；冷却不替代结论                            |
| Gas          | 完整wrapper到ack最大输入/树分布/全池域选择；逐游戏确定轮数；满足链上provider上限                        |
| 消费者       | 真实Anvil→SDK→Vault/Bank→wrapper→keeper→PostgreSQL→浏览器现金/期限/事件闭环                                   |
| 发布         | 新Vault绑定/ABI/schema/签名源认证及负面测试，外部审计和新部署身份                                             |

运行受影响 Forge、stateful invariant、mutation、SDK/web/keeper/bet-index、类型、构建、ABI/发布与运维检查。
真实 Anvil/PostgreSQL/fork 套件必须设置隔离实例并实际执行；环境缺失而 skip 不是通过。
旧 ERC20/async 测试数量不外推到新 NFT 模型，原 Azuro 树测试也不替代新托管和回调集成。

## 9. 交付与放行顺序

先固定核心设计与阶段0证据，再完成 A–E 的单一候选；独立复核后冻结源码/ABI/配置，
外部审计、全新 Sepolia 部署和网络签名验收。尚未解决的准入项：

- 成熟 LP 与新资金的结果信息/交易排序风险及公开的剩余风险边界。
- 完整回调的树成本、各玩法可接受轮数和真实 wrapper 费用。
- 用户另定业务峰值后的容量/延迟/费用验收。
- 模块/Hub 准入治理、guardian 托管和正式运营条件。
- 体育真实结果先于链上记账的独立定价边界；首发不准入体育池。

USDC 每轮最低 0.01，单仓最多 25 轮；总本金为每轮金额乘轮数，25 轮最低 0.25，取消单仓总额最低 1 的限制。
金额与轮数由合约约束，SDK/页面读取同一配置；退款默认 1 小时及未结仓 128 上限继续作为输入。
轮数上限降低不代替完整 gas 验收。该计划没有保证“24小时后任何资金都能全提”，
也没有宣称成熟上游实现可以免除本项目审计。
