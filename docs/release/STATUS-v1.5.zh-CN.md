# v1.5 发布事实与证据

> 核验日期：2026-09-25 · 维护状态：当前文档快照，非实时服务承诺
>
> 代码：`aaa5c807d09f72e972bfad286901c3bb3e88b9ee`
>
> Tree：`0d4fdc906e95a30dbe5493560a7dbb14c3cf2da1`
>
> 原始只读结果：[复盘证据 JSON](../audit/RepositoryReview-2026-09-25.evidence.json)

本页集中记录白皮书所引用的产品范围和当前核验结果。版本号不取代源码、部署地址和发布签名；新文档修订也不代表已重新部署合约。数值、暂停和治理参数可能变化，行动前须重新读取。

## 1. 代码、部署、开放与验收分开看

| 项目        | 代码能力                       | 本次发布与开放状态                                      | 验证范围                                  |
| ----------- | ------------------------------ | ------------------------------------------------------- | ----------------------------------------- |
| 八款 casino | 已实现                         | Base / Base Sepolia 已部署 v1.5                         | 主网每款一笔单轮真实 VRF 与自动结算已留证 |
| 主网 USDC   | 可调用                         | Bank 未暂停；网站投注关闭                               | 已有 8 笔 settled，不等于公开规模验收     |
| 测试网 USDC | 可调用                         | Bank 未暂停；网站测试投注允许                           | 测试与用户回归使用中                      |
| 双链 WETH   | 合约与页面支持                 | 两个 Bank 暂停                                          | 不宣传当前可下注                          |
| Sportsbook  | 合约、SDK、页面存在            | 当前 release 的 SportsHub/RiskEngine 为零地址；网站关闭 | 没有当前发布的生产 sportsbook 验收        |
| LP          | 单资产份额与受限赎回           | 受每池暂停、准备金和出金缓冲约束                        | 不保证正收益、随时退出或固定 APY          |
| 推荐        | 首触、基础预算及增量能力       | 实际分配受当前配置及资格约束                            | 不能把扩展能力写成已运行多级奖励          |
| 五语言 UI   | en / zh-Hans / pt-BR / ru / tr | 页面语言存在                                            | 白皮书为中文正文加英文摘要                |

依据：[网站开关](../../.github/workflows/frontend-docker-images.yml)、[应用访问条件](../../frontend/apps/web/src/app-shell/casino-access.ts)、[Base manifest](../../frontend/packages/ssot/src/release/embedded/chain-8453.json)、[Sepolia manifest](../../frontend/packages/ssot/src/release/embedded/chain-84532.json)。

网站主网开关 `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED=false` 不是链上暂停。网页拒绝主网下注时，未暂停合约仍可被其他客户端调用。

## 2. 本次固定区块回读

只读时间约为 2026-09-25 09:00 UTC。每条链使用一个公共 RPC 和固定区块；本次不是全量跨 RPC 共识核验，也没有重新逐笔验证历史回执。

| 读取项                          | Base（8453）  | Base Sepolia（84532） |
| ------------------------------- | ------------- | --------------------- |
| 区块                            | 51768751      | 47279284              |
| USDC Bank paused                | false         | false                 |
| WETH Bank paused                | true          | true                  |
| USDC NAV                        | 6.022414 USDC | 47.230239 测试 USDC   |
| USDC reserved                   | 0             | 0                     |
| 累计已使用流水                  | 0.057264 USDC | 10.223855 测试 USDC   |
| held / settled 计数             | 8 / 8         | 18 / 18               |
| USDC Bank 与 GameHub governance | 下表 Safe     | 下表 Safe             |
| Safe threshold / owners 数量    | 2 / 3         | 2 / 3                 |

`held/settled` 是 Bank 计数，不等于全站独立用户、成功钱包连接或所有退款数量。不同链的测试资产与真实资产不能合计成 TVL 或交易量。

双链地址相同，但链 ID 是身份的一部分：

| 角色               | 地址                                         |
| ------------------ | -------------------------------------------- |
| GameHub            | `0xB4056D12aD04B01629b3A022fee385D2a1ae4b48` |
| USDC Bank          | `0xEa3845f08a273257c3d3458D26e7bd4234330Dd4` |
| WETH Bank          | `0x9d61c6230ef0bf2d853e17a0368cbc384ef1843b` |
| 治理 Safe          | `0x7F0c244e1701B069727670745FD047179Ef8691d` |
| USDC Bank guardian | `0x9d239D9e0EE179Bd442497a034002aAf75865ea0` |

## 3. 同一区块的 casino / USDC 参数

