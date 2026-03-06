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

## Data Sources
- SDK read helpers: balances, allowances, refundCredit
- Local `TxJournal` as primary for history

## Acceptance Criteria
- All numbers formatted through shared format helpers
- Tx Journal rows always include `releaseDigest` and `chainId`
