# Frontend design

The current product uses one wallet-native casino interface.

- [Product architecture](../strategy/fullstack-product-architecture.md)
- [Casino transaction UX](casino-placebet-ux.md)
- [Durable index and source ownership](durable-bet-index.md)
- [Design tokens](10-design-tokens.md), [components](11-component-library.md), [wallet UX](13-web3-ux.md)
- [Data and state](14-data-and-state.md), [forms](15-forms.md), [mobile](16-mobile.md)
- [Earn console](earn-provider-console-spec.md)
- [NFT deposits and callback implementation plan](lp-accounting-and-callback-implementation.md)
- [Accepted LP ordering tradeoff](../adr/0034-nft-liquidity-deposits.md#pre-inclusion-ordering-owner-decision-2026-10-04)

Numbered visual references document current design choices. Contract behavior is defined by the
current constitution and ADR-0034. The NFT-deposit/callback implementation and consumers are locally integrated; full callback gas and
release qualification remain open. The UI follows this single target without a parallel compatibility flow.
