# ADR-0034 实施前复盘

日期：2026-09-28。结论：**当前补充后的 ADR 可进入实现；没有已完成的异步 Bank 修复，原扫描发现仍未关闭。**

这份记录是当前方案的实施准备复核，不是重新执行或改写原 Codex Security 扫描，也不是合约验收或部署许可。

## 审阅身份与范围

- 主目录分支：`docs/adr-0034-async-lp-redemption`，HEAD `869c3e97af2b7f3a14c35e64e5b80c33da9bd8c3`，加本次及上一轮未提交的 ADR 修订。
- 原扫描：`a77e83fe-c404-4b96-a41d-14321fd3cda2`，基线 `979be07a62ced32a37c42cfd06e28f60093620d0`。重新读取的权威状态为 complete，四项发现，一项 high、三项 medium。
- 原修复工作区：`/Users/kevin/.codex/worktrees/security-remediation/arbigamefi_ssot_project_all`，仍在 `codex/security-remediation`，保留 Sports、release tooling、LP 反例及文档 WIP。本次没有移动、覆盖或提交它们。
- 当前 HEAD 对原扫描基线的 `src/`、`test/`、`script/`、`frontend/` 没有已提交差异。本次只修改设计和复盘文档。
- 复核范围：Bank 价格、NAV、托管和授权；Router、赌场 Hub、VRF 与模块终结路径；两批状态机、付款失败与领取；SDK、Earn、keeper、索引和新旧部署共存。资金/授权、生命周期、集成三个方向进行了独立只读复核。
- 不包含：重新确认主网余额、实际 keeper 轮询配置、生产交易顺序或线上 gas；也没有执行部署、发布或原漏洞攻击序列。

## 原发现逐项去向

| 原扫描发现                                                                | 当前去向                                   | 关闭条件                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| `csf_c89fff2b45c23eed60c127d2`：未结算投注进入可赎回价格，LP 退出转移风险 | 本次异步赎回的核心；设计覆盖，代码尚未修复 | 真实 Bank/Router/Hub 路径的两类经济安全断言、状态机和集成验收完成          |
| `csf_b7a2cc91ea4f2e66fe30e6d4`：Sports 缺少有界公开终结路径               | 延期；首版异步 Bank 不准入 Sports          | 独立补齐所有 Sports 状态期限后重新验收，不能用挑战超时局部补丁关闭整个问题 |
| `csf_8afad561170106f027059991`：激活的 manifest 未被签名验证绑定          | 按既定决定延期，不并入 LP 实现             | 发布前需独立接受的精确产物认证路径；LP 测试不替代该门禁                    |
| `csf_0a2948d469328d98b27d5ae4`：ABI 文件名控制写入路径及生成语法          | 按既定决定延期，原 WIP 保留                | 独立完成输入约束、路径和内容认证验证，不能因本次设计通过而关闭             |

保留工作区中的 `docs/security/lp-exposure-remediation-plan.md` 是早期双向异步 cohort 方案。当前架构以 [ADR-0034](../adr/0034-async-lp-redemption-drained-batches.md) 为准：即时申购、单活动池、最多两个未定价赎回批次；不再按旧方案增加申购托管或固定整个池子的 shares 基数。

## 前两轮意见的复核结果

| 项目                                         | 当前设计处理                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| 原始 NAV/supply 与 virtual-offset 混用       | 保留现有虚拟报价，另加下述真实比例权益上限；修正“存入和退出无条件同价”的旧结论   |
| 截止依赖 keeper 调用                         | `holdBet` 自己检查时间；已有截止不可延长                                         |
| 长排空产生第三批、第一批定价后过早恢复下注   | 全局最多两个未定价批次；容量满则拒绝第三批；所有已截止批次处理完才恢复下注       |
| 玩家债务被 pause 或提款缓冲挡住              | 玩家 payable 为债务偿付；Bank 暂停不禁止它；代币发行方的限制仍适用               |
| NAV 只在 totalAssets 扣新债务                | 所有六处当前 NAV 计算统一经过一处内部函数，覆盖事前/事后 outflow 计算            |
| 最后份额被 partial withdraw 耗尽，资产仍剩余 | 拒绝这种部分提现；全额 withdraw/redeem 可结清；withdraw 支付精确请求金额         |
| 批次取整与个人取整差额                       | 每 controller 向下取整；分配完成后才释放最终尾差；已分配未领取资产仍保留为负债   |
| 不活跃 controller、旧槽复用与重复入账        | 权限开放的纯记账 sync；最多处理两个槽；一次入账并清槽；view 使用相同有效余额     |
| 全部取消的空批次、零资产 entitlement         | 空批次立即退出门禁和槽位；零资产份额允许无转账清空                               |
| openHolds 新增变量                           | 复用 held − settled − refunded；部分退款的 settle 只计入 settled，终结只发生一次 |

这些是设计层面闭合，均需要在实现中转成验收断言。

## 本次完整复盘补出的重要边界

### 1. 虚拟报价不是可用现金

证据：[Bank 的换算](../../src/core/Bank.sol:408)、[旧 optional-outflow 保护](../../src/core/Bank.sol:593)、[已有虚拟报价不变量说明](../../test/invariants/BankInvariants.t.sol:335)。