两条链本次读取相同：

| 参数                                 | 读值                          | 含义                                                                                                                     |
| ------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| defaultHouseEdgeBps                  | 200                           | 默认毛派彩扣减参数 2%，不是 LP 收益率                                                                                    |
| maxAffiliateDeltaBps                 | 0                             | 当前不开放额外推荐加价设置                                                                                               |
| activeReferralConfigId               | 1                             | 下列配置的编号                                                                                                           |
| baseBudgetBps / deltaBudgetBps       | 10000 / 10000                 | 对应 edge 预算比例；不是每笔 stake 全额奖励                                                                              |
| levelBps                             | `[0,10000,0,0,0,0]`，levels=2 | 无玩家 L0 返现，基础预算分配给一级上级；上级地址缺失或取整余数进入 sink。流水门槛未达时，奖励非 holdback 部分进入 locked |
| holdbackBps                          | 3000                          | 奖励预算的保留比例 30%                                                                                                   |
| holdbackVestingSeconds               | 86400                         | 新计划周期一天；新奖励不延长仍活跃计划的终点                                                                             |
| minPlayerTurnoverForUnlock           | 20000000                      | 20 USDC，按来源玩家已使用流水判断                                                                                        |
| riskReserveBps / withdrawalBufferBps | 1000 / 1000                   | 风险与出金缓冲分别为 10%                                                                                                 |
| refundTimeoutSeconds                 | 3600                          | 等待随机数的超时条件参数；治理可修改，非固定 SLA                                                                         |

这只是冻结参数，不承诺后续不变。尤其是限额、推荐定价、派彩扣减和 LP 经济不能用一个百分比概括。

## 4. 发布与运行身份

本次 SSH 只读 inspect 确认 Web 容器 OCI revision 为上述代码基线，镜像为：

```text
ghcr.io/arbigamefi/ssot-bbog-web@sha256:0d03cf9d64fa7d97a796df9a097b3bdd1701b7cdba3c31b14f51539aabb20eb9
```

公网双链 `/api/healthz` 在本次时点均返回 `status=ok`、keeper running、queueDepth=0，索引来源 PostgreSQL。该检查不覆盖完整历史一致性、延迟服务目标、所有金融约束或未来可用性。本次未重新审计服务器全部配置或执行任何生产写操作。

冻结提交的三项 CI 均 completed/success：[合约与发布检查](https://github.com/arbigamefi/ssot_BBOG/actions/runs/36083011754)、[前端 CI](https://github.com/arbigamefi/ssot_BBOG/actions/runs/36083011763)、[镜像构建](https://github.com/arbigamefi/ssot_BBOG/actions/runs/36083011792)。证据采集时 Nightly 36115002913 仍运行，未将其计为通过。普通 CI 的可跳过 fork / non-strict release 检查不替代正式 release gate。

## 5. 历史验收证据的适用范围

| 证据                                                                        | 已证明的限定事项                                  | 不能推广成                               |
| --------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| [主网八游戏验收](../deploy/v15/base-mainnet-live-acceptance.json)           | 每款单轮真实 VRF、keeper 自动结算、转账与索引核对 | 所有参数、批量退出、所有手机与大规模运行 |
| [恢复与 guardian 演练](../deploy/v15/recovery-and-guardian-drills.zh-CN.md) | 指定在途重启、单事件拒写恢复、部分退款、治理操作  | 全库故障、跨机容灾、全部退款分支实链验收 |
| [主网源码验证](../deploy/v15/base-mainnet-explorer-verification.json)       | 检查当时 17 个地址：Exact 6、Similar 11、未验证 0 | 全部 Exact 或第三方安全审计              |
| [测试网源码验证](../deploy/v15/base-sepolia-explorer-verification.json)     | 检查当时 17 个地址：Exact 5、Similar 12、未验证 0 | 编译匹配证明业务无漏洞                   |
| [历史 Bank 收尾](../deploy/v15/legacy-bank-closeout.zh-CN.md)               | 已识别旧义务与待签列表                            | 删除旧文件即完成全部链上退役             |

历史 Bank 列表上次记录仍有 14 个暂停待签；本轮未刷新这些旧地址，不将其描述为已清零或已完成。

## 6. 更新规则

代码能力由源码核实；部署身份来自签名 release 与链上；开放状态来自网站配置和合约；验收范围来自具体测试或交易证据。任一变化应先更新本页并标记日期、来源和未验证范围，再同步三份白皮书及对外页面。动态数值只在本页记录带区块快照，不在多个营销页面人工复制。
