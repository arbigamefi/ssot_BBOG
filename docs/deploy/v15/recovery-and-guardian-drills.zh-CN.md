# Sepolia 恢复与暂停演练

适用于内部 Base Sepolia 验收栈，链 ID 为 84532，GameHub 为 `0xB4056D12aD04B01629b3A022fee385D2a1ae4b48`，USDC Bank 为 `0xEa3845f08a273257c3d3458D26e7bd4234330Dd4`。公开 Web、主网 keeper、Caddy、主网数据库和已停止的旧 Sepolia keeper 不参与演练。以下为执行与验收方法，实际结果须另外附交易和恢复证据。

## 当前准备情况

2026-09-23：Keeper 的 11 项恢复回归通过。独立本机 PostgreSQL 验证了定向触发器：其他链、GameHub、单据及非结算事件可以写入；只有目标结算事件抛出可识别错误，所在事务回滚，撤销触发器及函数后重新写入成功。链上投注模拟通过。随后已完成本机解锁及 #12/#13 两笔实链演练，链上与索引恢复证据见下文；模拟结果与真实结果分别保留。

## 预算与公共状态基线

使用已批准的部署钱包，每项演练只提交一笔 0.2 测试 USDC 的批量 Coin Toss，两项合计 0.4 USDC；每笔最多两次、每次 0.1，首轮结束后提前停止，剩余 0.1 应由 Bank 退回。每笔部署钱包原生测试 ETH 上限为 0.0001，包含保守估算的 gas 和 VRF value；真实支出仍需通过含 L1 费用的回执和余额核算。

发送前重新确认链、发布地址、源码、不可变镜像、唯一 keeper、最新与 pending nonce、余额、有限 allowance、Bank 未暂停且 reserved 为零、LP 份额和剩余预算。先模拟再估算，解锁后再次校验。每笔发送前创建不可覆盖的尝试记录，记录哈希后等待回执；任何不确定结果先查链，禁止重跑发送脚本。两个签名步骤顺序执行，第一项失败便不发送第二项。

## 在途重启

1. 取得成功的 BetPlaced 回执后立即停止内部验收 keeper，保存链上非终态、持久游标和容器身份。
2. 证明 keeper 停止期间该单处于 RandomReady。若停止前已经结算，不能把这次重启记为在途恢复通过。
3. 恢复同一 keeper 容器，验证新的 startedAt、启动扫描或持久待办恢复、终态和游标追赶。所有退出路径均恢复该 keeper。
4. 对照两家 RPC、结算事件、USDC Transfer、钱包、Bank/NAV/协议费和数据库。要求仅一次结算，退款 0.1，reserved 回到零，且旧 Sepolia keeper 仍停止。

## 定向持久写入失败

1. 第二笔 BetPlaced 后取得真实 bet ID，只对该链、该 GameHub、该 ID 的 BetFinalized 插入安装临时触发器。它抛出明确异常，不通过数据库超时模拟故障；锁等待和语句时间均有上限，触发器三分钟自动失效。
2. 保持 keeper 运行，证明链上已完成付款，同时事件表缺少该结算事件、日志出现指定错误、观测到健康状态降级；独立收据物化仍可正确写入 bets 表，完整事件扫描的持久游标未越过结算区块。
3. 无论断言成功或失败，都删除该触发器及其函数；控制进程中断时，三分钟失效只消除拒写行为，仍须补做对象清理。
4. 让现有 keeper 重试补齐，核对退款和派彩、扫描游标追赶、错误对象数为零、仅一次链上支付。不能只看进程存活或 HTTP 200 判定恢复。

## guardian 暂停、已有债务退出与 Safe 恢复

两项恢复演练关闭后再执行以下步骤。guardian 使用已核验的加密 Foundry `guardian` 账号，地址为 `0x9d239D9e0EE179Bd442497a034002aAf75865ea0`；不使用退役明文 key。2026-09-23 的只读快照为该地址 nonce 0、测试 ETH 余额 0；签名前应重新读取并补足有上限的 gas。Safe 同次快照 nonce 为 7，后续须重新确认，不固化为发送参数。

1. 核验 guardian、Safe、owners、threshold、当前暂停状态和剩余预算，准备暂停交易和仅针对 USDC Bank 的 Safe 恢复包。
2. 创建一笔预算内的小额待结算投注，临时停止唯一 keeper；guardian 真实签署 `setRiskInPaused(true)`，核验成功回执、事件和回读。
3. 模拟新投注被暂停拒绝，确认 guardian 无权解除暂停。恢复 keeper，让已有债务在 Bank 暂停期间完成实际付款和未使用投注退款；核对链、账、库一致及 reserved 清零。
4. 两名真实 Safe owners 复核并执行 USDC Bank 的 `setRiskInPaused(false)`，核对 Safe 内层调用、ExecutionSuccess、Bank 事件及回读。单个 owner EOA、部署钱包或 guardian 都不能替代 Safe。
5. 核对 LP、协议费和其他资产义务的保留或退出方案，记录最终暂停状态。WETH Bank 不随 USDC 恢复包解除暂停。