令 `N = NAV`、`S = totalSupply`、`V = 10^decimals`。当 `N < S` 时，所有真实份额的虚拟报价可能高于 N。六位精度的例子：

```text
S = 10_000_000
N =  5_000_000
V =  1_000_000
virtualQuote(S) = 5_454_545 > 5_000_000
```

此前“去掉提款缓冲后按该报价全额记 exitPayable”会超额记债，或因后续检查回滚而无法结批。仅用整个池子 NAV 限额也不够：先退出的一批可能拿走其他 LP 的比例权益。

ADR 已采用最小的比例权益保护，所有输入在 burn 和记债前取同一快照：

```text
A_b = min(
    floor(Q * (N + V) / (S + V)),
    floor(Q * N / S)
)
```

有效批次有 `0 < Q <= S`。`N >= S` 时保留原虚拟报价；亏损时按真实权益限制；零 NAV 仍允许零额定价和清除份额。因 `A_b <= Q*N/S`，剩余净值满足 `(N-A_b)*S >= N*(S-Q)`，退出不会拿走剩余 LP 的比例权益。即时申购仍按既有虚拟价格，新 LP 承担该价格政策，前端需要披露；不能继续声称亏损时申购和退出同价。

### 2. 托管 shares 与现有 rescue 权限冲突

[rescueToken](../../src/core/Bank.sol:219) 当前只保护底层 asset，允许把 Bank 自己的 share token 转走。引入托管后，这会抽走用户 pending shares，导致取消或批次 burn 失败。

ADR 已明确：新 Bank 同时禁止 rescue 底层 asset 和 `address(this)`；不能从 Bank 的总 share 余额推导用户请求。直接转入或 mint 给 Bank 的份额不自动产生任何人的请求权益。

### 3. 聚合请求必须明确权益所有者

不同 owner 可以向同一个 controller 提交请求，聚合后无法恢复每笔原 owner 的取消份额。因此明确：成功 request 后权益归 controller；仅 controller 或其当前 operator 可取消或领取，取消股份固定退回 controller。owner 的 ERC-20 allowance 只授权请求阶段，不自动成为后续领取权限。

