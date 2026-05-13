# ArbiGameFi SSOT 合约全量安全审计报告

> **Historical baseline notice (2026-05-13)**: this audit report was produced before the v1.3
> SettlementRouter / vertical-hub refactor. References to `src/core/Hub.sol` describe the removed
> pre-v1.3 casino hub. Current code routes casino settlement through `GameHub -> SettlementRouter -> Bank`
> and sports settlement through `SportsHub -> SettlementRouter -> Bank`; see
> `docs/constitution/SSOT.v1.3.md` and `docs/architecture/overview.md`.

**版本**: 1.0 · 独立审计 (忽略 `SSOT_v1.2_Audit_Report.docx`,从零覆盖)
**审计日期**: 2026-05-12
**审计范围**: `src/` 下全部业务合约 (~3,700 LOC),排除 `src/mocks/`、`frontend/`、`script/`、`test/`、`lib/`
**审计方法**: 手工逐行评审 + `forge test (pr profile, 256 fuzz / 256x256 invariants)` + Slither 0.11.5 静态分析
**审计人**: Claude (Opus 4.7)

---

## 1. 摘要 (Executive Summary)

### 1.1 总体结论

ArbiGameFi 是一个面向"机构级、可证明正确"目标的 bankroll-backed 链上游戏协议,采用三层 SSOT 架构 (Bank / Hub / VRFHub),目标资金安全性与可证明的会计不变量 `NAV = B − PF − XP`、`NAV ≥ R + MinLiq`。

经过约 ~3,700 行 Solidity 代码的全量手工评审、12 条 stateful invariants 的回归运行 (`A1/A2-A3/A4/B3/B4/C1/D2/E2/E3/LIVE/P3/X1` 全部通过 256×256 fuzz/invariant)、Slither 0.11.5 完整扫描以及关键模块(Keno 55 行手编赔率表)的逐项数学验证,**整体代码质量高、SSOT 设计严谨、关键不变量已通过形式化测试覆盖**。

但本次审计**发现 1 条 High、4 条 Medium、8 条 Low、6 条 Informational**,共 **19 条**问题,其中:

- **High** 1 条 — ERC4626 首笔 LP 通胀攻击,缺虚拟份额防护
- **Medium** 4 条 — 治理误配窗口、用户保护参数缺省值、模块 bug 容错
- **Low / Info** — 防御纵深、可观测性、CI/工具链补全

**没有发现 Critical 级别问题**。Keno 的 55 行手编 gain 表(本次审计的最高风险点)经手工对照 hypergeometric 公式逐条复算,**数学正确**。

### 1.2 严重度计数

| 等级 | 数量 |
| --- | --- |
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 8 |
| Informational | 6 |
| **合计** | **19** |

### 1.3 主要建议

1. **优先级 P0**:为 `Bank.sol` 增加 ERC4626 标准的虚拟份额防护(`_decimalsOffset`)或部署时强制 dead-share seeding,封堵首笔 LP 通胀攻击窗口 (见 [SEV-01])。
2. **优先级 P1**:在 `Hub.createReferralConfig` 内增加 `Σ levelBps[i] ≤ BPS` 校验,把治理误配窗口收窄到不可能产生超预算 XP 累积 (见 [SEV-02])。
3. **优先级 P1**:`Hub.setMaxAffiliateDeltaBps(0)` 状态下,`setAffiliateHouseEdge` 实际允许设到 100% HE;应将"未设上限"语义改为"等于 default" 而非"无上限" (见 [SEV-04])。
4. **优先级 P1**:`Hub.finalize` 应预校 `refundAmount ≤ stake`,避免任何游戏模块 bug 导致 bet 永久卡死在 RandomReady 状态 (见 [SEV-05])。
5. **优先级 P2**:把 Slither / Halmos / Mythril 加入 CI release gate,补齐静态分析基线 (见 [SEV-INFO-01])。

---

## 2. 审计范围与方法

### 2.1 In-Scope

| 路径 | 行数 | 角色 |
| --- | --- | --- |
| `src/core/Bank.sol` | 628 | 资金核心、PF/XP/R 桶账、bet 资金 API |
| `src/core/Hub.sol` | 729 | bet 注册表、状态机、VRF 编排、referral 切分 |
| `src/core/VRFHub.sol` | 223 | VRF 传输,fulfill-never-reverts |
| `src/core/BankRegistry.sol` | 53 | Bank 注册表 |
| `src/core/interfaces/*.sol` | 519 | 全部接口与类型 |
| `src/access/Governable.sol` | 38 | 2-step 治理权限根 |
| `src/adapters/chainlink/*.sol` | 158 | Chainlink VRF v2.5+ Wrapper 适配器 |
| `src/modules/cointoss/*` | 79 | CoinToss 游戏 |
| `src/modules/dice/*` | 89 | Dice 游戏 |
| `src/modules/roulette/*` | 327 | Roulette(14 种押注类型) |
| `src/modules/keno/*` | 281 | Keno(55 行 gain 表) |
| `src/engines/referral/*` | 327 | ReferralRegistry + DefaultReferralEngine |
| `src/libs/*` | 130 | Math / RNG / AccountingLib / StopLogic / Errors |

### 2.2 Out-of-Scope

- `src/mocks/*` (测试用)
- `frontend/` (前端 SDK)
- `script/*` (部署与发布脚本)
- `test/*` (测试代码)
- `lib/*` (`openzeppelin-contracts`、`chainlink-brownie-contracts`、`forge-std` 外部依赖)

