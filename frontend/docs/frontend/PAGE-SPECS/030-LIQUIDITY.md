# Page Spec — Liquidity

## Route
- `/liquidity`

## Purpose
Allow users to view per-asset Bank health and manage LP positions (deposit/redeem) under SSOT semantics.

## Modules
- `LiquidityHeader` (release badge)
- `InterpretationCards` (plain-language LP readout for NAV / reserve / optional outflow)
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
- UI SHOULD explain the LP meaning of those metrics in plain language, rather than only rendering raw labels.

### Interpretation Layer (SHOULD)
- The route SHOULD make clear that:
  - `NAV` is LP backing
  - `ProtocolFeesPayable` and `XP` are not LP backing
  - `withdraw` / `redeem` are optional outflows constrained by reserve + minLiq checks
- The route SHOULD help the user read the page like an LP dashboard, not like a generic vault form.

## Acceptance Criteria
- Displays SSOT-defined metrics, not legacy pool metrics
- No references to PoolV2 fields
- All write actions use the standardized transaction flow
- LP-facing explanatory copy exists for the core constraints, not just the raw numbers
