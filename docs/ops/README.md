# Operations

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

The project has not launched. These documents describe the current application's first deployment
and operating procedures; they are not evidence of a running service. Start with the
[release facts](../release/README.md), [deployment workflow](../deploy/v16-release.md) and
[Docker configuration](../../frontend/deploy/docker/README.md).

- [Metrics and reconciliation](metrics.md)
- [Alerts and delivery](alerts.md)
- [Runbooks](runbooks/README.md)
- [Casino frontend access](casino-frontend-access.md)
- [Incident record](incident-templates.md)
- [Legacy Banks](legacy-banks.md): the pre-v1.5 Banks the exposed key still governs, and their retirement

Use the verified release digest, chain ID and contract addresses in every operational record.
The release gates in [ADR-0034](../adr/0034-nft-liquidity-deposits.md) remain prerequisites
for outside LP capital; a healthy process or a successful local test does not discharge them.