标准核对来源为 [ERC-7540](https://eips.ethereum.org/EIPS/eip-7540)。当前 [IERC4626Minimal](../../src/core/interfaces/IBank.sol:6) 并非完整标准实现。新 Bank 的接口验收需覆盖 request views/events、operator、ERC-165、ERC-7575 `share()`、同步存入侧的 ERC-4626 方法以及适用 overloads；不能只增加一个 requestRedeem 就宣称合规。

### 4. “转账失败”与“已经到账”必须分开核算

复用仓库已锁定的 [SafeERC20.trySafeTransfer](../../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol:52)，但它返回 false 不会主动回滚 token 内部已完成的副作用。首版资产准入必须确认失败不移动余额、成功按精确金额转账、没有 rebase；移动资金后又返回 false 的 token 不准入。

成功转账与新增玩家 payable 必须互斥。新增 `playerPayableTotal` 是聚合债务，不是新增 open-position counter。外部领取同时减少现金和债务；失败领取完整回滚；不得在领取时再次增加已结算 payout 指标。LP 指定 Bank 为领取地址时，效果是把该金额捐回 NAV，应单独断言。

偿付底线为 `B >= PF + XP + exitPayable + playerPayableTotal + R`。Router 分别检查 gross/refund 与分配 cap，并不单独证明每笔 `payoutNet + refund + PF/XP accrual <= reserved`；真实赌场模块与 referral engine 组合必须通过该验收。

### 5. keeper、SDK 和部署身份不是后续可选项

- [keeper finalizer](../../frontend/apps/keeper/src/finalizer.ts:50) 目前跳过 PendingVRF。新实现必须补符合条件的 `refund`、按 Bank 的 batch 推进、漏事件恢复、重启恢复和竞态读回。到期依据合约状态，不能用本机重新启动时间代替 cutoff。
- [GameHub.refund](../../src/core/GameHub.sol:568) 使用可变 timeout，但 timeout 的硬上限是一日。仍处 PendingVRF 的截止前仓位，在 cutoff 加一日后都有退款资格；晚到的有效随机数转入 RandomReady 后走真实 finalize。该资格边界不保证交易打包时间，也不保证一分钟排空。本轮不要求额外逐仓 deadline 账本。
- 最大 betCount、所有模块路径和 referral awards 的最坏 gas 必须实测；VRF callback 的 gas limit 不能当成 finalize 预算。不能为了排空而吞掉合法分配错误或把有效赢家改成退款。
- [SDK maxWithdraw](../../frontend/packages/ssot/src/sdk/create.ts:1538) 目前以 `maxRedeem -> convertToAssets` 推导；新 Bank 必须读取已定价可领资产。`getPosition` 也必须包含已离开钱包的 pending shares 和 claimable assets。
- [Earn](<../../frontend/apps/web/src/app/(product)/earn/pageClient.tsx:315>) 必须区分申请、等待截止/排空、可领和已领。请求和批次 burn 都不是实际提现现金流。LP P&L 不能因 shares 被托管而显示为损失；玩家 settled 也不再保证钱包已经收到 payout。
- [bankIndexer](../../frontend/packages/ssot/src/indexer/bankIndexer.ts:38)、provider ledger 和 bet-index 扩展既有事件处理即可；不要另造通用索引器。不能再仅通过 owner-to-zero Transfer 推断异步提款。
- 复用现有 health/告警路径，加入 Bank/batch/cutoff/drain-age。现有 [healthz-alert.sh](../../script/ops/healthz-alert.sh:75) 的失败投递仍推进 alerted 状态，不能作为新 drain 告警的通过证据；实现需修正并覆盖失败后重试。
- 按 Bank 地址/部署身份识别能力，保留 v1.5 ABI 与同步路径。首版选择保持 `getSSOT` tuple 形状，新增独立 liabilities/batch views。当前仅按 chainId 的 [ABI resolver](../../frontend/packages/ssot/src/abis/release/resolver.ts:23) 和 [ABI drift 检查](../../script/ci/check_bank_abi_drift.py:74) 都需按实际共存方式验收；不能为 CI 把主网旧 ABI 覆盖成新 ABI。
- `DeployV16` 对池统一部署 Bank，发布配置必须约束首版异步池为经过验收的 Casino Hub/模块，覆盖所有指向同一 Bank 的 pool ID。PoolRegistry 现有 allowlist 可复用。旧池停止新风险不应阻断其旧债务终结。
- [当前 v1.6 发布说明](../deploy/v16-release.md:9) 的“Bank ABI 不变”和 [旧审计范围](v1.6-audit-scope.md:47) 的 Bank 排除项在候选实现后必须更新；旧冻结不能证明新 Bank。

## 本次实际执行的验证

未新增或执行攻击脚本。执行的是仓库已有本地测试和独立整数算术检查，未连接 RPC。

```sh
forge test --offline --match-contract '^(BankObservabilityTest|BankGuardianAndTurnoverBoundTest|GameHubE2ETest|GameHubRouterTest|SettlementRouterTest|ContractSizesTest|HouseEdgeAllocationV16Test)$'
# 74 passed。实际 E2E 合约名为 GameHubE2E，因此由下一条单独覆盖。

FOUNDRY_PROFILE=pr forge test --offline --match-contract '^(BankInvariants|GameHubE2E)$'
# 23 passed：15 E2E + 8 Bank 项目。
# 其中 6 项 invariant 各 256 runs / 65,536 calls；另外 2 项为确定性测试。
```

两组没有重叠，共 **97 passed、0 failed**。Foundry 提示历史 invariant failure cache 因 bytecode 已变化而不重放；没有清理缓存，当前结果来自新执行。当前合约大小检查通过，未来新增实现仍必须重新检查 EIP-170。

整数检查覆盖 `V ∈ {1,2,10,100}`、`1 <= S <= 60`、`0 <= N <= 100`、`1 <= Q <= S`，共 739,320 个状态，检查付款不超过 NAV、剩余 LP 比例权益、盈利状态保留虚拟报价以及亏损全额退出得到 NAV。此有限检查辅助上面的代数证明，不是 Solidity 实现验证。

没有声称新赎回、支付失败、keeper 或前端测试已通过：这些功能尚未实现。原 LP 两个反例文件仍是历史缺陷证据，本轮未重跑。

## 实施顺序与退出条件

| 阶段                       | 最小工作                                                                         | 进入下一阶段的证据                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Bank 与标准接口         | 统一 NAV；玩家 payable；托管及授权；两批截止；比例权益定价；领取和标准视图       | 安全回归、成功/失败转账等价、批次/舍入/权限/偿付不变量、代码尺寸通过                                 |
| 2. 赌场端到端              | 真实 Hub/Router/VRF/module 组合；公开退款/终结；暂停、迟到随机数及准入约束       | 全部准入模块的正反结果、部分/全额退款、最坏规模 gas；无合法仓位被留在无法终结状态                    |
| 3. SDK、Earn、索引、keeper | 新旧能力路由；完整 LP 和玩家债权展示；超时退款和批次推进；事件恢复和真实告警投递 | 端到端覆盖 request → cutoff → drain → price → claim，重启/重复调用/漏事件/黑名单收款失败、新旧池共存 |
| 4. 候选冻结及发布评审      | 精确 revision/ABI、更新范围和发布文档；单独处理已延期的 release 认证门禁         | 独立审阅、重新冻结、获授权的 Sepolia 完整批次演练，之后外部审计与发布决策                            |

原两个 LP 反例改为安全断言时，旧版失败必须来自经济行为断言，而不是缺少新函数导致编译失败或 selector 不存在。保留旧证据，并在新实现中通过公开 Hub/Router 路径证明终结前无法取走对应退出款、终结后按确定的价格隔离并领取；不要以一个 `expectRevert` 替代资金归属检验。

当前设计复核建议进入阶段 1。ADR Owner 状态仍为 Proposed，原扫描 finding 状态不变；本记录不代替 Owner/Architect 的正式接受，也不声明任何现有部署已修复。
