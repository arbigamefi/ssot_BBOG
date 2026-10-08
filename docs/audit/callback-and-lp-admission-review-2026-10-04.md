# 首次回调与 LP 排序准入复核

日期：2026-10-04。范围：`d130b4de` 加当前 NFT 工作区；首发 Base Sepolia USDC casino，
八个现行模块；Solc 0.8.37 / Cancun / viaIR / optimizer 500。

**结论：结构边界、八模块成本组件与查询计费复核完成；严格全状态首次成功仍待证。
用户已明确选择保留同步退出与 fallback，接受并披露条件排序损益。**
经济选择已确定，不等于排序优势被修复或发布资格完成。
上轮源件清单 `eb9fa3c8f4e3064bdd0ad6bf1cd1c4acb66f0ab78318ada669d0c210a1998ccf`
在本轮起点逐文件核验无漂移。本轮生产 Solidity 未改。

## 树结构的有限边界

树深度固定为 40。`_addLimit` / `_removeLimit` 先沿接受截点 `_push`，
仅在 fallback 时再沿末叶 `_push`，最后执行一次前缀 `_pushLazy`。

| 项目 | 结构上限 | 理由与限制 |
| --- | ---: | --- |
| 一条 push 的不同 Node 槽 | 81 | 根及每层两个孩子 |
| 两条 push 的不同 Node 槽合计 | 159 | 至少共享根和根的两个孩子 |
| 前缀 lazy 访问节点 | 81 | 每层至多一个完整左区间及继续递归的边界路径 |
| Node 写入函数调用 | 241 | 两条 push 各至多 80 次，lazy 至多 81；不是 241 次新昂贵写槽 |
| 一个前缀检查／分配阶段的 suffix cover 读取 | 400 | 40 位端点中高位 1 与低位 0 的配对数，最多 `20×20` |
| 一个阶段的 suffix 查询循环 | 612 | 与读取数量不同；两阶段保守合计不超过 1,224 |

对齐后缀的 cover 节点是截点低位 0 对应的右兄弟，已经被对应边界 push 访问。
查询重复读取暖槽，不增加独立冷 Node；fallback 后的分配对应已执行的末叶 push。
表中仅计 Node，未计树计数器、Vault、Bank 或 token 槽。

400 读取的端点位型为 `1^20 0^20`。一个达到 612 循环的端点相对偏移为
`1095182564826`，其 cover 读取仅 178。设前导 1 数为 `a`，随后一个 0，
递推为 `F(0)=0`、`F(n)=max[a(n-a)+F(n-a-1)]`（`0≤a<n`）。
独立整数检查穷举 1–14 位共 32,766 个位型，与递推一致；40 位得到 612。
这不是逐个执行所有 40 位状态或 EVM 成本证书。

新增三个 Foundry 测试实际记录生产 push 和查询的访问槽：push 去重为 81；
两个端点累计读取为 400 / 178；任意 uint40 fuzz 的实际读取符合独立位组合计数，
且每个槽均在 push 集合中。全零夹具仅证明访问结构，不称作有资金历史或 gas 测量。

