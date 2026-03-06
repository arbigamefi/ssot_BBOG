# Page Spec — Account

## Route
- `/account`

## Purpose
Provide user self-audit: balances, allowances, tx journal, and protocol identity.

## Modules
- `BalancesCard` (per asset balance)
- `AllowancesCard` (spender=bank per asset)
- `TxJournalTable`
- `VRFRefundCreditCard` (view + claim)
- `ReleaseIdentityCard` (digest / chain / mode)

## Truth Sources
- Release artifact:
  - chain identity
  - release digest
  - read-only state
- SDK read helpers:
  - balances
  - allowances (spender = Bank)
  - refund credit
- Local `TxJournal`:
  - primary source for user action history / local audit trail

## Acceptance Criteria
- All numbers formatted through shared format helpers
- Tx Journal rows always include `releaseDigest` and `chainId`
- The page is more than a journal-only table
