# Runbooks

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

- [Governance Safe setup](governance-safe-setup.md)
- [Keeper signer custody](keeper-key-separation.md)
- [Keeper operations](casino-keeper-production.md)
- [Bet-index startup and replay](bet-index-production.md)
- [Database backup and recovery](bet-index-backup.zh-CN.md)
- [Bank solvency and NFT Vault accounting](bank-solvency.md)
- [Pause and configuration drift](pause-config-drift.md)
- [Configuration drift alerts (K0-4)](config-drift-alerts.md)
- [Casino finalization](game-finalization-diffs.md)
- [VRF and refund credit](vrf-refundcredit.md)

See also [metrics](../metrics.md), [alerts](../alerts.md) and the
[incident record](../incident-templates.md).
