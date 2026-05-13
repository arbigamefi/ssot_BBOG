# Migration Mapping: Refactored Protocol -> SSOT v1.2 (Clean-Room)

This file tracks **semantic parity** goals with `bankroll_protocol_refactored_v0.7.8` while preserving
SSOT v1.2 constitutional constraints (minimal trust surface + debt-out liveness + per-asset custody).

## High-level differences

### Refactored patterns to avoid
- Per-game hubs via inheritance (duplicates state; breaks global betId SSOT)
- Multiple GAME_ROLE callers into the Bank (larger access control surface)
- Settlement paths that depend on external transfers (feeSink/referral transfers causing revert)
- Pause that blocks settlement/refund
- Cross-asset coupling or netting that requires price oracles

### SSOT v1.2 patterns
- Single Hub registry (global betId across assets)
- Per-asset single custody: one immutable `Bank(asset)` per supported asset (ADR-0012)
- Bank trusts only the settlement authority (Hub in v1.2; SettlementRouter in v1.3)
- Fee/referral are accrued as liabilities; transfers are optional outflows
- VRFHub fulfill never reverts
- Risk-in pause freezes only risk-in + optional outflows; debt-out stays live
- Multi-roll semantics are standardized (ADR-0013)
- `player == receiver` (ADR-0014)

## Feature mapping checklist

### Multi-asset substrate (base)
- [x] Registry: `asset -> Bank(asset)` (governance-controlled registration)
- [x] Hub binds each bet to an `asset` and routes hold/settle/refund to `Bank(asset)`
- [x] Per-asset SSOT invariants (A1–A4, B3/B4) + cross-asset isolation tests

### Bank (vault + accounting, per asset)
- [ ] ERC4626 exact API parity (optional / roadmap item; SSOT currently provides ERC4626-like semantics)
- [x] SSOT NAV identity: `NAV = B - PF - XP`
- [x] totalReserved and reserve coverage (`NAV >= R`)
- [x] Optional outflow domain check (`NAV - R >= MinLiq`)
- [x] No backdoor ASSET rescue (non-asset rescue only)
- [x] Per-asset configs (minLiquidity, unlock thresholds, vesting duration) via per-asset banks

### Hub (lifecycle)
- [x] Global betId namespace
- [x] Permissionless finalize/refund
- [x] VRF request mapping + callbacks
- [x] StakeSpec first-class: `amountPerRoll`, `betCount`, `stopGain`, `stopLoss` (multi-roll)
- [x] Canonical RNG expansion (seed -> per-roll randomness)
- [x] Turnover/budget accounting uses `usedTurnover` (refund-aware)

### VRFHub
- [x] fulfill never reverts
- [x] detach semantics
- [x] Coordinator adapter abstraction (Chainlink v2.5+ wrapper adapter layer under `src/adapters/`) (ADR-0021)

### Referral / kickback
- [x] XP buckets: accrued/locked/holdback (liabilities)
- [x] Permissionless turnover-gated unlock
- [x] Permissionless rolling linear vesting
- [x] Skyline pricing + delta budgets (snapshotted per bet)
- [ ] Additional referral variants (only if refactored adds non-default rules)

### Game modules (refactored v0.7.8 set)
- [x] Dice (multi-roll)
- [x] CoinToss (multi-roll)
- [x] Roulette (raw bitmask parity + typed encoding convenience)
- [x] Keno (multi-roll, default N=40, M=10, played<=10)

## Notes on “perfect migration”

The goal is **semantic parity** with stronger guarantees: same economics (within SSOT-defined semantics),
same liveness, and higher verifiability (invariants + diff tests + CI proof gates).

We do not preserve refactored contract shapes or role layouts if they conflict with SSOT.
