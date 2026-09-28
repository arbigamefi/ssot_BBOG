# ArbiGameFi 技术白皮书

本文描述当前 v1.6 设计及异步 LP 赎回。**项目尚未上线。** 源码、测试和文档不构成部署或外部审计完成的证明；发布身份和验收要求见[发布说明](release/README.md)。规范以 [SSOT v1.6](constitution/SSOT.v1.6.md)、[可执行规范](constitution/ExecutableSSOT.v1.6.md)、[ADR-0034](adr/0034-async-lp-redemption-continuous-betting.md)和 [ADR-0035](adr/0035-recovery-rights-without-exit-blocking.md)为准。

商业定位见[商业白皮书](WHITEPAPER.product.zh-CN.md)，首次了解见[项目简介](ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md)。本文供技术尽调、审计和集成人员判断资金机制及其信任假设。

## 1. 资金与业务分层

| 层                           | 职责                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| Bank                         | 单资产托管、LP 份额、头寸预留、协议与奖励债务、退出与玩家债务    |
| SettlementRouter             | 将头寸绑定到原始 hub、Bank、资产及玩家；校验终结身份、次数与金额 |
| PoolRegistry                 | 定义池和业务域，授予 hub 对指定池的准入                          |
| GameHub / VRFHub / 模块      | 固定投注输入，请求和保存随机数，执行确定性游戏与分配             |
| SportsHub / SportsRiskEngine | 固定赔率票据、事件敞口、结果证据及争议生命周期                   |

Bank 不判断开奖结果；授权 hub 仍可能在金额边界内提交错误结果。因此规则、随机数链路和 hub 准入是资金安全模型的一部分。Casino、sports 及不同资产分别承保，不存在自动跨池赔付承诺。

参考：[Bank](../src/core/Bank.sol)、[SettlementRouter](../src/core/SettlementRouter.sol)、[GameHub](../src/core/GameHub.sol)、[SportsHub](../src/core/SportsHub.sol)。

## 2. 账本与偿付

在同一链上状态下，定义实际余额 B、协议应付款 PF、全部奖励应付款 XP、固定 LP 退出债务 X、玩家欠款 PP、历史回收资金 P 和当前期准备金 Ra：

```text
活跃 NAV = B - PF - XP - X - PP - P
B >= PF + XP + X + PP + P + Ra
活跃 NAV >= Ra = activeReserved
全部准备金 totalReserved = Ra + 历史各期剩余准备金
```

XP 包含可领、锁定及 holdback。P 同时覆盖历史未终结风险和已经释放但尚未领取的回收款，不能仅用历史准备金替代，也不能再重复扣除其中的准备金。支付已记债务时，现金与负债等额减少；授权向 Bank 自身领取是另行标识的捐赠。

`totalAssets()`、`getSSOT()`、新风险检查和份额转换使用同一活跃 NAV。riskReserve 限制新增承保，withdrawalBuffer 限制协议和奖励可选出金。固定 LP 领取、已释放回收款与玩家欠款不按该缓冲缩减金额；紧急暂停仍能阻止 LP 付款。

资产准入要求精确转账、不 rebase，失败转账不得先改变余额再返回失败。发行方冻结或暂停仍可能使支付不可用；符合单位和 decimals 不能证明代币具备这些语义。

## 3. House edge 与 LP 权益

按资产最小单位整数计算，S 为投注本金，Q 为未使用本金退款，G 为规则毛派彩，h 为接受时固定的有效 edge：

```text
U = S - Q
F = floor(G × h / 10000)
玩家净派彩 N = G - F
流水 edge E = floor(U × h / 10000)
运营预算 O = floor(E / 2)
LP 保留 = E - O
PF_new + XP_new <= O
```

LP 固定保留 50% 的流水 edge，运营方从另一半支付协议费用、玩家返水及推荐奖励。`DefaultReferralEngine` 的基础推荐比例合计不超过基础 edge 的 35%；加价奖励也受运营预算约束。缺失推荐人与推荐舍入余数归协议。纯退款不产生分配。详见 [ADR-0032](adr/0032-fixed-lp-share-operator-funded-referrals.md)。

