# Documentation

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

The project is in development. Documentation distinguishes accepted targets, the current implementation and remaining
launch work; read each document's status before treating it as verified behavior.

- [Project brief](ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md), [business whitepaper](WHITEPAPER.product.zh-CN.md),
  [technical whitepaper](WHITEPAPER.zh-CN.md).
- [Current contract rules](constitution/SSOT.v1.6.md), [executable invariants](constitution/ExecutableSSOT.v1.6.md),
  [architecture](architecture/overview.md), [design decisions](adr/README.md).
- [NFT liquidity deposits](adr/0034-nft-liquidity-deposits.md),
  [callback settlement](adr/0006-vrf-callback-settlement.md),
  [direct wrapper consumer](adr/0021-chainlink-vrf-wrapper-consumer.md),
  [native refund credit](adr/0022-vrf-native-fee-credit-invariants.md),
  [LP edge allocation](adr/0032-fixed-lp-share-operator-funded-referrals.md).
- [Testing](testing.md), [threat model](audit/threat-model.md), [audit scope](audit/v1.6-audit-scope.md).
- [Release](release/README.md), [deployment](deploy/v16-release.md), [operations](ops/README.md).
- [Frontend design](design/README.md), [frontend engineering](frontend/INDEX.md).
- [Product roadmap](roadmap.md), [economic design](strategy/economic-design.md),
  [product architecture](strategy/fullstack-product-architecture.md).

Game-specific rules live in `games/`. Operations templates are preparation for the current launch,
not evidence that a network or service is already deployed.
