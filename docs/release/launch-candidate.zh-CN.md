# 上线候选版规划

> 内部工程文档，2026-10-11 起维护。读者：Owner（做决定）、实施方（执行）、复核与审计方（核对范围）。
> 对外路线见[产品路线图](../roadmap.md)；本页只列工程工作包与验收方式。
> 本版经独立复核修订（`dist/independent-review-launch-candidate-2026-10-11/`，MANIFEST `6dfae149…`，README `ae18f52d…`）：
> 阻断 B-1、B-2 与应改 M-1–M-14 已并入，建议 S-1–S-11 见各节。

## 1. 原则

合约部署后不可更改。承载真实资金之前，已知问题**全部解决，或明确接受并披露**：

- 合约、发布工具、应用与文档的改动合并为**一个上线候选版**，只走一轮：设计冻结 → 实现 → 冻结 → 首次回调 gas 证书 v5 →
  独立复核 → 专业外审（含修复回路）→ 全新部署 → Release Gate → 测试网验收 → 主网证书 → 主网部署。
- 在完全干净的环境里从头做：旧部署、旧发布、旧分支与过程记录全部清出（§4），git 历史保留为档案；不做迁移，不做兼容。
- **本版只做赌场**。体育相关的合约、脚本、应用与文档移出本版（git 历史保留），以后作为独立版本修复 ADR-0033 的问题后另行审计上线。

## 2. 现状（2026-10-11）

- 仓库：唯一主干 `master` = `3e36a4bfc`（由发布线快进，未产生新提交）；只保留 `master` 与 `k0-4/config-drift-alerts`。
- 2026-10-10 的 Base Sepolia 部署（源码 `1b7419bca`，GameHub `0x6EE2…5bb7`，Bank `0x616d…1047`）：**放弃**。Bank 暂停中，
  Bank 与 Vault 均为 0 USDC，治理为 Safe `0x7F0c…691d`；不再做 Release Gate、镜像与测试网验收。2026-10-02 的旧部署已退役。
- Release Gate run `38103495700`（标签已删除的 `v1.6.0-base-sepolia-3e36a4bfc`）：树门槛与 proof-gates 通过；`release-gate` 四次
  attempt 都失败在 fork 步骤（`RPC eth_getLogs failed` / `RPC eth_chainId failed`；直接探测 Infura 得到
  HTTP 429，但运行日志不含状态码）。attempt 2、3 由 `arbigamefi` 账号发起，不是实施方，也不是复核方。退出条件：该门槛不再对旧树执行，
  Release Gate 只在本候选版上验收（A1 之后）。
- 审计：独立 AI 审计与三轮复核针对 v1.6（`1b7419bca` / `3e36a4bfc`）；外审交付 r2 已被本候选版取代，`1e95d7fe…` 不会有外审。
  专业外审以本候选版为准（§11 S-2）。

## 3. 决定

全部由 Owner 于 2026-10-11 确定：

| 事项 | 决定 |
| --- | --- |
| 版本安排 | 一个上线候选版（原 v1.6.1 与 v1.7 合并） |
| 环境 | 干净环境从头做，§4 的 12 项清理全部执行；生产服务器暂时保留 |
| 测试网 | 放弃当前部署的验收；本候选版全新部署后再做测试网验收 |
| 体育 | 移出本版（选项 A），见 B9 |
| F-05 | 每个玩家最多 **2** 个未结持仓，Bank 级 `MAX_OPEN_HOLDS = 128` 保留；容量假设经 Owner 确认（§7.5） |
| F-03 准入时间锁 | 非对称：增加风险的操作经 OpenZeppelin `TimelockController`（72 小时），降低风险的操作立即生效（§7.1） |
| 暂停语义（复核 B-1） | 暂停**不再阻止 LP 提款**，只阻止新下注与新存款（§7.2） |
| guardian（复核 B-1） | 独立多签，签名人与 Safe 不重叠，不使用 EOA（§7.3） |
| 无法入账结果的作废（复核 B-2） | 先尝试结算，失败才作废；资格期 24 小时，自 `vrfRequestedAt` 起算；Safe 或 guardian 触发，7 天后任何人可触发；对该 Bank 全部合格下注一并执行，落实为按 Bank 开窗、逐笔执行（§7.4） |
| B0 设计冻结 | [ADR-0037](../adr/0037-launch-candidate-authority-pause-capacity-void.md) 第 3 版：D1 合约构造时治理方即时间锁；D2 按 Bank 开作废窗口、任何人逐笔执行，另有运营规则与告警；D3 试结算下限 1,000 万 gas；D4 准入审查对照认证产物；D5 时间锁操作就绪即执行或在等待期撤销；D6 暂停不挡 XP 与协议费领取；D7 合约锁定延迟不低于 72 小时 |
| 其余已接受的设计取舍 | 维持接受，残余清单补全并逐项披露（§9） |
| Foundry 1.8.x | 放入本版，A7 在工作包 B 与证书 v5 之前完成 |
| CI 的 fork RPC | A1 完成后改为公共 RPC；不另建 CI 专用 key |
| RPC key 分配 | 仓库根 `.env` 的四个 key 按用途命名（只改名，值未变）：`INFURA_API_KEY_OPS` 用于本机部署广播、发布检查、`verify_governance` 回放与 K0-4（K0-4 在本机运行），以及主网上线后的备用 keeper（只走 HTTP；Owner 2026-10-14 由 Alchemy 改为 Infura，与主 keeper 的 HTTP 同一服务商、不同账户）；`ALCHEMY_API_KEY_OPS` 用于 preflight、fork 演练、gas 矩阵（免费档，`eth_getLogs` 每次最多 10 块，不用于日志扫描）；`INFURA_API_KEY_PROD_KEEPER`、`ALCHEMY_API_KEY_PROD_KEEPER` 只在服务器上给生产 keeper 用（`KEEPER_RPC_HTTP`、`KEEPER_RPC_WS`）。OPS 与 PROD_KEEPER 分属不同账户，旧 Alchemy key 已重建（Owner 确认）。实施方只经 `script/tools/with-ops-rpc.sh` 使用两个 OPS key，不得使用 `*_PROD_KEEPER`；浏览器与 web 服务端用 Base 公共 RPC |
| 文档 | 一档过程记录直接删除，二档先迁移决策与状态再删除，作为第一项工作（C2） |

Owner 于 2026-10-14 追加两项决定：

| 事项 | 决定 |
| --- | --- |
| 外审交付的发送时机 | 选项 A：在证书 v5 的独立复核完成之前发送外审交付（§5 第 4 步的复核与外审因此并行）；复核封存与域文件改为 `CERTIFIED` 的改动以补充件交付（C6） |
| 准入合规 | 只在链下：合约对下注与 LP 存入不设准入限制；地域屏蔽、KYC/AML 与负责任博彩由运营方的网站与运营承担。2026-09-29 提议的链上准入控制（运营方 blocklist、玩家自我排除、未验证钱包累计上限、LP 存入白名单）不进本候选版。残余见 §9，条款披露见 C9 |

## 4. 清理记录（2026-10-11）

归档目录：`~/arbigamefi-archive/2026-10-11-clean-slate/`（另有 `~/arbigamefi-archive/2026-10-11-superseded/`）。原件移入废纸篓
`arbigamefi-clean-slate-2026-10-11`，由 Owner 决定是否清空。

| # | 对象 | 结果 |
| --- | --- | --- |
| 1 | git 历史 | 保留 |
| 2 | 主干 | 远端 `master` 由 `5efbb07cd` 快进到 `3e36a4bfc`（04:48Z） |
| 3 | 分支 | 全部引用先打成 `all-refs-2026-10-11.bundle`（25 个引用，`git bundle verify` 通过），再删除 16 个本地分支 |
| 4 | worktree | 4 个移除；两个 Codex worktree 的未提交改动导出为补丁与归档（`worktrees/`，补丁可干净应用到原提交） |
| 5 | stash | 导出补丁后删除（stash 提交也在 bundle 里） |
| 6 | GitHub release 与标签 | 3 个删除（实施方执行，Owner 批准）。资产 SHA-256 与原标签：`base-sepolia-v16-20261002` → `ssot-release-chain-84532-47577983-0x7e7c13d4.tar.gz` `b04832d2…8499`（`5efbb07cd`）；`v1.6.0-base-sepolia-1b7419bca` → `e3432dcb…3016`（`1b7419bca`）；`v1.6.0-base-sepolia-3e36a4bfc` → `9744d928…2db8`（`3e36a4bfc`）。资产在 `dist.tar.gz` 内 |
| 7 | 仓库变量 | 删除 `V16_AUDITED_TREE`；`V16_RELEASE_SIGNER` 与 secret `FORK_RPC_URL_BASE_SEPOLIA` 保留到发布时再定 |
| 8 | 本地产物 | `dist/`、`deployments/`（含 `base-sepolia-v16.env`）、`/Users/Shared` 部署副本、仓库根 `cache/`：归档并逐成员校验后移入废纸篓（`cache/` 只移不归档）。仓库根 `.env` 不在清理范围 |
| 9 | 文档 | 两档处理，见 C2 |
| 10 | 链上 | 当前部署无资金、已暂停，直接放弃；无需操作 |
| 11 | 旧治理 EOA 的 18 个 legacy Bank | Owner 退役（C7 地址登记） |
| 12 | 生产服务器 | 保留，待本候选版上线时切换 |

清理中发现的遗漏：2026-09-28 的发布导入绑定加固只落地一部分（A10）；SportsHub 挑战超时的活性问题未解决（随体育移出本版，见 B9）。
旧 LP 份额定价问题（同批文档）已被 NFT 流动性重构取代。

## 5. 顺序

1. **设计冻结 B0**：§7 的全部设计（B1–B6）写成 [ADR-0037](../adr/0037-launch-candidate-authority-pause-capacity-void.md)，由独立方评审，并送外审方预审（S-2）。已完成两轮复核与 Owner 决定（D1–D7），预审包由 Owner 发送。
2. **工具链与工具**：A7（Foundry）先行，然后工作包 A 的其余各项；同时做 C2 文档清理。
3. **合约**：工作包 B（含体育移出）；**应用**：工作包 D；**文档**：工作包 C。
4. **冻结**，全部门槛全量重跑；**证书 v5**（§10）；**独立复核**；**专业外审**，外审后修复按 v5.x → 增量复核 → 外审复核的回路处理。
5. **全新部署**到 Base Sepolia（D1，§10）：部署后 Safe 排接线批次并公开，72 小时后执行，池已注册未激活、LP 可存入；
   签名发布，Release Gate `release-ready`（FZ-5）。
6. **测试网验收**：Safe 经时间锁排激活操作，72 小时后执行并记录 → 按 `docs/deploy/v16-sepolia-acceptance.md` 逐项验收，记录通过、失败或未执行
   （含暂停、解除、guardian 撤换演练）→ 发现的问题回到第 3 步。
7. 价值网络前置满足后（§13），主网证书、主网部署与发布。

## 6. 工作包 A：发布工具与 CI

