# ADR-0028: Protocol fee claims

Status: Accepted collection policy. The dual-custody accounting adaptation for
[ADR-0034](0034-nft-liquidity-deposits.md) is implemented and locally verified; final source binding and
release qualification remain **PENDING**. See the [implementation plan](../design/lp-accounting-and-callback-implementation.md).

## Decision

Bank retains `claimProtocolFees(amount, receiver)` for governance collection. It rejects zero receivers,
paused operation, a claim exceeding the fee balance and an invalid accounting/optional-outflow domain.
LiquidityVault, not Bank, holds the LP tree capital. A fee claim must not withdraw from that tree.

Let L be the Vault tree root, P the open player stakes, R their gross reserves and PP player payables:

```text
G = L+P = riskAssets
K = R-P = Vault.lockedLiquidity
Bank cash >= P + protocolFeesPayable + xpLiabilityTotal + PP
buffer = floor(G_before * withdrawalBufferBps / 10000)
```

For an external receiver, successful payment decreases Bank cash and PF by the same amount, preserving
L, G and K. Keep the existing optional-outflow policy `G_after>=R+buffer`, using pre-operation G for the
buffer. This can restrict PF/XP collection despite an already accrued debt. It is not an LP withdrawal
buffer: matured NFT withdrawals instead use `L-K` in LiquidityVault.

A payment to Bank itself leaves its cash unchanged and releases PF into explicitly diagnosed unallocated
Bank surplus. It is not automatic LP profit or new risk capital. Direct donations and self-payments are
not quietly assigned to the next depositor. No surplus sweep/distribution function is added here.

Emit `ProtocolFeesClaimed`; token failure reverts the claim and keeps the liability. Reentrancy guards
remain. A deficit or inconsistent custody state fails this optional outflow closed without inventing a
new governance state. Valid position terminalization and player-debt processing retain their own atomic
checks; they are not blanket-disabled by a new flag.

A terminal positive result with zero pre-settlement tree root is retained by Bank as separately
identified PF protocol capital, with a distinct event. It is excluded from gameplay fee/performance
counters. This rule prevents ownerless tree value and does not create a protocol risk pocket or permit
unallocated token donations to be claimed as protocol revenue.

Player-payable claims reduce Bank cash and PP equally, go only to the player and do not re-charge L.
They are independent of LP maturity, its result gate and the optional withdrawal buffer.

## Required verification

Update fee observability and invariants for both custody balances, P/R/K/L/G, NFT deposits/withdrawals,
player payables, empty-tree protocol profit, direct surplus and explicit self-payment. Verify fees cannot
consume player principal or cause a Vault debit, and failed transfers retain full liabilities.

These are pending evidence obligations; tests from another accounting model do not establish them.
See [SSOT v1.6](../constitution/SSOT.v1.6.md) for normative conservation and allocation rules.
