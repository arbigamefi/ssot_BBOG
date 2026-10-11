# Casino frontend access

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

Contract deployment does not open the public application. Before enabling public use, resolve the
target jurisdictions, applicable access requirements, age and sanctions checks, responsible gaming,
self-exclusion, terms, privacy and support arrangements. Those are launch decisions; the contract
and frontend feature flags do not implement or certify them.

For every supported chain, including Base mainnet and Base Sepolia, the application has independent controls:

- `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED` enables the casino betting entrypoint.
- `NEXT_PUBLIC_LP_DEPOSITS_ENABLED` enables LP deposits. It does not control mature NFT
  withdrawals or player-debt claims, and enabling betting does not enable deposits.
- The verified release determines the chain, assets, pools and contract addresses. A build without
  that release has no connected pools.

Both actions default to closed unless their own flag is explicitly `true`. A testnet acceptance
build must explicitly enable the action it needs; selecting a test chain does not bypass the flags.
Feature flags are build configuration, not on-chain authorization. Confirm the built application
rejects disabled actions and reports the actual Bank pause and active-capital state. Closing frontend deposits
must leave users able to inspect owned NFTs, node values, withdrawal deadlines, free-capital limits and player debts.
A Bank pause blocks new bets and LP deposits, not withdrawals; recorded randomness awaiting accounting
separately blocks LP operations in that pool until it is booked or voided. Neither is a queued withdrawal, and ordinary exits add no planned
betting pause. Reverted withdrawals do not change NFT value or its deadline. Successful partial withdrawal restarts its 24-hour lock, transfers preserve it, and full withdrawal burns the NFT. Asset approval goes to Vault, not Bank.

Before enabling risk-in, verify the intended release, keeper recovery coverage, database reads and
alert delivery. The [deployment workflow](../deploy/v16-release.md) and
[ADR-0034 acceptance gates](../adr/0034-nft-liquidity-deposits.md) govern network acceptance
and outside LP admission. There is no separate JSON approval validator in this repository.