合法 Node 写入改原有非零 packed 槽；push 不把零金额孩子生成非零节点，
lazy 不给零金额子树增资。递增 updateId 也使写入不恢复交易原值。
若保守按每次写函数最多两个 packed-field SSTORE，Node 冷读／首次非零改写／后续 dirty 写的骨架为
`159×2100 + 159×2900 + (2×241−159)×100 = 827,300 gas`。
**这不是完整树 gas 上界**，还缺暖读、计数器、hash、算术、递归、循环与内存。
成本分类依据 [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929) 和
[EIP-2200](https://eips.ethereum.org/EIPS/eip-2200)，未扣 gas refund。

## 完整受限回调补证

沿用真实 Base Sepolia wrapper / coordinator / USDC 本地 fork：区块 `47,657,524`，
哈希 `0x5a75e3c5fbaaa54dd1e67075af773668d43757b4e5de71f788ee69837650b872`。
consumer 预算 `2,447,746`。每例是独立 Forge 进程中已提交的 setup 加冷访问测量交易。
`--require-fit --isolate-build` 强制首次成功；清除编译覆盖，起点／每例／终点源件认证相同。

| 压力形状 | 直接支付 gross gas | 玩家拒付转 PP gross gas |
| --- | ---: | ---: |
| 400 cover 端点、Keno 25 轮、lazy | 1,851,614 | 1,872,180 |
| 612 循环端点、Keno 25 轮、lazy | 1,833,269 | 1,853,835 |
| 根处分叉与 380 cover、Keno 25 轮、lazy | 1,839,227 | 1,859,793 |
| 同分叉端点、单轮最大中奖、薄前缀 fallback | 1,723,542 | 1,744,108 |

**8/8 首次完成，0 重试，资金与终态断言通过。** 核对实际模块结果、seed、三层奖励、
PF/XP/PP、P/R/K、树 delta、双托管现金。两条路径合计使用 60 / 73 / 80 个真实存款；
只压缩空编号，不宣称执行了万亿次存款。

这补充了 [此前 41 个样本](tree-range-optimization-2026-10-04.md)，未超过其最高观测
`2,156,474 gas`。49 个不同输入仍不是全状态上界。新增八例仅覆盖上述 Keno 参数与结果，
不冒充再次穷尽八模块。gross 测量不含 proof / billing，也不能与 consumer 额度直接相减来推算内层余量。

## 同编译产物的成本组件与联合状态补证

本次继续核验 `SOURCE_FINAL.sha256` 的 1,052 项源件，起点 SHA-256 为
`3b17f651f57abc80de6230f39e4fc6d18cc8fd8368a4229b7aabe132551036ce`。
固定 Solc 可执行文件 SHA-256 为
`a27396e7732aa52e80ff89ad7bd8a2e46fec2a6dcc4ef20cd16e5e0c502d6821`。
成本导出沿用相同 Cancun / viaIR / optimizer 500；八模块与六个核心合约的完整
creation / runtime 均与隔离 Forge 产物核对一致。下面是组件结论，不是完整回调放行。

### 八模块成功 resolve

从原始编译汇编逐区间计费，按合法参数、1–25 轮约束每个循环、共享尾块与 helper
的执行次数，并单独计内存扩张。独立审阅复算全部八项；没有以有限种子样本代替次数证明。
保守计数包含若干未选择方法／互斥分支，所以这些是 callee body 上界，不能当作实测。

| 模块 | 单轮组件上界 | 25 轮组件上界 |
| --- | ---: | ---: |
| Keno | 16,105 | 324,094 |
| Baccarat | 15,061 | 320,032 |
| SicBo | 14,277 | 258,137 |
| Plinko | 10,720 | 213,028 |
| Slots | 10,796 | 199,384 |
| Roulette | 80,037 | 149,196 |
| Dice | 6,248 | 82,271 |
| CoinToss | 4,627 | 57,130 |

适用范围是当前模块字节码、GameHub 接受的最多 64 字节参数、一个随机词以及最多 25 轮。
不含调用者 ABI 构造、STATICCALL、冷账户、返回复制／解码、外层 EIP-150。
Keno 五次 draw 的 139 字节 hash、数组初始化／交换和累计内存分别计入；
SicBo／Slots 的合并 hash 尾块按每轮三次计入；Baccarat 每轮最多六次 card draw；
Plinko 每轮八行；Roulette 最多 18 次参数转换循环只执行一次。
Solc 自带 gas estimate 对 resolve 返回 `infinite`，没有被当作有限证书。
实验性 CFG 编译增加了 CBOR 元数据：仅去除 CBOR 后指令逐字节一致，用作分析辅助，
原配置的完整 runtime 才是部署身份，未把实验性输出替代正式产物。

### 暖槽 suffix 查询与逐层转发

实际成功指令的查询成本为 `65Q + 133I + 379R`，其中 Q 为查询次数、I 为总循环次数、
R 为 cover 读取次数。计入 PUSH0、共享 increment／checked-add 与返回，scratch 0/32
不增加内存高水位。结合位型的独立动态规划得到每阶段 **216,420**，两阶段 **432,840**。
单阶段极值偏移 `1099242012672` 的实际计数为 Q=21、I=517、R=386；
分别拼接 400 读取和 612 循环会过度计费。
查询前 `_push` 对每层两孩子预读，同槽 packed Node 使对应 suffix cover 为暖槽；
fallback 更换端点后先执行第二次 push。上述数字不含预热、父递归、树写入、Vault 固定段。

按实际成功字节码计 push／preview／lazy 的局部路径，再把两个端点的查询成本、
冷 Node 联集及前缀递归次数联合约束，得到下列**保守树组件候选**：

| 树分支 | 利润 | 亏损 |
| --- | ---: | ---: |
| 无 fallback | 1,247,230 | 1,266,038 |
| fallback | 1,730,071 | 1,749,619 |

它们计入 Node 冷读、合法非零原槽改写、后续写与局部指令，未计
add/removeLimit 入口／updateId、Vault 固定段、外层或 SSTORE 完成要求。
两个端点不能各自取独立最大值：根处分叉时，159 个不同 Node 与查询对的结构界
422,088 同时组成包络；单端点两阶段最大 432,840 只对应 81 个不同 Node。
边界递归最多 40 层，完整区间 terminal 数还受端点的 1 位数制约。

这些候选仍保守保留了金额状态不一定能同时实现的分支：preview 的短路／不足返回，
fallback 后 lazy 的正余额写，及 push 中的整数舍入。尤其 preview 看到 left=0，
不能据此说先前 push 未写该槽，因为正值可能刚被舍入为 0。
这里的剩余工作是证明这些金额与执行路径的联合关系；上述候选超出某个可用预算，
也不能反过来称作已找到实际失败输入。成功路径的算术、现金与计数器前提仍须成立，
不能把纯 gas 成本证书扩展成无限历史的无条件成功保证。

令 `A(g)=g-floor(g/64)`，子帧要求 U，snapshot 到 CALL 的完整成本为 O，
本帧成功返回成本为 Qafter，显式预留为 R。最小整数逆函数为
`A⁻¹(U)=U+floor((U-1)/63)`（U>0，U=0 时为 0）。调用前充分条件为
`g ≥ max(U+R, O+A⁻¹(U), O+U+Qafter, R+1)`；无显式 cap 时去掉 R 项，
再向父层加已证明的 Qbefore。独立整数复算通过，但 O、Qbefore、Qafter 仍须来自
对应字节码成本，不得填样本耗气。涉及 SSTORE 的子帧还须满足
[EIP-2200 的 gasleft 检查](https://eips.ethereum.org/EIPS/eip-2200)。

### 可共存奖励状态与新增真实回调

固定 USDC proxy runtime 为 1,798 字节、implementation 为
`0xd74cc5d436923b8ba2c179b4bca2841d8a52c5b5`（23,464 字节）。两者取自已认证 fork
缓存并独立重算 code hash；没有把 Circle 当前仓库源码冒充该历史实现的完整编译匹配。
该实现的余额／黑名单共用 packed 槽；transferFrom 也会扣减 MAX allowance。
健康资产的非零支付结算保守最多 11 次 balanceOf、两次转账尝试；利润和亏损的
托管转账方向互斥。成功直接转账与 PP 终态互斥，但失败 token 帧已经执行并回滚的
余额写 gas，仍须与随后 PP 记账共同计入；不能因为余额没有留在终态就剔除它。

固定 runtime 的静态区间／共享返回块计价给出 token callee 合计包络 **78,394 gas**，
含 proxy、DELEGATECALL、内存、SSTORE 与一次性冷访问。调用者侧至多 13 次
CALL／STATICCALL 的账户费若尚未计入，再加 3,800，合为 **82,194**；
不得在核心 CALL 账单再次叠加这项。未含调用者 ABI／返回处理或 EIP-150 余量。
较深的玩家余额上限失败也用完整 transfer 指令包络覆盖，并计 132 字节 revert
从实现到 proxy 的复制；黑名单早退的低价不能代替所有拒付分支。
这是假设分支计价，不是当前 USDC 供给下已执行的上限失败反例。
该 token 组件要求 proxy admin 与 Bank／Vault 不同，正常托管余额足额、
Bank→Vault allowance 有效、成功托管收款留有 255 位余额余量；玩家上限失败另按 PP 包络。

新增默认关闭的 `PRIOR_NEW_SOURCE_HELD` 测试选项：旧玩家 A 真实结算产生 holdback，
三个 payee 领取可立即领取部分后等待 holdback 成熟；新玩家 B 保持不合格，首次结算
同时形成 L0 accrued、L1/L2 新 source 锁定和旧 holdback 释放。所有奖励、全局桶、
现金、P/R/K、随机词与终态均由真实生产路径断言。它没有修改奖励或 LP 产品规则。

| 新联合形状（Keno 25 轮） | 直接支付 gross gas | 玩家拒付转 PP gross gas |
| --- | ---: | ---: |
| 400 cover、旧奖励成熟、新 source 锁定 | 1,818,255 | 1,838,821 |
| 查询成本极值端点、相同奖励状态 | 1,832,696 | 1,853,262 |
| 薄旧 prefix fallback、非末端 lastUsed、相同奖励状态 | 2,185,799 | 2,206,365 |

另重复两项旧基线，耗气保持 1,851,614 / 1,744,108。本次 **8/8 首次成功，0 重试**，
隔离构建／逐例源件认证通过。新增六个不同输入后累计 55 个，不是 57 个；
本轮最高观测为 2,206,365。fallback 用例的旧／晚叶为 20 / 41 个真实存款，
lastUsed 不再设为树最后一叶；压缩空编号仍不等同真实万亿存款历史。
14 项核心／模块编译身份与原配置逐项相同，生产 Solidity 未改。

### 核心固定段：已定价部分与缺口

六核心存储 layout／优化 IR 已认证到当前源码与 runtime。已列清单覆盖存储写、
最多 80 个固定槽首次访问、事件与直接 CALL／STATICCALL／EXTCODESIZE 的访问费。
已定价分项为：warm SSTORE 580,100、首次槽访问 168,000、事件 37,431、
直接调用访问费 20,800，合计 **806,331**。
这是尚未含全部核心指令／内存的**部分账单**，既不是完整上界，也不是实际可达最低值；
其中保守重计首次读／Vault 根槽，且若干奖励与协议资本分支不共存。
token 上游账户费已包含在该直接调用项，组合时不再加前述 3,800。

Bank 的动态写分项包络为 453,000。旧 holdback 释放可与 eligible 即时 accrued 同笔发生，
全局 accrued 最多五次写，不能只计三次。holdback 全局桶可能恢复到交易原值，
下一次写要按 clean 改写计价，不能统一算 dirty 100。
如果已证明之前的真实结算具有正 usedTurnover，可把两个不可归零统计收紧，
Bank 分项降到 418,800。当前夹具另有 prior-profit 且尚未领 PF 的特定条件，
可降到 384,600；该特例不能替代允许先领取 PF 的一般历史。

未定价的具体内容是：选中 dispatcher／helper／共享尾块的全部指令，
各帧 ABI／返回复制与内存高水位，最多三条 awards 的编码／解码／处理循环，
固定 referral engine 的算术／数组，以及每层 Qbefore／O／Qafter。
这些成本还须同树金额状态、旧统计与 token 路径组合，不能把 806,331
与组件表直接相加后称为完整证书或失败反例。

复现入口见 [gas 夹具说明](../../test/helpers/nft-callback/GAS_QUALIFICATION.md)，
原始 compiler、指令、独立复核和运行记录保存在
`dist/callback-cost-certificate-2026-10-04/`。该目录是本地证据，不是公开部署证明。

## 完整 gas 证书剩余任务

资格域须固定八模块字节码、资产 proxy/实现、provider 配置及编译器。
假设资产实现未升级、未全局暂停、两托管地址未被发行方冻结；玩家拒付独立覆盖。
新模块、资产实现或 provider 变化须重新资格化，任意未来治理配置不在该证明内。

[EIP-150](https://eips.ethereum.org/EIPS/eip-150) 转发和显式保留须逐层计算。
VRFHub 转发前保留 `45,000+10,000`，GameHub only-self 保留 `25,000`。
忽略全部前置工作及 CALL 成本，Vault/tree 的绝对乐观上限至多 `2,246,670`；实际更小。
这是转发上限，不能当作可实现预算或安全余量。

已完成的模块、查询和转发公式作为同一编译产物的组件证据。剩余联合成本表仍需完成：

1. 采用已完成的固定 token 组件，补核心固定段、调用者 ABI／返回处理及调用成本。
2. 树在上述结构界内联合计 push／preview／lazy、写槽与端点；不能把不同位型的独立最大值当作可达联合状态。
3. 分类 fresh/existing XP、holdback、PP、统计槽和 USDC 支付分支，列出可共存状态。
   制造 lazy 树通常已有结算，不能把不兼容样本的最大成本机械相加；样本最大值也不是证明。
4. 自底向上组合子成本 `Uchild`、CALL/内存成本 `O`、前后成本 `Qbefore/Qafter`。
   使用上面的整数逆函数和显式 cap 条件，另计各 SSTORE 的完成要求。
5. 仅当全部准入分支均满足 `2,447,746` 及各层完成预留，关闭严格门槛；
   否则定位具体分支，优化同一实现或缩小准入域，再独立验证。

当前未完成此证书。泛 ERC20 的耗尽 gas 构造不是当前 USDC 的已执行反例，
不据此扩展资产范围或改造支付系统。

## LP 排序的实际见证与用户裁决

新 `NftPreInclusionProfitOrdering.t.sol` 使用生产 CoinToss、GameHub、VRFHub、Router、
Bank、Vault、树，复用本地 wrapper/token 模型。risk=6000、edge=200、默认推荐费率；
玩家无推荐，实际 XP=0、PF=1 USDC。

1. Alice 存 1,000，24h 成熟；接受旧注 stake=100、reserve=200、净锁定=100。
2. Bob 后入 100；Alice 在结果未记录前合法全退 1,000，留下 Bob，旧 prefix 为空。
3. 同一 bet、同一手工选择的玩家输局 seed，真实本地回调一次终结，LP 利润为 99。
4. 先结算再 Charlie 存 50：Bob=199、Charlie=50。
5. Charlie 先存 50再结算：Bob=166、Charlie=83。
   **Charlie 多得 33，来自 Bob 少得 33。** 新 NFT 的 24h 不变，到期实际提 83。

旧 prefix 非空的负对照通过：Alice=1,099、Bob=100、Charlie=50，后入不分旧利润。
两分支终态与现金断言通过，没有无来源增资、重结或改变 seed。
此前条件退出见证仍通过：相同亏损在退出前后入账，退出者获得 50 USDC 条件差额，
留存 LP 承担相应损失。转让继承成熟提款能力，但未提供成交价，不能宣称购买 NFT 获利。
**测试主动选定结果，没有证明真实 VRF 可预测、oracle 泄漏或真实套利发生。**

用户本轮答复：**“保留既定规则，明确接受并披露排序风险”。** 因此：

- 保留自由资本同步退出、退出部分不再承担后记损益、prefix/fallback、转让不重置成熟期。
- 白皮书、SSOT、ADR 与 Earn 入金说明披露条件损益转移及 24h 的实际边界。
- 不把披露称为修复，不承诺资本排序公平，不新增未结仓位门禁、队列或旧权益账本。
- 外部审计、严格 gas 与新网络验收继续独立待验，经济风险接受不替代它们。

另一方案“任何未结仓位存在就禁止 LP 存取”未被选择。
它虽可复用 `openHolds()`，但成熟 NFT 也等待，持续接注或长期 Received 可封锁退出；
退出窗口还涉及停止新接注。现有 Bank 暂停同时禁止 LP 提款，不能直接充当该窗口。
延长冷却、快 keeper、提高缓冲、Received 后才拦截、私有 RPC 均不能证明消除结果记录前的条件优势。
前端禁用或“不营销”也不能阻止直接调用公开且未暂停的 Vault。

## 验证与源件记录

隔离 Forge 定向 **12/12 通过，0 fail/skip**：原退出两项、利润排序两项、查询八项；
两个 fuzz 各 256 runs。五项为新增，不把重复测试加进历史总数。
上轮全量 448 项属于上一冻结版本；本轮生产 Solidity 未改，不伪称再次全量运行。

证据：`dist/admission-decision-2026-10-04/` 的 `focused-unit.log`、
`check-prefix-shape-bound.py` / `prefix-shape-bound.json`、`structural-extrema/` 八份日志、
配置、源件起止清单、results/summary。运行器新增 `--isolate-build` 使用原生 Forge out/cache
并固定单线程，没有第二套 gas 引擎。

前端相关三组测试 **24/24**、类型与 lint 通过；22 份本轮说明文档的 164 个相对链接无缺失。
本地 Browser 在 `127.0.0.1:3159/earn`、1280px 桌面视口验证金额输入 0.5、
存入／取出切换后金额与风险说明保留、五语言实际切换。五段说明都在 324px 的卡片内容宽度内
正常换行，无水平溢出；没有框架错误浮层或应用 error，只有 Lit 开发模式提示。
这不是本轮手机、已连接钱包签名、全站翻译或生产构建验收。
原工作区未嵌入新部署 release，曾按设计显示只读状态；随后复用现有本地 Anvil 夹具验证，
完成后原始 embedded 字节恢复、仅本轮节点／服务器／标签关闭。

具体记录见同目录的 `earn-browser-qa.json`、`final-checks.json`、`document-links.json`、
`canonical-artifact-binding.json`、`收尾记录.md` 以及 `SOURCE_FINAL.sha256`。
16 份 production ABI 与 creation/runtime 字节串和隔离编译产物一致。
独立只读复核对本轮证据与披露给出范围内 `RECOMMEND_ACCEPT`；它不替代严格 gas 证书、
外部审计、部署验收或架构最终接受。
历史冻结包和 WIP 保留；未签名、广播、生产写入或重启。
