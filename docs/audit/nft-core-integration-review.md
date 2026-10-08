# NFT LP 与直接 VRF 结算：核心集成复盘

**证据版本边界：** 本报告保留核心集成阶段的源件证据。当前推荐引擎与部分重复存储正在简化；
下述测试数量和旧 gas 数字不能代表该轮修改已验收。新证据归档于
`dist/referral-simplification-2026-10-04/`。

日期：2026-10-04。基线提交：`d130b4de62218c6b8749bef623f12a59fa7c825b`。
本候选仍为本地未提交修改，未向公共链部署或广播，未重启生产服务。

**真实 Bank/Vault/VRFHub/GameHub 已接通，并通过本地核心验证；尚不具备整站或外部 LP 发布资格。**
本报告只描述核心实现和对应源件的证据。SDK、Earn、keeper 的后续接入见
[应用复核](nft-consumer-integration-review.md)；完整 gas 准入与经济排序评估仍需完成。

本报告的 `dist/nft-core/` 日志与源件清单对应核心集成验证时的文件内容。后续已删除
GameHub 的重复随机数存储，改为查询绑定的 canonical request；零 seed、失败交付、终态和取消
语义及相关核心路径当时重跑 **64/64**。最新的时间戳合并与请求读取去重后，定向核心 **144/144**、
树历史 **38/38** 通过。因此下列原 gas 数字和完整套件结果不能冒充最新实现的重新全跑结果；
最新真实 wrapper 矩阵为 32 次首次完成、4 次重试完成，见
[回调 gas 复核](nft-callback-gas-qualification.md)。

## 1. 本次实现

- [Bank](../../src/core/Bank.sol) 构造唯一不可替换的 Vault。Bank 保存原始投注本金 P、总准备金 R、
  固定的仓位存款截点、PF/XP/PP；[Vault](../../src/core/LiquidityVault.sol) 保存树资本 L 和净锁资 K。
  删除 ERC20 LP、4626/7540、虚拟偏移、批次、epoch、回收权和 active-reserve 双轨。
- Vault 每次入金创建一个 NFT，固定 24 小时；部分提款成功后剩余存款重新计时，转让保留期限。
  到期 owner 可按比例同步提取自由资本；成功退出部分不保留后续盈亏或回收权益。
  LP 提款不启动全池停注，下注容量随资本立即变化。
- [VRFHub](../../src/core/VRFHub.sol) 直接继承锁定版本的 Chainlink ConsumerBase，删除 adapter、自制 extra args
  和生产合成费用模式。实际请求使用 wrapper 原生报价，退费失败保留原付款人的 credit。
- [GameHub](../../src/core/GameHub.sol) 在回调中记录结果并尝试同笔结算。VRFHub 先持久化唯一 seed 和每 Bank
  未记账结果计数，再调用 Hub；终结失败保留原 seed，可公开重试或 finalize，不能重抽。
  seed=0 有效，未知模块错误不再被改成退款。
- Bank/Vault 资金、树、P/R/K、玩家债务、Hub/Router 终态和 VRF ack 位于同一可回滚终结子调用。
  玩家转账失败且余额未变时记 PP；不精确付款、托管资金转移或 ack 失败均不能冒充 PP。
  终结后再次核对双地址现金覆盖，不能隐藏已有 Bank 缺口。
- Router 只允许 Bank 为自身一次绑定 canonical consumer；未配置或读失败时 LP 存取拒绝执行。
  多个已收到未记账结果必须分别完成，不能因其中一个结算就解除整个 Bank 的保护。
- 游戏注册仍是一次性的，新增明确的 `maxBetCount` 和 `callbackGasLimit`。报价与下注使用同一参数，
  不保留旧线性 gas 公式。注册时的数值检查不替代发布前真实测量。

保留 Azuro 三个原文件逐字节不变，来源、许可和哈希见 [vendor](../../src/vendor/azuro-v3/README.md)。
原型 Bank、原型 VRF 和阶段 0 中间托管实现已删除；经济对照搬到真实 Bank 测试。
留下的 wrapper/token/mock Router 用于外部边界和故障注入，不是可部署兼容方案。

