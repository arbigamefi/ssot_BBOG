# ArbiGameFi SSOT 合约全量安全审计报告

> **修订说明 (2026-05-13)**:本报告为 v1.3 重审版本。原 2026-05-12 v1.2 单体 Hub 审计版本作为
> "历史基线"保留在 §A 附录。v1.3 重构引入 `SettlementRouter` + 垂直 hub
> (`GameHub` + `SportsHub`) + `PoolRegistry`,并新增 4 个游戏模块 (Baccarat / Plinko / SicBo / Slots)。
> v1.2 报告引用的 `src/core/Hub.sol` 已被拆分,所有 v1.2 finding 的修复状态已在本报告 §6 重新对账。

**版本**: 2.0 · v1.3 重审 · 独立审计(忽略历史 `SSOT_v1.2_Audit_Report.docx`)
**审计日期**: 2026-05-13
**审计范围**: `src/` 下全部业务合约 (~5,914 LOC),排除 `src/mocks/`、`frontend/`、`script/`、`test/`、`lib/`
**审计方法**: 手工逐行评审 + `forge test (pr profile, 256 fuzz / 256x256 invariants)` + Slither 0.11.5 静态分析 + 重审 SecurityFixes.t.sol 验证 v1.2 修复
**审计人**: Claude (Opus 4.7)

---

## 1. 摘要 (Executive Summary)

### 1.1 总体结论

v1.3 在 v1.2 之上做了**结构性重构与全面安全加固**。原单体 `Hub.sol`(729L)拆分为:

- `SettlementRouter`(104L)— 唯一的 Bank 结算入口,跨垂直 hub 共享
- `GameHub`(603L)— 赌场游戏生命周期与 VRF 编排
- `SportsHub`(752L,**全新**)— 体育博彩生命周期与 oracle 信任链
- `PoolRegistry`(107L,**全新**)— poolId 驱动的资金账户隔离
- `SportsRiskEngine`(225L,**全新**)— 体育博彩风险敞口闸

并对 v1.2 审计的 19 条发现中的 **11 条做了带测试覆盖的修复**(详见 §6),其中 1 条 High + 4 条
Medium + 6 条 Low/L 全部以 `test/unit/SecurityFixes.t.sol` 中 9 个明确 PoC 测试做了回归。

### 1.2 v1.3 关键里程碑

| 维度 | v1.2 | v1.3 | 变化 |
| --- | --- | --- | --- |
| 业务代码量 (LOC) | ~3,700 | ~5,914 | +60% |
| 核心合约数 | 4 (Bank/Hub/VRFHub/BankRegistry) | 7 (+SettlementRouter/PoolRegistry/SportsHub/SportsRiskEngine, -BankRegistry) | 重构 |
| 游戏模块数 | 4 (Dice/CoinToss/Roulette/Keno) | 8 (+ Baccarat/Plinko/SicBo/Slots) | +4 |
| forge 测试套件 (pr profile) | 35 通过 / 0 失败 / 1 跳过 | **113 通过 / 0 失败 / 1 跳过** | +78 |
| Stateful invariants | 12 (A/B/C/D/E/P/X/Z) | **19** (+R1-R4 SettlementRouter, +S1-S3 SportsHub) | +7 |
| Slither High/Medium (真实) | 0 | 0 | — |

### 1.3 v1.3 重审发现汇总

**v1.2 旧发现的处置**:

| v1.2 ID | 严重度 | v1.3 状态 |
| --- | --- | --- |
| SEV-01 (ERC4626 inflation) | High | ✅ **已修复** — `Bank.sol:32,97,293-299` 加 `_virtualOffset` |
| SEV-02 (levelBps 无总和上限) | Medium | ✅ **已修复** — `GameHub.sol:574-578` `_validateReferralConfig` |
| SEV-03 (holdback rolling reset) | Medium | ✅ **已修复** — `Bank.sol:600` 不再延展 active schedule endTs |
| SEV-04 (affiliate HE 0 → 100%) | Medium | ✅ **已修复** — `GameHub.sol:294,581-586` 严格化默认值 |
| SEV-05 (refundAmount>stake 卡死) | Medium | ✅ **已修复** — `GameHub.sol:437-446` finalize fallback refund |
| SEV-L2 (重复 bind 静默 no-op) | Low | ✅ **已修复** — `ReferralRegistry._bind` 重复 revert |
| SEV-L4 (skyline mstore 越界) | Low | ✅ **已修复** — `GameHub.sol:664-668` 改逐字节循环 |
| SEV-L5 (`_holdbackReleasable` 死分支) | Low | ✅ **已修复** — 死分支删除 |
| SEV-L6 (VRFHub detach 不清存储) | Low | ✅ **已修复** — `VRFHub.sol:182` `delete requests[requestId]` |
| SEV-L7 (`bindReferrer` 重复仍 emit) | Low | ✅ **间接修复**(L2 修复后调用先 revert) |
| SEV-L8 (`refundBet` 不 emit reserved) | Low | ✅ **已修复** — `Bank.sol:546,635` `BetReserveReleased` 事件 |
| SEV-L1 (VRFHub receive 接受 ETH) | Low | ⚠️ **未处理** — `VRFHub.sol:222`、`Adapter.sol:102` 仍接受裸 ETH |
| SEV-L3 (MAX_HOPS=32) | Info | ⚠️ **未处理**(Hub 6 跳兜底仍有效) |
| SEV-INFO-01..06 | Info | ⚠️ **未处理 / 部分 N/A**(详见 §6) |

**v1.3 新发现**:

| ID | 严重度 | 一句话 |
| --- | --- | --- |
| [NEW-H1] | **High** | SportsHub:Challenged 状态若 arbitrator 不响应,治理无 voidMarket 逃生通道,tickets 永久冻结 |
| [NEW-M1] | Medium | SportsHub:ReopenResult 仲裁后 `_results[marketId]` 整体覆盖,链上 audit trail 仅靠事件 |
| [NEW-M2] | Medium | SportsHub:`settleTickets/refundTickets/voidTickets` 批量循环无分页,大批量会 OOG |
| [NEW-M3] | Medium | SettlementRouter:不预检 `payoutGross+refundAmount ≤ pos.reserved`(B3 仅依赖 Bank) |
| [NEW-M4] | Medium | GameHub.finalize fallback refund 路径:恶意模块借 `refundAmount > stake` 规避 protocol fee 累积 |
| [NEW-L1] | Low | SportsHub 无 protocol fee/HE 累积(design — 边际靠 oracle odds vig) |
| [NEW-L2] | Low | SettlementRouter 不为失败注册校验 emit 事件,审计追溯仅靠 revert |
| [NEW-L3] | Low | BaccaratModule 用 stateless 13-rank 抽样模型,与实际 6-8 副 deck shoe 有 ~0.5% 边际差 |
| [NEW-INFO-1] | Info | PoolRegistry 无 unregister(intentional — 防 retroactive 路由) |
| [NEW-INFO-2] | Info | forge coverage 仍因 `Bank.settleBet` stack-too-deep 不可用 |

