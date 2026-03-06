# Page Spec — Liquidity

## Route
- `/liquidity`

## Purpose
Allow users to view per-asset Bank health and manage LP positions (deposit/redeem) under SSOT semantics.

## Modules
- `LiquidityHeader` (release badge)
- `BankSelector` (asset tabs)
- `BankSnapshotCards` (NAV, reserved, free, minLiq, protocol fees, XP buckets)
- `PositionCard` (user shares/assets, allowance helper)
- `DepositRedeemStepper` (standard tx UX)

## Truth Sources
- Release artifact:
  - supported assets
  - read-only gating
- SDK read helpers:
  - `sdk.bank.getSnapshot(asset)` → `DomainBankSnapshot`
  - `sdk.bank.getPosition(asset, user)` → `DomainBankPosition`
  - `sdk.bank.maxWithdraw(owner)`
  - `sdk.bank.maxRedeem(owner)`
- SDK write helpers:
  - deposit / withdraw / redeem flows

## Interaction Flows
- Deposit: plan → simulate → stepper → receipt → journal
- Redeem: plan → simulate → stepper → receipt → journal
- Withdraw: plan → simulate → stepper → receipt → journal

### Allowance (MUST)
- Spender MUST be the per-asset Bank (from embedded release or hub.bankFor(asset)).
- Approval policy MUST follow ADR-024.

### Metrics (MUST)
- UI MUST use SSOT bank snapshot semantics: NAV, Reserved, Free, MinLiq, ProtocolFeesPayable, XP buckets.
- UI MUST NOT introduce legacy PoolV2 terms (maxBetBpsOfTVL / utilHighBps / turnoverRate, etc.).

## Acceptance Criteria
- Displays SSOT-defined metrics, not legacy pool metrics
- No references to PoolV2 fields
- All write actions use the standardized transaction flow