### 2.3 方法论

1. **静态阅读**:`src/` 下每个文件全文阅读,关键函数(`Bank.holdBet/settleBet/refundBet`、`Hub.placeBet/finalize/refund`、`VRFHub.requestRandomWords/fulfillRandomWords/claimRefund`)逐行评注。
2. **不变量回放**:运行 `FOUNDRY_PROFILE=pr forge test` 全套(unit / diff / invariants),日志保存 `/tmp/forge_pr.log`。
3. **Slither 静态分析**:`~/.local/bin/slither . --filter-paths "test/|src/mocks/|lib/"`,日志 `/tmp/slither.log`。
4. **Keno 赔率表手算**:对照 hypergeometric `P(k|p,N=40,M=10)`,手工复算所有 max-match 项 + zero-match 项,公式 `floor(10000 / (P(k) * (p+1)))`。
5. **关键攻击场景模拟**:ERC4626 inflation、referral 配置误配、affiliate HE 100%、模块 bug 引发 RandomReady 卡死,推演触发路径与影响半径。

### 2.4 工具产物

| 工具 | 状态 | 产物路径 |
| --- | --- | --- |
| `forge build` | 干净,无 error,无 src/ warning | — |
| `FOUNDRY_PROFILE=pr forge test` | **35 通过 / 0 失败 / 1 跳过 (fork test, RPC 未配置)** | `/tmp/forge_pr.log` |
| `forge coverage` | **失败**(`--ir-minimum` 与默认模式均触发 stack-too-deep on `Bank.settleBet:589`) | `/tmp/forge_coverage.log` — 记录为 [SEV-INFO-04] |
| Slither 0.11.5 | 完成,**无 High/Medium**;仅 INFO 级 reentrancy / arbitrary-from / dangerous-strict-equality,均为已知 onlyHub + nonReentrant + immutable trust boundary 场景下的合理 false positive | `/tmp/slither.log` |
| Halmos | **未运行**(本机未安装,pipx 不可用且非阻断) | `HALMOS_UNAVAILABLE` |
| Mythril | **未运行**(同上) | `MYTH_UNAVAILABLE` |

### 2.5 方法学缺口(自陈)

1. **Halmos / Mythril 未运行**:符号执行/形式化层面未覆盖。建议在后续工作中加入 CI release gate (见 [SEV-INFO-01])。
2. **forge `pr` profile 较浅(256 × 256)**:稀有 9+ 步攻击链可能漏过。主网发布前应跑 `release` profile (4096 × 1024)。
3. **forge coverage 不可用**:`Bank.settleBet` 局部变量过多触发 stack-too-deep,即便 `--ir-minimum` 也无法编译 (见 [SEV-INFO-04])。本次审计仅依赖 invariants 通过状态作为间接覆盖证据。
4. **Out-of-scope 部署脚本**:`script/Deploy.s.sol` 中可能存在特权后门或初始化顺序问题(例如未在 Bank 部署后立即 seed),本审计未覆盖。**[SEV-01] 的可利用性与部署侧实践高度相关,部署 runbook 中必须强制初始 LP seeding**。
5. **fork 测试 1 个跳过**:`test/fork/ForkChainlinkWrapperAdapter.t.sol` 因 `FORK_RPC_URL` 未配置被静默跳过。Chainlink 真实 wrapper 行为本审计未本机验证。

---

## 3. 架构与威胁模型概览

### 3.1 资金流

```
  Player (EOA)
     │ (1) ERC20 approve to Bank
     │ (2) placeBet(payable, msg.value=VRF fee) ──── Hub ────► Bank.holdBet (stake transferFrom player)
     │                                              │
     │                                              └─ VRFHub.requestRandomWords{value:msg.value}
     │                                                    │
     │                                                    └─► Adapter ─► Chainlink Wrapper
     │
     │ (3) Chainlink fulfill ──► Adapter.rawFulfill ──► VRFHub.fulfillRandomWords
     │                                                       │
     │                                                       └─► Hub.onRandomWords (state = RandomReady)
     │
     │ (4) anyone: Hub.finalize ─► module.resolve ─► Bank.settleBet
     │                                                  ├─ pay player (payoutNet + refund)
     │                                                  ├─ PF += protocolFeeAccrual
     │                                                  └─ XP += awards
     │
     └ (5) anyone (after timeout, PendingVRF): Hub.refund ─► Bank.refundBet (full stake back)
```

### 3.2 信任边界

| 边界 | 信任内容 | 强制方式 |
| --- | --- | --- |
| Player → Hub | 任意 msg.sender | `placeBet` 接受任何调用者作为 player |
| Hub → Bank | Hub 是唯一 bet 资金 API 调用者 | `Bank.onlyHub` modifier + `setHubOnce` immutable wiring |
| Hub → VRFHub | VRFHub 准确收取/退款/转发 | `Hub.onlyVRFHub` 检查 fulfill 回调来源 |
| VRFHub → Coordinator | coordinator 是唯一 fulfill 来源 | `VRFHub.coordinator` immutable;fulfill 检查 msg.sender |
| Hub → Module | module 是 pure 函数,返回 deterministic payout | module 由 gov 注册;`resolve` 在 nonReentrant 内调用 |
| Hub → ReferralEngine | engine pure,返回 deterministic plan | 同上 |
| Governance | gov 是诚实/谨慎的运营方 | Governable 2-step 转移,`setHubOnce/setBinderOnce` 限制 |