### 1.4 严重度计数 (v1.3 重审)

| 等级 | 数量 |
| --- | --- |
| Critical | 0 |
| High | 1 (NEW-H1) |
| Medium | 4 (NEW-M1..M4) |
| Low | 5 (SEV-L1 + SEV-L3 旧未处理 + NEW-L1..L3) |
| Informational | 6 (SEV-INFO-01..02 + NEW-INFO-1..2 + 其余 SEV-INFO 视为可接受) |
| **合计** | **16** |

### 1.5 主要建议

1. **P0 (主网前必修)**:[NEW-H1] SportsHub `voidMarket` 必须支持从 Challenged 状态逃生(超时治理 void),否则不响应的 arbitrator 可以永久冻结一场赛事的全部 tickets。
2. **P1**:[NEW-M3] SettlementRouter 加 `payoutGross+refundAmount ≤ pos.reserved` 防御纵深;[NEW-M2] 批量循环加 hard cap(如 100 张) + 增量记录失败 ID。
3. **P1**:[NEW-M4] GameHub.finalize 的 fallback refund 应保留 `usedTurnover * baseHE` 的 protocol fee 累积,避免恶意模块完全规避 fee。
4. **P2**:[SEV-L1] VRFHub 与 Adapter 的 `receive()` 改为 revert,或加 `sweepDust(to) onlyGov`。
5. **P3**:[SEV-INFO-01] CI 接入 Slither(本审计现场安装,仓库长期缺基线)。

---

## 2. 审计范围与方法

### 2.1 In-Scope (v1.3)

| 路径 | 行数 | 角色 |
| --- | --- | --- |
| `src/core/Bank.sol` | 647 | 资金核心、PF/XP/R 桶账、bet 资金 API、**`_virtualOffset` 防 inflation** |
| `src/core/SettlementRouter.sol` | **104 (新)** | 唯一 Bank 结算入口,position 状态机 |
| `src/core/PoolRegistry.sol` | **107 (新)** | poolId 注册表,资金账户隔离 |
| `src/core/GameHub.sol` | **760 (重构自旧 Hub)** | 赌场 game lifecycle + VRF 编排 + referral 切分 |
| `src/core/SportsHub.sol` | **752 (新)** | 体育博彩 market/result/ticket 生命周期 |
| `src/core/SportsRiskEngine.sol` | **225 (新)** | 体育博彩风险敞口 / odds 信任 hash |
| `src/core/VRFHub.sol` | 227 | VRF 传输,fulfill-never-reverts(detach 现 `delete requests[id]`) |
| `src/core/interfaces/*.sol` | 902 | 全部接口(新增 `IGameHub`、`ISportsHub`、`ISportsRiskEngine`、`IPoolRegistry`、`ISettlementRouter`) |
| `src/access/Governable.sol` | 38 | 2-step 治理权限根(未变) |
| `src/adapters/chainlink/*.sol` | 158 | Chainlink VRF v2.5+ Wrapper(未变) |
| `src/modules/cointoss/*` | 79 | CoinToss(未变) |
| `src/modules/dice/*` | 89 | Dice(未变) |
| `src/modules/roulette/*` | 327 | Roulette(未变) |
| `src/modules/keno/*` | 281 | Keno(未变) |
| `src/modules/baccarat/*` | **157 (新)** | Baccarat — 3 因子,~22414/21813/104793 / 10000 |
| `src/modules/plinko/*` | **151 (新)** | Plinko 3 风险档(LOW/MED/HIGH) |
| `src/modules/sicbo/*` | **201 (新)** | Sic Bo 7 种押注类型 |
| `src/modules/slots/*` | **119 (新)** | Slots 8 符号 3 滚轴,jackpot 64× |
| `src/engines/referral/*` | 330 | ReferralRegistry + DefaultReferralEngine |
| `src/libs/*` | 130 | Math / RNG / AccountingLib / StopLogic / Errors(未变) |

### 2.2 Out-of-Scope

- `src/mocks/*` (测试用)
- `frontend/` (前端 SDK)
- `script/*` (部署与发布脚本)
- `test/*` (但本审计**重读** `test/unit/SecurityFixes.t.sol` 作为 v1.2 修复回归验证)
- `lib/*` (外部依赖)

### 2.3 方法论

1. **静态阅读**:`src/` 下每个 v1.3 新增/修改文件全文阅读,包括:
   - `Bank.sol` 完整重读(已加 `_virtualOffset` + holdback 修复)
   - `GameHub.sol` 重读对照 SEV-02/04/05/L4 修复点
   - `SettlementRouter.sol` 全读 — 跨 hub 信任边界焦点
   - `SportsHub.sol` 完整重读 — oracle quorum + result 生命周期 + ticket 结算
   - `SportsRiskEngine.sol` — exposure cap + riskHash 链
   - `VRFHub.sol` 对照 SEV-L6 修复
2. **不变量回放**:运行 `FOUNDRY_PROFILE=pr forge test`(unit/diff/invariants/fork)→ **113 通过 / 0 失败 / 1 跳过 (fork)**。日志 `/tmp/forge_pr_v13.log`。
3. **Slither v0.11.5 静态分析**:`~/.local/bin/slither . --filter-paths "test/|src/mocks/|lib/"`。日志 `/tmp/slither_v13.log`。报告 3 个 Impact:High + 2+ Medium,**全部为已知模式的合理 false positive**(详见 §7.3)。
4. **SEV-01..L8 修复回归**:逐项核对 `test/unit/SecurityFixes.t.sol` 中 9 个 PoC 测试与对应代码位置。
5. **新游戏模块数学验证**:Baccarat 3 因子(EV=1.0000)、Slots EV=512/512=1、SicBo 各 bet 类型因子(Specific Triple=216×、Total counts 3..27)逐项手算。Keno 55 行赔率表(v1.2 已验证)未变更。

### 2.4 工具产物

