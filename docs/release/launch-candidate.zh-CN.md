# 上线候选版规划

> 内部工程文档，2026-10-11 起维护。读者：Owner（做决定）、实施方（执行）、复核与审计方（核对范围）。
> 对外路线见[产品路线图](../roadmap.md)；本页只列工程工作包与验收方式。

## 1. 原则

合约部署后不可更改。承载真实资金之前，已知问题全部解决：

- 合约、发布工具与文档的改动**合并为一个上线候选版**，只走一轮：冻结 → 首次回调 gas 证书 v5 → 独立复核 → 专业外审 →
  全新部署 → 测试网验收 → 主网证书 → 主网部署。
- 当前 Base Sepolia 部署是测试网，不再为它单独发版，继续用于测试网验收（§8）；主网本来就要单独认证与部署。
- 发布工具先做（§4），因为本版自己的发布就要用到。

## 2. 现状（2026-10-11）

- Base Sepolia 部署：源码 `1b7419bca`，GameHub `0x6EE24a7659601090380CBcF7D832a33193355bb7`，Bank
  `0x616d4F468FFf9e1b8589556b315daEcDAc411047`（暂停中），治理已由 Safe `0x7F0c…691d` 接管。
- 发布：`v1.6.0-base-sepolia-3e36a4bfc`（提交 `3e36a4bfc`，tree `1e95d7fe…` = `V16_AUDITED_TREE`），发布包 `9744d928…`。
  Release Gate run `38103495700`：构建与严格检查通过，fork 步骤因 Infura 返回 HTTP 429 失败，整次运行结束后重跑失败作业。
- 2026-10-02 的旧测试部署已退役（旧 Bank 暂停，手续费 180,175 转入 Safe）。
- 独立 AI 审计与三轮复核已完成（`dist/independent-audit-2026-10-10/`）；外审交付 r2 针对的是 v1.6（`1b7419bca`），专业外审应以本候选版为准。

## 3. 决定

已定（2026-10-11）：

| 事项 | 决定 |
| --- | --- |
| 版本安排 | 合并为一个上线候选版（原 v1.6.1 与 v1.7） |
| 测试网验收 | 在当前部署上继续做 |
| F-05 每玩家持仓上限 | 每个玩家最多 **2** 个未结持仓 |
| CI 的 fork RPC | 改为公共 RPC（A1 完成后切换）；不另建 CI 专用 key |
| F-03 准入时间锁 | 只对增加风险的操作加 72 小时时间锁，降低风险的操作立即生效；OpenZeppelin `TimelockController`（§5.1） |
| 无法入账结果的强制退款 | 采纳：结算失败满 72 小时后由 Safe 作废并退还本金（§5.2） |

待 Owner 确认：

| 事项 | 推荐 | 详见 |
| --- | --- | --- |
| 其余已接受的设计取舍 | 维持接受：成交前的知情排序（需披露）、证书只覆盖 k>0、外部变化使证书失效 | §5.4 |
| Foundry 1.8.x 升级是否放入本版 | 放入（A7），本版本来就要全量重跑 | §4 |
| 旧 pre-release `base-sepolia-v16-20261002` 与失败的 `v1.6.0-base-sepolia-1b7419bca` | 线上切换到新部署后删除 | §9 |

## 4. 工作包 A：发布工具与 CI（不改字节码，先做）

