# Page Spec — Claims

## Route
- `/claims`

## Purpose
Expose XP and protocol-fee claim flows without leaking protocol internals into the route layer.

The page is both:
- a current-balance view for XP-related buckets
- a governed write surface for claim and sync actions

## Modules
- `ClaimsHeader`
- `XPBucketCards`
- `ClaimXPCard`
- `SyncHoldbackCard`
- `ProtocolFeeClaimCard`
- `ConnectWalletPrompt`

## Truth Sources
- Release artifact:
  - asset identity for display formatting
  - read-only / invalid-release gating
- SDK read helpers:
  - `sdk.bank.getXPBuckets(account)`
- SDK write helpers:
  - `sdk.bank.claimXPAccrued(amount, receiver)`
  - `sdk.bank.syncXPHoldback(account)`
  - `sdk.bank.claimProtocolFees(amount, receiver)`
- Optional future history surface:
  - Bank-event indexer facts for XP timeline

## Interaction Flows

### XP claim
- Read current `xpBuckets.accrued`
- Plan -> preflight -> stepper -> receipt -> journal
- Refresh balances after successful execution

### Holdback sync
- Read current releasable holdback
- Execute standardized write flow
- Refresh balances after successful execution

### Protocol fee claim
- Governed action
- Uses the same standardized write flow
- UI MUST clearly communicate that it may fail for unauthorized users

## States
- Loading:
  - XP bucket cards show loading state while balances are fetched
- Empty:
  - zero-value buckets are valid and must render intentionally
- Error:
  - DomainError only; no raw revert payloads
- Read-only:
  - route stays viewable, but all write actions are disabled with an explicit reason
- Wallet disconnected:
  - show connection prompt instead of blank content

## UX Rules
- All numbers MUST use shared formatting helpers.
- Write actions MUST use the standard transaction stepper.
- Read-only mode MUST disable all writes without hiding the route.
- The page MUST distinguish:
  - XP accrued
  - XP locked
  - XP holdback
  - XP holdback releasable

## Acceptance Criteria
- No placeholder references a missing Claims spec
- XP balances come from SDK reads, not hardcoded values
- All Claims write actions use standardized tx UX
- Errors surface through DomainError messaging only
