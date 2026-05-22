# ArbiGameFi SSOT 合约全量安全审计报告 — 2026-05-21

> **独立复核版本**。本轮为对 `arbigamefi_ssot_project_all` 仓库当前 `src/` 全量业务代码的
> 独立、系统、自底向上的安全审计,用于回答唯一的交付问题:**当前代码是否可以部署主网。**
> 本报告不依赖、不复用仓库内既有的 `FullAudit-2026-05.md`(2026-05-13)与
> `SSOT_v1.2_Audit_Report.docx`;所有结论均为本轮重新推导(包括 Keno 赔率表的逐值算术复核、
> 8 个游戏模块的 RTP 重算、Bank 结算代数的不变量证明)。结论与既有报告独立收敛于
> "0 Critical / 0 High",这一致性本身是正向信号。

| 项目 | 内容 |
| --- | --- |
| 审计日期 | 2026-05-21 |
| 提交快照 | 工作树当前状态(`forge build` 通过,`FOUNDRY_PROFILE=pr forge test -vv` 124 passed / 0 failed / 1 skipped) |
| 审计范围 | `src/` 下全部业务合约(46 个 `.sol`,约 5,822 LOC,排除 mocks) |
| 工具链 | Foundry forge 1.5.1 / solc 0.8.24 / via-ir + optimizer(20000 runs) / EVM cancun |
| 方法 | 手工逐行评审 + `forge test`(pr profile) + 算术不变量证明 + best-effort 静态分析 |
| 审计人 | Claude (独立 agent 审计) |

---

## 1. 摘要

### 1.1 一句话结论

**协议核心(资金记账、游戏赔率、储备金机制、VRF 活性)经验证是健全的,本轮未发现
开放的 Critical / High / Medium 级别漏洞。** 本轮独立审计发现 1 个 Medium 级活性缺陷
`M-01`,并已在同一修复轮次中关闭。剩余项为 Low/Informational 级纵深防御、配置约束
与测试/工具基线缺口。

**裁决需要分层:** 合约代码层在 `M-01` 修复后达到「条件性可发布」标准;但项目层主网
部署今日仍为 **NO-GO**,因为 Base mainnet release artifacts、治理/Timelock、keeper/Postgres
生产部署、主网 canary 与 `docs/deploy/base-mainnet-v13-readiness.md` 的审批行尚未全部关闭。
详见 §8 部署裁决。

### 1.2 严重度计数

| 等级 | 数量 | 概要 |
| --- | --- | --- |
| **Critical** | **0** | — |
| **High** | **0** | — |
| **Medium** | **0 open / 1 fixed** | M-01:`registerGame` 可覆盖在用 gameId → `RandomReady` 态投注永久无法结算/退款,本轮已修 |
| **Low** | **5** | VRFHub 缺重入锁;`refundTimeoutSeconds` 无上界;反环检测仅 64 跳;非 adapter 模式手续费永久锁定;VRF 费用按 betCount 多报 |
| **Informational** | **10** | 详见 §4.5 |

### 1.3 本轮验证通过的关键结论(正向)

1. **全部 8 个游戏模块的毛赔率 RTP ≤ 100%**(逐表算术复核):Keno(20 个 gain 值全部
   逐一验证)、Roulette(`37/popcount` 统一公式)、Dice(`100/winCount`)、CoinToss
   (`2×`)、Baccarat(13⁶ 枚举一致)、Plinko(三档配率二项分布求和)、SicBo(216 样本空间)、
   Slots(`512/512=1`)。整数向下取整使所有游戏天然偏向庄家。**计划书 §10 头号 Critical
   嫌疑(Keno 770M× 手编表)经复核 = 干净。**
2. **Bank 结算代数证明 A3(`NAV ≥ R`)在每次 `settleBet` 后被保持**:由于
   `reserved ≥ usedTurnover` 且 payout 侧的 house-edge 抽水恰好补偿了 PF/XP 计提,
   可证明 `NAV_after − R_after ≥ NAV_before − R_before ≥ 0`(见 §5)。
3. **状态机无双花**:`finalize`/`refund` 互斥于不同状态,终态不可逆,position 与 bet
   两层 state 双重保护。
4. **VRF 传输层契约成立**:`fulfillRandomWords` 由 try-catch 包裹,永不 revert;
   欠付 revert、溢付 best-effort 退款 + refundCredit 兜底。
