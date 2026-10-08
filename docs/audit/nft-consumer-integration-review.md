# NFT 应用接入复核

日期：2026-10-04。对象是 `codex/v16-acceptance-closeout` 在
`d130b4de62218c6b8749bef623f12a59fa7c825b` 上的未提交工作区。
核心资金规则见 [ADR-0034](../adr/0034-nft-liquidity-deposits.md)，
本文件记录应用接入，不重新决定 LP 经济权利。

## 结论与边界

SDK、Earn、赌场页面、keeper 和两种索引已切换到 NFT/Vault 接口。
真实 SDK Anvil、keeper Anvil/PostgreSQL 及生产构建的钱包浏览器回归均已执行通过。
当前没有导入新的公共链部署，也未使用真实账户签名、向公共链广播、更新线上服务或推送本次代码。

**发布仍被完整回调 gas 准入阻断。** [gas 复核](nft-callback-gas-qualification.md)
的最新 36 个实际 wrapper fork 场景中，32 个在预算内，4 个超预算后同 seed 重试成功。
后者证明资金原子性与可恢复性，不代表这些配置可以部署。
降低玩法轮数也不能自动证明所有树历史满足预算。

下文 Anvil、PostgreSQL、浏览器完整证据对应应用接入完成时的源件清单。随后 Bank 时间戳合并和
GameHub 请求读取去重后的 ABI 已重新导出，SDK 230 项与类型检查已重跑通过；本轮未重跑整套
浏览器或 keeper 端到端，不把旧包的源码身份称作最新核心源码身份。

## 接通的单一接口

- LP 授权给 Vault，每笔存款一个 NFT；枚举按冻结的 owner/block/hash 游标分页。
  24 小时以链时间计算，提款使用 `1e12 = 100%` 的比例精度，部分成功后重新锁定。
  发送前重新核对钱包、网络、NFT owner 和可执行状态；成熟零余额 NFT 可关闭。
- Bank 读取明确的 L/P/R/K/G、两处现金与负债、LP 状态及仓位容量。
  赌场预检仍执行 G/R 和原 riskReserveBps 规则，并读取认证发布绑定的逐游戏轮数与 callback gas。
  不再使用旧 activeReserved、ERC20 share price 或批次余额。
- keeper 订阅 canonical `ResultReceived`/`CallbackAttempt` 并用 HTTP 补扫。
  即使 GameHub 仍为 PendingVRF，只要 canonical request 已 Received 就重试原 seed；
  只有 Awaiting 且固定退款期限已到才退款。正常 callback 终态不再发送 finalize。
- PostgreSQL 使用唯一 `vault_provider_ledger`；浏览器缓存独立保存 Bank/XP 与 Vault 事件。
  DepositAdded 保留 payer/owner，提款归实际 owner，普通 NFT Transfer 不记录资产现金。
  mint/burn 不与相应现金事件重复计数，不推断 NFT 买卖价格或受让人的收益率。
- 删除旧 batch/recovery API、worker、页面及生成残留，部署模板改用
  `KEEPER_VAULT_PROVIDER_LEDGER_SCAN_INTERVAL_SECONDS`。没有兼容分支或数据库转换脚本。

## 交叉复核发现及修复

独立审查先保存了“坏行为成立”的本地反例，不能将它们算成安全验收。

1. **赠送存款的付款人漏记。** SDK RPC 查询已包含 payer，但数据库只包含 NFT owner。
   memory/SQL 现在同时查询 DepositAdded 的 caller，并保留 owner 原值；同一行不重复。
   真正 PostgreSQL 中验证付款人、受赠人都能查询，另一个 Vault 不串账。
2. **链头回退后的孤块尾部。** 原浏览器只替换新 head 以内区间，留下 head 以上旧事件。
   现在在一个 Dexie 事务中撤回作用域内 Bank/Vault/XP 事实并降低游标，再重放。
   覆盖小幅回退、超过 rewind 的回退、低于部署区块和重放 RPC 失败；不虚报同步范围。
3. **缺少交易身份时误报空区间。** keeper 曾跳过成功解码但缺 txHash/block/logIndex 的现金事件。
   现在整次读取失败，保留原记录和游标；恢复后重试原区间。