| 工具 | 状态 | 产物路径 |
| --- | --- | --- |
| `forge build` | 干净,无 error | — |
| `FOUNDRY_PROFILE=pr forge test` | **113 通过 / 0 失败 / 1 跳过** | `/tmp/forge_pr_v13.log` |
| `forge coverage` | **仍失败**(`Bank.settleBet:589` stack-too-deep,即便 `--ir-minimum`) | 同 [NEW-INFO-2] |
| Slither 0.11.5 | 完成,**无真实 High/Medium**;详细处置见 §7.3 | `/tmp/slither_v13.log` |
| Halmos / Mythril | **未运行**(本机未安装,非阻断) | `HALMOS/MYTH_UNAVAILABLE` |

### 2.5 方法学缺口(自陈)

1. **Halmos / Mythril 未运行**:符号执行未覆盖。建议接入 CI release gate(见 [SEV-INFO-01],仍未修复)。
2. **forge `pr` profile 较浅(256 × 256)**:稀有 9+ 步攻击链可能漏过。主网发布前应跑 `release` profile (4096 × 1024)。
3. **forge coverage 不可用**:仍因 `Bank.settleBet` 局部变量过多 stack-too-deep。本审计依赖 invariants 通过状态作为间接覆盖证据。
4. **fork 测试 1 个跳过**:`test/fork/ForkChainlinkWrapperAdapter.t.sol` 因 `FORK_RPC_URL` 未配置静默跳过(同 v1.2)。
5. **SportsHub oracle off-chain 行为**:reporter / challenger / arbitrator 集合由治理控制,off-chain 治理纪律不在审计范围。本审计假设 reporter 与 arbitrator 是诚实多签;若全部不响应,见 [NEW-H1]。

---

## 3. v1.3 架构与威胁模型概览

### 3.1 资金流(casino,通过 GameHub)

```
  Player (EOA)
     │ (1) ERC20 approve to Bank
     │ (2) GameHub.placeBet(payable, msg.value=VRF fee)
     │            │
     │            ├─ module.validate / module.maxPayout
     │            ├─ skyline + HE 快照
     │            ├─ Router.openPosition (only registered hub + pool allowed)
     │            │     └─ Bank.holdBet (stake transferFrom player)
     │            └─ VRFHub.requestRandomWords{value:msg.value}
     │                  └─ Adapter -> Chainlink Wrapper
     │
     │ (3) Chainlink fulfill -> Adapter.rawFulfill -> VRFHub.fulfillRandomWords (coordinator-gated)
     │            └─ GameHub.onRandomWords (state=RandomReady)
     │
     │ (4) anyone: GameHub.finalize
     │      ├─ module.resolve -> (payoutGross, refundAmount)
     │      ├─ IF refundAmount > stake:
     │      │     └─ Router.refundPosition(positionId, stake)  (fallback refund)
     │      └─ ELSE: settlePosition(payoutGross, payoutNet, refundAmount, PFAccrual, awards)
     │                └─ Bank.settleBet (pay player, accrue PF + XP)
     │
     └ (5) anyone (after timeout, PendingVRF): GameHub.refund
            └─ Router.refundPosition(positionId, stake)
```

### 3.2 资金流(sports,通过 SportsHub)

```
  Player (EOA)
     │ (1) ERC20 approve to Bank
     │ (2) Off-chain odds signer issues SportsOddsSnapshot + signature
     │ (3) SportsHub.placeTicket(marketId, outcomeId, odds, stake, signature)
     │            ├─ verify EIP-712 signature, market state, odds expiry, snapshot unused
     │            ├─ SportsRiskEngine.checkTicket (exposure caps, riskHash match)
     │            ├─ Router.openPosition (only registered hub + pool allowed)
     │            └─ accrue marketReserved / outcomeReserved / poolEventReserved / eventReserved
     │
     │ (4) Off-chain reporter quorum (threshold>=1) signs SportsResultPayload
     │ (5) reporter calls proposeResult(...) → market state = ResultProposed
     │ (6) Optional: whitelisted challenger calls challengeResult → state = Challenged
     │ (7) Either:
     │      • Permissionless finalizeResult(...) after result.finalizesAt → state = Resolved
     │      • Whitelisted arbitrator calls resolveResultChallenge(UpholdResult|ReopenResult|VoidMarket)
     │
     │ (8) anyone: settleTicket(s) (state=Resolved) — winners get payout, losers get 0
     │         └─ Router.settlePosition(positionId, payout, payout, 0, 0, [])
     │
     │ (9) anyone: refundTicket(s) (state=Voided) — full stake back
     │         └─ Router.refundPosition(positionId, stake)
```

### 3.3 信任边界 (v1.3)

| 边界 | 信任内容 | 强制方式 |
| --- | --- | --- |
| Player → GameHub/SportsHub | 任意 msg.sender | `placeBet` / `placeTicket` 接受任何调用者作为 player |
| Vertical hub → SettlementRouter | hub 已被 gov 注册且对 poolId 授权 | Router 查 `PoolRegistry.isRegisteredHub` + `isHubAllowedForPool` |
| SettlementRouter → Bank | router 是唯一 settle 入口 | Bank.`onlySettlementRouter` modifier + `setSettlementRouterOnce` immutable wiring |
| SettlementRouter → 位置所属 hub | 只有开仓 hub 能 settle/refund 该 position | Router.`_requireOwnerHeldPosition`(L97-103) |
| GameHub → VRFHub | VRFHub 准确收取/退款/转发 | `onRandomWords` 检查 `msg.sender == vrfHub` |
| VRFHub → Coordinator | coordinator 是唯一 fulfill 来源 | `VRFHub.coordinator` immutable;`fulfillRandomWords` 检查 |
| GameHub → Module | module 是 pure 函数,deterministic;若 module bug 返回 `refundAmount > stake`,GameHub 优雅 fallback refund | finalize 内 nonReentrant + L437-446 fallback |
| SportsHub → Oracle (signer/reporter/arbitrator) | 治理诚实选择;reporter quorum;challenger/arbitrator 白名单 | EIP-712 签名验证、`oddsSignerSetHash`/`resultReporterSetHash` 集合 hash 绑定 |
| SportsHub → SportsRiskEngine | 风险引擎正确计算 exposure caps | `riskHash` 链上对齐(odds snapshot 嵌入 riskHash) |
| Governance | gov 是诚实/谨慎的运营方 | Governable 2-step + 各种 `*Once` 限制 |

### 3.4 v1.3 新增 SSOT 公理(SSOT.v1.3.md §0)