5. **多资产无串仓**:每 pool 一座 Bank、一种资产,`PoolRegistry` 强制
   `IBank(bank).asset()==asset` 且单 bank 单 pool;结算严格按 `position.bank` 路由。

---

## 2. 审计范围与方法

### 2.1 In-scope 文件

| 目录 | 文件 | LOC |
| --- | --- | --- |
| `src/core/` | GameHub / SportsHub / Bank / VRFHub / SportsRiskEngine / SettlementRouter / PoolRegistry | 2,811 |
| `src/core/interfaces/` | IBank / IGameHub / IGameModule / IPoolRegistry / ISettlementRouter / ISportsHub / ISportsRiskEngine / IVRFAdapter / IVRFHub / SSOTTypes | ~900 |
| `src/access/` | Governable | 38 |
| `src/adapters/chainlink/` | ChainlinkV2PlusWrapperAdapter + 3 接口/工具 | 158 |
| `src/engines/referral/` | ReferralRegistry / DefaultReferralEngine + 接口 | 330 |
| `src/libs/` | Math / AccountingLib / StopLogic / RNG / Errors | 130 |
| `src/modules/` | 8 游戏模块(cointoss/dice/roulette/keno/baccarat/plinko/sicbo/slots)+ 各自 Params | ~1,500 |

> 注:计划书基于较旧快照,实际代码已演进 —— `Hub.sol` 已拆分为
> `GameHub`+`SettlementRouter`+`PoolRegistry`,并新增 `SportsHub`/`SportsRiskEngine`
> 及 4 个游戏模块(baccarat/plinko/sicbo/slots)。本轮按**实际代码**审计。

### 2.2 Out-of-scope(显式排除)

`src/mocks/`、`frontend/`、`script/`、`test/`、`lib/`(外部依赖)。

> **方法学缺口声明**:部署脚本(`script/`)与测试外的部署侧配置未审计。部署侧的特权
> 后门(错误的 governance 地址、未设 adapter、错误的 router 绑定)可绕过本报告的全部
> 链上结论。**本报告不构成对部署产物的清白证书。** 见 §8 部署前检查清单。

### 2.3 工具运行记录

| 产物 | 路径 | 处置 |
| --- | --- | --- |
| forge 主套件(pr profile) | `/tmp/forge_pr.log` | ✅ **121 passed / 0 failed / 1 skipped**,26 套件 |
| forge coverage | `/tmp/forge_coverage.log` | ❌ **不可用** —— 无优化器与 `--ir-minimum` 下均 "Stack too deep"(`Bank.sol:606` / Yul ABI 编码)。覆盖率指标本轮无法生成,见 I-01 |
| Slither | `/tmp/slither.json` `/tmp/slither.log` | best-effort,见 §7 附录 |
| Halmos / Mythril | — | 本轮未执行符号执行(见 §2.4) |

### 2.4 方法学自身的风险(自陈)

1. **未做符号执行**:Halmos / Mythril / Certora 本轮未运行。报告基于手工评审 + 算术证明 +
   forge fuzz/invariant。建议主网前补符号执行(列为 I-02)。
2. **forge `pr` profile 较浅**(256×256):难以触发深层稀有链路。建议主网门禁用
   `release` profile(4096×1024),仓库 `foundry.toml` 已定义该 profile。
3. **覆盖率不可测**:`forge coverage` 在本代码库无法编译(见 I-01),因此"哪些分支
   未被测试"无法量化。这是本轮最大的方法学盲点。
4. **Chainlink fork 测试被跳过**:`test/fork/ForkChainlinkWrapperAdapter.t.sol` 因
   `BASE_RPC_URL`/`ARBITRUM_RPC_URL` 未设而 `[SKIP] setUp()`(已在 `/tmp/forge_pr.log`
   断言层确认)。adapter 的 refund-credit 真实链路本轮未被 CI 覆盖,见 I-03。

---

## 3. 架构与威胁模型概览

### 3.1 三层资金结构

```
玩家 ──stake(ERC20)──▶ Bank(每资产一座金库,SSOT 记账)
玩家 ──VRF费(原生ETH)─▶ GameHub ──▶ VRFHub ──▶ ChainlinkAdapter ──▶ VRF Wrapper
                                            ▲
GameHub/SportsHub ──openPosition──▶ SettlementRouter ──holdBet/settleBet/refundBet──▶ Bank
```