| 编号 | 内容 | 来源 | 涉及文件 | 验收 |
| --- | --- | --- | --- | --- |
| A1 | 治理核验：日志分页不超过 200 块（可配置）；对 HTTP 429、5xx 与断连有界退避重试；在不泄露 URL 的前提下记录 HTTP 状态类别；**以已签名核验的区块为检查点做增量回放**，避免全历史回放随部署时长增长（Denim 之后主网一年约 79 万次 `eth_getLogs`） | Release Gate run 38103495700；公共 RPC 的 200 块上限（HTTP 413）；复核 M-14 | `script/release/verify_governance.py`（`CHUNK_SIZE = 500`，`Rpc` 无重试，`:86-105, 151-194`） | 伪 RPC 返回 413、429、5xx、断连时有界重试后仍失败；公共 RPC 上在 GitHub runner 连续 3 次通过；给出主网规模的页数与耗时估算；随后删除 secret `FORK_RPC_URL_BASE_SEPOLIA` 或改为公共 RPC（Owner 在 GitHub 操作）。本机发布检查与回放经 `with-ops-rpc.sh infura` 用 `INFURA_API_KEY_OPS`。进展（2026-10-11，本地）：分页 200 块（`GOVERNANCE_LOG_PAGE_BLOCKS`），408/425/429/5xx 与断连有界退避重试，报错只含状态码；检查点增量回放（`GOVERNANCE_CHECKPOINT` 加签名记录中的 `GOVERNANCE_CHECKPOINT_SHA256`）；release-gate 与镜像导入改用 Base 公共 RPC，不再引用 secret。本机公共 RPC 实测：31,764 块完整回放 318 页、345 次调用、12 次重试、500 秒，检查点之后 265 块 4 页、25 秒，最终状态一致。主网估算（2026-10-14 按 Denim 重算）：每秒 5 块，一年约 1.58 亿块；每页一次 `eth_getLogs` 覆盖所有地址，公共 RPC 每页 200 块，一年约 79 万页，按当日实测每页约 1.7 秒约 370 小时，因此依赖检查点；签名后每天新增约 2,160 页、约 1 小时（经 Infura 每页 10,000 块，每天 44 页）。**runner 验收已通过**：Governance Replay run 38127960425（`7874a883c`）在 `https://sepolia.base.org` 上连跑 3 次，每次全量回放（47,938,596–47,950,000，116 页、131 次调用、0 次重试、约 13 秒）与自检查点 47,945,000 起的增量回放（50 页、约 6 秒）都复现检查点 `885af8258cd937a1…`；同一提交的 Frontend Docker Images run 38127960478 通过。Governance Replay 作业与其夹具（已放弃的 2026-10-10 部署）随 A11 删除：新校验器只认时间锁模型；Release Gate 在 runner 上用 Base 公共 RPC 从签名检查点回放，走同样的分页与重试。剩余：Owner 删除 secret `FORK_RPC_URL_BASE_SEPOLIA` |
| A2 | 严格发布检查与镜像导入自行构建 `out/` 并断言产物来自当前检出；新增 push 触发的作业，用 `ReleaseImportFixture` 夹具包在全新检出上按工作流顺序跑 release-gate 离线步骤与镜像导入 | 复核 3 W-1 | `script/release/check_release.sh`、`script/release/prepare_image_release.sh`、`frontend/scripts/ssot-sync.mjs`、`.github/workflows/` | 新作业在 push 上通过；负对照：删掉构建步骤后新作业必须失败。**已完成**（2026-10-11 本地完成，runner 验收见本行末）：`check_release.sh` 与 `ssot-sync.mjs`（镜像导入）先自行 `forge build src`，再由 `script/release/check_current_build.py` 断言 19 个必需产物都是本检出的构建（compilationTarget 正确、solc 为 `deps.lock` 所钉、metadata 中每个源文件的 keccak256 等于检出中的文件）；`make release-abis` 同样检查；删除 `release.yml` 与镜像工作流里的显式构建步骤。新增 Release Path 工作流（发布路径文件的 push、每周、手动）运行 `script/ci/release_path.sh`：三个全新检出，producer 在本地 Base 规则节点（84532）部署夹具并按发布资产格式打包，gate 按 release-gate 作业顺序跑离线步骤（导入、`install_deps.sh`、`STRICT=1 make release-check`、`make audit-package`），image 跑镜像工作流的导入步骤；夹具自证回调域（`CALLBACK_DOMAIN_PATH`），证明的是路径而非证书。本机三个全新克隆全程通过；负对照两轮：去掉 gate 的构建步骤后在 `release-check` 失败（missing build artifact），去掉镜像导入的构建步骤后在导入失败（current build failed）。测试 `test/ops/test_current_build.py` 9 项；导入集成测试的隔离项目改为复制源码树（经指向项目外的符号链接时 Forge 记录绝对源路径，新检查据此拒绝）。**runner 验收已通过**：Release Path run 38131385850（`7d8efb021`）三段全过，约 3 分钟 |
| A3 | 发布签名：先校验 keystore 密码能解出 `RELEASE_SIGNER` 再签（forge 1.5.1 交互输错密码只报 `vm.sign: no wallets available`）；修正版发布脚本收进仓库（提示直接写终端；只读步骤含打包可重试） | 2026-10-11 两次签名失败 | `Makefile:165`；归档中的 `release_v16.next.sh` → `script/release/` | 输错密码给出明确错误；重试不会导致重复签名。**已完成**（2026-10-11，本地）：`make release-v16` 改为运行 `script/release/release_v16.sh`，删除无把关的 `release-digest` 目标。Foundry 1.8.5 交互输错密码仍只报 `vm.sign: no wallets available`（伪终端实测），因此密码从终端读入后先由 `cast wallet address` 解出并比对 `RELEASE_SIGNER`，输错 3 次即结束且不签名，keystore 属于其他地址或打不开时立即停止；forge 从 0600 临时文件读密码，退出（含 Ctrl-C）时删除。`VerifyReleaseV16` 认可的已有签名记录保留，重跑不再提示、不再签名；不认可的记录绝不覆盖。读链步骤只在传输错误后有界重试，每次尝试的日志单独保存且替换 RPC URL 与 key；`verify_governance.py` 的冻结区块检查对断连标注“RPC transport error”。打包拒绝覆盖已存在的归档（其 SHA-256 可能已获批）并原子写入。测试：`test/ops/test_release_v16.py` 13 项在伪终端上跑真实提示（含经 `with-ops-rpc.sh`），另有打包不覆盖与 transport 标注测试；另用一次性 keystore 与合成快照跑真实 forge/cast：输错一次后签名成功，重跑保留签名，快照改动后以 `digest mismatch` 拒绝覆盖 |
| A4 | 打包不再原样带上可能过期的 Etherscan 验证脚本：按快照重新生成，或地址不符时拒绝 | 2026-10-11 发现 10-02 的旧脚本 | `script/release/package_release.sh:96-97`、`script/tools/gen_verify_helpers.py` | 放入错误地址的脚本时打包失败。**已完成**（2026-10-11，本地）：两者都做。打包时用 `gen_verify_helpers.py --out` 从被打包的快照生成验证脚本放入归档（并列入 `MANIFEST.sha256`），不再拷贝本地文件；本地 `deployments/verify-latest-v16.sh` 与之不同即在任何链上检查之前拒绝打包。测试：`PackageGuardTests` 覆盖无本地脚本、本地脚本一致、本地脚本地址不符三种情况；把比对改成恒不触发的变异会被测试抓到 |
| A5 | 部署工具收进仓库：隔离副本部署（避开 forge 自动加载仓库根 `.env`）；广播前把关；一键 preflight（回读、模拟、逐笔核对、fork 演练、时间锁接管演练）；输出写入新目录，绝不覆盖已封印目录；RPC：preflight 与 fork 演练经 `with-ops-rpc.sh alchemy` 用 `ALCHEMY_API_KEY_OPS`，广播经 `with-ops-rpc.sh infura` 用 `INFURA_API_KEY_OPS` | 本次部署；preflight P-1；复核 S-3 | 归档中的 `prepare_deploy_copy.sh`、`broadcast.sh`、`run_preflight.sh`、`read-chain.cjs`、`verify_dryrun_plan.py` → `script/release/`；`script/tools/with-ops-rpc.sh`（已入库） | 拒绝路径逐一有测试：EIP-7702 委托、nonce 不符、清单不符、副本或上级目录有 `.env`、未确认；包装脚本只接受两个 OPS key（`test/ops/test_with_ops_rpc.py`）。**已完成**（2026-10-12，本地，按 ADR-0037 §9）： （1）部署路径：`run_preflight.sh`（经 `with-ops-rpc.sh alchemy`；不用签名 key、不发送）在提交的 `git archive` 隔离副本中依次运行 work-copy、read-chain、dry-run、verify-plan、rehearsal 五个阶段，输出目录不得已存在，日志去掉 RPC URL 与 key，通过后写 `PREFLIGHT.txt`。`read_chain.py` 在同一区块回读：Safe 恰为审定的 2/3 且无 module、guard；guardian 为至少 2 签、与 Safe 签名人不重叠的多签；部署者、keeper 与签名者无代码（EIP-7702）；部署者有余额且无待处理交易；角色互异且不是旧主机暴露的治理 EOA；代币、VRF 与域文件为认证版本；并按模板生成 `deploy-params.env`。`verify_dryrun_plan.py` 只接受预期的创建（顺序、nonce、地址、init code 与构造参数、每个 Bank 创建的 Vault、认证运行时与 Owner 政策参数）。rehearsal 在本地 anvil 分叉上部署，Safe 排接线、72 小时后执行，做 release 核验、运行时与认证构建比对，再激活并做 live 核验，结果须与计划一致。`prepare_deploy_copy.sh` 在仓库外生成部署副本（副本及其上级目录不得有 `.env`）。`broadcast_v16.sh`（Owner 经 `with-ops-rpc.sh infura` 运行）在要密码前逐项把关：preflight 用认证域文件（不是测试覆盖）通过且未广播过，副本为同一提交且参数未变，链正确，部署者无代码，latest 与 pending nonce 都等于计划的首个 nonce，无 key 模拟与计划逐笔一致；键入 `BROADCAST` 后在终端读 keystore 密码，须解锁部署者，三次错误即终止；退出时把 forge 记在副本 `cache/` 里的 RPC 去掉 key。广播从不续传，部分广播后从当前 nonce 重新 preflight。广播后的浏览器验证与 `make -C <副本> timelock-batches-v16` 在副本中运行。`make deploy-v16`、`make deploy-dryrun` 删除；共用函数在 `script/release/operator-functions.sh`（`release_v16.sh` 同用）；手册 `docs/deploy/v16-release.md` 第 1、2 步改写。 （2）修复：`PrepareTimelockBatchesV16` 在 `scheduleBatch` 的参数里读延迟，`vm.prank` 被 `getMinDelay` 用掉，脚本自己去排队而回退；改为先读。新增单元测试按原样发送 Safe 文件与 `executeCalldata` 并检查 release、live 结论，旧顺序下失败。preflight 的演练分叉此前每次都留在后台（`stage()` 以管道元素运行各阶段，函数里设的 EXIT trap 不会执行），命令行里带着含 key 的 RPC URL；现在演练无论成败都停掉分叉，并确认进程已退出（TERM 后未退则再 TERM、再 KILL；分叉刚启动就发出的 TERM 可能在子进程执行 anvil 前丢失），子 shell 意外退出时由外层清理按 pid 文件停掉，端到端检查成功与注入失败两条路径都不留分叉。 （3）测试：`test_deploy_v16.py` 11 项覆盖全部拒绝路径与唯一一次成功（日志与副本 `cache/` 不含 key），对门禁的 12 个变异全被抓到；`test_read_chain.py` 8 项；`test_verify_dryrun_plan.py` 8 项，6 个削弱变异全被抓到；DeploymentV16 37 项；ops 263 项。 （4）端到端：在 Base Sepolia 公共 RPC 的分叉上（模拟的 Safe 与 guardian 多签、一次性 keystore）按手册走通：preflight 五个阶段 → 部署副本 → 门控广播 16 笔创建 → 副本中生成 Safe 文件 → Safe 排接线、72 小时后执行 → `verify_governance` release 模式 verified，副本 `cache/` 中没有 RPC。 （5）生产服务器的准备见 §12。剩余（Owner）：真实 preflight 前建好独立的 guardian 多签，准备角色文件（只含公开地址） |
| A6 | 发布线合入 `master` | 复核 3 R-3 | — | **已完成**（§4 第 2 项）；另用 GitHub environment（required reviewers）包住 `release-gate`（S-1） |
| A7 | Foundry 升级到 1.8.x：全部工作流钉到同一确切补丁版本；anvil 显式钉到目标网络当时的硬分叉；预装 solc 后默认离线；工具链写入 v5 输入 | 冻结 v3；复核 §3.6 | 全部工作流、`test/ops`、`Makefile` | 在新版下复跑 ops 夹具、`DeployHarnessV16`、`run_gas_matrix.py`（1.8 有 30M 脚本帧上限）。**已完成**（2026-10-11）：v1.8.5（`51a52c59cf`）写入 `deps.lock`，`check_toolchain.py` 核对 8 处工作流与本机工具；solc 按 SHA-256 安装、离线编译；anvil 用 `--network base --hardfork azul --enable-tx-gas-limit`；`isolate` 默认关闭。PR 门槛、ops 119 项、SDK 集成通过；gas 矩阵两例与 v8 逐字段一致；isolate 下改按退款前毛 gas 计（准入日志 +45,404），由 `test/toolchain/IsolatedGasAccounting.t.sol` 钉住 |
| A8 | 冻结规程与证据索引：运行后改冻结文件必须附 diff 或冻结时副本；仓库内维护带摘要的证据索引（含 §4 的删除记录与标签映射）；`dist/` 证据归档到持久存储；只改工作流的冻结 delta 写明由哪次运行验证 | 冻结签核 FZ-9；复核 S-11、W-1(3) | 证据索引（路径与格式在本项确定） | 写明 `shasum -c` 用法，做一次恢复演练。**已完成**（2026-10-11，持久副本待 Owner）：索引为 [`docs/release/evidence.md`](evidence.md) 与 `docs/release/evidence-index.sha256`（归档根 `~/arbigamefi-archive/` 下全部 21 个文件的 SHA-256），含各封印清单摘要、§4 删除的 3 个标签与资产映射、`shasum -c` 用法与冻结规程五条；清理后新产生的 `dist/` 证据（规划复核、B0 复核两轮、外部预审包，117 个文件）归档到 `2026-10-11-post-clean-slate/`。恢复演练：21 个归档文件全部 OK；三个证据归档解到新目录逐成员 `shasum -c`，8,621 / 2,545 / 117 项全部 OK；两个含环境文件的部署归档在内存中逐成员核对，28 / 3,605 项一致；bundle 为完整历史、25 个引用。剩余（Owner）：把归档根复制到持久存储并在索引里记下日期与位置 |
| A9 | 测试整理：`_prepareLargeHistoricalProfit` 的 seed 写入病例文件；统一测试侧两份谓词参照；审计 PoC 并入 `test/` | 实施报告（C2 已删的 `preview-skip-first-callback-2026-10-07.md`，见 `b8a48425f` 中第 311–312 行）；审计 | `test/`；归档中的 `independent-audit-2026-10-10/tests/audit/` | 回归通过。**已完成**（2026-10-11，本地）：setup 盈利结果的 seed 改为病例字段 `PROFIT_SEED`，缺失或不再盈利时 setup 停下并报出 0..1023 中第一个可用 seed；8 个集中额度病例均记录为 4。fork 资格测试的全谓词投影改用 `test/utils/PrefixPath.sol`（经已部署 Vault 的公开 `treeNode` 视图逐层回放，返回每步状态供逐步断言），`VaultPrefixReference._prefixCapital` 保持原样（审计据此对照原生产代码，且被 gas 对比用例依赖）；前缀回放模糊测试要求二者逐值相等，把拆分改成向上取整的变异立刻被抓到。公共 RPC 上复跑集中额度 5 个与见证 6 个病例全部通过、回调全部在预算内，最重病例 wrapper gas 2,005,280 与证书 v4 记录一致。审计 PoC：模块普查与树差分两个性质测试并入 `test/diff/`（CI、nightly 与发布证明门槛都会运行；差分负对照在 Foundry 1.8 的 2^30 单测 gas 上限下暂停计量，8 轮中检出 3 轮）；F-01/F-02 的 PoC 断言的是已修复前的行为，已由 `CertifiedRuntime.t.sol` 与 `CallbackDomainV16.t.sol`（标注 audit F-02）的反向用例覆盖，不再并入；F-03/F-04/F-05 的 PoC 断言的是 B 要修的现状，按 B1–B3 的验收反转后由 B8 并入。审计的 `module_fairness.py` 只按自身公式重算赔率、不读仓库输入，`verify_seals.py` 校验交付封印，归 A8 证据索引 |
| A10 | 发布导入绑定加固：完整规范清单比对、池 ID 安全整数范围、ABI 清单逐项绑定与对应测试 | 2026-09-28 未合入的工作（归档 `worktrees/security-remediation.*`） | `script/release/validate_frontend_artifacts.py`、`script/release/GenerateFrontendManifestV16.s.sol`、`frontend/scripts/ssot-sync.mjs` | 归档中的 `test_release_artifact_binding.py` 思路落成仓库测试并通过。**已完成**（2026-10-11，本地）：校验器在逐项检查之后，用 `GenerateFrontendManifestV16` 从快照离线生成规范清单并整体比对（只忽略 `gitSha`、`generatedAt` 与十六进制大小写），报出第一个不同的位置；JSON 重复键与非有限数拒绝；池 ID 必须在 1..2^53−1；ABI 文件不得是链接。导入器先把包内文件一次性复制到私有目录（只收普通文件，拒绝链接），校验与激活读同一份字节；生成的 `index.ts` 只收 `chain-<数字>.json` 并转义导入路径。ABI 清单逐项绑定此前已在 `_validate_abis` 中（名称、地址键与地址、文件名、摘要、与本检出构建一致、Bank/Vault 实例）。归档测试基于已删除的 v1.5 夹具，按思路改写进 `test_manifest_authentication.py`：真实签名夹具包上 label、paramsEncoding、多余 `assets` 在整体比对处被拒，构建元数据变化仍通过；重复键、2^53 池 ID、链接文件被拒；读取后替换源清单（forge 垫片在首次调用时把恶意清单换回已签版本）仍被拒且激活内容不变。变异检查：换回改动前的导入器与校验器后，这 5 个用例全部失败 |
| A11 | 时间锁模型的工具：DeployV16、`PrepareSafeAcceptanceV16`（改为生成接线与激活的 `scheduleBatch`，D1）、`V16Snapshot`、`verify_governance.py`、`ReleaseDigestV16`、K0-4 全部改到时间锁模型，核验项见 §10；发布记录纳入 `verify_governance` 输出的 `checkpointSha256`，经签名后供 Release Gate 与 K0-4 增量回放（A1 已提供接口）；本机 RPC 输入同 A1，CI 用公共 RPC | 复核 M-1、§3.3.3 | `script/DeployV16.s.sol`、`script/release/` | P6（预排队操作）、P2（guardian 否决）型负向用例。**已完成**（2026-10-12，本地，按 ADR-0037 §9、§10）： （1）部署：`DeployV16` 先部署时间锁（延迟 259,200 秒；proposer 为 Safe，canceller 为 Safe 与 guardian，任何人执行），其余合约构造时治理即时间锁，部署者无任何角色、不做接线；guardian 必须是独立多签（Safe 代码、所有者与控制哈希钉住，至少 2 个签名人，与 Safe 不重叠）。广播前在模拟部署上演练接线与激活，按发布核验检查结果后恢复状态，接线会失败或接错即不广播。 （2）操作：`script/release/V16Batches.sol` 只从快照推出接线批次（ADR §9 第 2 步，另加与 Bank 构造默认值不同的参数：解锁流水 20 USDC、holdback 归属 1 天，ADR 已补）与激活（`setPoolActive(true)`，前驱为接线）；两个操作 ID 写入快照并由发布摘要签名。`PrepareTimelockBatchesV16`（`make timelock-batches-v16`，取代 Safe 接受包）在 fork 上用实际地址演练剩余部分，写出两个 Safe Transaction Builder 文件与供 72 小时审查公开的操作文件。本机节点实测：接线排队 210,587 gas，执行 1,183,518 gas（22 个调用）。 （3）核验：`V16Snapshot` 分 Deployed、Release（上线前发布状态：接线已执行、激活未执行、池未激活、Bank 未暂停、hub 注册且放行、无停用游戏）、Live（之后任意时刻：只接受降风险的变化，池激活须是发布的激活已执行）；`verify_governance.py` 从早于时间锁创建的起始块回放时间锁的角色、延迟与操作和全部治理事件（§10 第 1–7 项），每页一次 `eth_getLogs` 覆盖全部合约（Base 公共 RPC 实测支持多地址），模式同上（`GOVERNANCE_VERIFY_MODE`），检查点升到 V2。发布记录在快照摘要之外签入签名时那次核验的检查点，发布包带检查点文件，Release Gate、打包与镜像导入（live 模式）从它增量回放。时间锁 runtime 钉入 `coreRuntimes`。 （4）清单：能否下注是激活后的链上状态，快照、摘要、发布说明与清单去掉池激活标志，清单带时间锁地址；SDK、keeper 与页面服务发布里的全部池，下注规划在签名前实时读 `isPoolActive`，房间对未激活的池单独提示（五种语言）。 （5）K0-4（§10 第 9 项）：`script/ops/config-drift-monitor.py` 合入 `master`（分支 `k0-4/config-drift-alerts` 的版本按时间锁模型重写）：时间锁操作在排队、就绪前 12 小时与就绪未执行时告警（D5），每个排队调用按认证产物做准入审查（D4；`transferGovernance` 与 `acceptGovernance` 一律不过，ADR §3 已补），ADR §7.3 第 4 条的作废告警，从签名检查点起的 live 核验，认证域检查与 `openHolds` 容量告警；排队、准入审查、作废窗口与作废后同路径结算推送公开频道；本机以 launchd 经 `with-ops-rpc.sh infura` 运行，服务器另有 systemd 单元。 （6）测试：DeploymentV16 36 项、CertifiedRuntime 7 项；校验器 28 项，对其关键判定的 8 个变异全被抓到；新增变异 M32、M33 被抓到，M28、M30 锚点改为唯一；K0-4 59 项（对新规则的变异全被抓到）；单元测试 465 + 36 项，ops 231 项；三个全新克隆上 Release Path 通过（3 分 33 秒）；前端 CI 各步骤本机通过（含 Postgres、Anvil 集成与钱包 e2e）。Governance Replay 作业及其夹具（已放弃的部署）删除。 （7）剩余（Owner）：建 LP 可见的公开 Telegram 频道并把 bot 设为管理员；决定 K0-4 的常驻主机（Mac 休眠会推迟告警，价值网络前宜放在常开的主机） |
| A12 | 恢复证书 v5 所需的复现工具（v4 依赖的 `h1-callback-cost-certificate-2026-10-04/`、`callback-cost-certificate-2026-10-04/`、`takeover-2026-10-07/`）纳入仓库或证据索引 | 复核 M-8 | 归档 `dist.tar.gz`、外审交付 r2 | 在新检出上能复现 v4 的关键数值。另：审计交付的 102 个对抗性 gas 病例（`independent-audit-2026-10-10/tests/audit-adversarial-gas-cases.json`）纳入 v5 矩阵，集中额度病例按 A9 记录 `PROFIT_SEED`。**已完成**（2026-10-11）：`script/certificate/reproduce_first_callback_v4.py` 在全新克隆（`48422a4a7`，v4 合约）上从归档完整重跑，含模块界与 Baccarat 展开：41 个文件比对 0 处差异、无接受的例外，关键数值与 v4 一致（树 994,571、Vault `844ba36c…`、余量 +127,744 / +149,917 / +7,980 / +30,153）；用时 3 小时 31 分（模块界 2 小时 49 分、Baccarat 25 轮 39 分），内存峰值 32.7 GB。B9 起合约已变，v4 只在 `4a5762aa3` 上复现。102 个病例以审计原名放入 `test/helpers/nft-callback/gas-audit-adversarial-cases.json`（全部为集中额度，96 个断言前缀覆盖、6 个断言拒绝），各记种子 4，由 v5 矩阵首次运行逐例核对 |
| A13 | Denim 适配（链下工具）。Base Sepolia 2026-10-21 18:00 UTC、主网 2026 年 11 月起每秒 5 个块；`block.timestamp` 仍以秒计，同一秒约 5 个块共用一个时间戳；RPC 只新增可选的毫秒字段；BaseTime 存入占 tx[1]。合约不受影响：不使用 `block.number`，时限都按秒；GameHub 固定的 3 个 VRF 确认从约 6 秒缩到约 0.6 秒，记为残余。按块计数的链下逻辑在时间上缩为十分之一，负载变为十倍。测试网部署会在 Denim 之后，以下须在部署前完成。<br>**已实施**（2026-10-14，Owner 当日决定实施，备用 keeper 改用 Infura）：<br>(1)(4) `0787ff0d5`：K0-4 的确认与作废尝试改按秒（`DRIFT_CONFIRMATION_SECONDS` 24、`DRIFT_VOID_ATTEMPT_SECONDS` 600），模拟每秒 5 块、同秒共用时间戳；治理回放分页随端点（Infura 10,000、Alchemy 免费档 10、其他 200）。<br>(a) `41832e4f4`：keeper 与网页共用一份健康快照字段表，类型检查防止再次漂移。<br>(2) `560c19e53`：keeper 默认每段 2,000 块，每轮 10 万块（Denim 下约 5.5 小时）；被截断的一轮把 `scan` 标为降级，直到某一轮到达链头，账本与治理扫描未到最终块时同样降级。`7fab89d82`：payables 发现状态存于 `KEEPER_STATE_DIR`，重启后核对所存块的哈希再续扫，不符或文件无效则从发布块重放，保存失败即降级；生产 compose 新增 `keeper_state` 卷。<br>(6) `2026c19e5`：bet-index 回填止于最终块（删除 `BET_INDEX_CONFIRMATIONS`），默认每段 2,000 块；开发启动的回退改为 `KEEPER_DEV_REWIND_SECONDS`。<br>(3)(b) `a5f1209da`：终态证明按 `resolvedAt` 在终态后 500 秒内按日志定位；LP 账本每次查询 200 块（公共 RPC 实测 201 块可、202 块 HTTP 413），`getProviderLedger` 须给出起始块。`33606c5b9`：浏览器索引等待 24 秒、回读 48 秒，按实测出块速率换算块数，每次查询 200 块；运维页按秒判断延迟。`ccd4560da`：收据回退（生产唯一开启的 RPC 回退，此前每段 2,000 块在公共 RPC 上必被拒绝）按 `placedAt` 与 `resolvedAt` 只读该注自己的区块；其余回退确认 4 秒、每次 200 块。<br>(5) `ba342b505`：Release Gate 上限 90 改 240 分钟、镜像构建 60 改 180 分钟（公共 RPC 实测每页约 1.7 秒，签名后每天多约 1 小时），手册要求签名当天 dispatch。<br>(7) K0-4 手册、bet-index 手册与 A1 估算已按 Denim 改写。(c) 见 §12：备用 keeper 用 `INFURA_API_KEY_OPS`。<br>实施中的取舍：keeper 每轮预算取固定的宽裕值并在截断时降级，而非按出块速率推算；最近下注、玩家、推荐与 LP 账本接口的 RPC 回退窗口是调用预算而非时长（按时间换算会使 Denim 后调用量变为十倍），保留块数并改为以更少调用覆盖原时长，生产环境这几项回退关闭；浏览器端 Bank 索引器从未接入（worker 未启动、表无人读取），未改，已另行删除（连同三张 Dexie 表）。<br>独立复核（2026-10-14，见 C6）：REWORK——收据回退遗漏长周期投注的终态（P2）与跨速率切换的确认时长（Info），均已整改，待复核。<br>剩余：Denim 激活后在 Base Sepolia 上实跑 keeper、K0-4 与治理回放各一次（验收）。<br>评估原文——必须改（行为或告警出错）：<br>(1) K0-4：`DRIFT_VOID_ATTEMPT_BLOCKS` 300（10 分钟变 1 分钟就告警）与 `DRIFT_CONFIRMATIONS` 12（24 秒变 2.4 秒）改为按秒；<br>(2) keeper：每轮默认预算 50 段×10 块 = 500 块（100 秒），间隔超过 100 秒就会永久落后，而健康仍显示 running，改为按出块速率与间隔推算；payables 每次重启都从发布块全量重扫，历史增长十倍，改为持久化游标；<br>(3) SDK 与网页：终态证明回看 250 块（500 秒变 50 秒）、LP 账本默认窗口 10 万块（55.6 小时变 5.6 小时）、浏览器索引的 12 块确认与 24 块回卷，以及最近下注、玩家、推荐、收据窗口与 2 块确认，改为按时间；运维页按块数判“停滞”会在正常同步时误报，改为按秒。<br>应改（负载与耗时十倍）：<br>(4) `verify_governance` 与 K0-4 每页 200 块：本机发布与 K0-4 走 Infura（实测每页上限约 10,000 块）时放大分页。发布签名时的治理核验从部署块全量回放，72 小时接线后约 6,480 页，同样改用大分页；<br>(5) Release Gate 走公共 RPC（实测上限 201 块），从签名检查点回放：签名后每晚一天 dispatch，就多约 2,160 页，作业上限 90 分钟，须在签名后尽快 dispatch，或调整超时；镜像工作流 60 分钟同理；<br>(6) bet-index 回填默认 10 块一段、2 个确认。<br>(7) 文档：A1 的主网估算、K0-4 手册的预算数字与“每个块时间戳都递增”的说法、bet-index 手册的确认数与块数。<br>评估中发现的现存缺陷（与 Denim 无关）：<br>(a) 网页端 keeper 健康快照的字段白名单缺 `voids`、`governance`、`vaultProviderLedger` 与部分 `degradedBy` 值。自 D 起每份快照都被判无效，`/healthz` 的 keeper 检查报 degraded，运维页显示 keeper 已停止；<br>(b) Base 公共 RPC 的 `eth_getLogs` 上限实测 201 块。LP 账本回退（1,900 块）、收据回退（2,000 块）、浏览器索引（2,000 块）都超过它，走公共 RPC 时会被拒绝（HTTP 413）；<br>(c) `ALCHEMY_API_KEY_OPS` 是 Alchemy 免费档，`eth_getLogs` 每次最多 10 块。§12 中用它做主网备用 keeper 的 HTTP：Denim 之后约每秒一次日志查询才能跟上，需另选服务商或升级。 | Base 升级页与规格；`eth_config`；代码通查与实测 | keeper、SDK、web、bet-index、`script/ops/config-drift-monitor.py`、`script/release/`、`.github/workflows/`、`docs/ops/` | 每项改动都有测试；K0-4 测试加入每秒 5 块、同秒共用时间戳的模拟；前端 CI 全过；Denim 激活后在 Base Sepolia 上实跑 keeper、K0-4 与治理回放各一次 |