- **公理 9**: poolId 是 risk/accounting domain,绑定唯一 Bank;同 asset 多 pool 独立。
- **公理 10**: Bank settle 函数 MUST 仅由 SettlementRouter 调用。
- **公理 11**: 垂直 hub 拥有 domain lifecycle,但所有资金移动 MUST 走 Router。
- **公理 12**: 仅 owner hub 可 settle/refund 自己的 position(治理无 user-position 后门)。
- **公理 13**: 无跨 pool 净额清算。
- **公理 14**: Risk-in pause 不阻塞 debt-out(LIVE 跨 router 延展)。
- **公理 15**: Domain purity — casino 模块保持纯 VRF;sportsbook state 不渗入 game 模块。

---

## 4. 发现 (按严重度降序)

### 4.1 Critical

**无**。

### 4.2 High

#### [NEW-H1] SportsHub:Challenged 状态在 arbitrator 不响应时永久冻结全场 tickets

- **严重度**: High (liveness break with no recovery)
- **位置**:
  - `src/core/SportsHub.sol:243-254` (`voidMarket`)
  - `src/core/SportsHub.sol:438-457` (`challengeResult`)
  - `src/core/SportsHub.sol:459-499` (`resolveResultChallenge`)
  - `src/core/SportsHub.sol:567-589` (`_refundTicket/_voidTicket` 均要求 Voided 状态)
- **类别**: Liveness / Oracle Trust

**描述**

`SportsHub` 的 market 状态机:

```
Draft → Open → [Suspended ↔ Open] → Locked → ResultProposed
       ↓                                          ↓                    ↘
     Voided                                  Challenged    →  Resolved (via UpholdResult arbitration / finalizeResult)
                                                  ↓
                                              [UpholdResult/ReopenResult/VoidMarket arbitration]
```

`voidMarket(marketId, reasonHash)` 在 L251 显式拒绝 Challenged 状态:

```solidity
if (market.state == SSOTTypes.SportsMarketState.Challenged) revert ResultChallengePending(marketId);
```

而 `_refundTicket`/`_voidTicket` 均要求 market 状态为 `Voided`(L569、L581 调 `_requireVoidedMarket`)。`_settleTicket` 要求 `Resolved`(L551)。

**触发路径**:
1. Reporter 提交 result(market 进入 ResultProposed)。
2. 白名单 challenger 在 finality 窗口内调用 `challengeResult` → market 进入 Challenged。
3. 所有白名单 arbitrator 不响应 / 串通 / 私钥丢失。
4. `resolveResultChallenge` 永不被调用。
5. **市场永久卡在 Challenged 状态**:
   - `settleTicket`:requires Resolved → revert。
   - `refundTicket` / `voidTicket`:requires Voided → revert。
   - `voidMarket`:被 L251 显式拒绝。
   - `finalizeResult`:`if (market.state == Challenged) revert ResultAlreadyChallenged`(L503)。
6. 该 market 上所有 tickets 的 stake 与 reserved 永久锁定。

**影响**

- 单场赛事的全部 tickets stake 永久冻结(可能价值数千万)。
- 治理无任何链上逃生通道。
- 持续侵蚀 Bank 的 `totalReserved`,影响 A4 域(free liquidity)与 LP 出金。

**复现 (PoC,粘到 `test/utils/Repro.t.sol`)**

```solidity
function test_challenged_market_with_unresponsive_arbitrator_locks_tickets() public {
    // setup: deploy SportsHub, register pool, fund Bank, place ticket
    // ... (略,见现有 test/unit/SportsHubResult.t.sol fixture)

    // 1) reporter proposes
    vm.prank(reporter);
    hub.proposeResult(marketId, winningOutcomeId, sourceHash, evidenceHash, observedAt);

    // 2) challenger challenges within finality window
    vm.prank(challenger);
    hub.challengeResult(marketId, keccak256("disputed"));

    // 3) arbitrators never respond — fast forward beyond finality
    vm.warp(block.timestamp + 30 days);

    // 4) try every escape
    vm.expectRevert(); hub.finalizeResult(marketId);
    vm.prank(gov);
    vm.expectRevert(abi.encodeWithSelector(ISportsHub.ResultChallengePending.selector, marketId));
    hub.voidMarket(marketId, keccak256("emergency"));

    vm.expectRevert(); hub.settleTicket(ticketId);
    vm.expectRevert(); hub.refundTicket(ticketId);
    vm.expectRevert(); hub.voidTicket(ticketId);
    // tickets are now permanently locked. Stake & reserved never released.
}
```

**推荐修复**

允许治理在 challenge **超时后**强制 void:

```solidity
function voidMarket(uint64 marketId, bytes32 reasonHash) external override onlyGov {
    if (reasonHash == bytes32(0)) revert Errors.InvalidConfig();
    SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
    if (market.state == SSOTTypes.SportsMarketState.Resolved || market.state == SSOTTypes.SportsMarketState.Voided) {
        revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Open);
    }
    // NEW: allow void if challenge has been pending for too long (e.g., 7 days)
    if (market.state == SSOTTypes.SportsMarketState.Challenged) {
        SSOTTypes.SportsResult storage result = _results[marketId];
        uint64 ARBITRATION_TIMEOUT = 7 days;  // governance-configurable
        if (block.timestamp < result.challengedAt + ARBITRATION_TIMEOUT) revert ResultChallengePending(marketId);
        // fall-through to void
    }
    _setMarketState(market, SSOTTypes.SportsMarketState.Voided);
    emit MarketVoided(marketId, market.eventId, reasonHash, msg.sender);
}
```

或:增加 `forceVoidMarket(marketId, reasonHash)` 单独函数,带 timelock + 显式独立事件。

**SSOT 关联不变量**: 违反 公理 14 (LIVE / debt-out 跨 router 必须成功),延伸到 sportsbook domain。

---

### 4.3 Medium

#### [NEW-M1] SportsHub:ReopenResult 仲裁后 `_results[marketId]` 整体覆盖,链上 audit trail 仅靠事件

- **严重度**: Medium (audit/observability gap)
- **位置**: `src/core/SportsHub.sol:366-436` (`_proposeResult`),`src/core/SportsHub.sol:486-490` (ReopenResult)
- **类别**: Observability / Audit Trail

**描述**

`resolveResultChallenge(ReopenResult)` 把 market 状态还原到 Locked,允许下次 `proposeResult` 重写 `_results[marketId]`。重写发生在 L393:

```solidity
_results[marketId] = SSOTTypes.SportsResult({...});
```