- **Bank** —— ERC4626-like 金库。核心恒等式 `totalAssets() == NAV == B − PF − XP`;
  bet 资金接口(`holdBet/settleBet/refundBet`)仅 `SettlementRouter` 可调;
  `riskInPaused` 冻结 Risk-In 与 Optional-Outflow,但**永不阻断** Debt-Out(结算/退款)。
- **SettlementRouter** —— 唯一的 Bank 结算入口;持有 position 授权但不托管资金;
  `settlePosition/refundPosition` 仅 `position.ownerHub` 可调。
- **GameHub** —— 赌场游戏生命周期 SSOT + skyline 定价 + 推荐编排;状态机
  `None→Held→PendingVRF→RandomReady→(Settled|Refunded)`。
- **SportsHub** —— 签名赔率体育博彩;赔率由链下 signer 签发,链上仅强制执行签名报价;
  无链上 payout 计算 → 不存在链上 RTP 漏洞面。
- **VRFHub** —— VRF 传输层,合约层面保证 fulfill 永不 revert。

### 3.2 关键信任假设

| 假设 | 风险面 |
| --- | --- |
| `governance` 私钥安全且诚实 | 可暂停、改费率/赔率、覆盖游戏注册(M-01)、救援代币、领取协议费 |
| 链下 odds signer / result reporter 诚实(仅 SportsHub) | 体育博彩经济安全完全依赖链下定价 |
| Chainlink VRF Wrapper 正常履约 | 不履约时由 `refundTimeoutSeconds` 超时退款兜底 |
| pool 资产为"正常" ERC20(无回调/无 fee-on-transfer) | fee-on-transfer 代币会使 `B` 与记账漂移(见 I-09) |

---

## 4. 发现

### 4.1 Critical

**无。**

### 4.2 High

**无。**

### 4.3 Medium

#### [M-01] `registerGame` 可覆盖在用 gameId,使 `RandomReady` 态投注永久无法结算

- **严重度**: Medium
- **状态**: **Fixed in current patch**
- **位置**: `src/core/GameHub.sol:218-222`(`registerGame`)、`:438-460`(`finalize`)、`:566-594`(`refund`)
- **类别**: Liveness
- **描述**:
  `registerGame(gameId, module)` 无任何"已存在则禁止"检查,可直接覆盖
  `gameModule[gameId]`。同时 GameHub 状态机中 **`RandomReady` 态没有任何超时退款路径**
  ——`refund()` 仅接受 `PendingVRF` 态(`:569`),`finalize()` 仅接受 `RandomReady`
  态(`:441`)。`finalize` 内部调用 `gameModule[b.gameId]` 的当前指向模块来
  `resolve`/计算 payout。若治理在某投注进入 `RandomReady` 之后把其 `gameId` 重新
  指向另一个模块:
  - 新模块对旧 `betParams` 可能 `revert`(参数编码不兼容),或
  - 新模块返回 `payoutGross + refundAmount > b.reserved`(`reserved` 是用**旧模块**
    的 `maxPayout` 算的),触发 `finalize` 的 `:471` revert。

  两种情况下该投注卡在 `RandomReady`,既不能 `finalize` 也不能 `refund`,**玩家本金 +
  储备金永久冻结**。即便没有治理恶意:一旦发现某模块 bug 而把 gameId 改指到修复版
  模块,所有该模块上在途的 `RandomReady` 投注都会被冻结。

- **影响**: 受影响投注的玩家本金与该 bet 在 Bank 中的 `reserved` 永久锁定;`totalReserved`
  不下行,对应的银行资本被永久占用。需治理动作触发,故定为 Medium。
- **复现(调用链)**:
  ```
  1. gov.registerGame(KENO, kenoModuleV1)
  2. player.placeBet(KENO, ...)            → bet 进入 PendingVRF
  3. VRF 回调 onRandomWords               → bet 进入 RandomReady
  4. gov.registerGame(KENO, kenoModuleV2)  // 覆盖,V2 对旧 params 不兼容
  5. anyone.finalize(betId)                → revert(V2.resolve 报错 或 reserved 不足)
  6. anyone.refund(betId)                  → revert(BadState:state!=PendingVRF)
     ⇒ betId 永久卡死
  ```
- **本轮修复**:
  1. `registerGame` 现在拒绝覆盖已存在 `gameId`,模块升级必须使用新 `gameId`
     或走单独审计过的迁移路径:
     ```solidity
     if (gameModule[gameId] != address(0)) revert Errors.InvalidConfig();
     ```
  2. `finalize` 对 `IGameModule.resolve` 增加 `try/catch`;若模块 resolve revert、
     `refundAmount > stake`,或 `payoutGross + refundAmount > reserved`,则进入内部
     `_refundInvalidRandomReadyBet` 路径,将 bet 终态化为 `Refunded`、全额退还玩家本金并释放
     `SettlementRouter` position。这样即便未来模块逻辑异常,`RandomReady` 也不会永久卡死。