## 7. 工作包 B：合约（改字节码）

本节记录 Owner 的决定与方向；接口、状态、事件与参数以 [ADR-0037](../adr/0037-launch-candidate-authority-pause-capacity-void.md) 为准。

### 7.1 准入时间锁（F-03）

- 实现：OpenZeppelin `TimelockController`（依赖已有 v5.5）作为 PoolRegistry、GameHub、每个 Bank、ReferralRegistry 的治理方。
  `minDelay = 259,200`；`proposers = [Safe]`；`cancellers = [Safe, guardian]`；`executors = [address(0)]`；管理员设为 0。
  用 `GovernanceTimelock`（只扩展构造函数与 `updateDelay`）在构造时授予 guardian 取消权，没有临时管理员，也不用 `minDelay = 0` 的引导方式（P6）；延迟在合约里不能低于 72 小时（D7）。
- 合约增加降低风险角色 `sentinel`（由 Safe 持有），承担立即生效的操作；它的持有人经时间锁设置。
- 新池的 Bank 与新 hub 必须由同一时间锁治理；链上的同治理检查只防误配，准入的安全边界是 72 小时队列加对照认证产物的准入审查（D4，含 Bank、Vault、资产、hub 与模块的代码不可变，S-6）。

| 函数 | 归类 |
| --- | --- |
| `transferGovernance` | 经时间锁；新治理方之后可以随时 `acceptGovernance`，所以转移本身是关键操作，K0-4 对 `GovernanceTransferStarted` 告警；发布核验要求四类合约 `pendingGovernance == 0` |
| `registerPool` | 经时间锁 |
| `setPoolActive`、`setHubRegistered`、`setHubAllowedForPool` | `false` 立即生效；`true` 经时间锁。停用只拦新仓位，已准入的恶意 hub 只能在执行前取消 |
| `setRefundTimeout` | 经时间锁 |
| `queueEdgeChange` | 经时间锁，与现有 7 天延迟叠加共 10 天 |
| `cancelEdgeChange` | 立即生效 |
| `createReferralConfig`、`setActiveReferralConfig` | 经时间锁（会触发重新认证） |
| `registerGame` | 经时间锁 |
| 新增 `disableGame`（B6） | 立即生效；不提供重新启用（需要时以新 `gameId` 经时间锁重新登记） |
| `setRiskInPaused(true)` | 立即生效（降低风险角色或 guardian） |
| `setRiskInPaused(false)` | 经时间锁（§7.2 之后暂停不再冻结 LP 提款，可以维持） |
| `setMinBetAmount`、`setRiskReserveBps`、`setWithdrawalBufferBps` | 任何方向都经时间锁（Owner 固定值） |
| `setHoldbackVestingSeconds`、`setMinPlayerTurnoverForUnlock` | 经时间锁 |
| `setGuardian` | 经时间锁（guardian 能取消对自己的撤换，见 §9） |
| `rescueToken`、`claimProtocolFees` | 经时间锁 |
| `setSettlementRouterOnce`、`setRandomnessConsumerOnce`、`setBinderOnce` | 部署时一次性设置，之后回滚；发布核验确认值正确 |
| 撤销排队操作 | 立即生效（Safe、guardian） |
| 新增作废（B5） | 见 §7.4 |