## 2. 核心验证

正式仓配置：Solidity 0.8.37、Cancun、viaIR、optimizer 500。

```sh
forge test \
  --match-path 'test/unit/{AzuroTreeProperties,LiquidityVaultAdversarial,BankNFTAccounting,VRFHubDirect,NftCallbackIntegration}.t.sol' \
  --fuzz-runs 1024 --ignored-error-codes 6335 -vv
```

本次合跑 **116 passed、0 failed、0 skipped，21 个 suite**，日志 `core-integrated.log`。
另独立组合复核 **4/4 通过**，日志 `accounting-composition-review.log`。
通用 unit/diff 最终回归 **206/206 通过**，其中已包含这四项独立组合测试，fuzz 为 256 组。
Router/Sports/Bank 的 **14 项 invariant** 均以 256 runs × 500 depth 通过；NFT 转让有非空执行轨迹。
部署测试修复旧字段及治理目标索引后，按最终版本完整重跑 **24/24 通过**。
因此该源件清单对应的非 fork Solidity 证据覆盖 **360 个不同测试**，没有重复累计独立组合复核。
初跑失败和后续修复日志分别保留，不能将初跑改写成全绿。日志统一归档于 `dist/nft-core/`。

| 文件                                                                                   | 数量 | 主要边界                                                                  |
| -------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------- |
| [AzuroTreeProperties](../../test/unit/AzuroTreeProperties.t.sol)                       |   20 | 源件哈希、40 层分叉、范围/fallback、lazy 状态、高数值与计数器             |
| [LiquidityVaultAdversarial](../../test/unit/LiquidityVaultAdversarial.t.sol)           |   33 | NFT 授权/冷却/转让、报价、重入、精确收付、读取失败                        |
| [BankNFTAccounting](../../test/unit/BankNFTAccounting.t.sol)                           |   18 | 真实 Bank/Vault 双托管、PF/XP/PP、资本上限、128 名额、现金缺口、经济对照  |
| [VRFHubDirect](../../test/unit/VRFHubDirect.t.sol)                                     |   16 | 原生费/credit 守恒、请求绑定、防覆盖、零 seed、重试、ack/cancel、恶意回调 |
| [NftCallbackIntegration](../../test/unit/NftCallbackIntegration.t.sol)                 |   29 | 真实核心链、八玩法、九笔推荐奖励、失败原子性、gas 和退款竞态              |
| [NftAccountingCompositionReview](../../test/unit/NftAccountingCompositionReview.t.sol) |    4 | 多 Bank、多结果计数、治理不能绕保护、截点与跨合约权限                     |

上述五文件中的四项 fuzz 各运行 1,024 组：树性质两项、Vault 报价一项、Bank 守恒一项；
此外 VRF 费用 fuzz 也运行 1,024 组，每组八次请求。树序列 fuzz 每组 32 步。
`6335` 仅过滤依赖编译诊断，不跳过测试或忽略失败。

Bank runtime **15,948 bytes**；creation 加五个构造参数 **33,594 bytes**。
Vault runtime **15,185 bytes**，creation **16,400 bytes**（不含两个构造参数）。
测试中的巨型 fixture initcode 警告不能当作这些生产合约的尺寸；真实生产尺寸另有断言。

## 3. 会计边界与经济结果

```text
Vault cash = L + surplus_Vault
Bank cash  = P + PF + XP + PP + surplus_Bank
K = R - P,  0 <= K <= L
G = L + P
NFT free capital = L - K
```

投注本金不提高 NFT 账面资本；每笔终结仅分配 `stake - (payoutNet + refund + PF_new + XP_new)`。
玩家后续领取 PP 不再扣树。意外转入不自动增加资本或奖励新存款人。
Bank 保留原下注风险比例规则；LP 提款只受 L−K 和状态/期限约束，不叠加 PF/XP 的可选出金缓冲。