| 编号 | 内容 | 来源 | 涉及文件 | 验收 |
| --- | --- | --- | --- | --- |
| A1 | 治理核验的日志分页改为不超过 200 块（可配置），对 HTTP 429、5xx 与断连带退避重试，重试用尽仍判失败 | Release Gate run 38103495700；公共 RPC 的 200 块上限（HTTP 413） | `script/release/verify_governance.py`（`CHUNK_SIZE = 500`，`Rpc` 无重试） | 公共 RPC 上直连完成 `verify_governance.py` 与 `fork_release_gate.sh`；随后 secret `FORK_RPC_URL_BASE_SEPOLIA` 改为 `https://sepolia.base.org` |
| A2 | 严格发布检查与镜像导入自行构建 `out/` 并断言产物来自当前检出；新增 push 触发的作业，用 `ReleaseImportFixture` 夹具包在全新检出上按工作流顺序跑 release-gate 离线步骤与镜像导入 | 复核 3 W-1 | `script/release/check_release.sh`、`script/release/prepare_image_release.sh`、`frontend/scripts/ssot-sync.mjs`、`.github/workflows/` | 新作业在 push 上通过 |
| A3 | 发布签名：`make release-digest` 先校验 keystore 密码能解出 `RELEASE_SIGNER` 再签（forge 1.5.1 交互输错密码只报 `vm.sign: no wallets available`）；修正版发布脚本收进仓库（提示直接写终端；只读步骤含打包可重试；签名只执行一次） | 2026-10-11 两次签名失败 | `Makefile:165`；`dist/deploy-1b7419bca-2026-10-10/release_v16.next.sh` → `script/release/` | 输错密码给出明确错误；夹具上跑通 |
| A4 | 打包不再原样带上可能过期的 Etherscan 验证脚本：按快照重新生成，或地址不符时拒绝 | 2026-10-11 发现 10-02 的旧脚本 | `script/release/package_release.sh:96-97`、`script/tools/gen_verify_helpers.py` | 放入错误地址的脚本时打包失败 |
| A5 | 部署工具收进仓库：隔离副本部署（避开 forge 自动加载仓库根目录 `.env`）、广播前把关（部署者无代码即无 EIP-7702 委托、nonce、无密钥模拟与已核清单逐笔相同、手动确认）、一键 preflight（回读、模拟、逐笔核对、fork 演练与 Safe 接管演练） | 本次部署；preflight P-1 | `dist/deploy-1b7419bca-2026-10-10/{prepare_deploy_copy.sh,broadcast.sh}`、`dist/fresh-deploy-preflight-2026-10-10-r2/{run_preflight.sh,read-chain.cjs,verify_dryrun_plan.py}` → `script/release/` | anvil fork 上完整演练；`test/ops` 覆盖拒绝路径 |
| A6 | 发布线合入 `master`：远端 `master` 仍是 `5efbb07cd`（落后 8 个提交），其 `release.yml` 没有审计树检查、没有构建步骤、Foundry 为 `stable`、没有树门槛与 proof-gates 作业 | 复核 3 R-3 | 分支合并（PR） | 默认分支即加固后的工作流 |
| A7 | Foundry 升级到 1.8.x：钉版本、修 ops 夹具 gas 上限（anvil `--gas-limit`）、anvil 显式钉硬分叉；测试不依赖网络（预装 solc） | 冻结 v3（`dist/freeze-2026-10-08/v3/README.md`） | 全部工作流、`test/ops`、`Makefile` | 冻结门槛全量通过 |
| A8 | 冻结规程：运行后改冻结文件必须附 diff 或冻结时副本；仓库内维护带摘要的证据索引；`dist/` 证据归档到持久存储 | 冻结签核 FZ-9 | `docs/audit/` 证据索引 | 索引摘要可核 |
| A9 | 测试整理：`_prepareLargeHistoricalProfit` 的 seed 写入病例文件；统一测试侧两份谓词参照；审计 PoC（`dist/independent-audit-2026-10-10/tests/audit/`）并入 `test/` | 实施报告 §7；审计 | `test/` | 回归通过 |

## 5. 工作包 B：合约（改字节码）

### 5.1 F-03 准入时间锁（Owner 已确认，2026-10-11）

现状：`registerGame`、`registerPool`、`setHubRegistered`、`setHubAllowedForPool`、`setPoolActive` 与 Bank 风险参数全部立即生效；
被盗的治理密钥可以立刻接入恶意游戏模块或 hub，以伪造赔付掏空 LP 资金，LP 没有退出窗口。`registerGame` 只能新增，无法停用单个游戏。

参照：Compound 与 Uniswap 治理的 Timelock 最短 2 天（Compound 合约上限 30 天、排队 14 天未执行即作废）；Aave 治理 v2 短执行器 1 天、
高影响操作长执行器 7 天；Morpho 的 MetaMorpho 金库只对增加风险的操作加时间锁（1 天至 2 周），降低风险的操作立即生效，guardian 可撤销排队操作；
OpenZeppelin `TimelockController` 是上述做法的标准实现。

设计：

1. **非对称**：增加风险的操作经时间锁；降低风险的操作立即生效（与现有 `setRiskInPaused` 的规则一致）。
   - 经时间锁：接入游戏、池、hub；重新启用池；放松 Bank 风险参数（`setMinBetAmount`、`setRiskReserveBps`、`setWithdrawalBufferBps` 等）；
     `setRefundTimeout`；推荐配置；`setGuardian`；`rescueToken`；`claimProtocolFees`；治理权转移。
   - 立即生效（Safe 或 guardian）：停用池、hub、单个游戏；暂停；撤销排队操作；强制退款（§5.2）。
2. **延迟 72 小时**：LP 退出需要 24 小时锁定期，加上已占用资金随下注终结释放的时间（退款期限当前 1 小时，最长 1 天），
   再留至少 2 天察觉与行动（对应 Compound、Uniswap 的 2 天下限）。现有 7 天抽水变更延迟保留。
3. **实现**：OpenZeppelin `TimelockController`（依赖已有 v5.5）作为 PoolRegistry、GameHub、Bank、ReferralRegistry 的治理方；
   Safe 为唯一提议者，Safe 与 guardian 可取消，到期后任何人可执行；部署时放弃管理员角色。合约增加第二个角色承担立即生效的降低风险操作。