F 与 E 不是同一计量基数。F 留在本局游戏损益中；PF 和 XP 按 E 的运营预算计提，即使该局没有派彩。Router 使用自己的开仓记录执行上限，不依赖 hub 自报预算；还检查 `N <= G`、`Q <= S`、`G + Q <= reserved`。玩法准入须证明预留覆盖所有正常支付、退款和新增债务，且全额退款路径要求预留不低于本金。

仅计玩法、未计出入金及另行归属的虚拟资本残值时，资本变化为 `U - G + F - PF_new - XP_new`。公平毛赔付且忽略整数误差时，LP 理论期望约为有效流水 edge 的一半。这不是固定本金收益：有限样本可亏损；提前停止需要分析实际流水与结果的联合分布。

基础 edge、加价和推荐版本受当前合约的上限及变更规则约束。投注接受时固定的经济输入不因后续配置变化而重写。具体费率和资产范围由最终发布配置确定，本文不提供已上线参数。

## 4. 即时存入与异步退出

### 存入

设 T 为真实份额总量，V 为 `10^assetDecimals` 的虚拟偏移：

```text
deposit shares = floor(assets × (T + V) / (NAV + V))
mint assets = ceil(shares × (NAV + V) / (T + V))
```

存入者参与当前活跃期的未结算风险，不取得已封存历史期的回收权。虚拟偏移不能充当真实资产；零份额存款应拒绝。账面价值不是随时可提金额。

### 请求与按期隔离

`requestRedeem` 托管 owner 份额并把当前请求权交给 controller。请求合并到一个等待队列，在实际激活前可取消，即使最早日期已过。owner、获授权 spender 或 owner 的 operator 可申请；取消和付款由 controller 或其当前 operator 控制。Bank 托管地址不能成为 controller，普通转账或 mint 不能直接给 Bank 份额。

每次 `activateBatch` 固定当前活跃净值 N、真实份额 S、完整旧期准备金 R0，以及所有当时持有人的历史权利，包括留存者和申请者。R0 全部隔离，申请份额烧毁一次，可支取现金立即定价，下一期开始。旧期永久未结也不阻止下一期退出或有足额资本的新投注。每笔旧投注只属于一个历史期，结算不遍历全部期或全部用户。

设 V 为虚拟偏移，C 为该旧期累计实际成本，R 为其剩余准备金：

```text
G(x) = min(floor(S × (x + V) / (S + V)), x)
L = N - R0
批次现金 = floor(申请份额 × G(L) / S)
D = R0 - C - R                    已安全释放的现金
H = G(L + D) - G(L)               原真实持有人的累计回收
U = D - H                        虚拟资本残值
持有人累计回收 = floor(快照份额 × H / S)
本次可领取 = 累计回收 - 已领取
```

每笔实际成本包括玩家净派彩、退款、玩法 PF 和全部 XP，不能超过原预留。转账失败记为玩家债务也在终结时计成本，后来支付不重复扣账。已经完成的仓位可释放回收，不必等待同一期另一笔卡住的仓位。不能逐次对小额增量舍入；新入金、转账和全部份额退出都不改写旧回收权。

U、全退出的液态虚拟残值和最终历史分配尾差按 ADR-0035 归协议资本，单独记录，不算玩法 PF 或额外 house edge。部分退出不提前扣除全部留存者的液态残值。全部原持有人领完之前，尚未分配的资金不能被当作尾差。

### 两类领取

`withdraw` / `redeem` 领取已定价批次现金；标准 claimable/max 只包含这部分。历史 `claimRecovery(epoch, receiver, controller)` 是独立权利，普通份额已为零也可继续存在。零现金的普通 redeem 可以清理其 claim units，不会放弃历史回收。

Controller 的批次现金按份额向下分配并汇总。部分 withdraw 不得耗尽 claim units 却留下资产。`syncRedeem` 与 `syncRecovery` 允许任何人执行账本整理，但不转账、不改变受益人；暂停期间也可执行。实际 LP 付款由 controller/operator 授权，并受暂停约束；失败付款保持权利。网站不要求给 keeper operator 权限。