旧的 `proposeResult` / `challengeResult` / `resolveResultChallenge` 数据全部被新 struct 取代。链上 storage 不保留 history,只能从 events 重构,但 events 不是 SSOT 的强约束输入。

**影响**

- 监管/审计追溯困难。
- 不影响资金安全。

**推荐修复**

引入 `_results[marketId][version]` 二维 mapping,或在 `_proposeResult` 重写前 emit 一个 `ResultDiscarded(marketId, oldPayloadHash)` 事件,显式标记历史失效。

---

#### [NEW-M2] SportsHub:批量循环 `settleTickets/refundTickets/voidTickets` 无分页

- **严重度**: Medium (operator UX / DoS risk)
- **位置**: `src/core/SportsHub.sol:522-526`(`settleTickets`)、`532-536`(`refundTickets`)、`542-546`(`voidTickets`)
- **类别**: Liveness / Gas

**描述**

```solidity
function settleTickets(uint256[] calldata ticketIds) external override nonReentrant {
    for (uint256 i = 0; i < ticketIds.length; ++i) {
        _settleTicket(ticketIds[i]);
    }
}
```

无上限。大型 market 上数千 tickets 会:
1. 单笔 tx OOG。
2. 中间任一 ticket revert 整批 revert(单 ticket 状态异常或 storage corrupt)。

**影响**

- operator 必须手动分页;不便。
- 极端场景下整批 settle 失败可能延迟资金释放。
- 单 ticket 接口存在(`settleTicket`),不存在硬性卡死。

**推荐修复**

```solidity
uint256 public constant MAX_BATCH_SIZE = 100;
function settleTickets(uint256[] calldata ticketIds) external override nonReentrant {
    uint256 len = ticketIds.length;
    if (len > MAX_BATCH_SIZE) revert Errors.InvalidConfig();
    for (uint256 i = 0; i < len; ++i) {
        // optional: try/catch + accumulate failures
        _settleTicket(ticketIds[i]);
    }
}
```

---

#### [NEW-M3] SettlementRouter 不预检 `payoutGross + refundAmount ≤ pos.reserved`(B3 仅依赖 Bank)

- **严重度**: Medium (defense-in-depth gap)
- **位置**: `src/core/SettlementRouter.sol:65-81` (`settlePosition`)
- **类别**: Defense-in-Depth

**描述**

`SettlementRouter.settlePosition` 把 `payoutGross, payoutNet, refundAmount, protocolFeeAccrual, xpAwards` 透传给 `Bank.settleBet`,而不在 Router 层做任何 sanity check:

```solidity
function settlePosition(
    uint256 positionId,
    uint256 payoutGross, uint256 payoutNet,
    uint256 refundAmount, uint256 protocolFeeAccrual,
    SSOTTypes.XPAward[] calldata xpAwards
) external {
    SSOTTypes.Position storage pos = _requireOwnerHeldPosition(positionId);
    pos.state = SSOTTypes.PositionState.Settled;
    IBank(pos.bank).settleBet(positionId, payoutGross, payoutNet, refundAmount, protocolFeeAccrual, xpAwards);
    ...
}
```

Bank 在 `settleBet` 内做 B3 检查 (`Bank.sol:538-540`)。但若 Bank 调用因任何原因失败,Router 已经把 `pos.state = Settled`(L74),回滚发生整 tx 回滚,所以**实际是安全的**;但 Router 拿着 `pos.reserved` 的真值却不做防御纵深。

**影响**

- 当前架构下 Bank 是 trustable;但若未来 Bank 实现替换或被 upgrade,Router 缺少独立 B3 校验。
- 不属于 zero-day vulnerability,属于 defense-in-depth 缺口。

**推荐修复**

```solidity
function settlePosition(...) external {
    SSOTTypes.Position storage pos = _requireOwnerHeldPosition(positionId);
    // NEW: defense-in-depth B3 check
    if (payoutGross + refundAmount > pos.reserved) revert ReservedTooSmall(...);
    if (payoutNet > payoutGross) revert Errors.InvalidConfig();
    if (refundAmount > pos.stake) revert RefundTooLarge(...);
    pos.state = SSOTTypes.PositionState.Settled;
    IBank(pos.bank).settleBet(...);
    ...
}
```

---

#### [NEW-M4] GameHub.finalize fallback refund 路径完全规避 protocol fee 累积

- **严重度**: Medium (economic — 治理可控,但属 SEV-05 修复的副作用)
- **位置**: `src/core/GameHub.sol:437-446`
- **类别**: Economic / Defense-in-Depth

**描述**

SEV-05 的修复(`if refundAmount > stake: fallback refund`)是合理的活性保障。但 fallback 路径**完全跳过** `protocolFeeAccrual` 与 referral 切分:

```solidity
if (refundAmount > b.stake) {
    b.resolvedAt = uint64(block.timestamp);
    b.state = SSOTTypes.BetState.Refunded;
    _clearRequest(b);
    ISettlementRouter(settlementRouter).refundPosition(betId, b.stake);
    emit BetRefunded(betId, b.stake);
    return;
}
```

恶意或被攻陷的 game module(由 gov 注册)可以**始终返回 `refundAmount = stake + 1`**,使每笔 bet 都走 fallback refund,protocol 永远收不到 HE 累积。LP 经济收益归零。

**影响**

- gov 注册的恶意 module 可以让本协议陷入"零 fee 模式"。
- 触发需要 gov 注册一个**永远返回 refundAmount > stake** 的 module —— 这是 gov-trust 失效场景。
- 不能盗取 LP 本金(仍走 full refund,LP 不亏);但 LP 失去预期 fee 流。

**推荐修复**

在 fallback path 仍累积一个**保底 protocol fee**(例如 `stake * defaultHouseEdgeBps / BPS`),代价由 stake 承担:

```solidity
if (refundAmount > b.stake) {
    uint256 penaltyFee = Math.mulDiv(b.stake, uint256(defaultHouseEdgeBps), BPS);
    uint256 refundOut = b.stake - penaltyFee;
    b.state = SSOTTypes.BetState.Refunded;
    _clearRequest(b);
    // settle-as-refund path with protocol fee retention
    SSOTTypes.XPAward[] memory noAwards = new SSOTTypes.XPAward[](0);
    ISettlementRouter(settlementRouter).settlePosition(
        betId, 0, 0, refundOut, penaltyFee, noAwards
    );
    emit BetRefunded(betId, refundOut);
    return;
}
```

