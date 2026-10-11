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
| RPC key 分配 | 仓库根 `.env` 的四个 key 按用途命名（只改名，值未变）：`INFURA_API_KEY_OPS` 用于本机部署广播、发布检查、`verify_governance` 回放与 K0-4（K0-4 在本机运行）；`ALCHEMY_API_KEY_OPS` 用于 preflight、fork 演练、gas 矩阵，以及主网上线后的备用 keeper（只走 HTTP，与主 keeper 的 HTTP 不同提供方）；`INFURA_API_KEY_PROD_KEEPER`、`ALCHEMY_API_KEY_PROD_KEEPER` 只在服务器上给生产 keeper 用（`KEEPER_RPC_HTTP`、`KEEPER_RPC_WS`）。OPS 与 PROD_KEEPER 分属不同账户，旧 Alchemy key 已重建（Owner 确认）。实施方只经 `script/tools/with-ops-rpc.sh` 使用两个 OPS key，不得使用 `*_PROD_KEEPER`；浏览器与 web 服务端用 Base 公共 RPC |
| 文档 | 一档过程记录直接删除，二档先迁移决策与状态再删除，作为第一项工作（C2） |

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
5. **全新部署**到 Base Sepolia，时间锁接管（§10），Release Gate `release-ready`（FZ-5）。
6. **测试网验收**：Safe 经时间锁解除暂停并记录 → 按 `docs/deploy/v16-sepolia-acceptance.md` 逐项验收，记录通过、失败或未执行
   （含暂停、解除、guardian 撤换演练）→ 发现的问题回到第 3 步。
7. 价值网络前置满足后（§13），主网证书、主网部署与发布。

## 6. 工作包 A：发布工具与 CI