**72 小时的依据**（复核 §3.3.2）：LP 在时间 t 能完整退出，需要同时满足：没有未入账结果；会计有效；NFT 已过冷却（入金或上一次部分提取后 24 小时）；
`assets ≤ L − K`（否则只能部分提取并重新冷却）；USDC 转账可成功。设察觉延迟 d、剩余冷却 c、`L − K` 足够所需时间 u、部分提取次数 n，
退出时间约为 `d + max(c, u) + (n − 1) · 24h`。窗口开头**停用池**（不是暂停）且没有未入账结果时，u 不超过退款期限（当前 1 小时，最长 1 天），
n = 1，只要 d < 48 小时，72 小时就够；池保持开放且有对手方持续下注时，大额 LP 不保证完整退出。为让 d 足够小，排队告警推送到 LP 可见的公开渠道（S-9）。

### 7.2 暂停语义（复核 B-1）

暂停只阻止新下注与新存款，**不阻止 LP 提款**；入账门禁（`UnbookedResult`）、会计有效性、重入保护、24 小时冷却与 `L − K` 照旧。
这与主流做法一致（Compound 的 pause guardian 不能暂停赎回；Morpho 金库没有提款暂停），并落实审计 F-03 建议的后半句。
XP 与协议费领取也不受暂停限制，只保留出金安全域检查（D6）。审计 F-04 因此从“注释”变为“行为改动”。应急规程：出现可疑排队操作时，用停用池或撤销，不用 Bank 暂停。

### 7.3 guardian（复核 B-1）

guardian 是独立多签，签名人与 Safe 不重叠，不使用 EOA。它能取消一切排队操作（包括对它自己的撤换），这一否决权写入残余（§9）。
测试网验收演练“发现 → 停用或暂停 → 撤换 guardian → 解除”的全过程并计时。

### 7.4 无法入账结果的作废（复核 B-2）

现状：VRF 送达时 `VRFHub.unbookedResultCount[bank]` 加 1，结算确认后减 1；计数大于 0 时 Vault 的 `addDeposit` 与 `withdrawDeposit` 回滚
（防止 LP 在结果公开、尚未入账时抢跑）。结算确定性失败时计数永不归零，该池 LP 现金永久冻结；现有 `refund` 只适用于 VRF 未送达。

设计：

1. **先尝试结算**：作废交易先在 only-self 的 `finalizeFromCallback` 子帧里尝试结算，调用前要求 `gasleft() · 63/64` 不低于固定下限
   （远高于 v5 主口径上界，定为 1,000 万，公式含 EIP-150 一项，子帧固定拿下限，D3）；成功就正常入账，失败才进入作废分支，并记录失败前缀。作废分支不依赖模块、引擎、树写入与 token 转账。
2. **资格期 24 小时，自 `vrfRequestedAt` 起算**（下注记录已有该字段，回调不增加 gas）。72 小时退出窗口里至少还剩 48 小时。
3. **触发人**：时间锁、Safe（sentinel）或该 Bank 的 guardian 开作废窗口；窗口内与 `vrfRequestedAt` 起 7 天后的执行都无需授权（同样先尝试结算）。冻结因此有上限，不依赖 Safe 是否可用。
4. **与结果无关**：Base 单笔交易上限 16,777,216 gas，一笔只能尝试一次结算，所以按 Bank 开窗、逐笔执行（D2）。开窗人不能逐笔挑选；开窗时机与执行顺序的裁量由运营规则与 K0-4 告警约束（ADR-0037 §7.3）。
5. **状态覆盖**：包括 VRFHub 为 Received 而 GameHub 仍为 PendingVRF 的情形：作废入口先记录随机数，与 `finalize` 相同。
6. **会计**：P −= stake，PP += stake；R −= reserved，K −= released，树与 Vault 现金不动；`unbookedResultCount` 恰好减 1，与 `acknowledge` 互斥；
   `openHolds` 计入作废；F-05 名额同时释放；暂停期间也能执行；玩家用现有 `claimPlayerPayable` 领取。
7. **改动面**：GameHub（入口与终态）、SettlementRouter（`voidPosition`）、Bank（`voidBet`，onlySettlementRouter，记 `playerPayable` 不转账）、
   VRFHub（Received → 终态并减计数，在回调路径上，计入 v5）、对应接口与 `SSOTTypes`；LiquidityVault 不改。
8. **范围外**：会计类故障（发行方没收、USDC 语义改变）时作废同样失败，此时 LP 门禁本来就是 `InvalidAccounting`。
9. **规则变化与披露**：发布清单中“未知错误不能把赢家变成退款”改为“结算确实失败、自请求起满 24 小时后作废，退还本金”；VRF 原生费不退；写入条款并向玩家与 LP 披露。

### 7.5 每玩家持仓上限（F-05）

在 Bank 层实现（`holdBet` 与 `_applyHold`），计数与 turnover 放在同一个存储槽（ADR-0037 §5），审计 PoC 绕过 GameHub 直接开仓也被拒；Bank 级 128 保留。
残余：64 个地址即可占满 128 个名额（Sybil）；评估 VRF 单价下的攻击成本，为 `OpenHoldLimit` 设告警。
容量（Owner 确认）：每个 Bank 的吞吐约为 128 除以回调时延。

### 7.6 合约工作项