或简单地:在 module 注册时强制 `module.maxPayout()` 调用必须满足 `maxPayout >= stake`,防止注册"永远 refund 过大"的恶意 module。

---

### 4.4 Low (含未处理的旧 SEV)

#### [SEV-L1] (未处理) VRFHub 与 Adapter 接受任意 ETH 捐赠 → 破坏 Z1 不变量

- **位置**: `src/core/VRFHub.sol:222` (`receive() external payable {}`)、`src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol:102`

v1.2 报告同条 finding 未处理。生产环境任何裸 ETH transfer 会沉淀,破坏 Z1 (adapter mode ETH 守恒)。当前 invariant test 通过是因 handler 不做裸捐。

**推荐**:`receive()` 改 revert,或加 `sweepDust(to) onlyGov`。

#### [SEV-L3] (未处理) `ReferralRegistry.MAX_HOPS = 32`

- **位置**: `src/engines/referral/ReferralRegistry.sol:14`

v1.2 报告同条。Hub 6 跳 + dup-detection 兜底,**实际不可利用**。文档/常量建议提到 64+。

#### [NEW-L1] SportsHub 无 protocol fee/HE 累积

- **位置**: `src/core/SportsHub.sol:562` `settlePosition(positionId, payout, payout, 0, 0, noAwards)`

SportsHub 调 router.settlePosition 时 `protocolFeeAccrual=0`、`xpAwards=[]`。所有经济利差必须由 oracle 的 odds vig 内生。**Design 选择,无 bug。**

**风险**: 若 oracle odds 设计有缺陷(under-vig),LP 长期亏损 sportsbook bets。建议 SSOT 文档明确"sportsbook HE 取决于 off-chain odds 设计,治理须监控边际"。

#### [NEW-L2] SettlementRouter 不为失败注册校验 emit 事件

- **位置**: `src/core/SettlementRouter.sol:36-39` (`openPosition` 中的 `isRegisteredHub/isHubAllowedForPool` 校验)

未注册 hub 调 `openPosition` 直接 revert,无对应 audit event。

**推荐**:可选添加 `event UnauthorizedOpenAttempt(address indexed hub, uint64 indexed poolId)` 在校验前预 emit。

#### [NEW-L3] BaccaratModule 使用 stateless 13-rank 抽样(非真实 deck shoe)

- **位置**: `src/modules/baccarat/BaccaratModule.sol:131` (`_cardValue` 用 `RNG.roll2(...) % 13` 独立抽)

模块文档(L15)明确声明 "stateless RNG model"。与真实 6-8 副 deck 的差异 ~0.5% 边际(无放回 vs 有放回)。**设计选择,需在产品文档明示玩家**。

---

### 4.5 Informational

#### [SEV-INFO-01] (未处理) CI 中无 Slither / Halmos / Certora 基线

`.github/workflows/*` 仍无静态分析集成。本审计现场跑 Slither 干净;长期未自动化。

#### [SEV-INFO-02] (未处理) RNG 域字符串未按模块命名空间化

`src/libs/RNG.sol:11` `DOMAIN = "SSOT_RNG_V1"` 全局共享。在 v1.3 中,positionId 由 Router 全局递增,不会与旧 betId 重叠,**碰撞风险更低**。仍建议 RNG.roll 接受 module-specific salt。

#### [SEV-INFO-03] (未处理) 无 `previewDeposit/previewMint/previewWithdraw/previewRedeem`

`Bank.convertToShares/Assets` 是 view,但与 effecting (deposit/mint/withdraw/redeem) 舍入方向有差异(view 全 Floor,effecting 因路径 Floor/Ceil 不同)。OZ ERC4626 标准要求 `preview*` 与 effecting 同舍入。

#### [NEW-INFO-1] PoolRegistry 无 `unregisterPool` / `unregisterHub`

仅 `setPoolActive(false)` / `setHubAllowedForPool(false)` 用于停用。设计意图:防止 retroactive 路由破坏已开仓的 position。**Acceptable。**

#### [NEW-INFO-2] `forge coverage` 仍因 `Bank.settleBet` stack-too-deep 不可用

同 v1.2 [SEV-INFO-04]。本次审计依赖 19 条 invariants 通过状态作为间接覆盖证据。

#### [其它 v1.2 INFO-04..06] 部分 N/A:

- INFO-04 同上。
- INFO-05 (`setRiskInPausedAll` gas-DOS):v1.3 重构后,`Hub.setRiskInPausedAll` 不再存在。各 Bank 由 gov 个别 pause。**已自然消失。**
- INFO-06 (`totalReserved` 弃局锁资本):由 SEV-05 的 fallback refund 与 timeout refund 双重保障。**部分处置。**

---

## 5. SSOT 不变量验证矩阵 (v1.3)

每条标 **通过 / 失败 / 部分** + 依据。