| 编号 | 内容 | 来源 | 涉及文件 | 验收 |
| --- | --- | --- | --- | --- |
| A1 | 治理核验：日志分页不超过 200 块（可配置）；对 HTTP 429、5xx 与断连有界退避重试；在不泄露 URL 的前提下记录 HTTP 状态类别；**以已签名核验的区块为检查点做增量回放**，避免全历史回放随部署时长增长（主网一年约 23 万次 `eth_getLogs`） | Release Gate run 38103495700；公共 RPC 的 200 块上限（HTTP 413）；复核 M-14 | `script/release/verify_governance.py`（`CHUNK_SIZE = 500`，`Rpc` 无重试，`:86-105, 151-194`） | 伪 RPC 返回 413、429、5xx、断连时有界重试后仍失败；公共 RPC 上在 GitHub runner 连续 3 次通过；给出主网规模的页数与耗时估算；随后删除 secret `FORK_RPC_URL_BASE_SEPOLIA` 或改为公共 RPC（Owner 在 GitHub 操作）。本机发布检查与回放经 `with-ops-rpc.sh infura` 用 `INFURA_API_KEY_OPS`。进展（2026-10-11，本地）：分页 200 块（`GOVERNANCE_LOG_PAGE_BLOCKS`），408/425/429/5xx 与断连有界退避重试，报错只含状态码；检查点增量回放（`GOVERNANCE_CHECKPOINT` 加签名记录中的 `GOVERNANCE_CHECKPOINT_SHA256`）；release-gate 与镜像导入改用 Base 公共 RPC，不再引用 secret。本机公共 RPC 实测：31,764 块完整回放 318 页、345 次调用、12 次重试、500 秒，检查点之后 265 块 4 页、25 秒，最终状态一致。主网估算：一年约 1,577 万块，三个地址约 23.7 万页，按实测约 95 小时，因此依赖检查点；每天新增约 648 页、约 16 分钟。**runner 验收已通过**：Governance Replay run 38127960425（`7874a883c`）在 `https://sepolia.base.org` 上连跑 3 次，每次全量回放（47,938,596–47,950,000，116 页、131 次调用、0 次重试、约 13 秒）与自检查点 47,945,000 起的增量回放（50 页、约 6 秒）都复现检查点 `885af8258cd937a1…`；同一提交的 Frontend Docker Images run 38127960478 通过。剩余：Owner 删除 secret `FORK_RPC_URL_BASE_SEPOLIA` |
| A2 | 严格发布检查与镜像导入自行构建 `out/` 并断言产物来自当前检出；新增 push 触发的作业，用 `ReleaseImportFixture` 夹具包在全新检出上按工作流顺序跑 release-gate 离线步骤与镜像导入 | 复核 3 W-1 | `script/release/check_release.sh`、`script/release/prepare_image_release.sh`、`frontend/scripts/ssot-sync.mjs`、`.github/workflows/` | 新作业在 push 上通过；负对照：删掉构建步骤后新作业必须失败。**本地已完成**（2026-10-11）：`check_release.sh` 与 `ssot-sync.mjs`（镜像导入）先自行 `forge build src`，再由 `script/release/check_current_build.py` 断言 19 个必需产物都是本检出的构建（compilationTarget 正确、solc 为 `deps.lock` 所钉、metadata 中每个源文件的 keccak256 等于检出中的文件）；`make release-abis` 同样检查；删除 `release.yml` 与镜像工作流里的显式构建步骤。新增 Release Path 工作流（发布路径文件的 push、每周、手动）运行 `script/ci/release_path.sh`：三个全新检出，producer 在本地 Base 规则节点（84532）部署夹具并按发布资产格式打包，gate 按 release-gate 作业顺序跑离线步骤（导入、`install_deps.sh`、`STRICT=1 make release-check`、`make audit-package`），image 跑镜像工作流的导入步骤；夹具自证回调域（`CALLBACK_DOMAIN_PATH`），证明的是路径而非证书。本机三个全新克隆全程通过；负对照两轮：去掉 gate 的构建步骤后在 `release-check` 失败（missing build artifact），去掉镜像导入的构建步骤后在导入失败（current build failed）。测试 `test/ops/test_current_build.py` 9 项；导入集成测试的隔离项目改为复制源码树（经指向项目外的符号链接时 Forge 记录绝对源路径，新检查据此拒绝）。**runner 验收已通过**：Release Path run 38131385850（`7d8efb021`）三段全过，约 3 分钟 |
| A3 | 发布签名：先校验 keystore 密码能解出 `RELEASE_SIGNER` 再签（forge 1.5.1 交互输错密码只报 `vm.sign: no wallets available`）；修正版发布脚本收进仓库（提示直接写终端；只读步骤含打包可重试） | 2026-10-11 两次签名失败 | `Makefile:165`；归档中的 `release_v16.next.sh` → `script/release/` | 输错密码给出明确错误；重试不会导致重复签名。**已完成**（2026-10-11，本地）：`make release-v16` 改为运行 `script/release/release_v16.sh`，删除无把关的 `release-digest` 目标。Foundry 1.8.5 交互输错密码仍只报 `vm.sign: no wallets available`（伪终端实测），因此密码从终端读入后先由 `cast wallet address` 解出并比对 `RELEASE_SIGNER`，输错 3 次即结束且不签名，keystore 属于其他地址或打不开时立即停止；forge 从 0600 临时文件读密码，退出（含 Ctrl-C）时删除。`VerifyReleaseV16` 认可的已有签名记录保留，重跑不再提示、不再签名；不认可的记录绝不覆盖。读链步骤只在传输错误后有界重试，每次尝试的日志单独保存且替换 RPC URL 与 key；`verify_governance.py` 的冻结区块检查对断连标注“RPC transport error”。打包拒绝覆盖已存在的归档（其 SHA-256 可能已获批）并原子写入。测试：`test/ops/test_release_v16.py` 13 项在伪终端上跑真实提示（含经 `with-ops-rpc.sh`），另有打包不覆盖与 transport 标注测试；另用一次性 keystore 与合成快照跑真实 forge/cast：输错一次后签名成功，重跑保留签名，快照改动后以 `digest mismatch` 拒绝覆盖 |
| A4 | 打包不再原样带上可能过期的 Etherscan 验证脚本：按快照重新生成，或地址不符时拒绝 | 2026-10-11 发现 10-02 的旧脚本 | `script/release/package_release.sh:96-97`、`script/tools/gen_verify_helpers.py` | 放入错误地址的脚本时打包失败。**已完成**（2026-10-11，本地）：两者都做。打包时用 `gen_verify_helpers.py --out` 从被打包的快照生成验证脚本放入归档（并列入 `MANIFEST.sha256`），不再拷贝本地文件；本地 `deployments/verify-latest-v16.sh` 与之不同即在任何链上检查之前拒绝打包。测试：`PackageGuardTests` 覆盖无本地脚本、本地脚本一致、本地脚本地址不符三种情况；把比对改成恒不触发的变异会被测试抓到 |
| A5 | 部署工具收进仓库：隔离副本部署（避开 forge 自动加载仓库根 `.env`）；广播前把关；一键 preflight（回读、模拟、逐笔核对、fork 演练、时间锁接管演练）；输出写入新目录，绝不覆盖已封印目录；RPC：preflight 与 fork 演练经 `with-ops-rpc.sh alchemy` 用 `ALCHEMY_API_KEY_OPS`，广播经 `with-ops-rpc.sh infura` 用 `INFURA_API_KEY_OPS` | 本次部署；preflight P-1；复核 S-3 | 归档中的 `prepare_deploy_copy.sh`、`broadcast.sh`、`run_preflight.sh`、`read-chain.cjs`、`verify_dryrun_plan.py` → `script/release/`；`script/tools/with-ops-rpc.sh`（已入库） | 拒绝路径逐一有测试：EIP-7702 委托、nonce 不符、清单不符、副本或上级目录有 `.env`、未确认；包装脚本只接受两个 OPS key（`test/ops/test_with_ops_rpc.py`） |
| A6 | 发布线合入 `master` | 复核 3 R-3 | — | **已完成**（§4 第 2 项）；另用 GitHub environment（required reviewers）包住 `release-gate`（S-1） |
| A7 | Foundry 升级到 1.8.x：全部工作流钉到同一确切补丁版本；anvil 显式钉到目标网络当时的硬分叉；预装 solc 后默认离线；工具链写入 v5 输入 | 冻结 v3；复核 §3.6 | 全部工作流、`test/ops`、`Makefile` | 在新版下复跑 ops 夹具、`DeployHarnessV16`、`run_gas_matrix.py`（1.8 有 30M 脚本帧上限）。**已完成**（2026-10-11）：v1.8.5（`51a52c59cf`）写入 `deps.lock`，`check_toolchain.py` 核对 8 处工作流与本机工具；solc 按 SHA-256 安装、离线编译；anvil 用 `--network base --hardfork azul --enable-tx-gas-limit`；`isolate` 默认关闭。PR 门槛、ops 119 项、SDK 集成通过；gas 矩阵两例与 v8 逐字段一致；isolate 下改按退款前毛 gas 计（准入日志 +45,404），由 `test/toolchain/IsolatedGasAccounting.t.sol` 钉住 |
| A8 | 冻结规程与证据索引：运行后改冻结文件必须附 diff 或冻结时副本；仓库内维护带摘要的证据索引（含 §4 的删除记录与标签映射）；`dist/` 证据归档到持久存储；只改工作流的冻结 delta 写明由哪次运行验证 | 冻结签核 FZ-9；复核 S-11、W-1(3) | 证据索引（路径与格式在本项确定） | 写明 `shasum -c` 用法，做一次恢复演练 |
| A9 | 测试整理：`_prepareLargeHistoricalProfit` 的 seed 写入病例文件；统一测试侧两份谓词参照；审计 PoC 并入 `test/` | 实施报告（C2 已删的 `preview-skip-first-callback-2026-10-07.md`，见 `b8a48425f` 中第 311–312 行）；审计 | `test/`；归档中的 `independent-audit-2026-10-10/tests/audit/` | 回归通过 |
| A10 | 发布导入绑定加固：完整规范清单比对、池 ID 安全整数范围、ABI 清单逐项绑定与对应测试 | 2026-09-28 未合入的工作（归档 `worktrees/security-remediation.*`） | `script/release/validate_frontend_artifacts.py`、`script/release/GenerateFrontendManifestV16.s.sol`、`frontend/scripts/ssot-sync.mjs` | 归档中的 `test_release_artifact_binding.py` 思路落成仓库测试并通过。**已完成**（2026-10-11，本地）：校验器在逐项检查之后，用 `GenerateFrontendManifestV16` 从快照离线生成规范清单并整体比对（只忽略 `gitSha`、`generatedAt` 与十六进制大小写），报出第一个不同的位置；JSON 重复键与非有限数拒绝；池 ID 必须在 1..2^53−1；ABI 文件不得是链接。导入器先把包内文件一次性复制到私有目录（只收普通文件，拒绝链接），校验与激活读同一份字节；生成的 `index.ts` 只收 `chain-<数字>.json` 并转义导入路径。ABI 清单逐项绑定此前已在 `_validate_abis` 中（名称、地址键与地址、文件名、摘要、与本检出构建一致、Bank/Vault 实例）。归档测试基于已删除的 v1.5 夹具，按思路改写进 `test_manifest_authentication.py`：真实签名夹具包上 label、paramsEncoding、多余 `assets` 在整体比对处被拒，构建元数据变化仍通过；重复键、2^53 池 ID、链接文件被拒；读取后替换源清单（forge 垫片在首次调用时把恶意清单换回已签版本）仍被拒且激活内容不变。变异检查：换回改动前的导入器与校验器后，这 5 个用例全部失败 |
| A11 | 时间锁模型的工具：DeployV16、`PrepareSafeAcceptanceV16`（改为生成接线与激活的 `scheduleBatch`，D1）、`V16Snapshot`、`verify_governance.py`、`ReleaseDigestV16`、K0-4 全部改到时间锁模型，核验项见 §10；发布记录纳入 `verify_governance` 输出的 `checkpointSha256`，经签名后供 Release Gate 与 K0-4 增量回放（A1 已提供接口）；本机 RPC 输入同 A1，CI 用公共 RPC | 复核 M-1、§3.3.3 | `script/DeployV16.s.sol`、`script/release/` | P6（预排队操作）、P2（guardian 否决）型负向用例 |
| A12 | 恢复证书 v5 所需的复现工具（v4 依赖的 `h1-callback-cost-certificate-2026-10-04/`、`callback-cost-certificate-2026-10-04/`、`takeover-2026-10-07/`）纳入仓库或证据索引 | 复核 M-8 | 归档 `dist.tar.gz`、外审交付 r2 | 在新检出上能复现 v4 的关键数值 |

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
| B1 | 准入时间锁（§7.1）与 `sentinel` | 审计 F-03 | `src/access/Governable.sol`、`src/core/PoolRegistry.sol:22-56`、`src/core/GameHub.sol:150-249`、`src/core/Bank.sol:119-235` | 时间锁窗口内（包括暂停时）成熟 NFT 可以提取；恶意 guardian 不能冻结 LP 资金；交接时没有预排队操作（P6）；角色集合经事件回放核对；审计 PoC 的 F-03 用例被拒 |
| B2 | 每玩家 2 个持仓（§7.5） | 审计 F-05 | `src/core/Bank.sol:34, 486`、`src/core/GameHub.sol:323-413` | 审计 PoC 的 F-05 用例被拒；第 3 个持仓被拒，结算、退款或作废后释放 |
| B3 | 暂停不阻止 LP 提款（§7.2），guardian 注释同步 | 审计 F-04；复核 B-1 | `src/core/Bank.sol:130-141, 276-295`、`src/core/LiquidityVault.sol:107-128` | 复核 P1、P2 型用例：暂停与恶意排队同时存在时 LP 仍能退出 |
| B4 | 删除 `_allocationLeaf` 在 `maxLoss == 0` 时的死分支；按 ADR-0034 失效条款重新论证 R1 | 冻结签核 FC5；复核 M-9 | `src/core/LiquidityVault.sol:224` | `test_lossWithZeroReleasedCapitalIsRejected` 与树等价门槛不变 |
| B5 | 作废（§7.4） | Owner；复核 B-2、M-5 | GameHub、SettlementRouter、Bank、VRFHub、接口与 `SSOTTypes` | 可入账的下注在作废交易里被正常结算；24 小时前与非授权调用被拒，7 天后任何人可执行；计数恰好减 1；暂停下可执行；发行方冻结 Vault 或 Bank 时可作废（P5a、P5b）；会计类故障不在范围（P5c） |
| B6 | 单个游戏即时停用（无重新启用） | §7.1 | `src/core/GameHub.sol` | 停用后该游戏下注被拒，已有下注照常结算、退款或作废 |
| B7 | 宪法与规范对应修订的合约侧注释 | 复核 M-6 | 见 C5 | — |
| B8 | 审计 PoC 与复核 PoC（P1–P6）并入回归 | 审计；复核 | `test/` | 全部通过 |
| B9 | 体育移出本版：`SportsHub`、`SportsRiskEngine` 及接口；`SSOTTypes` 中的体育域与类型；DeployV16 的体育参数；发布脚本中的体育角色核验；体育测试与夹具 | Owner 选项 A | `src/core/Sports*.sol`、`src/core/interfaces/`、`script/DeployV16.s.sol`、`script/release/`、`test/` | 编译与全部门槛通过；`git grep -i sports` 只剩 ADR 与路线图中的未来规划 |

