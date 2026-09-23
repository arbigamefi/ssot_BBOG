# Sepolia 恢复与暂停演练

适用于内部 Base Sepolia 验收栈，链 ID 为 84532，GameHub 为 `0xB4056D12aD04B01629b3A022fee385D2a1ae4b48`，USDC Bank 为 `0xEa3845f08a273257c3d3458D26e7bd4234330Dd4`。公开 Web、主网 keeper、Caddy、主网数据库和已停止的旧 Sepolia keeper 不参与演练。以下为执行与验收方法，实际结果须另外附交易和恢复证据。

## 当前准备情况

2026-09-23：Keeper 的 11 项恢复回归通过。独立本机 PostgreSQL 验证了定向触发器：其他链、GameHub、单据及非结算事件可以写入；只有目标结算事件抛出可识别错误，所在事务回滚，撤销触发器及函数后重新写入成功。链上投注模拟通过。实际发送仍需要本机加密 keystore 解锁，模拟通过不等于已广播或实链恢复通过。

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
2. 保持 keeper 运行，证明链上已完成付款，同时数据库缺少该终态、日志出现指定错误、健康状态降级，完整事件扫描的持久游标未越过结算区块。
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
