# ArbiGameFi 项目与商业白皮书

> AGF-WP-BIZ-2026.10-r5 · 2026-10-12 · 中文，附英文概要 · 内部审阅稿，尚未对外发布
>
> **首要读者**：战略伙伴、渠道决策者、专业资金合作方；有融资情境时的项目投资者
>
> **读后决策**：是否值得进一步尽调、讨论合作或投入资源
>
> **项目尚未正式上线。** 已采用每次入金生成存款 NFT、固定 24 小时锁定、LiquidityTree 分配与 VRF 回调同笔尝试结算。核心合约及 SDK、Earn、keeper 接入已实现并完成对应版本的本地验证。完整回调 gas 资格、新部署网络验收和外部审计尚未完成；此前端到端结果不代表后续源码已重新全跑。本地测试不代表真实用户、营收、资本承诺、机构背书或牌照。机制见[技术白皮书](WHITEPAPER.zh-CN.md)，新部署验收见[测试网清单](deploy/v16-sepolia-acceptance.md)，当前状态与发布条件见[发布说明](release/README.md)。

## 摘要

ArbiGameFi 建设单品牌、钱包原生的 casino：玩家用自己的钱包参与，规则、费用、随机数、结算与支付都可以在链上核对。首期聚焦 Base 网络与 USDC，面向已经熟悉 EVM 钱包与稳定币、重视支出透明度的成年人。

- **差异**：投注资金由合约而非平台账户托管；结果使用可验证随机数；LP 固定获得每笔流水 house edge 的一半；LP 以存款 NFT 持有资本，固定 24 小时后按可用流动性提款；成功退出部分不再参与后续结果，正常提款不设置计划性停注。
- **收入**：来自按实际流水计算的 house edge。另一半支付推荐、玩家返水与协议费用。
- **现状**：NFT 账本、回调结算核心及 SDK、页面、keeper 接入已实现并完成对应版本的本地验证；完整回调 gas 资格、新部署验收和外部审计尚未完成。
- **尚未证明**：真实需求与回访、单位成本、合规路径和规模化的资本供给。
- **正在寻找**：渠道与内容合作、专业 LP 与服务伙伴，以及帮助完成审计与合规准备的资源。

## 1. 项目命题

线上博彩用户最常见的疑问有三个：钱在谁手里，结果是否公正，费用到底是多少。ArbiGameFi 的回答是把这三件事放到链上。投注由智能合约托管并按公开规则结算；随机数由第三方可验证服务提供；house edge、推荐分配与每一笔支付都有可核对的记录。

娱乐体验仍是产品核心。可核对性是信任基础，不能代替好玩的游戏、顺畅的钱包操作和可靠的服务。项目的品牌工作句是：**用自己的钱包参与游戏，看清每一次投入与结算。**

## 2. 目标客户与市场假设

| 假设中的首批用户                                      | 他们需要什么                                 | 需要的证据                           |
| ----------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| 持有 EVM 钱包与稳定币、所在地允许参与博彩娱乐的成年人 | 熟悉的玩法、清楚的总成本、可核对的结果与支付 | 完成率、放弃原因、无补贴的自主回访   |
| 以稳定币计价、重视资金透明度的小额与中额玩家          | 不必把余额长期存放在平台账户                 | 实际使用金额分布与各玩法的成本承受度 |
| 能够带来上述用户的内容创作者与社区                    | 清楚、可核对、按实际贡献结算的推广收益       | 可归因的有效使用、回访与贡献         |

首期只做 Base 与 USDC，以集中资本、流动性与服务资源。更多链与资产不能代替经营验证。

本文暂不给出市场规模数字：带日期、来源可查的外部研究尚未完成。研究计划与验证指标见 [GTM 计划](strategy/go-to-market.md)，结论出来之前不以"巨大市场"之类的表述代替证据。

## 3. 用户现有的选择与我们的差异

下表是我们对几类替代方案的判断，属于需要逐项验证的假设，不是对具体竞品的评价。