SDK 在同一区块读取账本和历史分页，不能只为提交过退出请求的人发现回收。页面区分可领现金、仍有风险的未来上限、未完整扫描的历史。没有全额现金到账期限：如果所有资金都背负未终结风险，可领现金可能为零，但不能永久折价抹掉后续回收权。

## 5. 玩家结算与支付证据

Casino 状态从 PendingVRF 到 RandomReady，再到 Settled。等待随机数的投注满足条件后可退款；RandomReady 按已接受规则终结。VRF 回调只记录随机数，资金结算另由公共 finalize 推进。规则参数长度在接受时限制为最多 64 字节，使准入范围和资源预算可验证。

Bank 尝试给玩家转账；失败则完整记录 playerPayable 并释放预留，使已接受头寸能终结。内部转账 OOG 也可能形成欠款；若整笔调用没有足够 gas 完成记债及终态则全部回滚。不能把获胜权利改成退款来完成退出定价。成功支付与新增同额欠款互斥。

任何人可触发玩家欠款领取，但始终付给玩家本人。领取失败保持债务。Bank 暂停不阻止已有投注结算、退款或玩家欠款领取；暂停会阻止新风险、存款、批次激活、LP 现金与回收领取及 PF/XP 可选出金。

收据分别证明终态金额和支付方式：已转账、已记欠款，或证据不足。终结时记录的欠款是历史事实，不能据此推断目前仍未领取。VRF 多付退款 credit 是单独的原生资产账本，不等于 Bank 玩家欠款。

## 6. 体育与信任边界

Sportsbook 规划为赛前固定赔率单关和独立资本。票据固定赔率、市场版本、期限、nonce 与风险参数；授权签名不证明现实结果真实。数据来源、报告门槛、挑战角色、裁决和作废规则必须独立验证。详见[体育路线](strategy/sportsbook-production-roadmap.md)。

Bank 的首期准入仅限具备已验证终结路径的 casino。体育缺失结果和长期争议的期限机制完成前，不准入这些 Bank。不能将 VRF 的恢复条件直接套到体育。

治理可以控制准入、允许的参数与暂停；多签不消除这些权限。代币发行方、随机数提供方、hub 及模块正确性、节点可用性和有人支付推进交易 gas 都是依赖。Keeper 只推进公开状态，不具有结果决定权或 LP 领取授权。

## 7. 可核对路径

固定链、区块、发布身份、Bank、Hub 和资产，读取 B、全部应付款、R 和份额，再核对 NAV 与偿付。用投注记录、随机数、规则输入和分配事件重算结果；以实际支付或欠款事件核对收据。Deposit/Withdraw/RecoveryClaimed 是需核对的 LP 现金流水，请求、同步和批次烧毁不算现金退出。捐赠单独识别。

验证须同时覆盖权限、跨批次舍入、零资产、取消边界、重组和重启、转账失败、最大准入工作量及未终结状态。测试结论应限定到实际场景和配置。只有新部署的身份、参数和运行证据连接起来，才能判断具体实例能否开放使用。

## English abstract

ArbiGameFi is an unlaunched wallet-native casino and sportsbook project. Banks account for assets, LP shares, reserves and payables. Casino gameplay allocates half of turnover house edge to LP capital. Deposits are immediate. Each redemption activation prices liquid cash and segregates its epoch's complete old reserve, preserving recovery rights for every original holder. Later bets and exits operate on active capital without waiting for old epochs. Recovery uses the same virtual-offset and real-equity constraints; released cash remains owned even after all active shares exit.

Failed player transfers preserve fully backed player payables and terminalization. Cash-flow indexing distinguishes actual liquid withdrawals, recovery payments and donations. A permanently unresolved position retains its own backing without gating later exits; full cash payment by a deadline is not guaranteed. Protocol capital residuals are distinct from gameplay fees. Sports admission and external audit remain independent gates. Source and local tests do not establish deployment acceptance.