4. **新增单个游戏的即时停用**，不必为一个游戏停掉整个池。
5. **透明度**：K0-4 监听排队事件并推送告警；前端向 LP 展示排队中的治理操作；发布核验检查延迟、角色与管理员已放弃。
6. **取舍**：`TimelockController` 没有过期作废，长期未执行的排队操作由运营规则主动撤销；不为此改写标准组件。

### 5.2 无法入账结果的强制退款（Owner 已确认，2026-10-11）

现状：VRF 送达时 `VRFHub.unbookedResultCount[bank]` 加 1，结算确认后减 1；计数大于 0 时 Bank 报告 `UnbookedResult`，Vault 的
`addDeposit` 与 `withdrawDeposit` 回滚（防止 LP 在结果公开、尚未入账时抢跑）。若结算确定性失败（任何人都可 `finalize` 重试），
计数永不归零，该池 LP 现金永久冻结；现有 `refund` 只适用于 VRF 未送达。

设计：

1. 只适用于 `RandomReady` 且连续 72 小时未能入账的下注（期间玩家或 keeper 可随时 `finalize`）。
2. 只有 Safe 可触发，不经时间锁（降低风险的补救，72 小时资格期本身就是延迟）。
3. 路径最短：退还本金并记为玩家可领取的应付款（不直接转账）；释放 Bank 占用；VRF 请求转为终态并使计数减 1，LP 门禁恢复；
   不调用游戏模块，不发赔付转账。
4. 不做无需授权版本：若有人能让自己的下注无法入账，无需授权的作废等于给他一张“输了就退本金”的免费期权。
5. 规则变化：发布清单中“未知错误不能把赢家变成退款”（`docs/release/checklist.md`）改为“结算失败满 72 小时后作废，退还本金”；
   写入条款并向玩家与 LP 披露（与受监管赌场“故障导致所有赔付和下注作废”的规则一致）。

效果：唯一无上限的失败模式（整池 LP 现金永久冻结）变为最长 72 小时；入账前的 LP 门禁与 M4 证明仍然需要。

### 5.3 合约工作项

| 编号 | 内容 | 来源 | 位置 | 验收 |
| --- | --- | --- | --- | --- |
| B1 | F-03 准入时间锁（§5.1） | 审计 F-03（Low） | `src/core/PoolRegistry.sol:22-56`、`src/core/GameHub.sol:235-249`、`src/core/Bank.sol`、`src/access/Governable.sol` | 审计 PoC `AuditGovernanceAndCapacity.t.sol` 的 F-03 用例改为被拒；白皮书第 18 行表述与新行为一致 |
| B2 | 每玩家最多 2 个未结持仓（Bank 级 `MAX_OPEN_HOLDS = 128` 保留） | 审计 F-05（Low）；Owner 决定 | `src/core/Bank.sol:34, 486`、`src/core/GameHub.sol:323-413` | 同一 PoC 的 F-05 用例改为被拒；第 3 个持仓被拒、结算或退款后释放名额；容量不变量重跑 |
| B3 | guardian 注释写明“暂停会冻结 LP 存取” | 审计 F-04（Info） | `src/core/Bank.sol:186-188, 280`、`src/core/LiquidityVault.sol:111-113` | 与 PoC `AuditGuardianLpFreeze.t.sol` 描述的行为一致 |
| B4 | 删除 `_allocationLeaf` 在 `maxLoss == 0` 时的死分支 | 冻结签核 FC5 | `src/core/LiquidityVault.sol:224` | `test_lossWithZeroReleasedCapitalIsRejected` 与树等价门槛不变 |
| B5 | 无法入账结果的强制退款（§5.2） | Owner 提出并确认 | `src/core/GameHub.sol`、`src/core/VRFHub.sol`、`src/core/SettlementRouter.sol`、`src/core/Bank.sol` | 构造确定性入账失败：72 小时前拒绝，之后 Safe 可作废，非 Safe 被拒；LP 门禁恢复；路径不调用模块、不转账 |
| B6 | 单个游戏的即时停用（§5.1 第 4 条） | F-03 分析 | `src/core/GameHub.sol` | 停用后该游戏下注被拒，已有下注照常结算或退款 |

### 5.4 维持接受的设计取舍

成交前的知情排序（已接受，须对外披露）；证书只覆盖 k>0（k=0 由参数下限与治理规则排除）；外部变化（USDC 升级、VRF 参数、硬分叉）
使证书失效（K0-4 告警与手册兜底）。B5 已采纳：“一个无法入账的结果冻结整池 LP 现金”从永久变为最长 72 小时。

## 6. 工作包 C：文档