| 维度       | 托管式加密博彩平台           | 传统持牌在线博彩     | ArbiGameFi                                   |
| ---------- | ---------------------------- | -------------------- | -------------------------------------------- |
| 资金       | 充值到平台账户，由平台记账   | 由受监管的平台托管   | 投注期间由合约托管；结算后直接支付到玩家钱包 |
| 结果       | 通常依赖平台自证的公平性机制 | 依赖监管与第三方认证 | 每局随机数与规则输入都在链上，可独立重算     |
| 费用       | 通常不透明或只在规则页披露   | 按产品披露           | 每局 edge 在接受时固定，并在界面与收据上列明 |
| 资本来源   | 平台自有资金                 | 平台自有资金         | LP存款NFT、树权益与负债全部公开              |
| 准入与合规 | 因平台而异                   | 严格的身份与地域管理 | 上线前须完成合规方案（§8）                   |

我们需要证明的差异有三项：可核对性确实影响用户的选择；钱包原生的操作成本在可接受范围内；透明披露收益与排序风险的 LP 规则能吸引资本。三项中任何一项不成立，都要调整定位，不能靠宣传弥补。

## 4. 产品组合

- **Casino**：Dice、Coin Toss、Roulette、Keno、Plinko、Sic Bo、Slots 与 Baccarat 八种玩法，支持多局连投与止盈止损。每笔投注都有报价、钱包确认、等待状态和收据。直接转账失败的款项记为玩家应付款，keeper 公开重试领取；发行方限制等情况仍可使付款失败。收据分别说明结果与实际到账方式。目标是随机数回调同笔尝试结算，失败保留原随机数补结算，不把重抽结果作为恢复方法。
- **LP 资金池**：LP 为指定资产的资金池提供赔付资本，持有每次入金对应的 NFT，按树分配规则参与盈亏。
- **推荐与推广**：两级推荐与玩家返水，全部由运营方预算支付，不占用 LP 的固定分配比例。

首期不依赖平台代币、白标业务或跨链资金共担。

## 5. 收入模型与单位经济

每笔投注按实际使用流水计算理论 house edge。**LP 固定保留一半；另一半是运营预算，用于两级推荐奖励与玩家返水，其余为协议收入。** 推荐与返水合计不超过该笔 edge 的 35%，玩家没有推荐人时这部分归协议。LP分配比例是合约常量，不随渠道变化。

**演算（示例参数，非上线配置）。** 流水 1,000 USDC，有效 edge 2%：

| 分配               | 有两级推荐人 | 无推荐人 |
| ------------------ | -----------: | -------: |
| LP                 |      10 USDC |  10 USDC |
| 玩家返水（L0）     |       2 USDC |        0 |
| 推荐奖励（L1／L2） |  4 ／ 1 USDC |        0 |
| 协议收入           |       3 USDC |  10 USDC |

这些是有LP资本时的理论值；若旧投注结算时全树已空，正收益按规则归协议资本，不补发给已退出NFT。单局结果使 LP 的实际盈亏大幅波动，理论 edge 只在大量投注中体现，也不代表收入已经收到现金。

**成本由谁承担**

| 成本                                       | 承担方                                    |
| ------------------------------------------ | ----------------------------------------- |
| 投注交易 gas、随机数请求与正常回调结算费用 | 玩家，报价中单独列出；新 gas 参数须实测   |
| 异常补结算、超时退款与玩家应付款代领的 gas | 提交交易者；keeper 使用运营方原生资产预算 |
| RPC、索引、监控、客服与维护                | 运营方                                    |
| NFT 入金与到期提款交易 gas                 | 发起交易的 LP                             |

协议收入以池资产计价，keeper 主要消耗原生资产，二者分开管理。补贴须有资金来源、额度与期限，不能侵占 LP 资金或已成立的用户债权。若在可接受的最小投注金额下，玩家成本过高或资本补偿不足，就调整范围与成本，而不是扩大宣传。经济模型的计算与校准见[经济设计](strategy/economic-design.md)。

## 6. 资本与 LP

资金池的规模决定能接受多大的投注：每笔投注在接受时都要预留最大赔付。新部署默认按 LP 资本加全部
未结投注本金的 60% 保留下注风险缓冲，其余部分扣除已有准备金后才能接新注。资本越充足，可承接的
投注越大。这个比例不额外限制 LP 提款；成熟 NFT 仍按自身余额和全池自由资本提款。

