# Casino frontend access

Contract deployment does not open the public application. Before enabling public use, resolve the
target jurisdictions, applicable access requirements, age and sanctions checks, responsible gaming,
self-exclusion, terms, privacy and support arrangements. Those are launch decisions; the contract
and frontend feature flags do not implement or certify them.

For mainnet, the application has independent controls:

- `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED` enables the casino betting entrypoint.
- `NEXT_PUBLIC_LP_DEPOSITS_ENABLED` enables LP deposits. It does not control redemption requests or
  claims, and enabling betting does not enable deposits.
- The verified release determines the chain, assets, pools and contract addresses. A build without
  that release has no connected pools.

Testnet access is enabled by the chain environment without those mainnet flags.
Feature flags are build configuration, not on-chain authorization. Confirm the built application
rejects disabled actions and reports the actual Bank pause and active-capital state. Closing frontend deposits
must leave users able to inspect requests, cancellation eligibility, priced claims and player debts.
A paused Bank can still accept redemption requests, but blocks batch activation and LP cash/recovery claims.

Before enabling risk-in, verify the intended release, keeper recovery coverage, database reads and
alert delivery. The [deployment workflow](../deploy/v16-release.md) and
[ADR-0034 release gates](../adr/0034-async-lp-redemption-continuous-betting.md) govern network acceptance
and outside LP admission. There is no separate JSON approval validator in this repository.
