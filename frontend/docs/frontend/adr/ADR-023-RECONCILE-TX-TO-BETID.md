# ADR-023 — Reconcile txHash → betId

**Status**: Accepted

## Context
SSOT 的 bet 是以 Hub events 为事实源（BetPlaced/RandomReady/Finalized/Refunded）。
用户在 UI 中下单后，我们必须把 **交易（txHash）** 与 **betId** 关联，才能：
- 自动跳转 bet detail
- 在刷新/重启后恢复进度（可回放）
- 支持 incident/support 追踪

如果只依赖 “返回值” 或页面内临时 state，会在重组、刷新、RPC 丢 log 时失效。

## Decision
实现 **分层回退** 的 reconcile 算法，并将结果写入 TxJournal。

### Priority Order
1) **Receipt Logs (primary)**
   - 从 `waitForTransactionReceipt` 的 `receipt.logs` 中解析 Hub 的 `BetPlaced`（按 `address==hub` + `topic0`）。
   - 使用 release ABI 解码事件，取 `betId`。

2) **Facts Store (secondary)**
   - 若 receipt logs 不完整或未包含事件，查询 Dexie `hubEvents`：`where(txHash==...)`。
   - 找到 `BetPlaced` 即取 betId。

3) **Window Search (fallback)**
   - 在 `receipt.blockNumber ± window` 里拉取 Hub `BetPlaced`（confirmations 安全头内），并按 `placedBy==account` 过滤。
   - window 默认 `max(64, 3*confirmations)`。

4) **Manual Binding (last resort)**
   - 若仍无法确定 betId，进入 `Mined but Unreconciled`。
   - UI 提供 “输入 betId 绑定” 的入口，并把用户输入写入 TxJournal。

### Persistence
- TxJournal **MUST** 记录：`txHash, chainId, releaseDigest, actionType=placeBet, status, betId?, blockNumber?`。
- 若 betId 关联成功，UI **MUST** 能根据 Journal 恢复跳转。

## Alternatives Considered
- 仅依赖 subgraph：拒绝（不是事实源，且有延迟/不确定性）
- 仅依赖 receipt logs：拒绝（部分 RPC/中间件可能不返回完整 logs）

## Consequences
- 复杂度增加，但可审计、可恢复、对抗不稳定 RPC。
- 需要 indexer/facts store 提供 txHash 维度索引。