- **回归证明**:
  - `test_registerGameRejectsOverwrite`
  - `test_revertingModuleResolveFallsBackToFullRefund`
  - `test_overPayoutModuleFallsBackToFullRefund`
  - `test_badModuleRefundTooLargeFallsBackToFullRefund`
- **SSOT 关联不变量**: LIVE(finalize/refund 活性)、A3(`totalReserved` 不下行致资本锁定)。

### 4.4 Low

#### [L-01] VRFHub 无 ReentrancyGuard,且在记账完成前向攻击者可控地址做全 gas `.call`

- **严重度**: Low
- **位置**: `src/core/VRFHub.sol:115-162`(`requestRandomWords`)、`:132`(退款 `.call`)
- **类别**: Access / Reentrancy(纵深防御)
- **描述**: `requestRandomWords` 在写入 `requests[requestId]`(`:151`)与转发 adapter
  (`:140`)**之前**,对 `payer`(由调用方传入、可为攻击者合约)执行
  `payable(payer).call{value: refundDue}("")`,转发全部剩余 gas。VRFHub 整个合约
  没有 `ReentrancyGuard`。
- **当前不可利用性分析**: 该回调发生时 `GameHub.placeBet` 持有自身 `nonReentrant`
  锁(GameHub 的 `placeBet/finalize/refund` 全部互斥);`SettlementRouter` 的
  `settle/refund` 要求 `msg.sender==ownerHub`;`Bank` 各函数独立 `nonReentrant`;
  `VRFHub.detach` 要求 `r.hub==msg.sender`。逐一枚举后,回调期间攻击者无法到达任何
  可造成资金损失的状态变更。且仅在玩家**主动溢付**时才触发回调(前端发精确费用时
  `refundDue==0`,无回调)。故定为 Low —— 但这是脆弱的纵深缺口。
- **推荐修复**: VRFHub 继承 `ReentrancyGuard`,`requestRandomWords`/`claimRefund`
  加 `nonReentrant`;并将退款 `.call` 移到 `requests[requestId]` 写入之后(CEI)。
- **SSOT 关联不变量**: Z1、V2。

#### [L-02] `refundTimeoutSeconds` 无上界,治理可设极大值阻断退款

- **严重度**: Low
- **位置**: `src/core/GameHub.sol:127-130`(`setRefundTimeout`)
- **类别**: Liveness / Access
- **描述**: `setRefundTimeout` 无任何边界检查。治理若把 `refundTimeoutSeconds` 设为
  极大值,VRF 失败的投注将在极长时间内无法触发 `refund()`(`:571-572`)。
  对照:`setHoldbackVestingSeconds` 已有 `0 < x ≤ 365 days` 的边界,此处缺失。
- **推荐修复**: 加合理上界,如 `if (seconds_ == 0 || seconds_ > 30 days) revert`。
- **SSOT 关联不变量**: LIVE。

#### [L-03] ReferralRegistry 反环检测仅 64 跳,≥65 深链路可构造环

- **严重度**: Low
- **位置**: `src/engines/referral/ReferralRegistry.sol:14`(`MAX_HOPS=64`)、`:50-55`
- **类别**: Economic
- **描述**: `_bind` 从 `referrer` 向上走 ≤64 跳查 `player`;若已存在链路深度
  >64 且 `player` 是其根,则 bind `player→该深链顶端` 时无法在 64 跳内检测到环。
- **不可利用性分析**: 即便构造出环,下游消费者 `GameHub._buildUplines`(≤5,带去重)
  与 `_computeSkylineAndHE`(≤6 段)均为定长循环 —— 不会死循环;推荐奖励上限恒为
  house-edge 预算,环不会放大奖励。构造 65 深链需 65 笔交易 + 65 个地址,且收益仍受
  预算约束。故无资金放大利用,定 Low。
- **推荐修复**: 文档明确"反环为 best-effort、深度受限",或将 `MAX_HOPS` 提至与业务
  最大链深一致。
- **SSOT 关联不变量**: —(推荐域)。

#### [L-04] 非 adapter 模式下 VRF 手续费永久锁定在 VRFHub