LP 的收益来自那一半 house edge，但同时承担：

- 游戏结果带来的盈亏与尾部风险；
- 资金被准备金占用的时间成本；
- 合约、资产与治理风险。

LP 存款 NFT 不是公司股权，不附带代币权利，也不是固定收益产品。

**进出规则（已实现并本地验证，发布资格待完成）**

- **每笔入金一份存款 NFT**：LP 资产直接进入独立的 LiquidityVault；每次入金均创建新节点和新 NFT，固定锁定 24 小时，不向旧 NFT 增资。Bank 单独托管投注本金与负债，未结本金不会直接变成 LP 利润。
- **到期提款**：只允许当前 NFT owner 发起并收款。成熟后在自身节点金额和全池自由资本范围内，同笔扣账到账；部分提款成功后余值重新锁定 24 小时，全部提款销毁 NFT。成熟的空余额 NFT 也可销毁，零比例和取整为零的部分提款拒绝。
- **转让**：NFT 转让沿用原期限，受让人取得该存款的权益。NFT 授权允许他人转走 NFT，因此具有资金风险；官方提款流程不要求授权 NFT 给 keeper 或其他 operator。转让不是现金入金，不能把继受人取得 NFT 直接算作收益。
- **退出后**：已提走资本没有后续盈亏或回收权。不存在每日批次、请求队列或再次领取。旧投注结算时，若开仓记录范围的当前资本足以覆盖该仓位原始最大 LP 亏损，利润与亏损都分给该范围；否则都分给当前全池。零风险仓位保留原范围及空范围回退，空树利润按下述协议资本规则处理。因此新 LP 也可能取得或承担旧投注结果。
- **额度**：LP 资本 L 是树根，净锁定 K 是 Bank 最大准备金 R 减未结本金 P。自由资本为 `L−K`，不再叠加 LP 出金缓冲；节点成熟不保证池子一定有足够自由资金。K=0 时，即使有旧投注未结也可在其他条件允许时全退；之后空树产生的利润归协议资本，不重建旧 LP 权利。
- **下注与异常**：正常提款不停止接注；资本减少会缩小下注能力，L=0 禁止新注。随机数已保存但结果未入账时，该 Vault 入金和提款暂缓，先按原结果补结算。若结果始终无法入账，公开重试不保证恢复；请求后满 24 小时（作废窗口内）或满 7 天，任何人可将其作废，本金退还为玩家应付款、VRF 原生费不退、不重新开奖，作废前该池 LP 操作暂缓。账务类故障不在作废范围内。不能承诺所有存款在固定时间内均可全额兑付。

**专业 LP 的核对口径**：L 读取 LiquidityTree，下注偿付基数为 `G=L+P`；原有下注比例规则仍使用 G。页面按每个 NFT 显示节点价值、解锁时间和当前可提额度，不再展示统一份额价格。捐赠形成的多余余额独立诊断，不自动变成树收益，也不提供新的提取接口。

**已接受的排序取舍（2026-10-04）**：结果尚未记录且其他检查允许时，成熟 NFT 可提走自由资本；已退出部分不再参与以后入账的旧投注损益，留存 LP 按树与回退规则承担。旧范围为空或不足时，后入资金也可能获得旧利润或承担旧损失。项目 Owner 已明确接受并保留这一模型，这是风险接受，不是风险修复。24 小时锁定及结果记录后的门禁不消除记录前的条件排序优势，本地见证也不证明真实 VRF 可提前预测；不宣传资本排序公平。

**H-1 分配修正**：结算时旧范围资本至少覆盖该仓位原始最大 LP 亏损时，两侧结果都归旧范围；否则两侧都归当前全池（零风险仓位保留原空范围规则）。这修正了无需预知结果的薄前缀套利，不撤销上述信息排序风险披露，也不承诺只转移波动而不改变预期收益。

采用的 40 层树会增加执行成本，完整回调与最坏分配路径仍须通过 gas 资格；合约硬上限为 25 轮，USDC 每轮最低 0.01，25 轮本金为 0.25，不设额外的单仓总本金门槛。风险披露、完整集成、新网络验收与独立审计仍是外部 LP 放行条件，不提供 APY、回本期或本金保护承诺。

