# ADR-0012: Multi-Asset SSOT via Per-Asset Banks + Single Hub

- **Status:** Accepted
- **Date:** 2026-01-09

## Context

We require **multi-asset (multi token)** support as a base property of the protocol, so that future
feature work (multi-roll, more games, referral v2, proofs) does **not** require a foundational rewrite.

The protocol also targets institution-grade correctness proofs. Therefore, the multi-asset design must:

- preserve **minimal trust surface**
- preserve **debt-out liveness**
- keep **proof scope small** (no price oracles, no cross-asset netting)
- remain compatible with **ERC4626-like** vault semantics (per asset)

## Decision

We will implement multi-asset as **N independent single-asset Banks** plus a **single global Hub**.

- For each supported ERC20 `asset`, there exists exactly one immutable `Bank(asset)` that custodies
  funds and maintains SSOT accounting (`PF/XP/R/NAV`) **in that asset**.
- The Hub is the single bet authority across all assets with a global `betId` namespace.
- Each bet binds to exactly one `asset` and therefore exactly one `Bank(asset)`.

There is **no** cross-asset netting, rehypothecation, or liability migration. Each asset remains
solvent independently.

### What this enables

- ERC4626-like interfaces remain clean (one vault per asset).
- Proof obligations remain local (A1–A4 per asset; no oracle conversions).
- Delisting an asset can freeze **risk-in** (new bets / optional outflows if desired) while keeping
  **debt-out** live for existing bets.

## Implementation outline

1. Introduce a registry `asset -> bank` with governance-controlled registration.
2. Update `Hub.placeBet` to take `asset` (or `bank`) and bind it per bet.
3. Route `holdBet/settleBet/refundBet` calls to the bet’s bound `Bank(asset)`.
4. Duplicate (per asset) the required observability views:
   - `Bank(asset).getSSOT()`
   - `Bank(asset).externalPayablesTotal()`, `protocolFeesPayable()`, `totalReserved()`, etc.
5. Update invariants to check A1–A4 and B4 **per asset**, and add cross-asset isolation checks.

## Acceptance

- Multiple `Bank(asset)` vaults can co-exist; Hub can place bets in any supported asset.
- All SSOT invariants hold **per asset**.
- No protocol function can “fix” solvency of asset `a` by draining asset `b`.
- Debt-out liveness remains unconditional for all assets.

## Consequences

- Some governance/config values become per-asset (e.g., `minLiquidityBps`, XP unlock thresholds).
- More test surface (assets × games), but invariants remain structurally identical.

## Alternatives considered

1. **Single multi-asset Bank contract** (custody multiple tokens):
   - Rejected: complicates ERC4626 semantics, increases proof scope, and raises cross-asset coupling risk.

2. **Separate Hub per asset**:
   - Rejected: violates the “single lifecycle (Hub)” SSOT axiom and fragments betId namespace.

## Links

- Constitution: `docs/constitution/SSOT.v1.1.md`
- Executable SSOT: `docs/constitution/ExecutableSSOT.v1.1.md`
