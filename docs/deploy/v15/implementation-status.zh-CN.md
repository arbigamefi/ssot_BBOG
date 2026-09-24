# v1.5 全新部署实施记录

更新于 2026-09-24（北京时间）。Sepolia v1.5 的真实投注、部分退款、恢复、guardian 与 2/3 Safe 演练已完成本次明确范围，两个测试 Bank 最终均暂停，测试 LP 与协议费保留用于回归。Base 主网 v1.5 已完成 51 笔部署交易，并经双 RPC 逐笔核对；真实 Safe 已接收全部治理，发布包已签署并导入应用。公开 Web、双链 keeper、Caddy 已切换至 v1.5；全新数据库已完成链上回放。主网 Safe 已解除新 USDC Bank 暂停，指定部署地址已实际存入 2 USDC LP；WETH 和新测试网 Bank 维持原暂停状态。尚未发送主网投注，投注及最大损失预算未指定。旧服务和旧卷的清理进展见末节。下文早期阶段记录中的余额和待办均为当时快照。

## 已确认参数

- Base 主网、Base Sepolia 的 2/3 Safe：`0x7F0c244e1701B069727670745FD047179Ef8691d`。
- 最新部署者及发布元数据签名者：`0x93ac87413E17d01CBa37B6317f64890bF7f99aC3`。此前指定的 `0xd662…BFB9` 已被替换。
- Foundry 账号：`5e33d0f9-f7e1-4a8c-aff1-b14a684783a0`。文件权限为 0600；已通过本机隐藏密码输入完成派生地址核验。
- guardian：`0x9d239D9e0EE179Bd442497a034002aAf75865ea0`，使用加密 Foundry keystore `guardian`，已通过本机解锁核验公开地址。
  此前指定的 `0x20634D34…c02a2` 已作废：它由 `cast wallet new` 生成时重定向未生效，私钥被明文打印到终端并进入会话记录。新 v1.5 部署未使用该地址。nonce=0 不能证明全网从未任命该地址；旧地址仅作为退役历史保留，不再作为有效配置。
- 两条链的 Safe 均已读取代码、三名 owner、threshold=2、无 module、无 guard，并绑定 singleton/fallback 的代码哈希。

完整公开参数及两条链的环境模板见同目录 `owner-parameters.json` 和 `chain-*.env.example`。

## 实施顺序和退出条件

| 阶段                        | 当前状态                                  | 完成条件                                                                                                                       |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1. 保全与清理旧未结算单     | 已完成本次明确范围                        | Git 完整 bundle；数据库 dump 哈希及独立恢复；142/143 的交易、链上终态和数据库收据一致                                          |
| 2. 单一 v1.5 部署与发布工具 | 已合并并完成双链模拟                      | 新建 Bank 初始暂停；Safe 提名、真实接收、发布校验分开；旧发布入口拒绝；CI 校验通过后冻结代码                                   |
| 3. Sepolia 全新部署         | 已部署，51 笔成功回执已交叉核对           | 对最终代码重新模拟，核验签名地址、余额、nonce 和费用；广播一次并逐笔确认；异常时保留原交易记录，禁止盲目重跑                   |
| 4. Sepolia 治理与业务验收   | 恢复、guardian 债务退出与 Safe 恢复已核验 | 两名真实 owner 执行 Safe 接收包；旧 bootstrap 无治理权限；guardian 只能暂停；新投注、VRF、结算/退款、DB、UI 和重启恢复全部验收 |
| 5. Base 主网部署            | 已部署、Safe 接收及签名发布完成           | 复用通过验收的源代码和主网参数；核验成本与 nonce；部署、Safe 接收、链上状态及签名发布包验证完成                                |
| 6. 新应用切换               | 双链公开切换及新库回放已完成      | CI 构建不可变镜像；Web/keeper 双链 manifest 和 Git revision 一致；全新 `arbigamefi_v15` 数据库；内部验证后交接 keeper 和 Caddy |
| 7. 旧系统退役               | 旧服务器容器、卷、目录已清理；链上历史义务待收尾                                    | 剩余 LP、协议费用、XP 等资产义务逐项处置；新系统稳定验收；列出旧容器、卷、脚本、密钥的准确退役清单后执行                       |

