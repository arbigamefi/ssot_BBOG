# v1.5 全新部署实施记录

更新于 2026-09-23。本记录区分已完成的部署与维护工作、仍待完成的治理和业务验收。公开 Web 与主网 keeper 仍使用旧合约。Sepolia v1.5 已部署并由真实 2/3 Safe 接收治理，独立内部 Web/keeper/PostgreSQL 已运行；Safe 已仅解除 USDC Bank 暂停，WETH Bank 继续暂停。业务验收进行中，主网 v1.5 部署仍待完成。

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
| 5. Base 主网部署            | 未开始                                    | 复用通过验收的源代码和主网参数；核验成本与 nonce；部署、Safe 接收、链上状态及签名发布包验证完成                                |
| 6. 新应用切换               | Sepolia 内部栈已运行，公开切换未开始      | CI 构建不可变镜像；Web/keeper 双链 manifest 和 Git revision 一致；全新 `arbigamefi_v15` 数据库；内部验证后交接 keeper 和 Caddy |
| 7. 旧系统退役               | 未开始                                    | 剩余 LP、协议费用、XP 等资产义务逐项处置；新系统稳定验收；列出旧容器、卷、脚本、密钥的准确退役清单后执行                       |

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

当前所缺输入是 Base 主网 gas 资金。建议部署钱包预备 0.003 ETH 作为费用余量；测试网 ETH 不属于主网余额。资金到位后再核验 nonce/余额/报价、签名广播、逐笔回执、Safe 治理接收与签名发布包，主网合约尚未部署。