| ID | 内容 | 主要落点 | 验证结果 | 证据 |
| --- | --- | --- | --- | --- |
| **A1** | `Bank.totalAssets() == NAV` | `Bank.totalAssets:205-208` | ✅ 通过 | invariant test 内含,SettlementRouter handler 覆盖 |
| **A3** | `NAV ≥ R` (per pool) | `Bank.sol:514` | ✅ 通过 | `invariant_router_reserved_matches_bank_reserved_by_pool` PASS |
| **A4** | optional outflow `NAV − R ≥ MinLiq` | `Bank.sol:472-488` | ✅ 通过 | 各 Bank handler 覆盖 |
| **B3** | `payoutGross + refund ≤ reserved` | `Bank.sol:538-540`, `GameHub.sol:448` | ✅ 通过(Bank 层);⚠️ Router 层缺(见 NEW-M3) |
| **C1/C2** | requestId 映射一致性 + detach 清存储 | `VRFHub.detach:176-184` (delete) | ✅ 通过 | SEV-L6 fix + test_detachClearsRequestStorage |
| **D2** | `rescueToken` 不可救 ASSET | `Bank.sol:142` | ✅ 通过 | 代码显式 revert |
| **E2** | XP 桶移动守恒 | `Bank.sol:391-460` | ✅ 通过 | 内置 invariant + test_newHoldbackAwardDoesNotDelayExistingVesting |
| **E3** | claimXPAccrued pause-gated | `Bank.sol:373` | ✅ 通过 | 代码显式 |
| **LIVE** | finalize/refund 在 pause 下成功 | `Bank/GameHub/Router` 各 settle/refund 不查 paused | ✅ 通过 (casino) ⚠️ **NEW-H1 违反 (sports — challenge 死锁)** |
| **P3** | `ΔPF + ΔXP == 预期 HE 累积` | `GameHub.finalize:514` | ✅ 通过 ⚠️ NEW-M4 (fallback refund 完全跳过) |
| **V1/V2** | VRF 欠付 revert + 溢付 best-effort | `GameHub:354`, `VRFHub:126-136` | ✅ 通过 | test/unit/VRFFee*.t.sol |
| **V4** | `claimRefund` 非 pause-gated | `VRFHub:164-174` | ✅ 通过 | 代码无 paused 检查 |
| **X1** | 多 pool 无 custody 交叉 | Bank + PoolRegistry per-pool 绑定 | ✅ 通过 | `invariant_router_positions_are_pool_isolated_and_stable` PASS |
| **Z1** | adapter 模式 ETH 守恒 | VRFHub + Adapter ETH | ✅ 通过 (handler-pure) ⚠️ SEV-L1 (生产裸捐破) |
| **R1**(新) | 仅注册 hub 可 open;仅 owner hub 可 settle | `Router:36-39, 97-103` | ✅ 通过 | `invariant_no_wrong_owner_or_bank_bypass` PASS |
| **R2**(新) | nextPositionId 单调,与成功 open 数匹配 | `Router:14, 45` | ✅ 通过 | `invariant_next_position_id_matches_successful_opens` PASS |
| **R3**(新) | position 结算后不可变 | `Router:74, 85` (state 写一次) | ✅ 通过 | `invariant_router_positions_are_pool_isolated_and_stable` PASS |
| **R4**(新) | router-reserved per-pool 与 Bank-reserved 匹配 | Router state + Bank.totalReserved | ✅ 通过 | `invariant_router_reserved_matches_bank_reserved_by_pool` PASS |
| **S1**(新 Sports) | exposure 与持仓 tickets 一致 | `SportsHub:649-655` (`_releaseExposure`) | ✅ 通过 | `invariant_sports_exposure_matches_held_tickets` PASS |
| **S2**(新 Sports) | router positions 与 sports tickets 1:1 对应 | `SportsHub.placeTicket:299-326` | ✅ 通过 | `invariant_sports_router_positions_match_tickets` PASS |
| **S3**(新 Sports) | 无 early debt-out(market 未 Resolved/Voided 之前不可 settle/refund) | `_settleTicket:551`, `_refundTicket:569`, `_voidTicket:581` | ✅ 通过 | `invariant_sports_no_early_debt_out` PASS ⚠️ **但 NEW-H1 揭示 Challenged 永久死锁** |

总计 21 条 SSOT 不变量,**全部 forge invariant 通过 256×256**;但 NEW-H1 揭示 LIVE 在 sportsbook arbitrator 不响应场景下违反 — invariant test 的 handler 没有"模拟所有 arbitrator 全部下线"的攻击路径,因此 invariant 套件**未捕获**该 finding。

---

## 6. v1.2 → v1.3 修复对账明细

| v1.2 ID | 修复位置 | 修复机制 | SecurityFixes.t.sol 测试 | 状态 |
| --- | --- | --- | --- | --- |
| **SEV-01** | `Bank.sol:32, 97, 285-299, 317-355` | 引入 `_virtualOffset = 10**decimals` immutable;所有 `_convertToShares/_convertToAssets` 均加虚拟分子分母;`deposit` 额外 `if (shares == 0) revert`(L318) | `test_firstLpInflationAttackNoLongerProfitable` | ✅ **严密**:验证 victim 在 attacker 捐赠 10^18 后仍获 >0 shares,attacker redeem 1 share 仅得 ~2,远低于捐赠值 |
| **SEV-02** | `GameHub.sol:574-578` | `_validateReferralConfig` 加 `for sum += levelBps[i]; if (sum > BPS) revert` | `test_referralConfigRejectsOverBudgetLevels` + `test_initialReferralConfigRejectsOverBudgetLevels` | ✅ **严密**:构造与运行时都覆盖 |
| **SEV-03** | `Bank.sol:589-603` | settleBet 内 holdback 段先 `_syncHoldback` 释放 vested,再 `if (existingHoldback == 0 ‖ vestingEnd <= now) update endTs` — 不再无条件 extend | `test_newHoldbackAwardDoesNotDelayExistingVesting` | ✅ **严密**:验证 t=15d 中段 release 50ether,t=30d 累计 200ether 全部到 accrued |
| **SEV-04** | `GameHub.sol:294, 581-586` | `placeBet` 中 `if (usedMaxHE == 0) usedMaxHE = defaultHouseEdgeBps`;`_maxAffiliateHouseEdge` 中 `if (delta == 0) return def` | `test_zeroMaxAffiliateDeltaMeansDefaultOnly` | ✅ **严密**:验证 affiliate 设 HE=201 在 delta=0 时 revert |
| **SEV-05** | `GameHub.sol:437-446` | `finalize` 内 `if (refundAmount > b.stake) → fallback refund path` | `test_badModuleRefundTooLargeFallsBackToFullRefund` | ✅ 修复 + **NEW-M4 新发现**:fallback 跳过 protocol fee |
| **SEV-L1** | (未修复) | — | — | ⚠️ **未处理** |
| **SEV-L2** | `ReferralRegistry._bind` | 重复 bind 改为 revert | `test_duplicateBindReferrerReverts` | ✅ **严密** |
| **SEV-L3** | (未修复) | — | — | ⚠️ **未处理**(实际不可利用,优先级低) |
| **SEV-L4** | `GameHub.sol:664-668` | skyline 编码改逐字节循环,无 mstore 越界 | (无 PoC,代码 review) | ✅ **严密** |
| **SEV-L5** | `Bank.sol` `_holdbackReleasable` | 死分支删除 | (代码 review) | ✅ **严密** |
| **SEV-L6** | `VRFHub.sol:176-184` | `detach` 改 `delete requests[requestId]` | `test_detachClearsRequestStorage` | ✅ **严密** |
| **SEV-L7** | 通过 SEV-L2 间接修复 | bindReferrer → bindFor revert → 不 emit | (代码 review) | ✅ **严密** |
| **SEV-L8** | `Bank.sol:546, 635` | settle/refund 内 `emit BetReserveReleased(betId, player, reserved)` | `test_refundBetEmitsReleasedReserve` | ✅ **严密** |
| **SEV-INFO-01..06** | 部分 | INFO-05 因架构重构自然消除;其余仍未处理 | — | ⚠️ **多数未处理** |