以下是执行过的经济见证，**不是已经修复的漏洞或线上攻击**：

- Alice/Bob 各存 1,000，旧仓本金 100、最大支出 500，实际支出 500。
  都留存时各剩 800；Alice 的成熟 NFT 在结果入账前提走 1,000 后，Bob 最后剩 600。
  已知链上 seed 保护无法识别入链前的信息或排序优势，24 小时冷却不能消除这种收益转移。
- 旧 LP 全退且净锁资为零后，Bob 在旧利润入账前新存 50，旧利润 100 可经空 prefix fallback
  使其余额变为 150，自己的冷却期限仍然保留。没有新资本时，空树正收益明确记为协议资本。

成熟 NFT 交易、链上结果公开前的排序与上述分摊规则，仍需在接纳外部 LP 前给出明确取舍和披露。
这些测试通过只说明代码遵循当前选定规则，不构成“经济模型无风险”结论。

## 4. 真实核心回调 gas

使用实际 Bank/Vault/VRFHub/GameHub/Router、八个玩法和推荐引擎。wrapper 传输与 USDC-like token
仍为本地模型；具体方法见 [回调测试说明](../../test/helpers/nft-callback/README.md)。

Base Sepolia 区块 47,638,466 的 provider 参数给出 consumer 上限 **2,447,746 gas**。
VRFHub 在下游调用外留 45,000 加调用余量，GameHub 在终结子调用外另留 25,000。
不得拿 coordinator 的整个 2.5m 直接当作 consumer 预算。

| 独立冷交易案例                              | 轮数 | 成功诊断调用 gas | 实际受限调用 |
| ------------------------------------------- | ---: | ---------------: | ------------ |
| Coin Toss                                   |  100 |        2,130,406 | 成功样例     |
| Dice                                        |  100 |        2,156,780 | 成功样例     |
| Roulette                                    |  100 |        2,140,895 | 成功样例     |
| Slots                                       |  100 |        2,258,895 | 成功样例     |
| Sic Bo                                      |  100 |        2,299,404 | 成功样例     |
| Baccarat                                    |   50 |        2,261,416 | 成功样例     |
| Baccarat                                    |  100 |        2,465,800 | 超预算       |
| Plinko                                      |   50 |        2,313,614 | 成功样例     |
| Plinko                                      |  100 |        2,609,100 | 超预算       |
| Keno                                        |   25 |        2,246,894 | 成功样例     |
| Keno                                        |   50 |        2,451,089 | 超预算       |
| Keno                                        |  100 |        2,883,776 | 超预算       |
| Dice，黑名单赢家记 PP                       |  100 |        2,195,498 | 成功样例     |
| Keno，17 个旧 NFT、此前部分提款、8 个新 NFT |   25 |        2,283,440 | 成功样例     |

主样例为 16 旧 NFT、8 后入 NFT、9 笔推荐分配、seed 12345。
受限调用确实成功终结才标为成功；6m 诊断调用只测超过上限时的工作量，不是可用网络配置。
测量围绕 exact-gas consumer CALL，非整笔交易、proof 或计费 gas。
48 格同测试内写存储筛查不等于独立冷交易，`vm.cool` 不会重置 EIP-2200 原值。

**当前只证明部分配置不能准入，尚未证明表内成功样例就是最坏情况上界。**
必须继续覆盖真实 token/wrapper、玩法参数与 seed、分散树和 lazy 历史，再确定每游戏最终轮数与 gas。
正常回调已知超预算的配置不能依赖 keeper 兜底后被宣布合格。

## 5. 真实 wrapper / USDC 本地 fork

[NftDirectWrapperFork](../../test/fork/NftDirectWrapperFork.t.sol) 在 Base Sepolia 固定区块
47,638,466 实际 **4/4 通过，0 skipped**。使用已部署 wrapper、coordinator 请求与 commitment、
USDC 代理，部署本候选核心合约至本地 fork；没有发送网络交易。