| 编号 | 内容 | 来源 | 位置 | 验收 |
| --- | --- | --- | --- | --- |
| B0 | 设计冻结：B1–B6 的接口、状态、事件与参数定稿，独立评审并送外审方预审 | 复核 S-2 | `docs/adr/0037-launch-candidate-authority-pause-capacity-void.md` | **已完成**（2026-10-11）：两轮独立复核无阻断，Owner 定 D1–D7；外审预审由 Owner 发送 |
| B1 | 准入时间锁（§7.1）与 `sentinel` | 审计 F-03 | `src/access/Governable.sol`、`src/core/PoolRegistry.sol:22-56`、`src/core/GameHub.sol:150-249`、`src/core/Bank.sol:119-235` | 时间锁窗口内（包括暂停时）成熟 NFT 可以提取；恶意 guardian 不能冻结 LP 资金；交接时没有预排队操作（P6）；角色集合经事件回放核对；审计 PoC 的 F-03 用例被拒。**已完成**（2026-10-11，本地，按 ADR-0037 §2、§3）：新增 `GovernanceTimelock`（OZ `TimelockController` 5.5；构造拒绝低于 259,200 秒的延迟、零 proposer 或 canceller 和兼任 proposer 的 canceller，admin 为零；`updateDelay` 低于 259,200 报 `DelayBelowMinimum`）与 `Sentinel`（`setSentinel` 只限治理，零值关闭该角色）；PoolRegistry、GameHub、Bank 继承 `Sentinel`。加风险方向（`registerPool`、`setHubRegistered(true)`、`setHubAllowedForPool(true)`、`setPoolActive(true)`）只限治理，降风险方向治理或 sentinel 即时生效；`registerPool` 与 `setHubRegistered(true)` 要求目标与注册表同一治理且无待接任，否则 `ForeignGovernance`（低层 staticcall 判断，EOA 同样被拒）；`cancelEdgeChange`、`disableGame` 为治理或 sentinel；暂停为治理、sentinel 或 guardian，解除只限治理。GameHub 20,610 字节；回调 gas 各 +110。`LaunchAuthority.t.sol` 按 D1 部署（各合约构造时治理即 T，Safe 排接线批次，72 小时后任何人执行，激活另需一笔），13 个用例：角色与部署者无权（R1，含 P6：没有交接，也就没有预排队来源）、构造与延迟下限（D7）、准入须等 72 小时且上线时池未激活（F-03、R2）、误配 Bank 在执行时被拒（R4）、sentinel 只降不升与撤销调价（R3）、就绪即可执行且不过期（R7、D5）、guardian 在等待期撤销、Safe 放弃 proposer 即冻结（R-8）、暂停只挡存入（P1）、恶意准入排队时 LP 在窗口内全额退出（P4）、恶意 guardian 冻结不了 LP、玩家与推荐方资金（P3，B3 后成立）；注册表另有 sentinel 方向与同治理检查用例，尺寸测试覆盖时间锁。用 EOA 当 hub 的旧测试改为写入 `test/utils/GovernedStub.sol`。事件回放核对角色与部署工具随 A11，审计 F-03 PoC 随 B8 |
| B2 | 每玩家 2 个持仓（§7.5） | 审计 F-05 | `src/core/Bank.sol:34, 486`、`src/core/GameHub.sol:323-413` | 审计 PoC 的 F-05 用例被拒；第 3 个持仓被拒，结算、退款或作废后释放。**已完成**（2026-10-11，本地，按 ADR-0037 §5）：`_playerTurnover` 原位换成 `PlayerAccount { uint248 turnover; uint8 openHolds; }`；`holdBet` 在全 Bank 检查之后拒绝第 3 个持仓（`PlayerOpenHoldLimit(player)`）并计数，`_applyHold` 减计数（结算、退款，B5 的作废同样经过它），成交量经 SafeCast 写入同一槽；`IBank` 增加 `MAX_OPEN_HOLDS_PER_PLAYER()`（2）与 `openHoldsOf`。新玩家的槽在下注时建立，所以八个游戏的最大冷回调 gas 各降 16,318（评审估计首次玩家 −15,937）。用例：Bank 层第 3 个被拒、他人不受影响、结算与退款各释放一个、成交量同槽；两个 hub 共用计数；GameHub 端到端被拒、按 Bank 计；128 槽用例改为 64 个地址各 2 个（残余 R-4）。作废释放随 B5，审计 F-05 PoC 随 B8，前端的专门提示随 D |
| B3 | 暂停不阻止 LP 提款（§7.2），guardian 注释同步 | 审计 F-04；复核 B-1 | `src/core/Bank.sol:130-141, 276-295`、`src/core/LiquidityVault.sol:107-128` | 复核 P1、P2 型用例：暂停与恶意排队同时存在时 LP 仍能退出。**已完成**（2026-10-11，本地，按 ADR-0037 §4）：`lpAccounting` 不再看暂停，`LPStatus` 去掉 `Paused` 并重新编号；`riskInPaused()` 移到 `ILiquidityVaultBank`，Vault 在暂停时以 `DepositsPaused()` 拒绝新存入，提款仍受未入账结果门禁、会计有效性、重入锁、24 小时冷却与 `L - K` 约束；按 D6 (a)，XP 与协议费领取去掉暂停检查、保留出金域；`RiskInPausedSet` 加 `caller`；guardian 注释同步。为免解码错位，SDK 状态表、keeper 池健康的状态常量与 earn 页（存入改看 `riskInPaused`，五种语言文案写明提款照常）同步改；其余应用层随 D，文档随 C5。新增用例：暂停时存入被拒、提款仍过门禁、冷却与 `L - K`；暂停时结算、XP 解锁与领取、协议费领取与 NFT 提款照常；暂停下领取仍受出金域约束；暂停事件带调用方。回调 gas 不变。含时间锁排队的 P1、P2 完整用例随 B1 与 B8 |
| B4 | 删除 `_allocationLeaf` 在 `maxLoss == 0` 时的死分支；按 ADR-0034 失效条款重新论证 R1 | 冻结签核 FC5；复核 M-9 | `src/core/LiquidityVault.sol:224` | `test_lossWithZeroReleasedCapitalIsRejected` 与树等价门槛不变。**已完成**（2026-10-11，本地）：`_allocationLeaf` 只剩 `if (cutoff == last) return cutoff;`，Vault 运行时 15,708 → 15,693 字节，八个游戏的最大冷回调 gas 各降 58；Bank 只因 import 了 Vault 而元数据变化。重新论证写入 ADR-0034 失效条款之后：B4 不改任何树写入，P1–P4、不变量 I、定理与 UNUSED_SUFFIX 不受影响。本地 unit 420、部署 25、准入 13、差分 18、不变量 5、ops 161 通过；域文件钉定已重生成 |
| B5 | 作废（§7.4） | Owner；复核 B-2、M-5 | GameHub、SettlementRouter、Bank、VRFHub、接口与 `SSOTTypes` | 可入账的下注在作废交易里被正常结算；24 小时前与非授权调用被拒，7 天后任何人可执行；计数恰好减 1；暂停下可执行；发行方冻结 Vault 或 Bank 时可作废（P5a、P5b）；会计类故障不在范围（P5c）。**已完成**（2026-10-11，本地，按 ADR-0037 §7）：三个状态枚举末尾追加 `Voided`；GameHub `openVoidWindow`（治理、sentinel 或该池 Bank 的 guardian，需 Router 报告有未入账结果，否则 `NoUnbookedResult`）与 `voidBet`（资格按 `vrfRequestedAt` 与 `voidCohortEnd`；`PendingVRF` 先记录随机数；gas 检查含 EIP-150 一项，否则 `VoidGasTooLow`；子帧恰好得到 1,000 万 gas，成功即正常结算并返回 false，失败才作废，记录 revert 前 32 字节）；Router `voidPosition`、Bank `voidBet`（应付款加 stake 并发 `PlayerPayableCreated`，`totalBetsVoided`、`totalVoided`，`getPerformance` 末尾追加两项）、VRFHub `acknowledgeVoid`（与 `acknowledge` 互斥，计数减 1）。Vault 未改：`cost == stake` 只释放锁定资本，按 ADR-0034 失效条款已重新论证。GameHub 22,299 字节（预算 23,552），所以 §10 的三个转发函数暂留，随 D 迁移 SDK 与页面调用方时删除；回调 gas 各 +385。`VoidBet.t.sol` 14 个用例（评审 V1–V13 与 C1、G1；V12 按 B0-M5 改为断言 `PlayerPayableCreated`）。隔离、冷状态下：最低可过 gas 时模块仍看到 9,821,958 gas（子帧拿足预算）；最小交易 gas 上限 10,669,555，距 2^24 余约 611 万；花光预算后的其余开销 115,274，两倍低于预留 600,000（模拟代币，真实 USDC 的 fork 测量随证书 v5）；该用例加入 `make test-casino-admission`。D 待办：SDK 把 `Voided` 显示为进行中、keeper 遇到 `Voided` 请求会抛错、索引与 K0-4 需接新事件 |
| B6 | 单个游戏即时停用（无重新启用） | §7.1 | `src/core/GameHub.sol` | 停用后该游戏下注被拒，已有下注照常结算、退款或作废。**已完成**（2026-10-11，本地，按 ADR-0037 §6）：`gameDisabled` 映射追加在存储末尾；`disableGame` 对未注册游戏报 `UnknownGame`、对已停用游戏报 `GameIsDisabled`，发出 `GameDisabled(gameId, caller)`；`placeBet` 与 `quoteVRFFee` 拒绝已停用游戏；不能重新启用（`registerGame` 拒绝已用过的 `gameId`）。暂为 `onlyGov`，B1 加入 sentinel 后改为治理或 sentinel。GameHub 运行时 19,947 → 20,370 字节（预算 23,552）。用例：权限、未知与重复停用、不可重新注册；停用后报价与下注被拒、不建仓位、其他游戏照常；停用前的下注照常结算与超时退款。作废用例随 B5；前端读取 `gameDisabled` 与 K0-4 告警随 D 与 A11 |
| B7 | 宪法与规范对应修订的合约侧注释 | 复核 M-6 | 见 C5 | —。**已完成**（2026-10-11，本地）：B1–B6 落地时同步改写 NatSpec（暂停只挡新仓位与存入、guardian 冻结不了资金、sentinel 只降不升、作废路径），各处引用 ADR-0037 相应节；另改 `IBank.totalRefunded` 与 `totalBetsVoided` 的说明、`SSOTTypes.BetTerminal` 的终态（含 `Voided`）。宪法 `SSOT.v1.6.md:125-130` 等仍写旧规则（暂停挡 LP、无强制退款），按 C5 经 Owner 批准后修订 |
| B8 | 审计 PoC 与复核 PoC（P1–P6）并入回归 | 审计；复核 | `test/` | 全部通过。**已完成**（2026-10-11，本地）：`test/unit/AuditRegression.t.sol` 把审计 F-03（准入即可掏空 LP）、F-04（guardian 暂停冻结 LP）、F-05（一人占满 128）和规划复核 P3（不可入账结果覆盖整个时间锁窗口）、P4（部分提取重启冷却，残余 R-2）改写为在候选版上被拒或按披露成立，5 个用例；文件头列出其余 PoC 的所在：审计 F-01、F-02 在 `CertifiedRuntime.t.sol`、`CallbackDomainV16.t.sol`，模块普查与树差分在 `test/diff/`，规划复核 P1、P2 与 B0 复核 R1–R7、P1、P3、P4 在 `LaunchAuthority.t.sol`，P5a–c 与 V1–V13 在 `VoidBet.t.sol`，C1、C2、G1、G2 在 B2、B6 的用例，P6 因 D1 无引导期、构造即 72 小时下限而不可能发生（`LaunchAuthority.t.sol` 覆盖） |
| B9 | 体育移出本版：`SportsHub`、`SportsRiskEngine` 及接口；`SSOTTypes` 中的体育域与类型；DeployV16 的体育参数；发布脚本中的体育角色核验；体育测试与夹具 | Owner 选项 A | `src/core/Sports*.sol`、`src/core/interfaces/`、`script/DeployV16.s.sol`、`script/release/`、`test/` | 编译与全部门槛通过；`git grep -i sports` 只剩 ADR 与路线图中的未来规划。**已完成**（2026-10-11，本地）：删除 SportsHub、SportsRiskEngine 及其接口；`PoolDomain` 只剩 `Unknown, Casino`，PoolRegistry 拒绝 Unknown、ABI 解码拒绝其他值，所以 GameHub 的逐笔域检查（`_casinoPool`、`WrongPoolDomain`）一并删除，GameHub 运行时 20,046 → 19,947 字节；DeployV16、V16Snapshot、发布摘要、清单、说明、回调域核验、`verify_governance.py`、校验助手与前端 ABI 不再含体育；前端、keeper 与下注索引的体育页面、API、恢复与终结器因 ABI 删除提前移除（原随 D），release schema 只接受 `domainId 1` 与 `"Casino"`；文档见 C8。认证运行时改变是 ADR-0006 的重新认证触发：84532 域文件改为 `PENDING_INDEPENDENT_REVIEW`，钉定按当前构建重生成，证书 v5 取代 v4；v4 只在 `4a5762aa3` 上复现。本地：unit 420、部署 25、准入 13、差分 18、不变量 5、ops 161，前端 typecheck、lint、测试（1198 通过，31 项缺 Postgres 或 Anvil 条件跳过）与构建通过。`git grep -i sports` 剩 ADR-0029（加了修订说明）、ADR-0032、宪法（修订见 C5）、本规划、路线图，以及代码里 `transports` 的误报 |

## 8. 工作包 D：应用层（复核 M-7）

ABI 重新生成；keeper 处理作废、停用游戏与持仓上限；索引 schema 与事件（作废、停用、时间锁排队）；SDK 错误类型；前端展示排队中的治理操作、持仓上限提示与作废收据；
移除体育相关页面与 keeper 逻辑（随 B9）；查明并处理 keeper 遇到 RPC finalized 高度回退即降级的问题（2026-10-11 生产健康 `degraded`：47969422 → 47969244）。验收沿用审计范围的 Consumers 一行：真实 Anvil、PostgreSQL、WS/HTTP 断线恢复。