- **严重度**: Low
- **位置**: `src/core/VRFHub.sol:145-149`(internal 模式)
- **类别**: Economic / Deployment
- **描述**: 若 `adapter` 未配置,`requestRandomWords` 收取的 `required` 费用留存
  VRFHub,而合约**无任何提现函数**("no backdoor" 设计)。该模式本为测试用,但若
  主网误以非 adapter 模式部署,所有玩家 VRF 费将永久锁定。
- **推荐修复**: 部署清单强制校验 `vrfHub.adapter() != address(0)`(见 §8);
  或在 internal 模式下也禁止 `requestRandomWords`。
- **SSOT 关联不变量**: Z1。

#### [L-05] VRF 费用按 `betCount` 线性多报

- **严重度**: Low
- **位置**: `src/core/GameHub.sol:266-272`(`quoteVRFFee`)
- **类别**: Economic / Code-Quality
- **描述**: `callbackGasLimit = 300_000 + betCount*20_000`。但 VRF 回调
  `onRandomWords` 只存储随机字、清映射、detach —— 成本与 `betCount` **无关**(多轮
  结算在独立的 `finalize` 交易中执行)。因此 `callbackGasLimit` 随 betCount 增长是
  无依据的,玩家(尤其大 betCount)按比例多付 VRF 费。
- **推荐修复**: 把 `callbackGasLimit` 定为一个覆盖 `onRandomWords` 的固定值
  (如 200_000),去掉 `betCount` 缩放。
- **SSOT 关联不变量**: —。

### 4.5 Informational

| ID | 概要 | 位置 |
| --- | --- | --- |
| **I-01** | `forge coverage` 在本代码库无法编译("Stack too deep",无优化器及 `--ir-minimum` 下均失败)。覆盖率指标无法生成,这是当前最大测试盲点。建议拆分 `Bank.settleBet` 中 `XPAwarded` 事件的局部变量,或为 coverage 配单独 profile。 | `Bank.sol:606` |
| **I-02** | CI 无 Slither / Halmos / Mythril / Certora 基线。建议至少把 Slither 接入 PR 门禁,Halmos 用于 `AccountingLib`/`StopLogic` 的属性证明。 | CI |
| **I-03** | Chainlink fork 测试在无 RPC env 时静默跳过(`[SKIP] setUp()`)。adapter 的 `requestRandomWordsInNative` 与 refund-credit 真实链路未被默认 CI 覆盖。建议 CI 配置一个公共 RPC 并把跳过升级为失败。 | `test/fork/` |
| **I-04** | 计划书 §5 引用的 A/B/C/D/E/P/V/X/Z 系列 stateful 不变量套件在当前仓库**不存在** —— `test/invariants/` 仅有 `SettlementRouterInvariants` 与 `SportsHubInvariants`。Bank 的 A1/A3/A4/E、VRFHub 的 V1/V2/V4 **无 property 测试**,仅靠单测 + diff 测试间接覆盖。对"可证明正确"目标这是实质缺口。 | `test/invariants/` |
| **I-05** | `governance` 为单一密钥角色(两步转移,但无链上 timelock)。可暂停、改费率/赔率、覆盖游戏、救援代币、领协议费。建议主网治理为 多签 + Timelock。 | `Governable.sol` |
| **I-06** | RNG 域字符串 `"SSOT_RNG_V1"` 未按模块命名空间化。**功能上无害**(`betId` 全局唯一且每个 betId 只经一个模块,已天然消歧),但脆弱。 | `libs/RNG.sol:11` |
| **I-07** | `_detachRequestIfOwned` / 首触 `bindFor` 用 `try/catch {}` 静默吞错。残留的 VRFHub 请求为惰性(后续 fulfill 因 `requestToBetId==0` 直接返回),可接受,但降低可观测性。 | `GameHub.sol:655-663,676` |
| **I-08** | `Bank.settleBet` 不自校验 `protocolFeeAccrual + Σxp` 的上界,完全信任调用 hub。本轮已证明 in-scope 的 `GameHub` 计提恒为 `usedTurnover×effectiveHE/BPS` 且 A3 被保持(§5),但 Bank 缺乏对未来 hub 的纵深防御。建议加断言 `protocolFeeAccrual + Σxp ≤ usedTurnover`。 | `Bank.sol:523-622` |
| **I-09** | 若 pool 资产为 fee-on-transfer / rebasing 代币,`holdBet` 实收 `stake` 会与记账漂移。建议 `PoolRegistry.registerPool` 或文档显式限定"标准 ERC20"。 | `Bank.holdBet` |
| **I-10** | `src/libs/Math.sol` 为**死代码**(无任何 `src/` 文件 import;Bank/GameHub/模块均用 OZ `Math`)。建议删除以缩小审计面。Baccarat 的"平局不退注"(Player/Banker 在 Tie 时判负)偏离赌场标准,经济上自洽,但建议文档说明。 | `libs/Math.sol` |