## 8. 工作包 D：应用层（复核 M-7）

ABI 重新生成；keeper 处理作废、停用游戏与持仓上限；索引 schema 与事件（作废、停用、时间锁排队）；SDK 错误类型；前端展示排队中的治理操作、持仓上限提示与作废收据；
移除体育相关页面与 keeper 逻辑（随 B9）；查明并处理 keeper 遇到 RPC finalized 高度回退即降级的问题（2026-10-11 生产健康 `degraded`：47969422 → 47969244）。验收沿用审计范围的 Consumers 一行：真实 Anvil、PostgreSQL、WS/HTTP 断线恢复。

## 9. 残余（维持接受或新增，逐项披露）

| 残余 | 处理 | 披露位置 |
| --- | --- | --- |
| R1 预检跳过依赖树不变量 I | 维持；B4、B5 后按 ADR-0034 失效条款重新论证 | 证书 v5、ADR-0034 |
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
| 发行方没收类故障时作废无效 | 新增（P5c） | 条款与 LP 材料 |

## 10. 认证、部署与核验

- **证书 v5**（复核 M-8）：GameHub、Bank、Router、VRFHub、PoolRegistry、Vault 的 runtime 都会变，必须重做：帧界（VRFHub、GameHub 外层与子帧、Router、Bank、Vault 与 getter）、
  固定账本（v4 为 811,982）、Bank 存储包络、token 交叉检查、组合四口径、绑定（O3）、M4 中 GameHub 后置算术；矩阵加入新状态病例（每玩家上限、停用游戏）；
  模块界驱动加入逐轮单调性检查（M7，v4 复核 R-1 / 勘误 E4）；证书复核方确认 A-1 的 (a) 读法（FZ-7）；主口径余量不低于 50,000。
  `coreRuntimes` 与 `moduleCodeHashes` 重新生成并加入 `TimelockController`；域文件在新证书被接受前为 `PENDING_INDEPENDENT_REVIEW`。
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
  10. 上线前状态为“池未激活、Bank 未暂停”（`V16Snapshot.sol:109, 127` 随 A11 修改）。