| 编号 | 内容 | 来源 |
| --- | --- | --- |
| C1 | 更正 `README.md:176`：tag 上的 CI 跑的是非严格 `make release-check`；严格检查只在手动 dispatch 的 Release Gate 中执行 | 复核 3 I-6 |
| C2 | 按“直接删除旧版本”规则删除描述旧部署的文档（例如 `docs/deploy/fresh-base-sepolia-preflight-2026-10-05.md`）；14 篇文档中指向已归档证据目录的链接改为指向证据索引（A8） | 2026-10-11 清理 |
| C3 | 发布手册：隔离副本部署、EIP-7702 检查、从标签 dispatch 并核对 `head_sha` 与作业列表、RPC 选择与限流；时间锁与强制退款的运营流程；`docs/release/README.md` 与 `checklist.md` 更新到当前状态 | 本次部署与发布；§5 |
| C4 | 条款与 LP 材料：强制退款规则；准入时间锁与 LP 退出窗口；每玩家 2 个持仓上限 | §5 |

## 7. 认证、复核、审计与部署（本版一轮）

1. A、B、C 完成后冻结；全部门槛全量重跑。
2. 首次回调 gas 证书 v5：新字节码重测（105 例严格矩阵、模块界、树 DP），主口径余量不低于 50,000；模块界驱动加入逐轮单调性检查
   （M7，v4 复核 R-1、勘误 E4）；证书复核方确认 A-1 的 (a) 读法（FZ-7）。`coreRuntimes` 与 `moduleCodeHashes` 重新生成，
   域文件在新证书被接受前为 `PENDING_INDEPENDENT_REVIEW`。
3. 独立复核；专业外审以本候选版为准（先向外审方说明范围变化，替代原 D-1 附录）。
4. 全新部署到 Base Sepolia、Safe 接管（含 `TimelockController` 配置核验）、发布、Release Gate、测试网验收；当前测试网实例按本次方式退役。
5. 主网前置满足后（§10），主网证书、主网部署与发布。

## 8. 测试网验收（当前部署，与开发并行）

前端镜像从标签 `v1.6.0-base-sepolia-3e36a4bfc` dispatch，新数据库，keeper 指向新部署；在公共网络上验收下注、真实 VRF 回调、
结算与付款、NFT 存取、keeper 断线恢复与告警。验收通过后由 Safe 解除 Bank 暂停。这里发现的集成问题并入本候选版。

## 9. 运营事项

| 事项 | 负责 | 备注 |
| --- | --- | --- |
| 当前 Release Gate：整次运行结束后重跑失败作业（Infura） | 实施方 | run `38103495700` |
| 告知外审方：合约将在本候选版中修改，外审以候选版为准 | 实施方准备，Owner 发送 | 替代复核 3 D-1 的附录 |
| 旧 release 清理：`base-sepolia-v16-20261002` 与 `v1.6.0-base-sepolia-1b7419bca` | Owner | 线上切换之后 |
| K0-4 配置漂移告警：补 Owner 参数检查与时间锁排队事件，指向新部署，装到主机 | 实施方，Owner 部署 | 分支 `k0-4/config-drift-alerts`（`15761dbc8`） |
| 旧治理 EOA 管理的 18 个 legacy Bank 退役（14 个未暂停）；PR #85 之前泄露过的 RPC key 轮换 | Owner | `docs/ops/runbooks/keeper-key-separation.md` |
| Infura 额度与生产 keeper 共用，大量核验会触发 429 | Owner | A1 完成后 CI 不再使用 Infura |

## 10. 价值网络与主网前置（冻结签核 FZ-8）

主网证书、主网 M4 证明、余量不低于 50,000、K0-4 与 `CallbackSettlementFailed` 告警、对外披露、专业机构外审、B1 准入时间锁；
运营主体、司法辖区与准入合规（地域屏蔽、制裁筛查、玩家限额）。

## 11. 来源

- 审计与复核：`dist/independent-audit-2026-10-10/`（`README.md`、`fix-review/`、`fix-review-2/`、`fix-review-3/`）；`docs/audit/v1.6-audit-scope.md`
- 架构冻结签核：`dist/architecture-decision-freeze-2026-10-08/DECISION.md`（FZ-1–FZ-9、残余表）
- 证书与勘误：`docs/audit/first-callback-gas-certificate-2026-10-07.md`、`dist/landing-2026-10-08/certificate-v4-ERRATA.md`
- 实施报告：`docs/audit/preview-skip-first-callback-2026-10-07.md`（尚未完成一节）
- 冻结记录：`dist/freeze-2026-10-08/`（v3 工具链决定、v9 delta 与收尾）
- 部署与发布：`dist/fresh-deploy-preflight-2026-10-10*`、`dist/deploy-1b7419bca-2026-10-10/`、`dist/retire-2026-10-02-deployment/`