**已完成**（2026-10-12，本地）：
- SDK：B 的新错误各有错误码；`voided` 状态与终态证明；`getVoidStatus`、`voidBet`（显式 1,100 万 gas）；下注规划在钱包签名前拒绝已停用游戏与已满的每玩家上限；快照增加未结持仓、作废合计与池激活状态；推荐绑定改走 ReferralRegistry；时间锁地址与排队调用的解码。
- keeper：作为运营方的作废执行者（ADR-0037 §7.3 规则 3），结算失败（含 gas 耗尽）后按 `vrfRequestedAt` 顺序逐笔作废，重启后等恢复扫描追上再执行；RPC 节点报告的 finalized 高度回退不再降级（即 2026-10-11 的生产问题，原因是负载均衡的节点不一致），finalized 一小时不前进、未入账结果超过一小时、缺块读取持续五分钟才降级；索引时间锁操作。
- 索引：作废的下注、作废窗口与停用游戏；时间锁操作、延迟变更与游标（Postgres 与内存）；作废的支付证明。现有库需重建（没有迁移代码）。
- 页面：作废显示为本金已退回并可在收据领取；卡住的下注显示何时可作废，到期后任何人可以作废；大厅隐藏已停用游戏，其房间显示已关闭；房间显示每玩家上限，待结算的下注不锁房间；玩家应付款从 Earn 移到领取页；池已注册未激活时开放存入；Earn 向 LP 列出时间锁的排队变更，运营页列出全部操作、作废窗口与停用游戏；原始合约错误改为五种语言的本地化文案。
- 验收：本机真实 PostgreSQL 与 Anvil：前端单元测试 1,555 项通过（索引库 130 项连 Postgres）；`bank_sdk_integration.sh`（SDK 7、web 8）、`keeper_integration.sh`（5 个场景，含作废与时间锁）、`bank_wallet_e2e.sh`（1）通过。
- 交给 A11 的两项已由 A11 处理：发布清单去掉 `pool.active`（发布里的池都由本版服务，能否下注是链上状态，页面与 SDK 实时读 `isPoolActive`），清单带 `governanceTimelock`；快照的起始块早于时间锁的创建，回放与索引都从这里开始，构造时的 `MinDelayChange` 与 `RoleGranted` 都在范围内。

## 9. 残余（维持接受或新增，逐项披露）

| 残余 | 处理 | 披露位置 |
| --- | --- | --- |
| R1 预检跳过依赖树不变量 I | 维持；B4、B5 后按 ADR-0034 失效条款重新论证（B4、B5 已论证，见 ADR-0034） | 证书 v5、ADR-0034 |
| R6 外部变化（USDC 升级、VRF 参数、硬分叉）使证书失效 | 维持；K0-4 告警与手册兜底 | 证书、运维手册 |
| 证书只覆盖 k>0 | 维持；k=0 由参数下限与治理规则排除 | 证书 |
| 应急顺序 | 维持 | ADR-0006 |
| 按网络认证 | 维持；主网单独认证 | 证书 |
| Bank 存储包络是分支最大值之和 | 维持 | 证书 v5 |
| 解释器口径依赖设计论证 | 维持；承载余量，不承载可行性 | 证书 v5 |
| UNUSED_SUFFIX 已知例外 | 维持；Vault 不可达，有测试钉住 | ADR-0034 |
| 成交前的知情排序 | 维持 | 条款与 LP 材料 |
| F-05 Sybil（64 个地址占满 128） | 新增；告警与成本评估 | 条款与 LP 材料 |
| 作废的运营方裁量 | 新增；先尝试结算、按 Bank 开窗与逐笔执行把裁量压到最小；开窗时机与执行顺序由运营规则与告警约束（ADR-0037 R-5） | 条款 |
| guardian 否决权 | 新增；独立多签 | LP 材料、运维手册 |
| `TimelockController` 无过期 | 新增；就绪后任何人可执行，撤销只在等待期可靠：操作要么就绪即执行，要么在等待期撤销；K0-4 在排队、临近就绪与就绪未执行时公开告警（S-9、D5） | 运维手册 |
| 提款与 XP 领取没有暂停制动 | 新增（B3、D6；ADR-0037 R-6） | 条款与 LP 材料 |
| 事故期间先到先得 | 新增（ADR-0037 R-7） | LP 材料 |
| Safe 丢失则治理永久冻结 | 新增；只能清退（ADR-0037 R-8） | 条款与 LP 材料 |
| 智能合约钱包可能无法自行作废 | 新增（ADR-0037 R-9） | 条款 |
| 作废交易需要约 1,076 万 gas（常量不可改），区块 gas 上限低于约 1,280 万（加两笔存款交易）的链上作废无法上链 | 新增（2026-10-14 核对 Denim）：节点在第一个 Denim 区块把上限除以 10，按现行设置 Base Sepolia 每块 1.2 亿、主网 4,000 万；上限由 Base 的 `SystemConfig` 决定，激活后核对 | 审计范围、运维手册 |
| VRF coordinator 的最少确认数提高到 3 以上时每笔新下注都会 revert（GameHub 固定请求 3 个确认） | 新增（2026-10-14）：两条链当前为 0；`verify_callback_provider.py` 在签名前、预检与 K0-4 每小时检查中核对 | 审计范围、运维手册 |
| 发行方没收类故障时作废无效 | 新增（P5c） | 条款与 LP 材料 |
| 准入无许可：直接调用合约的钱包绕过网站的地区限制、进入确认与负责任博彩工具 | 新增（Owner 2026-10-14，合规在链下）；网站控制与运营监控 | 条款与风险免责声明（C9） |

## 10. 认证、部署与核验

- **证书 v5**（复核 M-8）：GameHub、Bank、Router、VRFHub、PoolRegistry、Vault 的 runtime 都会变，必须重做：帧界（VRFHub、GameHub 外层与子帧、Router、Bank、Vault 与 getter）、
  固定账本（v4 为 811,982）、Bank 存储包络、token 交叉检查、组合四口径、绑定（O3）、M4 中 GameHub 后置算术；矩阵加入新状态病例（每玩家上限、停用游戏）；
  模块界驱动加入逐轮单调性检查（M7，v4 复核 R-1 / 勘误 E4）；证书复核方确认 A-1 的 (a) 读法（FZ-7）；主口径余量不低于 50,000。
  `coreRuntimes` 与 `moduleCodeHashes` 重新生成并加入 `TimelockController`；域文件在新证书被接受前为 `PENDING_INDEPENDENT_REVIEW`。

  进度（2026-10-12，分五步：工具与重算、矩阵、冻结、v5 计算与封存、复核包）：
  1. **证书工具入库，变动组件重算**：**已完成**（本地，`08cc8b8db`）。`script/certificate/certify.py` 在检出上一次算出整份证书（构建、帧界、树、模块、账本、绑定、组合），
     每个阶段把脚本复制到输出目录里运行，输出目录不得已存在；各文件的来源与改动见 `script/certificate/README.md`。解释器、具体执行器与两份树分析器与 v4 封存件逐字节相同；
     另两份树分析器改用函数相对锚点（按 JUMPI 的跳转侧命名，后继从字节码推出）。全部帧改用带环境模型的解释器（`env_frame_bound.py`：逐调用点的返回字、参数长度槽，
     immutable 一律视为未知，结果与视为 0 逐值相同）：GameHub 子帧 12,667、外层 4,565（v4 手工界 13,092 / 4,541；同一模型在 H1 字节码上得 12,645 / 4,456）；
     Bank.settleBet 34,377（不再借用引擎"至多两个锁定/延付分支"的语义，比手工界 30,189 保守）；Bank 两个 getter 2,344（在 H1 字节码上与手工界 525 + 1,647 逐值相同）；
     引擎 9,577（可执行码未变，手工界 10,312）。代币调用拓扑在构建上机械计数：亏损路径 6 + 5 次 balanceOf、2 次 transfer，盈利路径 6 + 3 次 balanceOf、transfer 与
     transferFrom 各一次，与复用的代币体界 78,394 的前提一致。固定账本重推：玩家流水与持仓数同槽（ADR-0037 §5），结算时该槽必非零，流水写入由新建 20,000 变为
     2,900 + 100，Bank 存储 453,000 → 436,000，拆分合计 786,082 → 769,082。树 994,531（B4 删去一个分支，−40）。模块：八个模块 25 轮界与 v4 逐值相同（最大 Keno 206,201）；M7：六个模块逐轮 1–25、Keno 与 Baccarat 各 8、12 个轮数点，界随轮数不减、最大值都在 25 轮（Keno 20、24 轮的 164,641、197,866 与 v4 复核方抽点逐值相同）；324 个作业分进程并行，1 小时 41 分。M1 归属与 v4 相同；M6 用例在
     本构建上重生成与 v4 逐字节相同，Foundry 对拍 192 例 0 差异（`test/unit/ModuleGasOracle.t.sol`，进单测门槛）。组合（开发运行，未封存）：主口径需求 2,305,547，余量 **+142,199**（v4 +127,744）；按供给 +164,372；静态次口径 +22,435 / +44,607；O1、O2 全部满足；作废试结算的 1,000 万覆盖子帧需求 2,111,156。逐项对照 v4 用 `script/certificate/compare.py`。
     `test/certificate` 20 个负对照（锚点错位、调用无模型、返回数据过短、玩家账户占两槽、复用绑定不符、M7 失败、输出目录已存在）进 CI。
  2. **矩阵新病例**：**已完成**（本地，`c564c4135`、`d50af93f3`、`6f211ff4b`）。夹具新增 `NFT_GAS_SECOND_HOLD`（同一玩家两笔持仓，结算时 2→1）与
     `NFT_GAS_DISABLE_GAME`（受理后停用游戏），4 个病例；`run_gas_matrix.py --all-cases` 取全部病例文件的并集。首轮全量 211 例（固定区块 fork、真实 wrapper 与 USDC、
     `--require-fit --isolate-build`）：137 例执行且首次回调全部在预算内、0 次重试，最大 1,989,307（v1.6 时 2,005,280）；其余 74 例是审计病例被夹具前提拒绝，
     与审计方当时逐例相同（62 例种子使目标盈利，12 例 Coin 目标与集中额度所需的历史 Coin 游戏冲突），已从病例文件删除，保留可执行的 28 例，矩阵现为 137 例。
     作废分支用真实 USDC 在 fork 上测量（`test/fork/VoidBetUsdcFork.t.sol`，隔离）：花光 1,000 万预算后其余开销 174,970，两倍 349,940 低于 600,000 预留；
     USDC 冻结 Vault 时作废照常完成，开销相同。
  3. **冻结与全部门槛重跑**：**已完成**。冻结提交 `1a5e9df00`；`script/release/run_freeze.sh`（经 `with-ops-rpc.sh alchemy`）在干净工作区上记录提交、树与全部
     1,117 个跟踪文件的清单，阶段之间核对五次均一致，证据 `freeze-2026-10-12/`（封存 `EVIDENCE.sha256` `92904967…`，248 个文件；归档
     `2026-10-12-freeze/`，恢复核对 249 项 OK，已入证据索引）。结果：回归 526/527（1 项只在隔离模式下运行，casino-admission 15/15 含它）、
     夜间单测 503/503、diff 18/18、不变量 5/5、树门槛 53/53、证书工具 20/20、矩阵 137/137 在预算内（与开发运行逐例逐 gas 相同，最大 1,989,307）、
     真实 USDC 作废 2/2、直连 wrapper 4/4；ops 263/264——`test_manifest_authentication` 的一项夹具偶发（两个本地节点上的 Safe 模拟合约代码不一致），
     单独、整模块与全量重跑（264/264）均通过，GitHub CI 也通过。原因已查明并修复（`eda00221f`，冻结 delta 2）：Forge 1.8.5 的动态测试链接按编译集合改写用 `new` 部署 src 合约的测试文件，同文件里 Safe 模拟合约的元数据哈希随之变化（只编译夹具与连同 `DeploymentV16.t.sol` 一起编译得到不同代码），两个节点分两次 Forge 运行部署、其间又有重编译，第二个节点就可能拿到另一份代码；模拟合约移到无导入的独立文件后各种编译得到同一份代码，setUpClass 先比对两个节点上快照各地址的代码，另加单独编译的回归用例，ops 265/265。同一提交上的 GitHub 运行全部通过：CI 38204986055、
     Release Path 38204985981、Frontend CI 38204991035、Nightly Proof Gates 38204994146、Frontend Docker Images 38204986085。
  4. **v5 计算与封存**：**已完成**（待独立复核）。证书在冻结提交上算出（`freeze-2026-10-12/certificate/`，封存 `MANIFEST.sha256` `5726389a…`，78 个文件），
     组合与开发运行逐字段相同：主口径余量 **+142,199**。证书文档改写为 v5（`docs/audit/first-callback-gas-certificate-2026-10-07.md`，含 FZ-7 的读法：
     推荐与边际参数在解释器中一律未知，上界对任意取值成立；M4 后置算术源码未变）。域文件 `certificateSeal` 改引 v5（不引复核，状态仍为
     `PENDING_INDEPENDENT_REVIEW`），封存副本 `script/release/certificates/first-callback-v5/`；v4 的封存副本与复现器删除（复现器在 `4a5762aa3` 中保留）。
     冻结后对跟踪文件的这些改动按规程第 3 条记录为冻结 delta（`freeze-2026-10-12-delta-1/`）。
  5. **复核包**：**已完成**。`dist/certificate-v5-review-2026-10-12.tar.gz`（SHA-256 `267e4de5…`，包内清单 `81b9ad15…`）：冻结证据与 v5 证书、delta 1、冻结提交的源码快照、v4 组合与逐项对照、H1 字节码上的方法交叉核对（GameHub 子帧 12,645 ≤ 13,092、外层 4,456 ≤ 4,541，Bank getter 与人工界逐值相同，Bank 结算在 H1 的分支域下 28,171 ≤ 30,189，引擎 9,577 ≤ 10,312），以及请复核方确认的六项；与 delta 1 一起归档为 `2026-10-12-certificate-v5-review/`。复核包由 Owner 交给证书复核方；复核接受后域文件才改为 `CERTIFIED`。