## 11. 工作包 C：文档

| 编号 | 内容 | 来源 |
| --- | --- | --- |
| C1 | 更正 `README.md:176`：tag 上 CI 跑的是非严格 `make release-check`；严格检查只在手动 dispatch 的 Release Gate 中执行 | 复核 3 I-6 |
| C2 | 文档清理（第一项工作）。一档直接删除：`docs/audit/` 的 `contract-simplification-review-2026-10-04.md`、`h1-first-callback-review-2026-10-04.md`、`max-bet-and-compiler-review-2026-10-04.md`、`nft-tree-gas-reachability.md`、`prefix-threshold-validation-2026-10-05.md`、`tree-range-optimization-2026-10-04.md`，`docs/design/first-callback-settlement-qualification.md`，`docs/deploy/fresh-base-sepolia-preflight-2026-10-05.md`。二档先迁移再删除：`callback-and-lp-admission-review-2026-10-04.md`（排序取舍的接受记录迁入 ADR-0034）、`nft-core-integration-review.md`、`nft-consumer-integration-review.md`、`nft-callback-gas-qualification.md`、`preview-skip-first-callback-2026-10-07.md`（状态改为指向发布文档）。**已完成**（2026-10-11）：13 篇删除，排序取舍的接受记录迁入 ADR-0034 的 “Pre-inclusion ordering” 一节，状态引用改指发布说明，资格引用改指证书与测试 | Owner；验收：`git grep` 不再命中已归档目录（复核 S-4，18 个文件） |
| C3 | 发布手册：隔离副本部署、EIP-7702 检查、从标签 dispatch 并核对 `head_sha` 与作业列表、RPC 选择（§3 的 key 分配、包装脚本用法、本机绝不使用 `*_PROD_KEEPER`）；时间锁接管与解除暂停的时间表；更正 `v16-release.md:127` 的 “one person … cannot pass the gate alone”，写明 `V16_AUDITED_TREE` 是复核接受的树而非外审树；`docs/release/README.md` 与 `checklist.md` 更新到当前状态 | 复核 S-1 |
| C4 | 条款与 LP 材料：作废规则（VRF 原生费不退）；准入时间锁与 LP 退出窗口；暂停不阻止提款；每玩家 2 个持仓；guardian 否决权；§9 全部残余 | §7、§9 |
| C5 | 规范修订（宪法的修订需 Owner 明确批准并留记录）：`docs/constitution/SSOT.v1.6.md:125, 128-130, 137`；`ExecutableSSOT.v1.6.md:48-52, 243-249, 302`；`docs/adr/0006-vrf-callback-settlement.md:87-90, 197-204, 229`；`docs/adr/0034-nft-liquidity-deposits.md:30, 145`；`docs/architecture/overview.md:95, 116`；`docs/audit/v1.6-audit-scope.md:49, 172`；`docs/audit/threat-model.md:140`；`WHITEPAPER.zh-CN.md:18, 197, 201, 212, 215-216, 223, 229, 232-233`；`WHITEPAPER.product.zh-CN.md:109`；`docs/strategy/economic-design.md:104`；`docs/ops/runbooks/pause-config-drift.md:11, 18, 36-39`；`docs/ops/alerts.md:26`；`docs/ops/runbooks/governance-safe-setup.md:22-61` | 复核 M-6 |
| C6 | ADR-0006 的两处改进（M4 范围限定、确认记录的位置）；本版外审交付按 FZ-6 清单打包 | 复核 S-8 |
| C7 | legacy Bank 地址登记：18 个 Bank 的链、地址、是否暂停、余额、治理方、退役计划与 RPC key 轮换记录（2026-10-11：四个 key 按用途改名；OPS 与 PROD_KEEPER 分属不同账户，旧 Alchemy key 已重建，均经 Owner 确认） | 复核 M-12 |
| C8 | 体育文档移出本版（随 B9），路线图保留体育作为未来能力 | Owner 选项 A |

