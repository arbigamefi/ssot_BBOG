# Current design decisions

Core accounting, authority, buffer and encoding rules are consolidated in the
[current constitution](../constitution/SSOT.v1.6.md). The records below describe decisions still relevant
to this implementation; completed implementation plans and superseded proposals are removed.

- [ADR-0005: Referral liabilities as XP buckets; permissionless unlock + rolling linear vesting](0005-referral-permissionless-linear-vesting.md)
- [ADR-0006: VRFHub fulfill never reverts (soft-ignore + try/catch)](0006-vrfhub-fulfill-never-revert.md)
- [ADR-0007: Fee-on-Payout House Edge (Net Settlement)](0007-fee-on-payout-house-edge.md)
- [ADR-0008: Skyline Pricing and Delta Referral Budgets](0008-skyline-pricing-and-delta-budget.md)
- [ADR-0013: Multi-Roll Semantics (Refund + stopGain/stopLoss) and Canonical RNG Expansion](0013-multi-roll-semantics-and-rng.md)
- [ADR-0014: Player Equals Receiver (No Recipient Separation)](0014-player-equals-receiver.md)
- [ADR-0015: Adopt OpenZeppelin primitives](0015-openzeppelin-primitives.md)
- [ADR-0021: Chainlink VRF v2.5+ Wrapper Adapter (Native Payment)](0021-chainlink-vrf-wrapper-adapter.md)
- [ADR-0022: Adapter-mode ETH/Credit Accounting Invariants](0022-adapter-eth-credit-invariants.md)
- [ADR-0026: Error taxonomy — separate authorization errors from balance errors](0026-error-taxonomy-auth-vs-balance.md)
- [ADR-0027: Extract shared StopLogic library for multi-roll stop conditions](0027-stop-logic-shared-library.md)
- [ADR-0028: Protocol fee claims](0028-claim-protocol-fees.md)
- [ADR-0029: Settlement Router and domain hubs](0029-settlement-router-vertical-hubs.md)
- [ADR-0032: Fixed LP share of the turnover house edge; operator-funded referrals](0032-fixed-lp-share-operator-funded-referrals.md)
- [ADR-0034: Asynchronous LP redemptions without stopping betting](0034-async-lp-redemption-continuous-betting.md)
- [ADR-0035: Preserve old risk without blocking later LP exits](0035-recovery-rights-without-exit-blocking.md) — Accepted and implemented; local validation complete, external audit and fresh network acceptance pending.