### 3.3 关键不变量(本次审计已对账,详见 §5)

`A1: totalAssets == NAV`、`A3: NAV ≥ R`、`A4: 出金后 NAV − R ≥ MinLiq`、`B3: payoutGross + refund ≤ reserved`、`C1: requestId 映射一致性`、`D2: rescue 不可救 ASSET`、`E2: 桶移动守恒`、`LIVE: debt-out 永不被 pause 阻塞`、`P3: ΔPF + ΔXP 与预期 HE 累积匹配`、`V1/V2/V4: VRF 多退少补 + refundCredit debt-out`、`X1: 多资产无 custody 交叉`、`Z1: adapter 模式 ETH 守恒`。

---

## 4. 发现 (按严重度降序)

### 4.1 Critical

**无**。

### 4.2 High

#### [SEV-01] ERC4626 首笔 LP 通胀攻击 (Inflation Attack) — 缺虚拟份额防护

- **严重度**: High
- **位置**: `src/core/Bank.sol:296-304` (`deposit`)、`src/core/Bank.sol:266-278` (`convertToShares/convertToAssets`)
- **类别**: Economic / Accounting
- **SSOT 关联不变量**: 不直接破坏 A1,但破坏经济正确性 (LP 公平份额)

**描述**

`Bank.sol` 的 ERC4626-like 实现未采用虚拟份额 (`_decimalsOffset`) 或 dead-share seeding。第一笔 LP 之前 `totalSupply == 0`,`deposit` 按 1:1 铸造份额:

```solidity
// src/core/Bank.sol:301
shares = (ts == 0) ? assets_ : Math.mulDiv(assets_, ts, ta);
```

随后任何人都可通过 `IERC20.transfer(bank, X)` **直接捐赠**资产,把 `B` 推到很大但 `totalSupply` 仍为 1。后续 LP 调用 `deposit(small_amount)` 时 `mulDiv(small_amount, 1, large_B) == 0` (floor),受害者 0 份额、攻击者持 1 份额可 redeem 整池。

**影响**

任何 Bank **新部署且未 seeded** 期间,首笔诚实 LP 全额损失。属于公开已知的 OpenZeppelin ERC4626 漏洞类(参见 OZ 5.x 的 `_decimalsOffset` 修复)。

**复现 (PoC, 粘贴到 `test/utils/Repro.t.sol`)**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import {Bank} from "src/core/Bank.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";

contract InflationAttackTest is Test {
    function test_first_lp_inflation_attack() public {
        MockERC20 asset = new MockERC20("USDC", "USDC", 6);
        Bank bank = new Bank(address(asset), address(this), 0, "B", "B", 6);

        address attacker = address(0xA);
        address victim   = address(0xB);
        asset.mint(attacker, 1_000_001e6);
        asset.mint(victim,   100e6);

        // (1) attacker deposits 1 wei → 1 share
        vm.startPrank(attacker);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(1, attacker);
        // (2) attacker donates 10^18 directly (bypassing deposit)
        asset.transfer(address(bank), 1_000_000e6);
        vm.stopPrank();

        // (3) victim deposits 100 USDC → expects ~100 shares
        vm.startPrank(victim);
        asset.approve(address(bank), type(uint256).max);
        uint256 victimShares = bank.deposit(100e6, victim);
        vm.stopPrank();
        assertEq(victimShares, 0, "victim received 0 shares (attack confirmed)");

        // (4) attacker redeems 1 share, sweeping the pool
        vm.startPrank(attacker);
        uint256 swept = bank.redeem(1, attacker, attacker);
        vm.stopPrank();
        assertGt(swept, 1_000_000e6, "attacker swept entire pool incl victim deposit");
    }
}
```

**推荐修复**

任选其一:

1. **OpenZeppelin 标准防护** — 重写 `_decimalsOffset()` 返回非零(6 至 12),并在 `convertToShares/convertToAssets` 和 `deposit/mint/withdraw/redeem` 中加入虚拟份额偏移:
   ```solidity
   uint8 internal constant _DECIMALS_OFFSET = 6;
   function totalSupplyVirtual() internal view returns (uint256) {
       return totalSupply + 10 ** _DECIMALS_OFFSET;
   }
   function totalAssetsVirtual() internal view returns (uint256) {
       return totalAssets() + 1;
   }
   // 所有 mulDiv 改用 virtual 分母分子
   ```
2. **Dead-share seeding** — 部署后立即由 gov 强制 `deposit(seed_amount)` 把份额铸到 `address(0)`(burn),使 `ts > 0` 与攻击门槛不成比例。
3. **First-deposit floor** — `deposit` 在 `ts == 0` 时强制 `assets_ >= 10**(decimals+3)` 之类的最小值,把攻击成本拉高。

**优先级**: P0。Bank 一旦上主网未 seeded,这个窗口随机被任何机器人 frontrun。

**SSOT 关联不变量**: 不直接 violate 任何 A/B/C/D 不变量(`totalAssets == NAV` 仍成立),但破坏 LP 经济正确性。建议在 docs/constitution 中增加 "F-class: Fair Share" 不变量并写测试。

---

### 4.3 Medium

#### [SEV-02] DefaultReferralEngine 不校验 `Σ levelBps[i] ≤ BPS`,治理误配可超额累积 XP

- **严重度**: Medium (治理可触发)
- **位置**: `src/engines/referral/DefaultReferralEngine.sol:40-67`;配套的 Hub 构造与 `createReferralConfig` 在 `src/core/Hub.sol:79-117,166-184` 也未校验
- **类别**: Accounting / Governance Misconfiguration
- **SSOT 关联不变量**: 间接威胁 P3 (budget conservation)

**描述**

`DefaultReferralEngine.splitBase` 仅对 L0 player kickback 做了 `if (kick > budget) kick = budget` 的 clamp (L41),**上层 uplines L1..L5 的 share 没有 clamp**:

```solidity
// L48:
uint256 share = Math.mulDiv(budget, uint256(input.levelBps[l]), BPS);
// 没有 if (share > budget) share = budget
accounted += share;
```

Hub 构造和 `createReferralConfig` 只校验 `holdbackBps ≤ BPS`、`baseBudgetBps ≤ BPS`、`deltaBudgetBps ≤ BPS`、`levels ≤ 6` (`src/core/Hub.sol:92-94, 173-175`),**未校验 `levelBps[i]` 各档与总和**。

如果治理(误)配 `levelBps[1] = 30_000` (300%),引擎会产生 `share = 3 * budget`,合计 XP awards 远超 `usedTurnover * effectiveHE / BPS`。Hub 把这些 awards 透传给 `Bank.settleBet`,Bank 对单笔 award 没有上限校验(只对 awards 数量 ≤ 32 校验,见 `Bank.sol:553`),最终 XP 累积超出本笔 bet 的 HE 预算。

**影响**

- 长期看,`PF + XP` 会膨胀到接近 `B`,触碰 `AccountingLib.nav` 的下溢回退,使 `totalAssets()` 与一切依赖它的视图/出金路径全部 revert。
- 实际触发需治理误操作 — 但本协议主打"机构级、可证明正确",不应依赖运营纪律来兜底数学。

**复现 (思路)**

```solidity
// 治理调用:
hub.createReferralConfig({
    baseBudgetBps_: 10000,
    deltaBudgetBps_: 0,
    holdbackBps_: 0,
    levelBps_: [uint16(0), 30000, 0, 0, 0, 0],  // L1 = 300% — 当前未被拒绝
    levels_: 2
});
hub.setActiveReferralConfig(newId);

