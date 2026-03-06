# Milestone D3 — Reconcile (tx → betId) + Bet Detail

本里程碑的目标是把“写交易”闭环成“可审计的 bet 事实”：用户发起 `placeBet` 后，前端必须可靠地把 `txHash` 映射到 `betId`，并提供可复现的 `/bets/[betId]` 详情视图（含 params 解码、事件时间线与可执行动作）。

> 依赖：ADR-022（BetPanel Stepper）、ADR-023（Reconcile tx → betId）、ADR-021（Facts Store / Dexie）。

---

## 1. Scope

### 1.1 In scope

- **Reconcile 实现**：`placeBet` mined 后将 `txHash → betId` 关联写入 TxJournal。
- **Mined but Unreconciled UX**：当无法自动获得 betId 时，UI 必须提供重试与手动绑定入口。
- **Bet Detail 页面**：`/bets/[betId]` 必须展示 Summary / Params / Timeline / Actions（Refund）。
- **Params persistence**：为保证 params 可解码与可审计，TxJournal 必须持久化 `metaJson`（至少含 `paramsHex`）。

### 1.2 Out of scope

- Liquidity / Referral（D4/D5）
- Bets list 的完整筛选/分页/导出（D6）
- 完整 i18n 与 copy polishing（E 阶段）

---

## 2. Definition of Done (DoD)

### 2.1 Reconcile (MUST)

对 `placeBet` 的结果，系统 **MUST** 按以下优先级尝试获得 betId（ADR-023）：

1. **Receipt logs**：从 receipt.logs 解析 Hub `BetPlaced`（按 address + topic）。
2. **Facts Store**：从 `hubEvents` 按 `chainId + txHash` 搜索 `BetPlaced`。
3. **Window search (fallback)**：按 `{blockNumber ± window}` + `placedBy == account` + `asset/game` 等条件筛选。
4. 若仍无法关联，**MUST** 进入 `Mined but Unreconciled` 状态。

当获得 betId 时：

- **MUST** 更新 TxJournal：写入 `betId` 与 `betIdSource`（`receipt|facts|window|manual`）。
- **MUST**（best-effort）将 `BetPlaced` 事件写入 Facts Store（使 bets state machine 立即可见）。

### 2.2 TxJournal metaJson (MUST)

- `placeBet` 的 TxJournal 记录 **MUST** 包含 `metaJson`。
- `metaJson` **MUST** 至少包含：
  - `gameId`
  - `assetId`
  - `paramsHex`（用于 params 解码；不可仅保存 paramsHash）
  - `stakeSpec`（可为对象或编码字符串）
  - `placedBy`（account/address）
  - `releaseDigest`
- `metaJson` **MUST** 为 JSON-safe（不得包含 `bigint`、函数、循环引用）。

### 2.3 BetPanel Stepper UX (MUST)

当 `placeBet` mined 后：

- 若已 reconciled：UI **MUST** 提供显式入口跳转 `/bets/[betId]`。
- 若未 reconciled：UI **MUST** 展示：
  - `Retry reconcile`（调用 `sdk.hub.reconcilePlaceBetTx(txHash)`）
  - `Manual bind betId`（输入 betId，调用 `sdk.hub.bindPlaceBetTx(txHash, betId)`）

### 2.4 Bet Detail Page (MUST)

`/bets/[betId]` **MUST** 包含以下模块：

- **Summary**：betId、状态、player、asset、stake、vrfFee、时间戳（placed/resolved/refunded 等）。
- **Params**：
  - 优先从 TxJournal.metaJson.paramsHex 解码并展示。
  - 若缺失，则 fallback：展示 `paramsHash`（并提示无法解码）。
- **Timeline**：按 `chainId+betId` 查询 Facts Store 的 Hub events，按 blockNumber/logIndex 排序。
- **Actions**：至少支持 Refund（若 eligible）；所有写动作 **MUST** 复用 Tx stepper（ADR-022）。

Refund eligibility：

- 若 bet 仍 pending 且 `now - placedAt >= refundTimeoutSeconds`，Refund 按钮变为 enabled。

---

## 3. Data Model Changes (Dexie schema v2)

> 仅描述“必须可审计”的最小变更。

### 3.1 hubEvents

- 新增字段：`betId?: string`
- 新增索引：
  - `[chainId+txHash]`（reconcile step2）
  - `[chainId+betId]`（bet detail timeline）

### 3.2 txJournal

- 新增字段：
  - `betId?: string`
  - `betIdSource?: 'receipt'|'facts'|'window'|'manual'`
  - `metaJson?: string`
- 新增索引：`[chainId+betId]`

---

## 4. Acceptance Checklist (Manual)

> 目标：在 Base Sepolia (84532) 上能通过“单用户闭环”验收。

1. `pnpm dev` 启动后连接 84532，顶部展示 releaseDigest。
2. `/games/*` 发起一次 placeBet：
   - Stepper 显示 submitted → mined。
   - 若 receipt 可解析，应自动显示 `View bet`。
3. 若出现 `Mined but Unreconciled`：
   - 点击 `Retry reconcile` 成功后出现 `View bet`。
   - 或输入 betId 手动绑定，绑定后可跳转详情页。
4. `/bets/[betId]`：
   - Summary/Params/Timeline 均可见；Params 能从 metaJson 解码（若存在）。
   - Refund 在 eligible 时可发交易并写入 TxJournal。
5. 刷新页面：
   - Bets state 不丢失（Facts Store + TxJournal 仍存在）。

---

## 5. References

- ADR-022 — BetPanel Stepper
- ADR-023 — Reconcile tx → betId
- ADR-021 — Facts Store (Dexie)
- PAGE-SPECS/020-BETS — Bets list + detail