4. **上次交易日志覆盖当前操作。** 共用交易 hook 向前读取两秒历史，可能用上次失败覆盖本次成功，
   或在本次失败后被授权成功日志重新变成 submitting。现仅查询本次开始以后的记录，
   已等待完毕的执行结果不被迟到日志覆盖；四项定向回归和钱包重试流程通过。

这些属于本地源码与受控输入验证，不是已经发生的外部攻击。

## 已执行的应用证据

| 范围                         | 当前结果与实际覆盖                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| SSOT 包                      | 最终 230/230；另 4 项 Anvil 在普通命令中 skip，下行已独立实际执行。覆盖 SDK/domain/编码/indexer/release；其中 SDK 定向为 143 项，不重复累加 |
| 真实 SDK Anvil               | 4/4，无 skip；Vault 授权、存赠、冷却/重锁、成熟 operator 不能直接提款、转让/销毁、真实下注 G/L/P/R/K、PP 结算和补领、零叶关闭               |
| bet-index，独立 PostgreSQL   | 95/95，无 skip；含付款人归属、重组区间、事务回滚、并发初始化及原有投注/财务路径                                                             |
| 浏览器索引与 release         | 47 项通过，包含在上述 SSOT 总数内；BankIndexer 最终 14/14                                                                                   |
| keeper                       | 最终完整 19 文件、221/221；身份缺失修复后的相关两文件 45 项包含在总数内                                                                     |
| keeper 真实 Anvil/PostgreSQL | SIGKILL 后重启同 seed 结算且恰好一次付款、正常 callback 零 keeper 广播、固定 deadline 退款、PP 补领、取消后迟到；该次 SQL 31/31             |
| web                          | 最终完整 123 文件、723/723，另实际钱包 E2E 1/1；生产构建通过                                                                                |
| 运维与发布工具               | 最终 `test/ops` 105/105；含真实本地部署、签名/导入拒绝场景及告警送达状态验证                                                                |

钱包 E2E 在独占 localhost Anvil 与 Next 生产构建上执行：先模拟授权期间账户/网络改变，
确认中止后续存款；重试成功入金 100 LOCAL，生成 NFT，未到期不可提，24 小时后提取 40%，
剩余 60 重新锁定，成熟后全提并销毁 NFT，钱包资产守恒。首次失败及最终通过日志均保留，
没有靠忽略异常或延时固定金额断言让测试通过。SDK Anvil 使用独立 18549 端口并记录其进程创建/清理。

本地 Anvil 的 mock token/wrapper 和测试账户用于可重复故障注入，不验证 Chainlink 实际服务、
真实 USDC 发行方操作或 Safe 多签执行。SQL 验证使用自建 loopback Docker 实例并清理。
Foundry/ABI 与真实 wrapper 的证据分别见核心/gas 报告；测试数量不重复累加为“审计完成”。
本轮浏览器 gate 只验证 LP 钱包现金流程，未在浏览器中执行真实赌场下注；赌场 SDK Anvil
与页面准入/报价单元测试分别验证，不能合并描述成同一条浏览器到 keeper 的全流程验收。
桌面和 390px 手机截图已人工查看，NFT 当前金额、owner、期限与冷却原因可见；
英文、简中以及葡萄牙语、俄语、土耳其语的新 NFT 文案均已接入；后三种语言各补齐本轮 93 项文案。
JSON、键范围和占位符已核对。页面截图验证使用英文，未将其当作每种语言的逐屏视觉验收。
最终三语翻译在完整 web/E2E 运行后落地，只改 JSON 文案；翻译后另跑 i18n 4/4 和键/占位符检查，
没有将完整 web/E2E 日志描述为三语翻译后的重新运行。

## 尚待完成

- 将本次本地证据纳入候选复核；日志、源码哈希与页面截图归档于
  `dist/nft-consumer-2026-10-04/`，该目录是证据，不能用作构建依赖。
- 解决完整树路径的 gas 准入，之后才能填写逐游戏部署参数与冻结发布候选。
- 补齐浏览器赌场真实下注链路和各语言的逐屏视觉验收。
- 剩余变异测试、独立/外部审计、结果公开前的交易排序风险、用户另定峰值后的容量验收。
- 最后才是全新部署、用户控制签名和公共网络端到端验收。
