# Earn provider console

The current `/earn` page supports immediate asset deposits or share minting, a single redemption
queue, priced liquid claims and independent historical recovery under ADR-0035. It selects current
casino pools and reads the generated contract ABI.

- Show active wallet equity, queued liquid estimates, priced claimable assets and historical recovery
  separately. Future recovery is an upper bound, not cash or a guaranteed portfolio value.
- Request by shares. Cancellation is available until actual activation, even after eligibility.
  Activation prices available cash immediately; each old epoch retains its risk and recovery rights
  for all snapshot holders. A stuck epoch never gates a later request or activation.
- Discover historical rights even when the wallet holds zero active shares. Page contiguous epoch IDs
  at one fixed block. Empty account pages can still have older rights; expose further pagination.
- Use the same block for Bank views, recovery pages and cash history. Show the snapshot time and
  explicit refresh; successful transactions invalidate the snapshot. Incomplete historical discovery,
  unsettled recovery or unverified cash-history coverage prevents displaying a complete final return.
- Display emergency pause independently. It blocks deposits, activation and LP liquid/recovery claims.
  Requests, cancellation and entitlement synchronization remain available; player debt can still be paid.
- Account balances, NAV, current and historical reserves, liabilities and lifetime counters come from Bank.
  Indexed daily GGR is a gameplay metric, not an LP share-price performance series.
- The provider ledger records Deposit, Withdraw and RecoveryClaimed cash events. Record beneficiary,
  caller and receiver separately. Payments to Bank are donations; requests, burns and recovery availability
  are not receipts. Canonical range replacement removes orphaned events on replay.
- Failed reads block affected actions and offer retry. Chain, Bank, account and release identity scope
  caches; fresh preflight validates the selected Bank before any transaction.
- Website flags control new deposits. The UI never asks users to make a keeper an ERC-7540 operator.

LPs retain a fixed 50% of the turnover edge and bear the pool's game-result risk; no return is promised.
The complete financial rules are in [ADR-0035](../adr/0035-recovery-rights-without-exit-blocking.md).