步骤 3—6 的具体命令与检查在 [v1.5 发布流程](../v15-release.md)。首次模拟前部署账户两条链均为 nonce=0、balance=0；该状态已被后续到账和 Sepolia 部署改变。新地址的只读部署模拟均通过：每条链估算 gas 为 33,962,624；Sepolia 约 0.000373588864 ETH，Base 约 0.000341341352512 ETH。这些是当时估算，广播前需要刷新。

## Sepolia 实际部署与治理接收

#50、#51 已按顺序合并，本次部署使用主线提交 `d17a6a8db1598b9d6dce1114a0154708396514cf`。51 笔交易均成功，最后一笔位于区块 47140563，使用另一 RPC 逐笔核对了回执及区块哈希。实际费用含 L1 为 **0.000159166635682337 ETH**；账户剩余 **0.049840833364317663 ETH**，nonce=51。之前零余额及模拟费用的记录均是历史观测。

- GameHub：`0xB4056D12aD04B01629b3A022fee385D2a1ae4b48`。
- USDC Bank：`0xEa3845f08a273257c3d3458D26e7bd4234330Dd4`。
- WETH Bank：`0x9d61C6230ef0bF2d853e17a0368CBC384ef1843B`。

全部 7 个治理目标的字节码、提名、已发布参数以及 Bank guardian/暂停状态，均在部署完成区块上验证通过。完整地址和交易哈希见 [部署记录](base-sepolia-deployment.json)。原始 snapshot 的 `pending-safe-acceptance` 保留为部署时历史事实；最新治理状态以独立接收记录为准。