## 12. 运营事项

| 事项 | 负责 | 备注 |
| --- | --- | --- |
| 通知外审方：r2 已被本候选版取代，`1e95d7fe…` 不会有外审；送 B0 设计预审；约定外审后修复回路 | 实施方准备，Owner 发送 | 复核 S-2 |
| K0-4 配置漂移告警：Owner 参数、时间锁排队与 Ready 超期、`OpenHoldLimit`、作废事件；排队告警推送到 LP 可见的公开渠道 | 实施方，Owner 部署 | 分支 `k0-4/config-drift-alerts`；复核 S-9；在本机运行，RPC 用 `INFURA_API_KEY_OPS`（HTTP，经包装脚本） |
| legacy Bank 退役（14 个未暂停）与 RPC key 轮换 | Owner | C7；key 已于 2026-10-11 按用途改名 |
| 主网备用 keeper 只配 `KEEPER_RPC_HTTP`（`ALCHEMY_API_KEY_OPS`），不配 WS；`frontend/deploy/casino-keeper/backup.base-mainnet.env.example` 随 D 更新 | 实施方，Owner 部署 | 主网上线后 |
| 原生安全扫描：排期，或写明由外审取代 | Owner | 复核 S-10 |
| 旧生产服务器：只保留旧数据，不再维护、不换 key；本候选版上线切换时彻底删除，新服务器的 keeper 直接用 `*_PROD_KEEPER` | Owner | — |