- **部署与接管**（D1，ADR-0037 §9）：时间锁最先部署，其余合约构造时治理方就是时间锁，部署者从头到尾没有权限；接线批次先在 fork 上用实际地址回放，
  再由 Safe 排队并公开 calldata，72 小时后任何人执行，执行后池未激活、LP 可以入金；激活另排一笔 72 小时的操作，计入测试网与主网时间表。
- **发布核验新增检查**（`verify_governance.py`、`V16Snapshot`，复核 §3.3.3）：
  1. `GovernanceTimelock` 的 runtime 钉进 `coreRuntimes`，`getMinDelay() == 259200`（合约下限同值），`MinDelayChange` 只有构造那一条；
  2. 回放 `RoleGranted` / `RoleRevoked`：PROPOSER = {Safe}，CANCELLER = {Safe, guardian}，EXECUTOR = {0}，DEFAULT_ADMIN = {timelock 自身}，部署者无任何角色；
  3. 回放 `CallScheduled` / `CallExecuted` / `Cancelled`：没有未结排队操作，或只剩发布声明列出的操作；
  4. 每个 Governable 目标 `governance == timelock`、`pendingGovernance == 0`；
  5. guardian ≠ 0、≠ Safe，是独立多签（核对代码哈希与所有者摘要），等于时间锁的取消者；
  6. `sentinel == Safe`（PoolRegistry、GameHub、每个 Bank）；
  7. 回放 `GovernanceTransferStarted`/`GovernanceTransferred`、`SentinelSet`、`GuardianSet`、`GameDisabled`、`VoidWindowOpened` 等事件，等于发布值；每个模块只登记在一个 `gameId` 下；
  8. 发布摘要覆盖以上全部值；
  9. K0-4 监听上述全部事件；
  10. 上线前状态为“池未激活、Bank 未暂停”（A11：`V16Snapshot` 的 `Release` 模式与 `verify_governance.py` 的 `release` 模式）。

## 11. 工作包 C：文档

| 编号 | 内容 | 来源 |
| --- | --- | --- |
| C1 | 更正 `README.md:175`：tag 上 CI 跑的是非严格 `make release-check`；严格检查只在手动 dispatch 的 Release Gate 中执行。**已完成**（2026-10-12）：并改正“CI 只在默认分支运行”（实际在全部分支、`v*` 标签与 PR 上运行） | 复核 3 I-6 |
| C2 | 文档清理（第一项工作）。一档直接删除：`docs/audit/` 的 `contract-simplification-review-2026-10-04.md`、`h1-first-callback-review-2026-10-04.md`、`max-bet-and-compiler-review-2026-10-04.md`、`nft-tree-gas-reachability.md`、`prefix-threshold-validation-2026-10-05.md`、`tree-range-optimization-2026-10-04.md`，`docs/design/first-callback-settlement-qualification.md`，`docs/deploy/fresh-base-sepolia-preflight-2026-10-05.md`。二档先迁移再删除：`callback-and-lp-admission-review-2026-10-04.md`（排序取舍的接受记录迁入 ADR-0034）、`nft-core-integration-review.md`、`nft-consumer-integration-review.md`、`nft-callback-gas-qualification.md`、`preview-skip-first-callback-2026-10-07.md`（状态改为指向发布文档）。**已完成**（2026-10-11）：13 篇删除，排序取舍的接受记录迁入 ADR-0034 的 “Pre-inclusion ordering” 一节，状态引用改指发布说明，资格引用改指证书与测试 | Owner；验收：`git grep` 不再命中已归档目录（复核 S-4，18 个文件） |
| C3 | 发布手册：隔离副本部署、EIP-7702 检查、从标签 dispatch 并核对 `head_sha` 与作业列表、RPC 选择（§3 的 key 分配、包装脚本用法、本机绝不使用 `*_PROD_KEEPER`）；时间锁接管与解除暂停的时间表；更正 `v16-release.md:152` 的 “one person … cannot pass the gate alone”，写明 `V16_AUDITED_TREE` 是复核接受的树而非外审树；`docs/release/README.md` 与 `checklist.md` 更新到当前状态。**已完成**（2026-10-12）：隔离副本、EIP-7702 与门控广播随 A5 写入 `v16-release.md` 第 1、2 步；Release Gate 从发布标签 dispatch（运行的是该标签自己的 `release.yml`），只有 `headSha` 为标签提交、事件为 `workflow_dispatch`、作业恰为六个且全部成功时才接受，以 `release-ready` 为准；`audited_source_tree` 与 `V16_AUDITED_TREE` 是外审（含修复复核）接受的树，清理后变量未设，设置前门槛一律失败；两个树值只防错标签与输错，不是双人控制（仓库没有 environment、ruleset 或分支保护）；新增“RPC endpoints”（每个 key 的用途）与“From deployment to betting”（72 小时时间锁下的时间表，激活最早在第 6 天，暂停即时、解除需 72 小时）；`docs/release/README.md`、`docs/release/checklist.md` 与 `docs/deploy/checklist.md` 按本候选版更新（容量 128/Bank 与 2/玩家、作废对“结算失败不把赢家变成退款”的唯一例外、从时间锁创建前回放、上线前的网络演练） | 复核 S-1 |
| C4 | 条款与 LP 材料：作废规则（VRF 原生费不退）；准入时间锁与 LP 退出窗口；暂停不阻止提款；每玩家 2 个持仓；guardian 否决权；§9 全部残余。**已完成**（2026-10-12，Owner 审定措辞，包括“本页与合约不一致时以合约为准”与 keeper 按请求顺序处理作废的运营承诺；pt-BR、ru、tr 上线前宜请母语者复核）：站内服务条款与风险免责声明各 10 节，按 ADR-0037 与 §9 写入投注与容量（128/资金池、2/玩家）、开奖与退款、作废及其裁量与限制（VRF 原生费不退、本应中奖也只退本金、智能合约钱包、发行方冻结与没收）、暂停只挡新投注与新存入、停用资金池与游戏、72 小时治理时间锁（只可调高）与取消权、Safe 丢失后只能清退、先后顺序与事故期间先到先得、64 个地址占满容量；Earn 风险面板新增“资金池规则”5 条并链接风险免责声明。en、zh-Hans、pt-BR、ru、tr 五种语言齐全（后三种此前没有法律页译文），测试检查每种语言每节齐全且不是英文照抄 | §7、§9 |
| C5 | 规范修订（宪法的修订需 Owner 明确批准并留记录）：`docs/constitution/SSOT.v1.6.md:125, 128-130, 137`；`ExecutableSSOT.v1.6.md:48-52, 243-249, 302`；`docs/adr/0006-vrf-callback-settlement.md:87-90, 197-204, 229`；`docs/adr/0034-nft-liquidity-deposits.md:30, 145`；`docs/architecture/overview.md:95, 116`；`docs/audit/v1.6-audit-scope.md:49, 171`；`docs/audit/threat-model.md:140`；`WHITEPAPER.zh-CN.md:18, 196, 200, 211, 214-215, 222, 228, 231-232`；`WHITEPAPER.product.zh-CN.md:108`；`docs/strategy/economic-design.md:104`；`docs/ops/runbooks/pause-config-drift.md:11, 18, 36-39`；`docs/ops/alerts.md:25`；`docs/ops/runbooks/governance-safe-setup.md:22-61`。B9 另需：`SSOT.v1.6.md:18, 147, 230, 265` 与 `ExecutableSSOT.v1.6.md:64-66, 266, 302` 删去或改写体育（草案已备，随本项送 Owner），`docs/adr/0032-fixed-lp-share-operator-funded-referrals.md:74` 的体育分配句。**已完成**（2026-10-12）：Owner 审阅草案（`33eaa4c08`）后明确批准，记录在 `SSOT.v1.6.md` §10。宪法按 ADR-0037 与 B9 修订：治理从部署起经时间锁，sentinel 与 guardian 只能即时降风险，暂停只挡新仓位与新入金，每玩家 2 个持仓，作废是已收到结果无法结算时的唯一出路，一个 hub 与一个业务域；`ExecutableSSOT` 删去 A9，新增 G6（时间锁与 sentinel）、G7（容量）。同样的规则写入 ADR-0006、0032、0034、架构概述、审计范围、威胁模型、经济设计、两本白皮书（r5）、暂停、Safe 与前端准入手册、告警、指标、路线图和测试网验收清单 | 复核 M-6 |
| C6 | ADR-0006 的两处改进（M4 范围限定、确认记录的位置）；本版外审交付按 FZ-6 清单打包。**ADR 部分已完成**（2026-10-12）：M4 的范围按勘误 E8 限定为模块层 `resolve` 与 GameHub 其后的算术检查，Router、Bank、Vault 的 revert 位点由帧界、O1/O2 与 Bank/Vault 结算测试覆盖；“已独立确认”以证书组件表（§4）中引用封存复核的复核状态为准。**外审交付已备好**（2026-10-14，Owner 发送）：审计范围文档 `docs/audit/v1.6-audit-scope.md` 按本候选版重写（被审对象、目标设计、Owner 固定的决定、八项审查对象、既往发现在本版的状态、§9 与 ADR-0037 R-1–R-9 的残余、未完成门槛），不变量映射补 ADR-0037 各行，即被审提交 `fcbb2ad61`（CI 38504778203 通过；冻结 delta 2 记录 `0be336e40`–`fcbb2ad61` 的改动，`EVIDENCE.sha256` `d9bde325…`）。交付 `dist/external-audit-delivery-2026-10-14.tar.gz`（SHA-256 `774a0d00…`）：`SCOPE.md`、`RECONCILIATION.json`、`make audit-package` 切出的源码包与 20 个证据归档（冻结运行与两个 delta、证书 v5 复核请求包、规划与 B0 复核、外部预审包、AI 审计与三轮修复复核、证书 v5 复用组件的来源、v4 证书与复核、10-07 的复核与裁决；其中 12 个与 r2 逐字节相同）。包内全部 129 份清单逐一核对：当前候选版的清单都在原目录或其所描述的根目录通过，其余为旧源码的源清单与评审方的工作清单，逐项说明；密钥扫描无命中；`SCOPE.md` 第 9 节的核对步骤在全新目录中原样跑通。证书 v5 的独立复核尚未完成；Owner 选项 A（§3）：交付现在发送，按 FZ-6，复核封存与域文件改为 `CERTIFIED` 的改动以补充件随后交付。随附给外审方的说明信写明 r2 与 `1e95d7fe…` 不再审计、预审包原样收录、准入合规在链下、修复回路的约定。证书复核请求包不含复用组件的来源证据，复核方需要交付包中的 `callback-cost-certificate-2026-10-04`、`h1-callback-cost-certificate-2026-10-04`、`landing-2026-10-08` 与 `independent-review-certificate-v4-2026-10-08`<br>**补充件 1 已备好**（2026-10-14，Owner 发送）：被审提交 `fcbb2ad61` 之后的 19 个提交（`15470d28c`–`39da7a67a`）只改链下代码、工作流与文档，`src/`、`lib/`、编译配置、证书工具、域文件与 Solidity 测试的 git 树都未变。按规程第 3、4 条记为冻结 delta 3（`freeze-2026-10-12-delta-3/`，`EVIDENCE.sha256` `eeb7f844…`，22 个文件）：ops 270/270、Release Path（三个全新检出）与前端 CI 13 步在 delta 提交上重跑通过；合约门槛沿用冻结运行（没有 Solidity 测试使用 FFI，矩阵源清单与冻结时逐字节相同）；GitHub 在 `39da7a67a` 上 CI、Frontend CI、镜像与定时的 Nightly Proof Gates 38537074532 全部通过。补充件 `dist/external-audit-addendum-1-2026-10-14.tar.gz`（SHA-256 `751a948a…`）含 `ADDENDUM.md`（按领域列出改动、请外审关注的五点、门槛与核对步骤）、`39da7a67a` 的源码包与 delta 3；归档 `2026-10-14-audit-addendum-1/`，恢复核对 30 项 OK，已入证据索引。补充件 2：证书 v5 的复核封存与域文件改为 `CERTIFIED`（冻结 delta 4）。<br>**补充件 1 的独立复核**（2026-10-14，用户指定 Codex 承担独立技术审查，覆盖 `fcbb2ad61..39da7a67a` 的 19 个提交、78 个文件）：**REWORK**。P2：收据回退对长周期投注遗漏终态——10,000 块上限截断了其后的事件，一小时后退款、一天后作废的投注都返回 `placed`（未证明造成链上资金损失）。Info：浏览器索引的 24 秒确认跨出块速率切换时不构成下界（实测只等 3 秒），在 Denim 之后首次部署的约束下不单独阻断。表述更正三处：审计范围称冻结 delta 只改测试、工作流与文档（delta 3 也改了链下代码）；补充件 1 称“输入有变的门槛都已重跑”，应为实际执行的受影响本地门槛（ops、Release Path、前端 CI 13 步）；说明信中补充件 2 改为 `CERTIFIED` 应以独立复核通过为条件。合约全量审查与证书 v5 不在该复核范围内。整改（实施方，待独立复核）：收据回退按 `getBet` 的 `placedAt` 与 `resolvedAt` 分别读取下注与终态那一秒的区块（各约 10 块，每次查询仍不超过 200 块），结果未落在终态那一秒时在下注后至多 10,000 块内查找（`BET_RECEIPT_READY_SEARCH_BLOCKS`），日志与存储状态不一致时行状态取存储并标记 `incomplete`；回归测试覆盖一小时后退款、24 小时与 7 天后作废、延迟结算、同秒多块、durable 缺行与终态日志缺失，复核方的复现用例在修复后返回正确终态。浏览器索引改为读目标块的真实时间戳核对确认时长，回读窗口同样核对，速率估计只作起点。审计范围与说明信已更正，补充件 1 的门槛表述随下一个补充件更正。Owner 决定（2026-10-14）：补充件 1 不单独发送，整改通过独立复核后发送覆盖到整改提交的修订版 | 复核 S-8 |
| C7 | legacy Bank 地址登记：18 个 Bank 的链、地址、是否暂停、余额、治理方、退役计划与 RPC key 轮换记录（2026-10-11：四个 key 按用途改名；OPS 与 PROD_KEEPER 分属不同账户，旧 Alchemy key 已重建，均经 Owner 确认）。**已完成**（2026-10-12）：`docs/ops/legacy-banks.md`。按旧 key 的全部 CREATE 地址在两条链上各取一个区块普查（Base 公共 RPC，只读）：旧 key 治理 44 个 Bank，Base 5 个（全部为空，2 个未暂停）、Base Sepolia 39 个（10 个暂停、29 个未暂停，14 个持有测试代币）；其余受它治理的合约不持有 ETH、USDC 或 WETH；没有待接任的治理。原记的 18 个只覆盖部分部署。文中写明 Owner 的退役步骤与 RPC key 改名记录 | 复核 M-12 |
| C8 | 体育文档移出本版（随 B9），路线图保留体育作为未来能力。**已完成**（2026-10-11，随 B9）：删除 sportsbook 运维手册、两篇赔率 provider 文档与体育生产路线；42 篇文档去掉体育定位、组件、告警、指标与运维内容（含 `docs/design/adr/` 三篇的措辞）；路线图 §4 改为“体育作为未来能力”；简介、两本白皮书升到 r4、路线图升到 r2（2026-10-11）；ADR-0029 加修订说明，其余 ADR 正文与宪法未改（见 C5） | Owner 选项 A |
| C9 | 准入合规在链下的披露（Owner 2026-10-14，§3）：服务条款与风险免责声明第 9 节写明合约不检查所在地、年龄与身份，网站的地区限制、进入确认与负责任博彩工具只作用于网站（后两者只在设置它们的浏览器中生效），在不允许参与的地方直接调用合约或借此绕开限制即违反条款；五种语言。**已完成**（2026-10-14，Owner 审定措辞，含“违反本条款”一句；pt-BR、ru、tr 上线前宜请母语者复核；主网前若网站按牌照要求加 KYC，这两节再改） | Owner |