---

## 5. SSOT 不变量验证矩阵

每条标注 **通过 / 失败 / 未验证(手工证明)** 及依据。

| ID | 内容 | 结论 | 依据 |
| --- | --- | --- | --- |
| **A1** | `totalAssets() == NAV == B−PF−XP` | ✅ 通过 | `Bank.sol:205-208` + `AccountingLib.nav` 按构造成立;`B` 取实时 `balanceOf`。 |
| **A3** | `NAV ≥ R` | ✅ 通过(算术证明) | `holdBet` 入场强制 `NAV−Rafter ≥ ml`;`settleBet` 后:`ΔNAV = −(payoutNet+refund+accrual)`、`ΔR = −reserved`,因 `reserved ≥ usedTurnover` 且 `payoutNet = payoutGross(1−edge)`、`accrual = usedTurnover·edge`,可证 `NAV_after−R_after ≥ NAV_before−R_before`。 |
| **A4** | Optional outflow 域 `NAV−R ≥ minLiq` | ✅ 通过 | `_checkOptionalOutflowDomain`(`Bank.sol:472-488`)对 withdraw/redeem/claimXP/claimPF 全路径生效;claimXP/claimPF 因同时减 B 与 减 PF/XP,NAV 不变。 |
| **B3** | `payoutGross + refundAmount ≤ reserved` | ✅ 通过 | 三重检查:模块 `maxPayout` 保证、`GameHub.finalize:471`、`SettlementRouter.settlePosition:77`、`Bank.settleBet:538`。 |
| **C1/C2** | VRF request 映射一致、finalize/refund 后清零 | ✅ 通过 | `onRandomWords`/`finalize`/`refund` 均 `requestToBetId[reqId]=0` + `_detachRequestIfOwned`;VRFHub `fulfillRandomWords` 首次即 `r.active=false`。 |
| **D2** | `rescueToken` 不得救 ASSET | ✅ 通过 | `Bank.sol:142` `if (token == asset) revert`。 |
| **E2/E3** | XP 桶移动守恒 + claim 受 pause-gate | ✅ 通过 | `unlockXPLocked`/`syncXPHoldback` 为纯桶间移动且 total 同步增减;`claimXPAccrued` 有 `if(paused()) revert`。 |
| **LIVE** | `finalize`/`refund` 在 pause 下仍可成功 | ✅ 通过 | `Bank.settleBet`/`refundBet` 无 `paused()` 门;`GameHub.finalize`/`refund` 无 pause 门。M-01 已通过禁止 gameId 覆盖与 invalid-resolve 全额退款路径关闭。 |
| **P3** | `ΔPF + ΔXP == house-edge 累积` | ✅ 通过(代数证明) | `GameHub.finalize`:`protocolFeeAccrual + Σawards = nonBudgetBase+nonBudgetDelta+baseBudget+deltaBudget = baseHEAmt+deltaHEAmt = usedTurnover·effectiveHE/BPS`;`DefaultReferralEngine` 的 `splitBase`/`splitDelta` 逐项守恒(`Σ + sink = budget`)。 |
| **V1/V2** | VRF 欠付 revert、溢付 best-effort 退还 | ✅ 通过 | `VRFHub:126` `InsufficientVRFFee`;`:128-136` 溢付退款 + `_refundCredit` 兜底。 |
| **V4** | refundCredit 是 debt-out、非 pause-gated | ✅ 通过 | `claimRefund` 无 pause 门、CEI 正确(先清零后转账,失败回滚)。 |
| **X1** | 多资产无 custody 交叉污染 | ✅ 通过 | `PoolRegistry`:单 bank 单 pool + `asset()` 校验;结算按 `position.bank` 路由。 |
| **Z1** | Adapter 模式 ETH 守恒 | ✅ 通过(adapter 模式) | `GameHub.placeBet` 转发全部 `msg.value`、无 `receive`,自身不留 ETH;VRFHub 仅留 `Σ refundCredit`;adapter 把 `required` 全额转发 wrapper。**非 adapter 模式见 L-04。** |