## 13. 价值网络与主网前置（冻结签核 FZ-8）

主网证书、主网 M4 证明、余量不低于 50,000、K0-4 与 `CallbackSettlementFailed` 告警、§9 全部披露、专业机构外审、B1 准入时间锁、guardian 独立多签；
运营主体、司法辖区与准入合规（地域屏蔽、制裁筛查、玩家限额）。

## 14. 来源

清理后，原 `dist/` 下的记录在两份归档里，成员路径保留 `dist/` 前缀：当日第一轮清理移走的旧目录在 `~/arbigamefi-archive/2026-10-11-superseded/superseded-2026-10-11.tar.gz`（`PATHS.txt`、`MANIFEST.sha256`），其余在 `~/arbigamefi-archive/2026-10-11-clean-slate/dist.tar.gz`（`dist.PATHS.txt`、逐文件清单 `dist.MANIFEST.sha256`）。仓库文档引用这些证据目录时只写目录名，相对于归档中的 `dist/`。

- 审计与复核：`independent-audit-2026-10-10/`（`README.md`、`fix-review/`、`fix-review-2/`、`fix-review-3/`）；`docs/audit/v1.6-audit-scope.md`
- 本规划的独立复核：`dist/independent-review-launch-candidate-2026-10-11/`
- 架构冻结签核：`architecture-decision-freeze-2026-10-08/DECISION.md`（FZ-1–FZ-9、残余表）
- 证书与勘误：`docs/audit/first-callback-gas-certificate-2026-10-07.md`、`landing-2026-10-08/certificate-v4-ERRATA.md`
- 冻结记录：`freeze-2026-10-08/`；部署与发布：`fresh-deploy-preflight-2026-10-10*`、`deploy-1b7419bca-2026-10-10/`、`retire-2026-10-02-deployment/`
- 未合入的 2026-09-28 工作：`~/arbigamefi-archive/2026-10-11-clean-slate/worktrees/`