真实 Safe 已在区块 **47141051** 执行 [治理接收交易](https://sepolia.basescan.org/tx/0x34892d2e97f2f40959355fb05303a8119d26d9053faf57650b70ffdfb4f54a2c)。已核对成功回执、Safe `ExecutionSuccess` 以及同一交易的 7 个 `GovernanceTransferred` 事件，并使用第二 RPC 核对回执与区块哈希。在固定区块 **47141280** 回读，所有目标均为 `governance=Safe`、`pendingGovernance=0`；`VerifyGovernanceV15` 完整代码/参数/Safe 控制/Bank 暂停状态校验通过。详见 [治理接收证据](base-sepolia-governance-accepted.json)。

[原始治理接收包](safe-acceptance-84532.json) 保留为历史证据，不应再次执行。此交易没有解除 Bank 暂停，也没有完成业务验收或生产切换。已使用已批准的发布账号签署元数据，完成发布包生成、严格制品一致性校验、签名验证及打包前实时治理校验，并通过 `ssot:sync` 导入 Sepolia v1.5 manifest、ABI 和可复核的原始发布包副本。见 [发布记录](base-sepolia-release.json)。后续独立数据库和实际业务验收进展见本记录末节。

独立核验曾遇到官方 RPC 限流、公共 RPC 的批量/传输读取失败；改用另一 RPC 的单项读取后完成全部 51 笔核验。失败记录保留，未重发部署交易。

## 已完成的生产维护证据

旧 Sepolia 单据 142、143 已正常 finalize：

- 142：`0xe7af164aa47c80e874abae78e9e6bff5c84953dbf733ea5db94f54447347ba54`。
- 143：`0x263b6af79d13757b4162d721dc39a5254c77382b9af1e5060fbbf587c0e5e203`。

同一确定区块 47137521 回读，两笔均为状态 4；旧 USDC Bank 的 reserved 已归零、held/settled 为 186/186。两笔收据通过现有 hydrate API 写回投影。为避免 nonce 冲突，维护期间仅暂停过 Sepolia keeper，之后恢复原容器和原镜像。

143 的成功交易之后，首次即时读取返回旧状态，维护脚本因此报错；没有重发交易。后续锚定区块和收据回读确认成功。该失败记录保留，不能把首次执行描述为全程无错误。

数据库备份 SHA256：`6891d17cb1ff3848bedb98464f62b091397e2ec62deb51d22f83a4e337cdc6dd`。本机第二次隔离恢复成功，恢复出 8 张 public 表；临时容器已清理。首次恢复失败，未保留可定位原因的 stderr，不能断言其原因；失败记录与成功复验同时保留。备份早于本次 finalize，回退时仍需链上重放以恢复这些后续事件。

## 校验范围和边界

最终本地回归：144 项合约单元测试通过（含 16 项新部署测试），19 项运维/发布边界测试通过。Node、Python、Shell 语法检查及 Git diff 检查通过；CI 结果须另外读取，不能由本地结果代替。

- 新增部署测试覆盖提名与接受的区别、部分接受、Safe 配置变化、字节码不一致、Bank 风险参数/退款时间/池状态变化，以及 Sports 目标完整性。
- 发布工具测试覆盖旧 schema、混用 chain/block、缺少信任锚、镜像 revision/digest 不一致、治理校验失败时禁止打包，并保留原活跃文件。
- 本地 Safe mock 仅验证程序边界，不能替代真实 2/3 签名和钱包恢复演练。
- Sepolia 嵌入式 manifest 已对应真实 v1.5 合约；Base 主网仍为旧版。双链 v1.5 镜像门禁会继续拒绝当前混合版本的生产切换，直到主网部署与治理验收完成。
- 旧版历史 fixture、地址证据和部分维护脚本暂时保留，直到其资产义务和依赖逐项退役；不能声称已删除全部历史版本。
- 新合约一旦接受投注，应用回滚也必须继续指向 v1.5 地址和兼容数据库，不能切回旧合约。

19 项固定区块只读权限检查通过，覆盖两个 Bank 的旧部署者、guardian、keeper、三名 Safe owner 无权直接解除暂停，guardian 有权暂停但无权改任 guardian，及旧部署者无权修改 GameHub 退款超时。`eth_call` 的 caller 模拟不构成真实签名或状态变更演练，详见 [权限只读证据](base-sepolia-permissions-readonly.json)。

Sepolia 发布包导入后的应用验证：类型检查、Web 构建、778 项测试通过；另用本机独立 PostgreSQL 补验 6 项恢复集成测试通过。实时 release smoke 通过。本机 Web 对新 release 和新 PostgreSQL 的健康检查通过，keeper 尚未交接，因此整体 `degraded`；未宣称完整业务验收完成。后续安排见 [测试网验收计划](sepolia-acceptance-plan.zh-CN.md)。

## 业务模拟发现并修正的发布工具缺陷

第一次使用发布向量进行真实模块模拟时，Dice `maxPayout` 拒绝旧的单字段 `uint8` 参数；当前合约实际需要 `(bool isOver, uint8 target)`。同时发现前端黄金向量测试只枚举 v1.3/v1.4，漏掉了 v1.5。修正生成器及参数描述、补入 v1.5 向量枚举和 SDK 编解码校验，并新增生成器输出必须通过全部 8 个真实模块 `validate/maxPayout` 的回归；17 项部署/发布测试通过。原始错误包哈希保留在发布记录的 `supersededArtifacts`，新包重新严格验签、治理核验、打包并通过 `ssot:sync` 导入。已部署合约与 snapshot 摘要均无需改变。

独立验收辅助脚本也曾把投注授权目标误设为 GameHub；本协议由 Bank 拉取 stake，已改为仅向 Bank 授予合计 50 USDC 的有限授权（40 LP + 最多 10 投注）。该错误仅发生于本机 fork 模拟，未广播交易，与发布工具缺陷分别记录。

## 浏览器源码验证补齐与 USDC 开池

2026-09-22 对本次 17 个合约逐一查询 Etherscan API，发现 PoolRegistry、SettlementRouter、GameHub 和两个 Bank 未验证，其余 12 个合约是已有源码的 Similar Match。此前的签名制品、链上代码哈希和治理校验不能替代浏览器源码验证；部署收尾遗漏了这一步。已用部署时的源码、编译配置和原始构造参数补交，5 个遗漏均达到 Exact Match，复查未验证数量为 0。

其余 12 个地址显式重提后返回 `Already Verified`，仍属于 Similar Match。未宣称它们达到 Full Match；平台要求完成账号所有权验证及白名单后方可升级。完整地址、分类及构造参数核对见 [逐地址验证报告](base-sepolia-explorer-verification.json)。发布流程已明确增加源码验证与逐地址复查步骤。

Safe 在区块 47143601 执行了仅解除 USDC Bank 暂停的操作，实际区块和交易见 [执行证据](base-sepolia-usdc-unpause.json)。外层交易经过中继，核验绑定 Safe 的 `SafeMultiSigTransaction` 内层目标、金额、操作、calldata 与 `ExecutionSuccess`，并与独立 Alchemy 回执交叉核对；没有要求外层 `transaction.to` 必须为 Safe。两个公共 RPC 回执读取返回 HTTP 403，未重发治理交易。

## 八游戏真实投注与账本核对

PR #52 已合并至 `23a062d2ac08b4d5b9f29b3e367a7c4d1df56658`；CI 镜像源码为 `bea3ed05b53ec362667251d82516865e4477e760`，二者 tree 相同。VPS 上的独立验收栈使用全新 PostgreSQL、v1.5 Sepolia manifest 和不可变镜像，Web 仅绑定 `127.0.0.1:3300`。旧 Sepolia keeper 已停止，新 keeper 单独使用其签名地址；公开 Web、Caddy 和主网 keeper 尚未切换。

Owner 提供的 50 测试 USDC 已按批准预算执行：40 USDC 存入 LP，八游戏各投注一笔，总 stake 为 **0.572652 USDC**，净赔付合计 **0.417540 USDC**，钱包剩余 **9.844888 USDC**。Bank 资产余额为 **40.155112 USDC**，扣除应付协议费用 **0.011452 USDC** 后 NAV 为 **40.143660 USDC**，LP 份额为 40,000,000 基础单位；XP 为 0，reserved 为 0，held/settled 为 8/8。账本、链上终态及 PostgreSQL 八行收据一致。详见 [逐笔验收记录](base-sepolia-usdc-canary.json)。

11 笔验收钱包交易（含一笔回滚）与 8 笔结算交易共 19 份回执，由 Alchemy/Tenderly 核对交易、区块哈希、状态、日志和 gas；八组 VRF `Fulfilled` / `BetRandomReady` 的请求号与随机哈希相符。实际从投注到 finalize 为 **12—14 秒**，仅代表本次八笔样本。钱包 gas 含 L1 费用为 **0.000056322366337361 ETH**，VRF 实扣 **0.000058973832837805 ETH**，合计 **0.000115296199175166 ETH**，与原生币余额变化完全一致。

本轮并非全程无错：approve 成功后公共 RPC 回执读取 HTTP 403，交叉核验后从下一 nonce 继续，未重发授权。nonce 55 的 Roulette 因辅助发送脚本未给 VRF 报价留缓冲而回滚：报价升幅约 0.006127%，无 USDC 转移，gas 已计入上述成本。现有 SDK 原本已有 50% 缓冲；辅助脚本按相同策略重新逐笔取价并模拟，从 nonce 56 完成余下六笔。多付 VRF 费用已退回，退款信用为 0；这不等于业务退款路径验收。

八笔全部终结后，对新 keeper 做了一次空队列重启：重新读取持久游标，八笔终态、事件计数和 LP 账本未改变，健康状态恢复为 `ok`，旧 Sepolia keeper 保持停止。这项证据不覆盖处理中重启和数据库写入失败。浏览器实际读取 #1 与 #8 收据，结算、金额、PostgreSQL 来源和测试网交易链接正确；尚未执行浏览器钱包完整流程。观察到收据链为 84532、全局页头仍显示 Base，进入游戏链接未携带链参数，公开切换前须核验跳转的链一致性。

下一阶段依次完成：处理中重启与持久写入失败恢复、真实业务退款、guardian 签名暂停与债务出口、Safe 恢复、LP/协议费处置及最终暂停状态。完成这些退出条件后，才推进 Base 主网 v1.5 部署及双链公开切换。当前保留测试 LP 和协议费义务，不把八游戏结算通过描述为全部上线验收通过。

## PR #59 部分退款闭环（2026-09-23）

SDK、索引和前端金额口径修复已合并，8 项 CI 通过；合并提交 `083ef0c4` 与镜像源码 `ba2bebb8` 的 Git tree 相同。内部 Sepolia 栈升级并补齐 10 笔历史终态退款字段，#11 的真实部分退款由链上至 SDK、数据库和 UI 全链路核验一致。详见 [部分退款公开证据](base-sepolia-partial-refund-acceptance.json)。上文八游戏阶段的余额、镜像和待办是历史记录；当前待办以最新验收记录为准。公开 Web、主网 keeper、Caddy 和主网数据库未切换，主网 v1.5 尚未部署。

## 恢复与 guardian 阶段（2026-09-23）

#12 在途重启、#13 指定结算事件写失败恢复、#14 guardian 暂停期间已有债务退出已实际执行并核验。准确范围、原始辅助脚本失败与实际账本见 [恢复及暂停验收记录](recovery-and-guardian-drills.zh-CN.md)。真实 2/3 Safe 恢复已核验，随后由 guardian 恢复发布前暂停状态，当前两个 Bank 均暂停；[执行证据](base-sepolia-safe-recovery.json)绑定内层调用、Safe 哈希、成功事件及两家 RPC。40 USDC 初始 LP 对应份额与 0.203676 USDC 协议费已明确保留在新 v1.5 测试池用于后续回归，未转出或核销；[最终暂停与留存余额](base-sepolia-final-pause.json)已双 RPC 核验。主网切换尚未完成。

## Base 主网部署前检查（2026-09-23）

测试网恢复、guardian/Safe 实际演练、测试资产保留及最终暂停已完成。指定部署地址在 Base 主网的 nonce 为 0、余额为 0 ETH，两个 RPC 读取一致；当前 Solidity 与已部署 Sepolia 的 `d17a6a8d` 版本一致。完整只读部署模拟通过，估算 33,970,350 gas、约 0.00091465225124595 ETH；这不是广播或实际费用，发送前还要刷新。首个官方 RPC 的 TLS EOF 已保留，改用备用 RPC 后成功，未发送交易。详见 [主网预检证据](base-mainnet-preflight.json)。

此前建议部署钱包预备 0.003 ETH。Owner 随后补充了 0.0015 ETH，发送前重新核算并通过费用上限检查，实际部署结果如下。

## Base 主网实际部署（2026-09-23）

部署源代码为已合并的 `7fb390d5b42346722a225e497dee6fcd3a67ed55`，合约、部署脚本及编译配置与完成测试网验收的版本一致。部署前余额 0.0015 ETH，nonce=0；51 笔交易、17 个新合约全部成功，最后一笔区块为 **51692732**。官方 RPC 与 Tenderly 的正式回执、区块哈希、日志和费用一致，nonce=51。实际费用含 L1 为 **0.000144028633447999 ETH**，剩余 **0.001355971366552001 ETH**，精确余额对账通过。逐笔记录见 [主网部署证据](base-mainnet-deployment.json)。

本轮保留了两次工具中断：首笔成功后 PublicNode 拒绝读取回执；第一次 `--resume` 仍从 Foundry 缓存使用旧 RPC，未发出新交易。随后仅替换缓存的 RPC 地址，以同一交易序列成功续发剩余 50 笔。原始即时回执中有 36 份区块哈希为零，重新读取两家 RPC 的正式回执后完成核验；原始记录保留，没有因此重发任何交易。

在最后部署区块核验全部运行时代码哈希、已发布配置、Safe 控制结构、7 项治理提名及两个 Bank 的 guardian/暂停状态均通过。已生成 [主网 Safe 接收包](safe-acceptance-8453.json)，只含 7 个 `acceptGovernance()` 调用，金额均为 0，chain ID 为 **8453**。主网与测试网新地址相同，必须按 chain ID 区分；不可使用测试网历史签名包。

真实 2/3 Safe 已在区块 **51693133** 执行[主网治理接收交易](https://basescan.org/tx/0xdb9fec0887ff318a6938d85d6c63469f2fd8b9c62dec73387a94201702b1a531)。实际批次仅含已审阅的 7 个调用；Safe 哈希、nonce=0、threshold=2、成功事件、7 项治理事件以及两家 RPC 的最终权限状态均匹配，完整代码/配置发布门禁通过。全部目标 `governance=Safe`、`pendingGovernance=0`，两个 Bank 保持暂停。详见 [主网治理接收证据](base-mainnet-governance-accepted.json)。接收包现为已执行的历史证据，不得重复执行。下一步签署发布元数据、导入主网 manifest、构建双链不可变镜像，公开应用尚未切换。

17 个主网地址的浏览器源码复查完成：**6 个 Exact Match、11 个 Similar Match、0 个未验证**。逐地址编译器、优化参数、构造参数及验证分类见 [主网源码验证报告](base-mainnet-explorer-verification.json)。Similar Match 不等于 Full Match；本轮显式提交返回 `Already Verified` 的地址保留其实际分类。

主网发布摘要为 `0xcf3f3550d8532fc656ad8e646b015b972f88631f5e38125b47d0f1ed249e0055`，由指定发布账号签署。严格制品一致性、可信签名、打包前实时治理和导入门禁均通过；主网 manifest、ABI 及原始签名制品已通过 `ssot:sync` 导入，两个嵌入链均使用 v1.5。详见 [主网签名发布记录](base-mainnet-release.json)。主网只读冒烟、类型检查及 Web 构建通过；公开服务当前仍指向旧合约，应用切换需等待最终回归与 CI 不可变镜像验收。

导入主网发布包后，本地严格测试 **855 项通过**，13 项需要独立 PostgreSQL 的集成测试因本次未提供数据库而跳过；本轮未修改数据库实现。前两次运行因工作区合并后缺失 `@ssot/bet-index` 依赖链接而失败，按锁文件刷新依赖后通过，未修改产品代码以绕过失败。主网治理核验首轮遇到官方 RPC 429，改为固定区块批量只读回查后两家 RPC 一致，未重发 Safe 交易。


## 双链公开切换与旧进程停用（2026-09-23）

PR #62 的合并树与 CI 镜像源码树一致。已部署经过 manifest/revision 校验的不可变 Web、keeper 镜像，并在独立 `arbigamefi_v15` 数据库完成链上重放；未导入旧数据库投影。2026-09-23 15:39 UTC 已交接 Caddy，公开双链 health 为 `ok`，两个 keeper 队列为零。停用其余旧服务后再次验证通过。详见 [公开切换证据](public-cutover.json)。

- 14 笔 Sepolia 投影（除写入时间外）与验收库完全一致，包含退款和终态交易；42 条事件中，前 10 条历史终态仅增加 getter 已验证的 `refundAmount=0`，其余字段一致；1 条 LP 账本完全一致。主网新库投注为零。
- 公开 #11—#14 回执与数据库一致。#11 HTML 显示总返还 0.296、净收益 +0.096，返回链接保留测试链参数；首页不再出现固定 98% 文案。
- 用户提供的两笔旧主网暂停交易均成功，两个独立 RPC 核对正式区块、Bank 事件及暂停状态。USDC 使用钱包代理调用，不能误写为外层直接调用 Bank。见 [暂停证据](legacy-mainnet-pause-verified.json)。
- 在区块 51694246，旧主网两 Bank 的 totalAssets、totalSupply、protocolFeesPayable、totalReserved 均为零，暂停为 true。见 [旧主网资产快照](legacy-mainnet-retained-obligations.json)。这不代表所有历史链、XP 或其他合约义务已清零。
- 旧生产及内部验收共 8 个容器均停止，restart policy 改为 `no`。服务器现在只运行 v1.5 的 Web、双链 keeper、Postgres、Caddy 共 5 个服务。旧容器、镜像、数据库卷、备份及历史地址证据尚未删除。

回放期间主网 2000 区块查询被 RPC 拒绝，改为 1000 后成功；测试网 2000 区块回放成功。完成核对后已恢复原 RPC、10 区块范围及扫描周期。Caddy 首次检查因 VPS Compose 不支持 `run --pull` 失败，验证本地镜像存在后去掉该参数，配置和证书检查通过。以上失败没有导致链上重发或游标跳过。

下一阶段依次执行：

1. 收尾历史部署资产和 XP 义务清单，为旧脚本、容器、卷、密钥明确归档或删除条件；优先保全可恢复证据，不把停用写成已彻底删除。
2. 明确主网 LP 资产、金额、提供账户、canary 投注及最大损失预算；当前没有已批准的主网资金预算。
3. 准备具体 Safe 开放调用和验收步骤，在预算到位并完成治理签名后，按限额核验真实投注、VRF、结算、退款和公开回执。
4. 业务验收后再决定持续开放；若退出条件不满足，保持或恢复暂停。当前已完成应用切换，不代表主网已开放投注。


## 主网 2 USDC LP 入池与服务器清理（2026-09-24 北京时间）

Owner 明确 LP 金额为 2 USDC、提供者为部署地址。实际 [Safe 交易](base-mainnet-usdc-unpause.json) 在 nonce=1 仅对新主网 USDC Bank 执行 `setRiskInPaused(false)`，目标、calldata、Safe 哈希、2/3 阈值、成功及暂停事件和双 RPC 状态均一致；WETH 保持暂停。

随后只授权 2 USDC 并将 2 USDC 存入部署者自己的 LP 份额，未发送投注。两笔交易、Deposit/Transfer 事件和区块后状态经两家 RPC 核验；Bank NAV 与 LP 总份额均为 2,000,000 基础单位，allowance=0、reserved=0，部署钱包剩余 3.1 USDC。两笔实际 gas 含额外链上费用合计 0.000006544989393587 ETH。见 [入池证据](base-mainnet-lp-deposit.json)。主网累计投注和最大损失预算仍未指定，余额不代表投注授权。

用户补充的 [旧测试网两笔暂停](legacy-sepolia-pause-verified.json) 也已核验。交易通过中继发送，外层 from 不是旧治理 EOA；实际 Bank `Paused` 事件的 account 为旧治理地址，两个旧 Bank 均 paused=true、reserved=0。更早历史 fixture 中仍有 14 个 Bank 未完成暂停，服务器磁盘清理不代表链上历史资产义务消失。

公开切换后的后续探测曾两次返回 Cloudflare 522；当时服务器内部健康为 ok，Web/Caddy 无 OOM、无重启，后续外网复查恢复。默认 Python User-Agent 另收到 403/1010，浏览器 User-Agent 双链检查均为 200/ok。522 根因尚未定位；本次未修改 Cloudflare/WAF 或开放额外端口，不能把后续通过写成从未发生故障。

服务器清理已按 Owner 授权执行：删除 8 个已停止旧容器、6 个已确认无运行容器引用的旧卷、两套旧目录、旧项目备份及部署压缩包，清除未使用镜像、构建缓存和 apt 下载缓存。两个最小数据库审计副本已移出服务器并核对 SHA-256，保存在 Owner 本机受限目录；当前生产数据库及证书卷保留。没有对 v1.5 应用、keeper 或数据库执行重启。详见 [清理执行证据](server-cleanup.json)。

- 根分区使用率从 91% 降至 34%，释放 13,458,882,560 字节（约 12.5 GiB）；可用空间约 15 GB。
- `/var` 实测由约 15 GB 降至约 1.8 GB。Docker 仅保留 5 个运行容器、4 个在用镜像、4 个运行卷，构建缓存为零。
- journal 从约 2.4 GB 降至约 235 MB，并配置 256 MB 上限及 14 天保留期。系统自身 `/var/backups` 未作为旧项目备份删除。
- 删除可能在重启后拉起旧 keeper 的遗留 systemd unit；原健康监控迁移至 v1.5 目录，原配置、状态及 timer 保留。Docker 开机启动与新容器 restart policy 保持有效。
- 清理前后内部双链 health 均为 ok，在用镜像身份一致。新数据库保留 14 笔测试网终态，主网无投注，新增 2 USDC LP 入池账本已核对。

清理后 Python 公网探测曾读超时；随后本机 curl 的主网接口和服务器 curl 的测试网接口分别返回 200/ok。以上是有限时点的验证，公网间歇性超时根因仍待排查，不能据此认定已恢复持续稳定。

剩余工作：定位公网间歇性超时；处置更早 14 个历史 Bank 的暂停与资产义务；在另行明确主网投注和最大损失预算后执行小额业务验收。目前主网 USDC Bank 已解除暂停、WETH 仍暂停，未发送主网投注。


## 本地旧部署材料退役与剩余收尾（2026-09-24）

按 Owner 授权，从工作区清除 v1.3/v1.4 运维脚本、可执行 Make 入口、旧 ABI/发布包/fixture、旧部署 runbook、原型截图和归档文档；同时删除本地忽略的旧广播、压缩包及明确属于旧版本的环境文件。保留双链 v1.5 的签名制品、真实广播记录、当前凭据和仍约束当前合约的协议规范。历史源文件可从 Git `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273` 查询，不在工作树另留一份备份。

生产部署统一指向 Docker 不可变镜像流程；移除旧独立 systemd 安装模板，本地 keeper 模板继续服务开发与 backfill，start block 更新为 v1.5。验证辅助脚本现在拒绝 v1.3/v1.4 快照，避免清理后再次生成旧入口。具体清理范围见 [本地清理报告](local-cleanup.json)。

已刷新 [18 个历史 Bank 的义务清单](legacy-bank-closeout.zh-CN.md)：最新四个已暂停，其余主网 1 个和测试网 13 个暂停调用均已只读模拟通过，等待旧治理钱包签署；未代发或转移资产。主网投注及最大损失预算仍待明确，未新增主网投注。

公网排查确认服务器原监控于 06:31:32 UTC 报不可达、06:33:22 恢复。Owner 提供的 DNS 指向同一 VPS；12 次新探测（Cloudflare 与直连源站各 6 次）均返回 200/ok，最慢约 1.79 秒。连接跟踪表未接近上限，采样窗口未见 80/443 内核丢弃日志。现有证据不足以定位先前超时，未修改 DNS、TLS 或防火墙。详见 [公网排查记录](public-connectivity-investigation.json)；需要失败请求的 Cloudflare Ray ID 与源站时序才能继续缩小范围。


## 清理已合并、主网资金安排与公网诊断补充（2026-09-24）

PR #65 已通过合约、前端和 Docker 检查并合并到 `938f9e57b13e5df08dfe08f8fc17617c4611ca28`，本地 master 已同步。共删除 416 个旧 tracked 文件、150 个旧 ignored 路径，另移除 22 个旧编译输出/缓存目录；应用运行制品无需因这次清理重新部署。

Owner 此后授权从部署钱包现有 USDC 安排额外 LP 与小额业务验收，上文“预算待明确”为历史状态，不再适用。最新只读核对为钱包 5.1 USDC、已有 LP 份额 2,000,000、nonce 53、allowance=0、reserved=0。准备新增 4 USDC LP，八种游戏合计投注 0.057264 USDC；11 笔调用在主网固定区块分叉模拟全部通过，详见 [待执行证据](base-mainnet-acceptance-prepared.json)。这些不是主网交易回执；实际签名、广播由用户本人完成，目前仍未新增主网 LP 或投注。

模拟发现适配器 `requestGasPriceWei=10000000`，若交易使用 35000000 wei gas 单价，wrapper 返回 `fee too low`；VRFHub 先退多余 msg.value，额外 50% ETH 缓冲不能修复 gas 单价高于配置的差异。使用配置范围内的 10000000 wei 后请求全部成功；未更改生产治理配置。真实 VRF、keeper 结算和账本仍需实际交易完成后验收。

服务器在 07:01:07 UTC 再次记录无响应，07:02:58 恢复。旧监控没有保留 HTTP 状态、Ray ID 或连接阶段，无法由该日志断言是 522。新诊断实现保留这些字段，公网失败时补充五秒内的 loopback 应用对照；仍使用已有 timer 和通知节奏。详见 [排查与部署说明](../../ops/runbooks/public-healthz-timeouts.zh-CN.md)。公网根因仍未确定，诊断能力补齐不能写成故障已修复。

本次刷新历史 18 个 Bank 的链上状态，剩余 14 个仍未暂停，所有 reserved 与 XP 仍为零。它们需要旧治理钱包签名，新 Safe 和部署钱包不能代签。