## 7. 分发与增长

推荐体系仅包括玩家返水（L0）与两级推荐奖励（L1、L2）。推荐关系首次绑定后不可更改；每笔投注接受时固定收款人和分配比例，推荐关系不会改变玩家的 house edge。house edge 的调整均须等待 7 天。奖励金额由接受时的配置决定；Bank 的领取流水门槛与新建 holdback 释放期限仍读取当前配置。这些成本全部来自运营预算，因此渠道扩张不会稀释 LP 分配比例。

增长按"先验证、后扩张"推进：

1. 在限定范围内观察真实使用，区分测试资金与真实资金、补贴与非补贴用户；
2. 以可归因的有效使用与回访评估渠道，比较它们的实际成本；
3. 只有在玩家成本、LP 风险、服务能力与渠道贡献都支持时，才扩大受众与资本。

钱包地址不等于独立的自然人，流水、钱包连接数与访问量都不能直接当作需求或利润。指标与实验设计见 [GTM 计划](strategy/go-to-market.md)。

## 8. 合规与市场准入

各司法辖区对博彩娱乐的监管差异很大。本项目**尚未取得任何牌照，也未确定运营主体与目标辖区**，本文不作任何合规声明。

网站目前已有以下措施，但都只在用户界面层提示，数据存放在浏览器本地，**尚未在服务端或链上强制执行**：

- 年龄、所在地责任与条款确认门禁；
- Cookie 同意；
- 负责任博彩工具：现实提醒、最长 180 天的自我排除、每日充值与亏损限额设置。

上线前必须完成：

- 法律意见、运营主体与目标辖区的确定，以及受限辖区清单；
- 服务端的地域封锁与制裁名单筛查，以及限额的强制执行；
- 用户条款与隐私政策。条款须写明：投注因合约缺陷无法结算时，由运营方以协议收入补偿玩家；
- 与牌照要求相适应的身份核验与反洗钱安排。

合规方案未落实之前，不开放真实资金服务。

## 9. 执行与路线

当前建设与验收顺序如下（详见[路线图](roadmap.md)）：

1. 玩家规则、收据与异常恢复，Bank／Vault 分工、NFT 树账本和回调结算已实现并完成对应版本的本地验证；
2. 完成每轮最低 0.01 USDC、最多 25 轮下的完整回调 gas 资格及容量评估；
3. 在最终源码和新部署上重新验收 NFT 进出、真实支付、异常恢复、keeper WS/HTTP 补漏与告警；
4. 落实已接受排序风险的公开披露，完成外部审计、合规方案与限定环境的验收；
5. 在有限范围内开展真实使用与渠道验证，再决定扩大范围。

当前进展见[发布说明](release/README.md)；网络与审计的待验事项见[审计范围](audit/v1.6-audit-scope.md)。全新 Base Sepolia 部署将按[测试网清单](deploy/v16-sepolia-acceptance.md)核对多签接管、实际回调与付款、NFT 存取及服务运行。

**本次账本、回调与消费者已实现并完成对应版本的本地验证，尚未取得发布资格。** 不设置迁移或双版本兼容范围。项目已明确接受并保留上述排序风险；最终源码仍须重新固定编译与部署身份，回调 gas、容量、完整网络验收与外部审计仍待完成。风险接受不替代这些条件，未完成前不放行外部 LP。

合约部署后不可升级，治理由多签经 72 小时时间锁执行：准入与调参须公开排队，Safe 或独立的 guardian 多签可在等待期取消，LP 可在此期间退出；停用资金池、停用游戏与暂停等降风险动作可即时执行。暂停只阻止新投注和 LP 新入金，不阻止结算、退款、作废、玩家应付款领取和 LP 提款；解除暂停须经时间锁。每个资金池最多 128 个未结投注，每个玩家最多 2 个。正常回调不依赖 keeper 发第二笔交易，但异常路径仍需公开补结算和运营监控。团队与主体信息在尽调阶段单独提供；本文不从架构推断经营记录。

## 10. 关键风险