---

## 6. 复现指引索引

| 发现 | 复现方式 |
| --- | --- |
| M-01 | §4.3 给出原始 6 步调用链;本轮已新增回归测试覆盖 registerGame 覆盖拒绝、resolve revert 全额退款、over-payout 全额退款。 |
| L-01 | 部署一个在 `receive()` 中回调 VRFHub 的合约作为 `player`,以溢付 `msg.value` 调用 `placeBet`,在回调中尝试各入口 —— 用于验证"当前不可利用"结论而非证明漏洞。 |
| L-02/L-03/L-04/L-05 | 均为配置/边界类,无需 PoC;按 §4.4 描述静态确认即可。 |
| 游戏 RTP | 见 §1.3 与下方算术;`test/diff/Diff*.t.sol` 已对 6 个模块做 diff 比对。 |

**Keno gain 表逐值复核**(N=15,M=5,C(15,5)=3003,`gain = floor(30030000/(count·(played+1)))`):
全部 20 个有效值(played 1..5)与合约 `KenoModule._gain` **逐一吻合**;最大乘子
`gain(5,5)=5005000 → 500.5×`(非计划书所述 770M×,后者为旧表)。`maxPayout` 用
`_gain(played,played)`,经验证恒为该 played 行的最大值。

---

## 7. 附录:工具输出摘要与再次运行命令

### 7.1 forge 测试(已执行)

```
Ran 26 test suites: 124 tests passed, 0 failed, 1 skipped (125 total)
  └─ 1 skipped = test/fork/ForkChainlinkWrapperAdapter.t.sol(无 RPC env)
```

### 7.2 Slither(已执行)

Slither 0.x 成功运行,产物 `/tmp/arbigamefi_slither_after_m01.json`:
**70 个合约 / 101 个检测器,112 条结果**。High/Medium 分布:
`arbitrary-send-erc20`(1)、`arbitrary-send-eth`(1)、`reentrancy-eth`(2)、
`incorrect-equality`(14)、`reentrancy-no-eth`(1)、`uninitialized-local`(12)、
`unused-return`(5)。

经本报告逐条人工三角验证,**4 条 High 全部为可解释的误报或已被本报告覆盖**:

| Slither 检测 | 位置 | 三角验证结论 |
| --- | --- | --- |
| `arbitrary-send-erc20` | `Bank.holdBet` `transferFrom(player,…)` | 误报。`holdBet` 受 `onlySettlementRouter` 限制,且 `player` 必须先 `approve` Bank;无法在无授权下扣款 —— 标准金库拉款模式。 |
| `arbitrary-send-eth` | `VRFHub.requestRandomWords` | 仅退还调用者自己的溢付 `msg.value−required`,非任意盗转。对应 L-01。 |
| `reentrancy-eth` | `GameHub.placeBet` | 即 VRFHub 溢付回调路径,对应 **L-01**,已给出"当前不可利用"完整论证。 |
| `reentrancy-eth` | `VRFHub.claimRefund` | 误报。CEI 正确(先清零、转账失败则回滚)。 |

32 条 Medium 同样经验证为误报:`incorrect-equality` 全部是哨兵/状态边界判定;
`uninitialized-local` 全部是随后被填充或有意零值的 memory 结构/数组,其中 M-01 修复新增的
`payoutGross` / `refundAmount` 是 `try IGameModule.resolve(...) returns (...)` 分支赋值前的
安全零值;`unused-return` 是 `decode()` 仅取其 revert 副作用、以及 ECDSA tuple 的第三元素
未用 —— 均无安全影响。
**Slither 未产生本报告 §4 之外的任何新发现。**

### 7.3 再次运行命令(用户可本地复跑)

```bash
cd /Users/kevin/arbigamefi_ssot_project_all
forge --version && forge build

# 主套件(pr profile)
FOUNDRY_PROFILE=pr forge test -vv 2>&1 | tee /tmp/forge_pr.log

# 主网门禁建议用 release profile(4096 fuzz / 4096x1024 invariant)
FOUNDRY_PROFILE=release forge test 2>&1 | tee /tmp/forge_release.log

# 覆盖率(当前会因 Stack too deep 失败 —— 见 I-01)
forge coverage --ir-minimum --report summary 2>&1 | tee /tmp/forge_coverage.log

# Chainlink fork(需先 export BASE_RPC_URL / ARBITRUM_RPC_URL)
forge test --match-path 'test/fork/*' -vv

# 静态分析
slither . --foundry-out-directory out --filter-paths "test/|src/mocks/|lib/" \
  --json /tmp/slither.json --checklist
```

