# ADR-024 — Allowance & Approval Policy

**Status**: Accepted

## Context
SSOT 的 stake escrow 发生在 `Bank.holdBet()`，ERC20 的 spender 是 **Bank**。
不同 token 的 approve 语义存在差异（标准 ERC20 vs USDT 风格 reset）。
如果 approve 策略不统一，会造成：
- 下注/存款失败（allowance 不足）
- 安全风险（默认无限授权）
- UX 不一致（每页处理不同）

## Decision
在 SDK 内实现统一的 AllowancePolicy，并由 plan 输出 stepper steps。

### Default Policy (MUST)
- **Exact approval**：当 `allowance < required` 时，执行 `approve(spender, required)`。
- 说明：approve 是 **SET**，不是增量。

### Reset-then-exact (SHOULD)
对已知需要 reset 的 token（例如 USDT 风格），当 `allowance > 0 && allowance < required` 时：
1) `approve(spender, 0)`
2) `approve(spender, required)`

### Unlimited approval (MAY)
- 允许用户选择 `approve(spender, type(uint256).max)`，但必须：
  - 默认关闭
  - UI 必须显示风险提示
  - 记录在 TxJournal 的 paramsSummary 中

## Consequences
- 所有写流程（下注/LP deposit）行为一致、可审计。
- 需要维护一份 “require reset” token allowlist（可来自 manifest 或前端配置）。