| 风险     | 说明                                                        | 应对                                                       |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| 需求     | 目标用户是否会选择并回访，尚未验证                          | 限定范围的真实使用研究，按指标决定扩张                     |
| 监管     | 牌照、辖区与强制合规措施尚未完成                            | 上线前完成 §8 所列事项；未完成前不开放真实资金             |
| 合约     | 不可升级，缺陷可能锁住准备金或妨碍 LP 进出                  | 外部审计、反例与不变量测试、明确异常状态和验收边界         |
| 资本     | LP 可能亏损；退出时机影响留存者承担的风险；资本不足限制投注 | 明确披露未来盈亏归属，保护准备金，按资本设置下注与提款额度 |
| 运营     | 回调结算失败、补结算服务、RPC 或索引中断                    | 保留原随机数公开重试，WS 与 HTTP 补漏、监控与告警          |
| 排序     | 结果记录前的进出时机及旧范围回退可能改变 LP 盈亏            | 保留既定规则并明确接受、披露风险；不宣传资本排序公平       |
| 外部依赖 | USDC 发行方的冻结或暂停、Chainlink VRF 与 Base 网络的可用性 | 付款失败可记应付款；仅仍未收到随机数且达到固定截止后可退款 |
| 治理     | 多签可准入玩法与资金池、调整受限参数                        | 一切准入与调参经 72 小时时间锁、可取消并公开告警；参数有上限；治理不能提取 LP 资金 |
| 集中度   | 首期只有一条链、一种资产                                    | 有意为之，以集中资源；扩展以经营证据为前提                 |

## 11. 合作方式与下一步

| 合作方向   | 需要核对的条件                                       |
| ---------- | ---------------------------------------------------- |
| 渠道与内容 | 受众是否合适、体验、归因方式、报酬来源与实际贡献     |
| 专业 LP    | 池资产、资本风险、完整负债、退出条件、治理与审计证据 |
| 服务       | 责任划分、成本、异常处理与可核对的交付               |
| 审计与合规 | 范围、时间表、责任人与交付物                         |

合作方应核实实际主体、负责人、服务资格与能力。有意进一步沟通的伙伴，可从[项目简介](ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md)开始，技术尽调请阅读[技术白皮书](WHITEPAPER.zh-CN.md)。

## English overview

ArbiGameFi is an unlaunched casino project focused initially on Base and USDC.
**NFT liquidity and callback settlement are implemented and locally verified in the core contracts and application interfaces; release qualification remains pending.**
A dedicated LiquidityVault issues a new deposit NFT for each contribution, with a fixed 24-hour lock.
Mature owner-only withdrawals pay that owner; partial success relocks the remainder, full withdrawal
burns the NFT, and transfers preserve maturity. NFT authorization remains an economic permission.

LP capital is the LiquidityTree root L, net lock is K=R-P and free capital is L-K. No extra LP buffer,
fungible share price or historical recovery claim remains. At each settlement, profit and loss use
the old-deposit prefix if it covers the position's original maximum LP loss; otherwise both use all
current deposits. Zero-risk positions retain the original empty-prefix fallback. New deposits may
therefore share old expected returns and risk; settlement order may affect allocation. When the tree is empty, later profit
belongs to protocol capital. Ordinary withdrawal does not pause betting; zero LP capital stops new bets.

VRF stores the original seed and attempts settlement in the callback. Failure retains that result
for public retry and blocks affected LP cash operations until booking completes. Keeper continues
exception handling and WS/HTTP recovery. Stage 0 must measure the adopted 40-level tree and full
callback before claiming a supported round limit. The 24-hour lock and atomic callback do not prove
pre-fulfillment ordering safety. Before canonical receipt, mature free capital may exit and bears
no subsequently booked result, leaving remaining LPs to absorb it. The project Owner explicitly
accepted and retained these economics on 2026-10-04, including old-result whole-tree fallbacks.
This accepts the risk rather than fixing it; capital-ordering fairness is not promised, and local
conditional witnesses do not establish that real VRF can be predicted. Full gas qualification,
final-source integration, fresh network acceptance and external audit remain gates.
Previous Base Sepolia evidence stays attached to its original candidate. Test activity establishes
neither production readiness nor demand, income, capital commitments or regulatory qualification.