---

## 8. 部署主网裁决

### 8.1 裁决:**合约代码层 CONDITIONAL GO;项目主网部署 NO-GO today**

协议**架构与核心资金逻辑是健全的**,本轮未发现开放的 Critical/High/Medium 漏洞,无需架构
返工。`M-01` 已在本轮关闭,并有回归测试覆盖。

但是"合约代码层可发布"不等于"今日可主网部署"。当前仓库仍只有 Base Sepolia
`chainId=84532` 的 release/frontend/golden-vector artifacts;`docs/deploy/base-mainnet-v13-readiness.md`
仍明确标记 `Status: NO-GO`;生产治理、keeper/Postgres、主网 canary、审批行与 mainnet
release artifact 尚未关闭。因此本报告的部署裁决是:

> **不要今天部署 Base mainnet。先完成 §8.2 的项目级 MUST gates,再进入主网部署窗口。**

### 8.2 部署前必须项(MUST,阻断主网)

1. **重新生成并签名 Base mainnet release artifacts** —— 当前签名 release digest
   `0x2a3db090c24089944a0f23df63eb970c89c6f3529970c85c29b8cf3de9aba176` 仅对应
   Base Sepolia v1.3 artifact,不能作为 `8453` 主网发布凭证。
2. **治理为多签 + Timelock** —— 见 I-05。`registerGame`、`setRefundTimeout`、
   `setActiveReferralConfig`、`rescueToken`、`claimProtocolFees`、`setAdapter`
   均为高权限操作,EOA 治理对本协议风险敞口过大。
3. **以 release profile 跑全套测试通过或拆成可 CI 承载的 release 分段矩阵** ——
   `FOUNDRY_PROFILE=release forge test` 的部分 invariant 在本地运行成本过高,必须给出
   可复跑的分段命令、日志与通过证据。
4. **生产 keeper/Postgres/canary 证据** —— casino keeper 与 sportsbook terminalizer
   必须有 primary + backup 部署、健康快照、Base mainnet dry-run/canary runbook。
5. **部署侧检查清单(脚本/运维)**:
   - `vrfHub.adapter() != address(0)`(否则触发 L-04 费用锁定);
   - `bank.settlementRouter()` 指向正确的 SettlementRouter;
   - 每个 pool 的 `IBank.asset()` 与注册资产一致,且资产为标准 ERC20(I-09);
   - `governance` 地址为预期的多签/Timelock;
   - `defaultHouseEdgeBps > 0`、各 referral config 经 `_validateReferralConfig`。

### 8.3 部署前强烈建议项(SHOULD)

6. 处理 L-01~L-05(VRFHub 加重入锁、`refundTimeout` 加上界等)。
7. **恢复核心不变量测试套件**(I-04)—— 为 Bank 的 A1/A3/A4/E、VRFHub 的
   V1/V2/V4 补 stateful invariant 测试。这是"可证明正确"目标的硬要求。
8. 修复 `forge coverage`(I-01)并把行覆盖率纳入门禁。
9. CI 接入 Slither(I-02),并让 Chainlink fork 测试在 CI 真实运行(I-03)。
10. 主网前补一轮符号执行(Halmos 覆盖 `AccountingLib`/`StopLogic`/Keno 表)。

### 8.4 残余风险声明

完成 8.2 后,链上代码可达"可部署"标准;但下列残余风险无法由本审计消除:
体育博彩经济安全依赖链下 odds signer 诚信;VRF 活性依赖 Chainlink 履约
(由超时退款兜底);治理私钥被盗将危及全协议。这些属于运营/信任域,需由
组织流程(多签、监控、应急 runbook)而非合约代码来管理。

---

## 9. 交付物清单

1. 本报告 `docs/audit/FullAudit-2026-05-21.md`(主交付,独立于既有 `FullAudit-2026-05.md`)。
2. 工具输出:`/tmp/forge_pr.log`、`/tmp/forge_coverage.log`、`/tmp/slither.log` + `/tmp/slither.json`。
3. 本轮 M-01 修复补丁:`src/core/GameHub.sol`、`test/unit/SecurityFixes.t.sol`。
4. 测试性能补丁:`test/invariants/SettlementRouterInvariants.t.sol`,用于让 router invariant
   在 PR profile 下保持可复跑。

*报告完 — 2026-05-21*