## 12. 运营事项

| 事项 | 负责 | 备注 |
| --- | --- | --- |
| 通知外审方：r2 已被本候选版取代，`1e95d7fe…` 不会有外审；送 B0 设计预审；约定外审后修复回路 | 实施方准备，Owner 发送 | 复核 S-2 |
| K0-4 配置漂移告警：Owner 参数、时间锁排队与 Ready 超期、`OpenHoldLimit`、作废事件；排队告警推送到 LP 可见的公开渠道 | 实施方，Owner 部署 | 已随 A11 实现（`script/ops/config-drift-monitor.py`，手册 `docs/ops/runbooks/config-drift-alerts.md`）；复核 S-9；在本机以 launchd 运行，RPC 用 `INFURA_API_KEY_OPS`（HTTP，经包装脚本）。Owner：建公开频道（bot 为管理员），安装后按手册做三项上线前测试；Mac 休眠会推迟告警，价值网络前定常驻主机 |
| legacy Bank 退役（31 个未暂停：Base 2 个、Base Sepolia 29 个，见 `docs/ops/legacy-banks.md`）与 RPC key 轮换 | Owner | C7 已登记；key 已于 2026-10-11 按用途改名 |
| 主网备用 keeper 只配 `KEEPER_RPC_HTTP`（`INFURA_API_KEY_OPS`，Owner 2026-10-14 由 Alchemy 改为 Infura），不配 WS；`frontend/deploy/casino-keeper/backup.base-mainnet.env.example` 随 D 更新 | 实施方，Owner 部署 | 主网上线后。示例已改为只配 HTTP（2026-10-14；keeper 没有 WS 时只走 HTTP 轮询，`runtime-errors.test.ts` 覆盖）。原定的 `ALCHEMY_API_KEY_OPS` 是免费档，`eth_getLogs` 每次最多 10 块，Denim 之后撑不起日志扫描（A13 (c)），故改用 Infura（实测每次约 10,000 块） |
| 原生安全扫描：排期，或写明由外审取代 | Owner | 复核 S-10 |
| 生产服务器（root@45.77.243.138）：在此之前只保留旧数据，不维护、不换 key；随新合约的全新部署一起重建，不做迁移（Owner 2026-10-12）：保留系统，删除旧应用、容器与数据（命令清单由实施方准备，Owner 在服务器上执行），再按 key 分配重新部署整套服务（web、keeper、索引、健康检查与 Telegram 告警，索引库全新建库）；`*_PROD_KEEPER` 由 Owner 运行实施方准备的脚本写入服务器环境，脚本不打印任何值 | 实施方准备与部署，Owner 删除与写入 key | 准备已随 A5 完成（2026-10-12）：手册 `docs/ops/runbooks/production-rebuild.md`（只读清点；Owner 按清点出的名字执行删除；从签名发布部署，索引库全新；Owner 写入秘密；上线前检查）；`script/ops/send-keeper-rpc.sh` 由 Owner 在本机运行，只读两个 `*_PROD_KEEPER`，经 ssh 标准输入交给 `swap-keeper-key.sh --rpc` 一次原子替换 `KEEPER_RPC_HTTP` 与 `KEEPER_RPC_WS`，不打印、不进命令行；旧主机上手工建的健康探针 systemd 单元已入库。执行在新合约部署时 |

## 13. 价值网络与主网前置（冻结签核 FZ-8）

主网证书、主网 M4 证明、余量不低于 50,000、K0-4 与 `CallbackSettlementFailed` 告警、§9 全部披露、专业机构外审、B1 准入时间锁、guardian 独立多签；
运营主体、司法辖区与准入合规（地域屏蔽、制裁筛查、玩家限额；按 Owner 2026-10-14 的决定全部在链下，见 §3）。

主网证书的输入已备（2026-10-14，`mainnet-certificate-inputs-2026-10-14/`，`EVIDENCE.sha256` `e6d56207…`；提前准备，主网证书仍在测试网验收之后计算）：
- **不需要改合约**：主网 wrapper 开销 13,400、coordinator 上限 2,500,000，与 Sepolia 相同，回调 gas 2,447,746 恰好放得下；wrapper 与 coordinator 和 Sepolia 是同一份编译产物，只有 immutable 不同。
- **主网 USDC** 的代理与实现都和 Sepolia 不是同一份代码：实现只差链接库地址（签名校验路径）；代理只在升级用的 `isContract` 上不同，其后整体后移 54 字节。按 10-04 的方法在主网代码上重算，token 体界仍为 78,394，待独立复核。
- **硬分叉**：两条链当前都是 Cobalt，`eth_config` 除链 ID 与激活时间外逐项相同。
- **尚需**：`certify.py` 与 fork 夹具按链参数化；`reused.json` 的主网 token 条目；在主网固定区块上重跑矩阵、直连 wrapper 与真实 USDC 作废；随证书提交 8453 域文件（目录中有草案）。
- **Denim 与回调计价**（2026-10-14 按规格、节点源码与 Vibenet 核对，激活后再确认）：规格不改操作码、gas 表与交易类型，单笔上限仍为 16,777,216；新增 BaseTime 预部署（`0x4200…0030`）与每块 tx[1] 的元数据存款（gas 上限 100 万）；B20 预编译的改动与本系统无关（USDC 是普通合约）。回调路径的计价因此不变，证书 v5 不受影响；wrapper 开销 13,400 与 coordinator 上限 2,500,000 是 Chainlink 的配置，不随 Denim 改变，回调 gas 仍是零余量，provider 一旦调高开销或调低上限，新下注的请求就会 revert（R6）。节点在第一个 Denim 区块把 `SystemConfig` 的区块 gas 上限除以 10、EIP-1559 分母乘以 10（`base/base` `925c6c9db`，`DENIM_GAS_PARAMETER_SCALING_FACTOR`），每秒吞吐与 base fee 的响应不变：Base Sepolia 每块 1.2 亿、主网 4,000 万，远高于作废交易所需的约 1,076 万（§9）；Vibenet（Denim 预览网，链 ID 84538453）每块 600 万，是那个网络自己的配置。Denim 之后 `pending` 标签没有内存池状态，在 Vibenet 上与 `latest` 返回同一区块：viem 取 nonce 用 `pending`，keeper 的写操作在写锁内逐笔等到回执，不会复用 nonce，只有等回执超时后的下一笔可能撞上未确认的那笔；代码中没有其他 `pending` 或 Flashblocks 用法。coordinator 当前要求的最少确认数为 0，GameHub 固定请求 3 个确认，Chainlink 若提高到 3 以上每笔新下注都会 revert，因此 `verify_callback_provider.py` 增加这项检查（§9）。激活前后各运行一次 `script/ops/denim-activation-check.sh <新目录>`（只读，经 `with-ops-rpc.sh alchemy`；Sepolia 2026-10-21 18:00 UTC 之后再跑）：出块节奏、区块 gas 上限对作废交易、BaseTime 预部署与 tx[1] 存款、`pending` 的返回、provider 与 USDC 对认证域文件（含最少确认数），并在同一区块上用认证的 wrapper、USDC 与回调 gas 跑直连 wrapper 的 fork 测试。fork 测试在 Foundry 的 EVM 中执行、只换链上状态，证明的是 provider 与 token 的状态未变；Base 节点上的执行由部署后的测试网验收覆盖。真实 USDC 作废的 fork 测试固定在冻结时的区块，USDC 状态是否变化由代码哈希的核对覆盖。主网证书计算前在主网上再确认一次。

## 14. 来源

证据索引、校验方法与冻结规程见 [`evidence.md`](evidence.md)。清理后，原 `dist/` 下的记录在两份归档里，成员路径保留 `dist/` 前缀：当日第一轮清理移走的旧目录在 `~/arbigamefi-archive/2026-10-11-superseded/superseded-2026-10-11.tar.gz`（`PATHS.txt`、`MANIFEST.sha256`），其余在 `~/arbigamefi-archive/2026-10-11-clean-slate/dist.tar.gz`（`dist.PATHS.txt`、逐文件清单 `dist.MANIFEST.sha256`）。仓库文档引用这些证据目录时只写目录名，相对于归档中的 `dist/`。

- 审计与复核：`independent-audit-2026-10-10/`（`README.md`、`fix-review/`、`fix-review-2/`、`fix-review-3/`）；`docs/audit/v1.6-audit-scope.md`
- 本规划的独立复核：`dist/independent-review-launch-candidate-2026-10-11/`
- 架构冻结签核：`architecture-decision-freeze-2026-10-08/DECISION.md`（FZ-1–FZ-9、残余表）
- 证书与勘误：`docs/audit/first-callback-gas-certificate-2026-10-07.md`、`landing-2026-10-08/certificate-v4-ERRATA.md`
- 冻结记录：`freeze-2026-10-08/`；部署与发布：`fresh-deploy-preflight-2026-10-10*`、`deploy-1b7419bca-2026-10-10/`、`retire-2026-10-02-deployment/`
- 未合入的 2026-09-28 工作：`~/arbigamefi-archive/2026-10-11-clean-slate/worktrees/`
