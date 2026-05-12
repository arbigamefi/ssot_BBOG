# Architecture Decision Records (ADR)

This directory contains short, immutable records of architectural decisions.

## Format

Each ADR:
- has a monotonically increasing number
- is written in English
- includes: Context, Decision, Consequences, Alternatives considered
- references relevant SSOT clauses and tests

## Index

- ADR-0001: Immutable v1.0 (no upgrades)
- ADR-0002: SSOT accounting identity (`NAV = B - PF - XP`)
- ADR-0003: Hub is the only bet authority (Bank trusts only Hub)
- ADR-0004: Risk-in pause semantics (freeze risk-in + optional outflows; debt-out stays live)
- ADR-0005: Referral liabilities as XP buckets; permissionless unlock + rolling linear vesting
- ADR-0006: VRFHub fulfill never reverts (soft-ignore + try/catch)
- ADR-0007: Fee-on-payout house edge (net settlement)
- ADR-0008: Skyline pricing and delta referral budgets
- ADR-0009: Reference model differential testing (state mirror + diff asserts)
- ADR-0010: Invariant suite completion and run policy (D2/E2/E3/B3/P3, CI gates)
- ADR-0011: Multi-game module expansion without new trust surface
- ADR-0012: Multi-asset SSOT via per-asset Banks + single Hub
- ADR-0013: Multi-roll semantics (refund + stopGain/stopLoss) and canonical RNG expansion
- ADR-0014: Player equals receiver (no recipient separation)
- ADR-0015: Adopt OpenZeppelin primitives (SafeERC20/Math/Pausable/ReentrancyGuard)
- ADR-0016: Roulette typed parameter encoding (kind+payload) with legacy bitmask support
- ADR-0017: Keno module (default N=40, M=10) with precomputed gain table
- ADR-0018: Proof hardening — complete B/C/D invariants and initial diff suite
- ADR-0019: CI proof gates tiers + stateful system-level diff
- ADR-0020: Charged VRF fee in native token (refactored parity)
- [ADR-0021: Chainlink VRF v2.5+ Wrapper Adapter](0021-chainlink-vrf-wrapper-adapter.md)
- [ADR-0022: Adapter-mode ETH/Credit Accounting Invariants](0022-adapter-eth-credit-invariants.md)
- [ADR-0023: Fork tests as a release gate](0023-fork-tests-as-release-gate.md)
- [ADR-0024: Release artifact digest + signature (deployment lock)](0024-release-artifacts-digest-signature.md)
- [ADR-0025: Release notes MUST reference the release digest](0025-release-notes-and-packaging.md)
- [ADR-0026: Error taxonomy — separate auth from balance errors](0026-error-taxonomy-auth-vs-balance.md)
- [ADR-0027: Extract shared StopLogic library](0027-stop-logic-shared-library.md)
- [ADR-0028: Protocol Fee Withdrawal (`claimProtocolFees`)](0028-claim-protocol-fees.md)
- [ADR-0029: Settlement Router + Vertical Hubs](0029-settlement-router-vertical-hubs.md)