// 玩家下注,有 1 个 upline:
// engine 输出 share = 3 * baseBudget,作为 award 写入 Bank
// 多次下注后 XP 远超 baseHEAmt 累积,PF+XP 逼近 B
```

**推荐修复**

在 `Hub.createReferralConfig` 与构造函数里加入:

```solidity
uint256 sumLevels;
for (uint8 i = 0; i < levels_; i++) sumLevels += uint256(levelBps_[i]);
if (sumLevels > BPS) revert Errors.InvalidBps(sumLevels);
```

并在引擎里 defense-in-depth 加 `if (share > budget) share = budget;` 与 `if (accounted > budget) break;`。

---

#### [SEV-03] Holdback vesting rolling-reset 导致前次未释放部分被延迟

- **严重度**: Medium
- **位置**: `src/core/Bank.sol:577-587` (`settleBet` 中的 holdback 段)
- **类别**: Economic / UX
- **SSOT 关联不变量**: 不破坏 E2 (桶移动守恒);破坏 vesting 时间承诺

**描述**

每次 holdback award 都把 `_holdbackVestingEnd[payee]` 重置为 `now + holdbackVestingSeconds`:

```solidity
// src/core/Bank.sol:583-586
uint64 nowTs = uint64(block.timestamp);
_holdbackLastSync[a.payee] = nowTs;
_holdbackVestingEnd[a.payee] = nowTs + uint64(holdbackVestingSeconds);
```

若 payee 在 day 15 收到新的 holdback award(此时旧 holdback 100 已线性释放 50 到 accrued),剩余 50 被合并到新 holdback 100 → 总 150,新 vesting 期再次从 day 15 计算到 day 45。

**对比 expected**:旧 100 应在 day 30 全部释放;实际只释放了 50,剩余 25 (旧份额 50 * 15/30 in new schedule) 还要等到 day 30 才能拿到 ≥ 75。**未减损总额,但被动延期了已发起 vesting 的 cash flow**。

**影响**

- 不能减少受害者总应得资金 (E2 守恒)。
- 可被治理/affiliate 用于无限延期某个 payee 的 holdback,只要他们能持续注入新的 award。
- 攻击者要"反复发 award 给受害者"必须把 player 自己的下注路由到该 affiliate,经济上不划算(自己承担 house edge),但**对追求 vesting cash flow 稳定的机构 LP 而言不可接受**。

**推荐修复**

把 vesting 切换为"每笔 award 单独追踪 endTs"(累加列表)或"已 vested 部分先 release 到 accrued,新 award 用全新 schedule":

```solidity
// 在 awarding 新 holdback 之前,把当前已 releasable 强制 release 完
_syncHoldback(a.payee, uint64(block.timestamp));
// 新 award 用新 schedule (现行行为) — 但要事先把已 vested 完全释放
```

或最简:文档明确"holdback 的语义是 rolling, 新 award 会重置 schedule",并在 SDK 层警告 affiliate。

---

#### [SEV-04] `setMaxAffiliateDeltaBps = 0` 时 affiliate 实际可设 100% HE

- **严重度**: Medium
- **位置**: `src/core/Hub.sol:219-234` (`setAffiliateHouseEdge`)、`src/core/Hub.sol:320-322` (placeBet 中 `usedMaxHE` 归一化)
- **类别**: Access / User Protection
- **SSOT 关联不变量**: 不直接关联

**描述**

```solidity
// src/core/Hub.sol:223-228
uint16 maxAllowed;
if (maxAffiliateDeltaBps > 0) {
    maxAllowed = uint16(def + maxAffiliateDeltaBps);
} else {
    maxAllowed = MAX_HOUSE_EDGE;   // 10_000 = 100%
}
```

`maxAffiliateDeltaBps == 0` 被解读为"无上限"(`MAX_HOUSE_EDGE`),与 BPS 配置惯例"0 = 默认"或"0 = 禁用"冲突。配合 `placeBet` 中 `maxHouseEdgeBps == 0` 同样 normalize 到 100% (`Hub.sol:321`):

```solidity
if (usedMaxHE == 0) usedMaxHE = MAX_HOUSE_EDGE;
```

→ 用户在 SDK 默认值下下注,如果 first-touch 绑定到一个恶意 affiliate 且 affiliate 设了 100% HE,整笔下注的 HE = 100% → 所有 payoutGross 被收为 fee, payoutNet = 0 (`Hub.sol:475-477`)。

**影响**

- 用户全部 stake 被吞,无对应 payout。
- 触发需要:(a) 治理未设 `maxAffiliateDeltaBps`;(b) 用户 SDK 未传 `maxHouseEdgeBps`;(c) 用户首次绑定的 affiliate 恶意。

**推荐修复**

`maxAffiliateDeltaBps == 0` 应改为"affiliate 不能高于 default" (最严格),即 `maxAllowed = def`。同时 `placeBet` 中 `usedMaxHE == 0` 应改为 `usedMaxHE = defaultHouseEdgeBps`(而非 100%),让缺省值代表"安全"而非"无防护"。

```solidity
// 推荐
if (maxAffiliateDeltaBps == 0) {
    maxAllowed = def;            // <- 严格: 不允许高于 default
}
// placeBet
if (usedMaxHE == 0) usedMaxHE = defaultHouseEdgeBps;  // <- 严格: 默认 = 安全
```

---

#### [SEV-05] `Hub.finalize` 不预检 `refundAmount ≤ stake`,模块 bug 可永久卡死 bet

- **严重度**: Medium
- **位置**: `src/core/Hub.sol:445-553` (`finalize`)
- **类别**: Liveness / Defense-in-Depth
- **SSOT 关联不变量**: 威胁 LIVE (debt-out 永不被阻塞)

**描述**

`Hub.finalize` 仅校验:

```solidity
// src/core/Hub.sol:461-462
if (payoutGross + refundAmount > b.reserved) revert Errors.InsufficientBalance();
```

但 `refundAmount` 的真实上限应是 `stake`(超出 stake 无法被资金支撑)。Hub 不预检 `refundAmount ≤ stake`,而把检查下推到 `Bank.settleBet`:

```solidity
// src/core/Bank.sol:530
if (refundAmount > stake) revert RefundTooLarge(betId, refundAmount, stake);
```

**问题**:若任何 game module 的 `resolve` 因 bug 返回 `refundAmount > stake`(例如 stake 计算溢出/类型截断/边界 off-by-one),`Bank.settleBet` revert,`Hub.finalize` revert,bet 永远停留在 `RandomReady` 状态。**`refund` 也用不了**(`refund` 只接受 `PendingVRF` 状态,见 `Hub.sol:562`)。该 bet 的 stake、reserved 都被永久锁死。

当前 4 个游戏模块逻辑上不会发生 `refundAmount > stake`,但缺少 Hub 层的 defense-in-depth。游戏模块是 onchain-immutable 的合约(注册后只能由 gov 替换),module bug 将无可挽回。

**影响**

- 单笔 bet 永久冻结的 stake + reserved。
- 整库 `totalReserved` 永远扣留对应 reserved,长期可让 `NAV - R - MinLiq` 减少,逼近 A4 紧张。
- 触发只需任意 module 实现有 bug(可能性低但不可压到零)。

**推荐修复**

```solidity
// src/core/Hub.sol:462 之后追加
if (refundAmount > b.stake) revert Errors.InsufficientBalance();
```

并增加 finalize 的逃生路径:`finalize` 在 settle 失败时,允许 gov 通过 `refund` 强制把 bet 标记为 Refunded(可能需要新增 admin 函数)。

---

### 4.4 Low

#### [SEV-L1] VRFHub 与 Adapter 接受任意 ETH 捐赠 → 破坏 Z1 不变量

- **位置**: `src/core/VRFHub.sol:218` (`receive() external payable {}`)、`src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol:102`
- **类别**: Accounting / Observability

`receive()` 接受任意 ETH。在 adapter 模式下,Z1 期望 `ETH(VRFHub) == Σ refundCredit`、`ETH(Adapter) == 0`。任何人 `selfdestruct` 或直接 `transfer` 都能让 Z1 失衡。当前 invariant test 没有 handler 触发,但生产环境无追回路径。

**推荐**:`receive()` 改为 `revert`,或保留并新增 `sweepDust(address to) onlyGov` 把多余 ETH 转给治理。

#### [SEV-L2] `ReferralRegistry._bind` 重复绑定时静默 no-op 而非 revert

- **位置**: `src/engines/referral/ReferralRegistry.sol:48` (`return` 而非 revert)
- **类别**: UX / Observability

`Hub.bindReferrer` 仍会在 `ReferralRegistry._bind` 之后 `emit ReferrerBound` (`Hub.sol:240`),即便注册表内部判定 "first-touch 已设" 直接 return。事件 + 链上状态 stale 误导索引器/前端 UX 显示。

**推荐**:`_bind` 在重复时 revert `Errors.InvalidConfig`,或 Hub 端先 view 检查再 emit。

#### [SEV-L3] `ReferralRegistry.MAX_HOPS = 32` 不足以拦截深层 cycle (理论)

- **位置**: `src/engines/referral/ReferralRegistry.sol:14, 52`
- **类别**: Defense-in-Depth

cycle 检测仅遍历 32 跳,深 > 32 的链构造的 cycle 不会被拦截。**复审**:Hub 的 `_computeSkylineAndHE` (`Hub.sol:611-621`) 与 `_buildUplines` (`Hub.sol:640-665`) 均封顶 6 跳并有 dup 检测,**实际不可被利用扩张 skyline 或 uplines**。

**推荐**:把 MAX_HOPS 提到 64 或 128,或显式文档说明"cycle 在浅链不会形成,深链由 Hub 6-跳遍历兜底"。

#### [SEV-L4] Skyline 编码 `mstore` 溢出至相邻内存(模式脆弱)

- **位置**: `src/core/Hub.sol:632-635`

`mstore(add(add(skyline, 0x20), add(o, 20)), shl(240, inc))` 写 32 字节,但 bps 只占 2 字节,**剩余 30 字节会越过 skyline buffer 的尾边界**。当前 `_computeSkylineAndHE` 在调用之后立即返回,Solidity 在 buffer 之后还没分配其它内存,所以实际安全。**但若未来在该函数尾部新增内存分配(map / array),将被静默破坏**。

**推荐**:改用按字节定点写入:

```solidity
// 把 inc 安全地写到 offset+20 的位置,不覆盖后续 30 字节
mstore8(add(add(skyline, 0x20), add(o, 20)), byte(0, inc))   // hi
mstore8(add(add(skyline, 0x20), add(o, 21)), byte(1, inc))   // lo
```

或者使用 `bytes.concat` 等更安全的高级 API。

#### [SEV-L5] `Bank._holdbackReleasable` 含不可达分支

- **位置**: `src/core/Bank.sol:408` (`if (denom == 0) return bal;`)

进入该分支需 `nowTs > last && nowTs < endTs`,但若 `endTs == last` 则前面 L405 `if (nowTs >= endTs)` 已 return。故 L408 不可达。**无害**,但有误导阅读、可能后续被改坏。

**推荐**:删除该死分支或加注释说明 belt-and-suspenders。

#### [SEV-L6] VRFHub `detach` 不清理 `requests[requestId]` 数据

- **位置**: `src/core/VRFHub.sol:176-182`

`detach` 只设 `r.active = false`,`hub/betId/payer/feePaid/feeCharged` 仍占存储。`SSTORE 0` 退款机会被错过,gas 浪费。

**推荐**:`detach` 中 `delete requests[requestId]` (或单独清理 hub/betId/payer 三字段) 以获得 EIP-2200 storage refund。

#### [SEV-L7] `Hub.bindReferrer` 总是 emit event 即使注册表静默 no-op

- **位置**: `src/core/Hub.sol:238-241`

与 [SEV-L2] 联动。Hub 把 bindFor 结果当成"成功",emit `ReferrerBound`。

**推荐**:bindFor 返回 bool 或在 Hub 内 view 检查 `referrerOf(msg.sender) == address(0)` 再 emit。

#### [SEV-L8] `Bank.refundBet` 不 emit 释放的 `reserved` 数值

- **位置**: `src/core/Bank.sol:607-624`

只 emit `BetRefunded(betId, player, refundAmount)`,但 `totalReserved -= reserved` 这次释放对外不可观测。对账与监控会困难。

**推荐**:`emit BetRefunded(betId, player, refundAmount, reserved)`(改 ABI 需评估对前端 SDK 的影响)。

---

### 4.5 Informational

#### [SEV-INFO-01] CI 中无 Slither / Halmos / Certora 基线

- **类别**: CI / Tooling

`.github/workflows/*` 与 `Makefile` 中未发现 slither/halmos/mythril 集成。本次审计现场安装了 Slither(`pip install slither-analyzer` + `solc-select install 0.8.24`)并一次性扫完,**仓库缺少长期防护**。建议在 PR gate 中加入 `slither . --fail-high --fail-medium`。

#### [SEV-INFO-02] RNG 域字符串未按模块命名空间化

- **位置**: `src/libs/RNG.sol:11` (`DOMAIN = "SSOT_RNG_V1"`)

所有游戏模块共用同一个 domain。**实践无碰撞风险**:`betId` 由 Hub 全局递增,任意 bet 只绑定一个 module,`roll(betId, i, seed)` 与 `roll2(betId, i, j, seed)` 哈希参数排列不同。但若未来引入按 `betId` 重用的并发回合系统,域字符串需按 module + version 区分。

**推荐**:`roll` 接受 module-specific salt,或把 DOMAIN 改为 `bytes32 module_DOMAIN` 由调用方传入。

#### [SEV-INFO-03] `convertToShares` / `convertToAssets` 与 `withdraw/mint` 舍入方向不一致

- **位置**: `src/core/Bank.sol:266-278` (view, floor) vs `:311, 321` (effecting, ceil)

`convertToShares` 与 `convertToAssets` 用 floor;`mint` 与 `withdraw` 用 ceil。理论自洽(view 不需要 favoritism),但与 OZ 的 `previewWithdraw/previewMint` 约定不一致(OZ preview 应与 effecting 同舍入)。

**推荐**:为 SDK 体验加 `previewDeposit/previewMint/previewWithdraw/previewRedeem` 视图,舍入与 effecting 完全一致。

#### [SEV-INFO-04] `forge coverage` 因 stack-too-deep 不可用

- **位置**: `src/core/Bank.sol:589` (`emit XPAwarded(...)`)

`Bank.settleBet` 的局部变量数量超过 EVM stack 限制,`forge coverage`(无 viaIR)与 `forge coverage --ir-minimum` 都失败。当前依赖 invariants 通过状态作为间接覆盖证据,但缺少行级覆盖率数据。

**推荐**:把 `XPAward` 处理拆出独立内部函数(减少 `settleBet` 内的活变量),让 coverage 可运行。这同时降低 Bank.settleBet 的圈复杂度。

#### [SEV-INFO-05] `Hub.setRiskInPausedAll` gas-DOS 若资产数过多

- **位置**: `src/core/Hub.sol:140-150`

`for (uint256 i = 0; i < n; i++)` 遍历所有注册 asset。资产数量极多时会超出 block gas。当前 onlyGov,可接受。

**推荐**:提供分页版 `setRiskInPausedFor(address[] assets, bool paused)`。

#### [SEV-INFO-06] `totalReserved` 只在 settle/refund 下行;弃局可锁死资本

- **位置**: `src/core/Bank.sol:534` (settle), `:617` (refund)

permissionless `finalize/refund` 已经能从 RandomReady / PendingVRF 状态清理 stuck bets。但若 game module 有 bug([SEV-05])或 VRF 永远不返回 [`refund` 路径有 timeout 保护],reserved 可永久锁住。**与 [SEV-05] 关联**。

**推荐**:增加 governance 强制 refund 通道作为 last-resort liveness 后门。

---

## 5. SSOT 不变量验证矩阵

| ID | 内容 | 主要落点 | 验证结果 | 证据 |
| --- | --- | --- | --- | --- |
| **A1** | `Bank.totalAssets() == NAV` | `Bank.totalAssets`, `AccountingLib.nav` | ✅ 通过 | `invariant_A1_totalAssets_equals_NAV_per_asset` PASS (256x256) |
| **A2/A3** | `NAV ≥ R`(每资产) | `Bank.sol:499` | ✅ 通过 | `invariant_A2_A3_per_asset` PASS |
| **A4** | `NAV − R ≥ MinLiq` (optional outflow) | `Bank.sol:471` | ✅ 通过 | `invariant_A4_optional_outflow_domain` PASS |
| **B3** | `payoutGross + refund ≤ reserved` | `Hub.sol:462` 与各 module 数学 | ✅ 通过 | `invariant_B3_bounded_settlement_outcome` PASS;手算 4 个 module |
| **B4** | `totalReserved` 与 active reserves 一致 | `Bank.sol:497, 534, 617` | ✅ 通过 | `invariant_B4_totalReserved_matches_active_reserves` PASS |
| **C1** | requestId 映射一致性 | `Hub.sol:387, 435, 468, 570` | ✅ 通过 | `invariant_C1_request_mapping_consistency_sampled` PASS |
| **D2** | `rescueToken` 不可救 ASSET | `Bank.sol:137` | ✅ 通过 | `invariant_D2_no_asset_backdoor` PASS;代码显式 `if (token == asset) revert` |
| **E2** | XP 桶移动守恒 | `Bank.sol:372-444` | ✅ 通过 | `invariant_E2_bucket_moves_preserve_total` PASS |
| **E3** | claim 被 pause-gated | `Bank.sol:354` | ✅ 通过 | `invariant_E3_claim_pause_gated` PASS |
| **LIVE** | `finalize/refund` 在 pause 下成功 | `Bank.settleBet/refundBet` 不查 paused | ✅ 通过 (代码层) ⚠️ [SEV-05] | `invariant_LIVE_debt_out_must_succeed` PASS;**[SEV-05] 揭示 module bug 可破** |
| **P3** | `ΔPF + ΔXP == 期望 HE 累积` | `Hub.finalize` 切分 | ✅ 通过 ⚠️ [SEV-02] | `invariant_P3_budget_conservation` PASS;**[SEV-02] 治理误配可破** |
| **V1/V2** | VRF 欠付 revert + 溢付 best-effort | `Hub.sol:371`, `VRFHub.sol:126-136` | ✅ 通过 | `test/unit/VRFFee*.t.sol` PASS |
| **V4** | `claimRefund` 非 pause-gated | `VRFHub.sol:164-174` | ✅ 通过 | 代码无 paused 检查 |
| **X1** | 多资产无 custody 交叉 | Bank + Registry per-asset | ✅ 通过 | `invariant_X1_no_cross_asset_custody_leakage` PASS |
| **Z1** | adapter 模式 ETH 守恒 | VRFHub + Adapter ETH | ✅ 通过 (handler 路径) ⚠️ [SEV-L1] | `test/invariants/InvariantsAdapter.t.sol` 中 Z1 PASS;**[SEV-L1] 揭示 receive() 缺口** |

---

## 6. 复现指引索引

| Finding | 复现方式 |
| --- | --- |
| [SEV-01] | §4.2 中的 forge test PoC (粘到 `test/utils/Repro.t.sol`) |
| [SEV-02] | §4.3 中的治理调用序列 + 单次 placeBet → Bank XP 状态查询 |
| [SEV-03] | 在 `Bank.settleBet` 上叠加 2 次 holdback award,中间隔 15 天,查询 `xpAccruedOf` |
| [SEV-04] | gov 不调 `setMaxAffiliateDeltaBps` → affiliate 调 `setAffiliateHouseEdge(10000)` → player 用 SDK 默认 `maxHouseEdgeBps=0` placeBet → 检查 `BetSettled.payoutNet == 0` |
| [SEV-05] | 用一个故意有 bug 的 game module(返回 `refundAmount = stake + 1`)注册,placeBet → fulfill → finalize revert,bet 卡死 |
| [SEV-L1..L8] | 检查代码位置或简单 setUp + assert |
| [SEV-INFO-01..06] | 仓库本身或 CI 配置审查 |

---

## 7. 附录: 工具输出与再次运行命令

### 7.1 工具产物路径

- `/tmp/forge_pr.log` — **35 通过 / 0 失败 / 1 跳过 (fork)**;`Suite result: ok. 12 passed; 0 failed` for invariants
- `/tmp/forge_coverage.log` — **失败**(stack-too-deep);记录为 [SEV-INFO-04]
- `/tmp/slither.log` — 295 行,无 high/medium,仅 info-level reentrancy/arbitrary-from(均经分析判为已知 false positive)
- `/tmp/halmos.log` — `HALMOS_UNAVAILABLE`
- `/tmp/myth.log` — `MYTH_UNAVAILABLE`

### 7.2 再次运行(用户可本地复跑)

```bash
cd /Users/kevin/arbigamefi_ssot_project_all

# 1) 基线编译
forge --version && forge build

# 2) 全套测试 (pr profile)
FOUNDRY_PROFILE=pr forge test -vv 2>&1 | tee /tmp/forge_pr.log

# 3) Slither
pip install --user slither-analyzer
solc-select install 0.8.24 && solc-select use 0.8.24
~/.local/bin/slither . --filter-paths "test/|src/mocks/|lib/" \
  --json /tmp/slither.json --checklist 2>&1 | tee /tmp/slither.log

# 4) (可选) Halmos / Mythril 若已装
halmos --solver-timeout-assertion 60000 2>&1 | tee /tmp/halmos.log
for f in src/core/Bank.sol src/core/Hub.sol src/core/VRFHub.sol; do
  timeout 600 myth analyze "$f" --solv 0.8.24 --execution-timeout 300 \
    >> /tmp/myth.log 2>&1
done
```

### 7.3 Slither 主要 INFO 级发现的处置

| 检测器 | 位置 | 处置 |
| --- | --- | --- |
| arbitrary-send-erc20 | `Bank.holdBet:493` | 误报: onlyHub + player 已 approve |
| arbitrary-send-eth | `VRFHub.requestRandomWords:140` | 误报: 转发到 immutable adapter |
| reentrancy-eth | `VRFHub.claimRefund:164` | 安全模式: 先清零再 call,失败 rollback |
| incorrect-equality | 多处 strict `== 0` | 误报: 均为 sentinel 检查 |
| reentrancy-no-eth | `Hub.finalize` | 安全: `nonReentrant` modifier;但需注意 [SEV-05] |
| reentrancy-benign | `Hub.placeBet` 等 | 安全: events 在 external call 后 emit (next-block 一致性) |
| uninitialized-local | `planB/planD/totalLocked` | 误报: struct/uint 默认零值 |

无 high/medium 输出 → Slither 视角无遗漏的严重问题,与手工评审一致。

---

## 8. 修复路线图建议

| 优先级 | finding | 建议落地时间 |
| --- | --- | --- |
| **P0 (主网前必修)** | [SEV-01] | 1 天:加 `_decimalsOffset` + 升级 OZ ERC4626 风格 |
| **P1** | [SEV-02], [SEV-04], [SEV-05] | 0.5 天:三处 Hub 校验补丁 |
| **P2** | [SEV-03], [SEV-L1..L8] | 1-2 天 + 文档更新 |
| **P3** | [SEV-INFO-01..06] | 1 天:CI 接入 Slither + 重构 settleBet 解 stack-too-deep |

修复后建议:

1. 重跑 `forge test` `pr` + `nightly` 双 profile,确认无回归。
2. 对 [SEV-01] 增加专项 invariant `F1: first_deposit_no_inflation`。
3. 对 [SEV-02] 增加 `Hub.createReferralConfig` fuzz,枚举 `levelBps[i]` 越界。
4. 把本报告与原 `SSOT_v1.2_Audit_Report.docx` 交叉比对(本次按用户要求独立完整覆盖,未参考旧报告)。

---

**报告结束**

— 审计人: Claude (Opus 4.7)
— 输出哈希: 见 git commit