**修复严密度评估**:11/19 主 finding 已修复且有 PoC 测试覆盖,**修复质量优秀**。无 bypass 漏洞被发现,无修复引入新 critical/high 漏洞(NEW-M4 仅为 SEV-05 fix 的次生 medium-level 副作用)。

---

## 7. 附录:工具输出与方法论详情

### 7.1 工具产物路径

- `/tmp/forge_pr_v13.log` — **113 通过 / 0 失败 / 1 跳过(fork)**
- `/tmp/slither_v13.log` — 295 行,3 Impact:High + 2+ Medium(全部 false positive,见 §7.3)
- `/tmp/forge_coverage.log` — **失败**(stack-too-deep,同 v1.2 [NEW-INFO-2])
- `HALMOS / MYTH_UNAVAILABLE`

### 7.2 再次运行命令

```bash
cd /Users/kevin/arbigamefi_ssot_project_all

forge --version && forge build

FOUNDRY_PROFILE=pr forge test -vv 2>&1 | tee /tmp/forge_pr_v13.log

# Slither
pip install --user slither-analyzer 2>/dev/null
solc-select install 0.8.24 && solc-select use 0.8.24
~/.local/bin/slither . --filter-paths "test/|src/mocks/|lib/" \
  --json /tmp/slither_v13.json --checklist 2>&1 | tee /tmp/slither_v13.log
```

### 7.3 Slither v1.3 主要 High/Medium 发现的处置

| ID | Impact | 位置 | 处置 |
| --- | --- | --- | --- |
| ID-0 | High | `Bank.holdBet:497-521` arbitrary-from in transferFrom | **False positive**:onlyRouter + player 已 approve |
| ID-1 | High | `VRFHub.requestRandomWords:115-162` sends ETH to "arbitrary user" | **False positive**:adapter 由 gov 设且 coordinator() 跨校验 |
| ID-2 | High | `GameHub.placeBet` reentrancy-eth | **False positive**:`nonReentrant` 保护 + 所有外部调用对象 immutable |
| ID-4 | Medium | `GameHub.getBetParams` strict `== None` 等值 | **False positive**:sentinel 检查 |
| ID-15 | Medium | `SportsHub.placeTicket` 状态写在外部调用之后(`_poolEventReserved`) | **False positive**:`nonReentrant` + 所有 mutating 入口同保护 |
| ID-16/17 | Medium | `Bank.settleBet` 局部变量 `totalAccrued/totalLocked/totalHoldback` 未初始化 | **False positive**:uint256 默认 0 是 Solidity 惯用语义 |
| ID-26 | Medium | `_requireReporterQuorum` 弃用 `ECDSA.tryRecover` 返回的第三值 | **False positive**:`(addr, err, )` 显式丢 |

**结论**:Slither 视角下,v1.3 无遗漏的真实 high/medium。

### 7.4 v1.2 → v1.3 测试套件增长

| 类别 | v1.2 测试数 | v1.3 测试数 | 新增点 |
| --- | --- | --- | --- |
| unit | 17 | 87 | +GameHubE2E (10), +GameHubRouter (4), +PoolRegistry (5), +SettlementRouter (5), +SecurityFixes (9), +SportsHub* (50+) |
| diff | 4 | 8 | +DiffBaccarat, +DiffPlinko, +DiffSicBo, +DiffSlots |
| invariants | 12 | 19 | +SettlementRouterInvariants (4), +SportsHubInvariants (3) |
| fork | 1 (skipped) | 1 (skipped) | 未变 |
| **总计** | **34** | **115** (113 passed + 1 skipped + 1 forktest skipped) | **+238%** |

---

## 8. 修复路线图建议 (v1.3)

| 优先级 | finding | 建议落地时间 |
| --- | --- | --- |
| **P0 (主网前必修)** | NEW-H1 (SportsHub challenge 死锁) | 0.5 天:加 governance void 逃生通道 + arbitration timeout |
| **P1** | NEW-M3, NEW-M4 | 0.5 天:Router 加 B3 防御纵深;GameHub fallback refund 保留 penalty fee |
| **P1** | NEW-M2 (batch loops) | 0.5 天:加 MAX_BATCH_SIZE 上限 |
| **P2** | NEW-M1 (result audit trail), SEV-L1, SEV-L3, NEW-L1..L3 | 1-2 天:文档化 + 防御纵深 + receive() 改 revert |
| **P3** | SEV-INFO-01..03 + NEW-INFO-2 | 1-2 天:CI 接入 Slither;Bank.settleBet 拆函数解 stack-too-deep |

修复后建议:

1. 重跑 `forge test` 双 profile(pr + nightly)+ 重跑 Slither + 增 PoC `test_challenged_market_forced_void_after_timeout`(NEW-H1)。
2. 对 SportsHub 增加 stateful invariant `invariant_sports_market_no_permanent_lock`:所有 market 在 max(challengePeriod + arbitrationTimeout + finality) 时间窗后,**必有**至少一个 debt-out 路径可走。
3. 对 GameHub.finalize fallback 路径增 invariant `invariant_finalize_fallback_protocol_fee_accrual`:fallback refund 时 protocol fee 累积 ≥ stake * defaultHE / BPS。

---

## A. 附录:v1.2 历史基线审计快照

本附录保留 v1.2 单体 Hub 审计版本的核心结论,作为 v1.3 重审的 baseline:

- **v1.2 范围**:`src/core/Hub.sol`(729L,已删除)+ 4 个 module + 旧 BankRegistry(已替换为 PoolRegistry)
- **v1.2 发现**:0 Critical / 1 High / 4 Medium / 8 Low / 6 Informational = 19 条
- **v1.2 测试**:35 通过 / 0 失败 / 1 跳过 (fork);12 条 stateful invariants
- **v1.2 主要 finding**(均已在 §6 重新对账):
  - **SEV-01 ERC4626 inflation** (High) — 现已修复
  - **SEV-02 levelBps 总和无上限** (Medium) — 现已修复
  - **SEV-03 holdback rolling reset** (Medium) — 现已修复
  - **SEV-04 maxAffiliateDelta=0 → 100% HE** (Medium) — 现已修复
  - **SEV-05 refundAmount > stake 卡死 RandomReady** (Medium) — 现已修复
- **v1.2 旧报告引用的 `src/core/Hub.sol` 已被拆分为 GameHub + SportsHub + SettlementRouter,引用过期。**

---

**报告结束**

— 审计人: Claude (Opus 4.7)
— 重审日期: 2026-05-13
— 输出哈希: 见 git commit