开仓放入 setUp，Foundry 提交该状态后在独立 test 交易进行 callback，避免 dirty-slot 低估。
单轮 CoinToss、单 NFT、无推荐奖励：真实 wrapper 调用段赢 **1,248,281 gas**，输 **1,063,716 gas**；
失败交付 **83,624 gas** 后仍保留首个 seed，重试成功。覆盖真实 token 双托管、玩家赔付、
树利润与成熟提款、actual gasprice 原生收费/退款及费用不足的整笔回滚。

显式五项 fork 目标、consumer gas 改为 2,000,000 后另跑 **4/4 通过**；仍是同一个历史区块，
不增加测试数量，也不是当前发布资格。缺一项参数时按预期拒绝。
默认未启用时明确标记 SKIP。发布脚本启用测试、采用签名 snapshot 的目标与治理验证的
新鲜区块，并拒绝四项未全部实际执行的结果；结束后再核对治理区块 hash，发生重组就整轮拒绝。
gate 本身另有五项入口测试，覆盖 skip、目标替换、旧架构、治理失败和重组。

此处注入本地测试余额并 impersonate coordinator 完成回调，**不验证 VRF proof、coordinator
fulfillment 计费、服务可用性、延迟或所有游戏的最坏 gas**。

## 6. 发布认证与回归证据

部署、snapshot、digest、manifest、ABI 导出和验证器使用唯一 NFT 架构。每池必须包含 Vault
身份，签名绑定游戏轮数和 callback gas；删除 adapter 和 LP share precision 字段。
部署模板要求逐游戏显式填写已验证参数，尚未填写的是发布前置条件，不是假定的生产默认值。
前端 source-only ABI 已更新到当前合约，SDK/UI 接入已完成本地验证；
embedded 仍不包含新公共链部署。应用证据见 [应用接入复核](nft-consumer-integration-review.md)。

- 发布工具局部 **38 项通过**，fork gate 入口另 **5 项通过**。
- 真实本地 Anvil 部署、签名和导入的 **9 个唯一场景通过**，包括字段/签名篡改、治理未接受、
  路由变化、导入拒绝时保留现有文件。首次有一个诊断失败：将 accepted 部署快照用于另一个
  pending 部署，先命中 Safe code mismatch；改用其本身签名包后，诊断路径又触发 Foundry
  文件读取权限。最后将诊断材料放进允许目录，精确验证了 governance not ready。
  两次都未放宽生产校验，失败与重跑日志全部保留，重跑不重复计数。
- 暂停且零余额的新本地部署通过实际 `release-readonly-smoke.mjs`，涵盖 Vault 互绑、双托管
  SSOT 和八游戏的 quote/admission。这个 smoke 不代表有仓位、真实 Safe 执行或整站验收。
- 变异目标已替换为当前规则；31 个锚点均存在。新增 NFT/VRF 的 **9/9 变异被测试断言抓住**，
  执行前 96 项基线全过，没有将编译失败当作抓住变异。所有输入已逐字节恢复。
  分类器自身四项测试也通过。其余 22 个未在本轮实际重跑，不能将锚点检查说成 31 个变异都通过。

## 7. 剩余交付边界

1. 继续发布资格验收和剩余 mutation。旧 ERC20/批次测试、旧 recovery Python 模型和部署历史操作记录
   已删除；核心与应用分别按实际执行范围记录证据。
2. 真实 wrapper/USDC 单轮 fork 已通过，继续完成最坏输入 gas 准入；固定调用参数后再冻结 ABI/发布配置。
3. SDK、Earn/NFT 索引和 keeper 已切到唯一新接口并完成本地联调，详见应用接入报告。
   gas 未准入，仍不能拿此候选部署整站。
4. 完成独立/外部审计、外部 LP 经济排序决策和用户另定峰值后的容量验收。
5. 最后才生成全新候选并进行用户控制的签名、部署与线上验证。

本地核心与应用通过和正式发布是不同结论；两份报告均不替代外部审计，也不声称公共链部署已经验证。
