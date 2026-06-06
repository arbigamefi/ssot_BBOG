# ADR-0031: Split Bank risk reserve from withdrawal buffer

Status: Accepted  
Date: 2026-06-06

## Context

The historical `minLiquidityBps` parameter carried two meanings:

1. risk-in reserve: how much NAV must remain free after accepting new bet risk;
2. optional-outflow buffer: how much NAV must remain available after LP withdrawals, XP claims, and protocol fee claims.

Using one parameter for both made incident response ambiguous. Raising `minLiquidityBps` to protect the house from new risk also tightened LP withdrawals and claims. Lowering it to improve LP exit capacity also allowed larger new-risk intake.

## Decision

`Bank` now exposes two explicit per-bank controls:

- `riskReserveBps`: the new-risk reserve buffer used by `holdBet`.
- `withdrawalBufferBps`: the optional-outflow buffer used by `withdraw`, `redeem`, `claimXPAccrued`, and `claimProtocolFees`.

The legacy constructor argument and `minLiquidityBps()` getter remain as a compatibility alias for `riskReserveBps`. `setMinLiquidityBps(uint256)` remains as a compatibility alias for `setRiskReserveBps(uint256)`.

`withdrawalBufferBps` initializes to the same value as `riskReserveBps`, preserving legacy behavior unless governance explicitly separates them.

## Updated Invariants

Let:

- `RiskReserve(NAV) := NAV * riskReserveBps / 10_000`
- `WithdrawalBuffer(NAV) := NAV * withdrawalBufferBps / 10_000`

For risk-in:

- `holdBet` MUST ensure `NAV_afterRiskIn - R_afterRiskIn >= RiskReserve(NAV_afterRiskIn)`.

For optional outflows:

- for a requested optional outflow from current state `S`, `Bank` MUST ensure
  `NAV_afterOutflow - R >= WithdrawalBuffer(NAV_beforeOutflow)`.

Debt-out operations (`settleBet` and `refundBet`) remain exempt from both buffers.

## Consequences

- Governance can keep a large risk reserve for new bets while allowing a smaller, explicit LP withdrawal buffer.
- `maxWithdraw(owner)` and `maxRedeem(owner)` are now driven by `withdrawalBufferBps`, not `riskReserveBps`.
- Dashboards should label `minLiquidityBps` as legacy/risk reserve and display `withdrawalBufferBps` separately when available.
- Release snapshots include both `poolBankRiskReserveBps_*` and `poolBankWithdrawalBufferBps_*`; both are included in the v1.4 release digest.

## Non-goals

- No cross-asset netting.
- No change to reserve release, settlement, or refund liveness.
- No attempt to put player counts, leaderboards, or time-series analytics on-chain.
