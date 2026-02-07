# Milestone 2.0 — Multi-Asset Foundation (Base Substrate)

This plan makes multi-asset support a **first-class SSOT property**, per ADR-0012 and SSOT v1.1.
The goal is to complete the “base rewrite” **once**, so that future features (multi-roll parity,
more games, referral v2, proofs) build on a stable substrate.

## Scope (in / out)

### In-scope
- Multiple ERC20 assets supported concurrently.
- Exactly one `Bank(asset)` vault per supported asset (custody + SSOT accounting).
- Single global Hub (global `betId` namespace) that routes per bet to the correct `Bank(asset)`.
- Per-asset SSOT views + invariants (A1–A4, B4 per asset).
- Cross-asset isolation tests (no wrong-asset transfers).

### Out-of-scope (defer)
- Any price-oracle-based cross-asset netting (explicitly forbidden by constitution).
- Recipient separation (`player != receiver`) (explicitly forbidden by ADR-0014).
- Multi-roll parity itself (handled in Milestone 2.1).

## Design checkpoints (must be written before code changes)

1. **Asset registry contract shape**
   - Immutable mapping in Hub constructor (strict) vs governance-updatable registry (flexible).
   - Requirement: existing assets MUST NOT be removed in a way that breaks debt-out for old bets.

2. **Per-asset configs**
   - `minLiquidityBps`, `holdbackVestingSeconds`, `minPlayerTurnoverForUnlock` become per-asset.
   - Decide whether pause is:
     - per-asset (recommended), or
     - global + per-asset overrides.

3. **Bet record additions**
   - Each bet stores: `asset`, `bank`.
   - Ensure `snapshotHash` commits to `asset` to prevent confusion attacks.

## Work breakdown (PR-sized)

### PR-2.0.1: Registry + second Bank(asset) wiring
- Add `BankRegistry` (or Hub-managed mapping) with `registerAsset(asset, bank)` governance path.
- Add a test mock asset (ERC20) and deploy a second Bank for it in tests.
- Add view: `Hub.bankOf(asset)` and `Hub.isAssetSupported(asset)`.

**Acceptance**
- Tests can register 2 assets and obtain their bank addresses.
- No existing code path assumes a single global `asset`.

### PR-2.0.2: Hub routes hold/settle/refund by bet.asset
- Extend `placeBet` signature to include `asset` (or infer from game, but explicit is preferred).
- On bet hold: route to `Bank(asset).holdBet(...)`.
- Store `bet.asset` / `bet.bank`.
- On finalize/refund: route to `bet.bank`.

**Acceptance**
- E2E: one bet in asset A and one bet in asset B can be placed, fulfilled, and settled independently.
- No bet can accidentally settle on the wrong bank.

### PR-2.0.3: Bank is strictly single-asset (no changes in custody rule)
- Ensure each `Bank(asset)` enforces `asset` immutability and rejects rescuing that asset.
- Ensure XP/fees/reserves remain per bank and never cross-asset.

**Acceptance**
- E2E: settling a bet in asset A does not change balances of asset B for Bank/players (except intended deposits).
- “No backdoor” tests remain valid per bank.

### PR-2.0.4: Invariants upgraded to multi-asset
- Update invariant harness to maintain a list of supported assets and their banks.
- Check A1–A4 per asset.
- Update B4 to be per asset.
- Add X1 cross-asset isolation invariant (wrong-asset transfers never occur).

**Acceptance**
- `forge test --match-path test/invariants/*` passes for multi-asset setup (PR profile).
- Nightly profile stays stable after a burn-in run.

### PR-2.0.5: Documentation sync
- Update `docs/roadmap.md` to include Milestone 2.0 and 2.1 ordering.
- Update `docs/constitution/*` references to v1.1.
- Ensure ADR index includes 0012.

**Acceptance**
- All docs cross-links resolve inside repo.
- CI/PR templates reference correct constitution version.

## Risks & mitigations

- **Risk:** asset confusion attacks (settle/refund routed to wrong bank)
  - **Mitigation:** store `asset` and commit it into `snapshotHash`; add unit tests; add invariants.

- **Risk:** per-asset config drift (some banks misconfigured)
  - **Mitigation:** expose per-asset config views and add invariants / sanity checks.

## Deliverables

- Multi-asset substrate committed.
- Updated invariant suite and E2E tests.
- Updated documentation (constitution + ADR + roadmap).