`GameHub.refund` 要求仍处于 PendingVRF 且超过退款时限；停止 keeper 不会阻止外部 VRF 回调，不能靠停止 keeper 伪造超时退款样本。已有真实部分退款不等于真实全额退款，相关验证边界应分别记录。完整业务与治理退出条件满足前，不广播主网 v1.5 部署，也不删除旧资产记录。

## 实链恢复结果（2026-09-23）

两项已完成，公开交易、逐笔资金与故障观测见 [恢复验收证据](base-sepolia-recovery-acceptance.json)。第一笔 #12 在 PendingVRF 时停止 keeper，停机期间转为 RandomReady，恢复后只结算一次。第二笔 #13 已在链上付款，但定向触发器阻止 BetFinalized 事件入库；三次观测中的扫描游标均保持 47201226，低于结算区块 47201231，日志累计出现 3、7、9 次指定错误。撤销触发器后事件自动补齐、游标追上，未再次付款，临时触发器与函数均清理。

| 单据 | 原始投注 USDC | 净派彩 | 未使用投注退款 | 总到账 | 净结果 |
| ---- | ------------: | -----: | -------------: | -----: | -----: |
| #12  |           0.2 |      0 |            0.1 |    0.1 |   -0.1 |
| #13  |           0.2 |  0.196 |            0.1 |  0.296 | +0.096 |

两家 RPC、终态 getter、USDC Transfer、钱包、Bank/NAV/协议费、PostgreSQL 与 API 收据均一致。部署钱包累计 stake 1.172652 USDC，剩余投注额度 8.827348，#13 后钱包 9.936888 USDC、0.049682545755534247 ETH。两笔部署钱包 gas（含 L1）与 VRF 实扣合计 0.000028663471921616 ETH。Bank reserved 为零，keeper 运行、队列为零，公开与主网容器未变。

原始辅助脚本退出码为 1，原因是它错误地要求事件拒写时 bets 收据也不能存在。`materializeCasinoReceipt` 另行读取权威终态并直接写 bets，因此正确收据先于事件日志落库是预期路径。本次保留该失败与原始观测，随后按实际注入范围单独复核事件缺失、游标停住、故障撤销和自动补齐，未重发交易。故障期间健康状态曾显示 running，后来观测到 degraded；不能单靠健康标志判断持久索引完整性。该结果覆盖指定事件的事务失败，不宣称全数据库不可写演练通过。

真实部分退款现已覆盖中奖与未中奖两种结果；仍不等于 PendingVRF 超时后的全额退款实链样本。guardian 暂停、Safe 恢复及 LP/协议费最终处置仍须分别关闭，主网 v1.5 尚未部署。

## guardian 已完成、Safe 恢复待执行（2026-09-23）

guardian 已真实签署 USDC Bank 暂停，交易 `0xbc5750aca6db751b6fade8c09f7d03ce643bdd919b68048d71067873f75efe83`，区块 47201684。新投注模拟返回 `RiskInPaused(uint64)` 的准确错误 selector `0x51f19a2f`；guardian 解除暂停返回 `Unauthorized()` 的 `0x82b42900`。此前已经存在的 #14 在区块 47201694 完成结算，实际返还未使用投注 0.1 USDC。两家 RPC 均核验该结算区块的 Bank 暂停状态，Bank reserved 归零，keeper 恢复运行、队列为零，其他容器未变。

#14 后部署钱包 9.836888 USDC、0.049618104269132288 ETH；累计 stake 1.372652 USDC，剩余投注额度 8.627348 USDC。另向 guardian 转入的 0.00005 测试 ETH 是 gas 备用金，不是投注或协议费用；暂停后 guardian 剩余 0.000049737576913372 ETH。本阶段部署钱包与 guardian 的实际 gas（含 L1）加 VRF 合计 0.000014703909488587 ETH，不含 keeper gas。公开交易、金额和控制边界见 [guardian 验收证据](base-sepolia-guardian-acceptance.json)。

原始发送辅助脚本使用本机 Cast 不支持的 `--data`，在 CLI 解析阶段退出；两家 RPC 确认 nonce 与余额未变，没有网络发送。保留原尝试标记和退出记录，修正为原生转账/显式函数参数后先在关闭的本机端口校验解析，再重新解锁签署；没有重发任何已广播交易。首次未入金 guardian 的权限模拟还受 gas 余额检查影响，改为零 gasPrice 的只读权限模拟后验证准确错误 selector，未发生链上写入。

当前 USDC 与 WETH Bank 均暂停。下一步由真实 2/3 Safe owners 执行 [USDC 恢复包](safe-guardian-recovery-84532.json)，只调用 USDC Bank 的 `setRiskInPaused(false)`、value 为 0。Safe 控制哈希与原先固定记录一致，无 module/guard；nonce 7 仅为生成时观测，执行前需要重新核验。签名完成不等于执行成功，必须核对实际 Safe 内层调用、ExecutionSuccess、Bank 事件与回读后才能把本步骤标为完成。
