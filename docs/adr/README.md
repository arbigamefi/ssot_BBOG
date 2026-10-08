# Current design decisions

Core accounting, authority, buffer and encoding rules are consolidated in the
[current constitution](../constitution/SSOT.v1.6.md). The records below describe the decisions behind this
target. NFT-deposit/callback core and application interfaces are implemented and locally verified; release qualification remains pending.
See the [detailed implementation plan](../design/lp-accounting-and-callback-implementation.md).

- [ADR-0005: Referral liabilities as XP buckets; permissionless unlock + rolling linear vesting](0005-referral-permissionless-linear-vesting.md)
- [ADR-0006: Durable randomness and callback settlement](0006-vrf-callback-settlement.md) (amended 2026-10-08: first-callback certificate policy, margin standard, Owner risk acceptance)
- [ADR-0007: Fee-on-Payout House Edge (Net Settlement)](0007-fee-on-payout-house-edge.md)
- [ADR-0013: Multi-Roll Semantics (Refund + stopGain/stopLoss) and Canonical RNG Expansion](0013-multi-roll-semantics-and-rng.md)
- [ADR-0014: Player Equals Receiver (No Recipient Separation)](0014-player-equals-receiver.md)
- [ADR-0015: Adopt OpenZeppelin primitives](0015-openzeppelin-primitives.md)
- [ADR-0021: Direct Chainlink wrapper consumer](0021-chainlink-vrf-wrapper-consumer.md)
- [ADR-0022: Native VRF fee and refund-credit invariants](0022-vrf-native-fee-credit-invariants.md)
- [ADR-0026: Error taxonomy — separate authorization errors from balance errors](0026-error-taxonomy-auth-vs-balance.md)
- [ADR-0027: Extract shared StopLogic library for multi-roll stop conditions](0027-stop-logic-shared-library.md)
- [ADR-0028: Protocol fee claims](0028-claim-protocol-fees.md)
- [ADR-0029: Settlement Router and domain hubs](0029-settlement-router-vertical-hubs.md)
- [ADR-0032: Fixed LP share of the turnover house edge; operator-funded referrals](0032-fixed-lp-share-operator-funded-referrals.md)
- [ADR-0034: NFT liquidity deposits and settlement allocation](0034-nft-liquidity-deposits.md) (amended 2026-10-07: k>0 allocation without the vendor preview, UNUSED_SUFFIX tree patch)
