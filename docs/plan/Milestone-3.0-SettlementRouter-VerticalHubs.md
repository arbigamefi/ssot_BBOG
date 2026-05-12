# Milestone 3.0 — SettlementRouter + Vertical Hubs

## Purpose

Implement ADR-0029 as a pre-mainnet architecture refactor.

This milestone creates the settlement substrate required for sportsbook expansion while preserving the
casino-game SSOT guarantees already proven by the current `Bank + Hub + VRFHub` architecture.

## Scope

In scope:

- `PoolRegistry`;
- `SettlementRouter`;
- `Bank` trusted-caller refactor from Hub to router;
- current `Hub` evolved into `GameHub`;
- casino flow migrated from `asset` routing to `poolId` routing;
- router/pool invariants and system-level differential tests;
- deploy/runbook/doc updates.

Out of scope:

- full SportsHub implementation;
- live betting;
- parlays;
- player props;
- prediction-market CTF tokens;
- shared casino/sports bankroll;
- production oracle integration.

SportsHub MVP should start after this milestone once the settlement kernel is proven.

## Target contract graph

```text
PoolRegistry
    |
    | poolId -> Bank(asset)
    v
SettlementRouter
    |
    +-- GameHub -> VRFHub -> casino modules
    |
    +-- SportsHub (future Milestone 3.1)
```

## PR sequence

### PR-3.0.1 — SSOT v1.3 draft and interfaces

Deliverables:

- Add `SSOT.v1.3.md` draft covering:
  - poolId isolation;
  - router-only Bank settlement;
  - vertical-hub ownership of domain lifecycle;
  - debt-out liveness under risk-in pause;
  - no cross-pool netting.
- Add `ExecutableSSOT.v1.3.md` draft covering new invariants.
- Add interface skeletons:
  - `IPoolRegistry`;
  - `ISettlementRouter`;
  - `IGameHub` or renamed `IHub`;
  - shared settlement types.

Acceptance:

- Docs and interfaces compile or are intentionally stubbed behind no build-breaking references.
- ADR-0029 links to the v1.3 draft.

### PR-3.0.2 — PoolRegistry

Deliverables:

- Implement `PoolRegistry`.
- Replace production routing assumption from `asset -> Bank` to `poolId -> Bank`.
- Support multiple pools sharing one asset with different Bank contracts.
- Add hub allowlist per pool.
- Add registry events:
  - `PoolRegistered`;
  - `PoolActiveSet`;
  - `HubRegistered`;
  - `HubAllowedForPoolSet`.

Acceptance:

- Unit tests cover registration, duplicate rejection, wrong asset rejection, hub allowlist, inactive pools.
- Cross-pool same-asset registration is supported only with distinct Bank contracts.

### PR-3.0.3 — SettlementRouter compatibility layer

Deliverables:

- Implement `SettlementRouter`.
- Add global `positionId`.
- Store `Position` records with owner hub, pool, bank, asset, player, stake, reserved, state, snapshot hash.
- Route hold/settle/refund to Bank.
- Enforce registered hub and owner hub authorization.
- Emit settlement events.
- During this PR only, wire Bank's existing one-time `hub` field to the router in tests so the branch remains green before the vocabulary rename.

Acceptance:

- Unit tests cover:
  - open position success;
  - unregistered hub rejection;
  - hub not allowed for pool rejection;
  - only owner hub can settle/refund;
  - no double settlement/refund;
  - inactive pool risk-in rejection;
  - debt-out settlement/refund after pool pause.

### PR-3.0.4 — Bank router authority

Deliverables:

- Rename `hub` to `settlementRouter` in Bank and IBank.
- Rename `setSettlementRouterOnce` to `setSettlementRouterOnce`.
- Replace `NotHub` with `NotSettlementRouter` or equivalent error.
- Keep Bank hold/settle/refund accounting semantics unchanged.

Acceptance:

- Existing Bank unit tests pass after caller update.
- No governance path can directly hold/settle/refund.
- Debt-out settle/refund remains live under risk-in pause when called by router.

### PR-3.0.5 — GameHub migration

Deliverables:

- Rename or evolve current `Hub` into `GameHub`.
- `placeBet` takes `poolId` instead of `asset`.
- `GameHub` calls `SettlementRouter.openPosition`.
- `positionId` becomes casino bet id.
- VRF request mapping binds `requestId -> positionId`.
- Finalize/refund goes through router.
- Preserve pricing, referral, skyline, VRF fee, and pure module semantics.

Acceptance:

- Existing casino E2E tests pass after migration.
- VRF adapter tests pass after migration.
- No game module gains custody or Bank access.
- Existing audit fixes remain preserved.

### PR-3.0.6 — Invariants and differential tests

Deliverables:

- Extend invariant handler to track pools and router positions.
- Add router position model.
- Assert per-pool Bank accounting.
- Assert no cross-pool settlement.
- Preserve current casino stateful diff behavior through the router.

Acceptance:

- PR profile:
  - unit tests pass;
  - invariants pass;
  - stateful diff passes;
  - adapter diff/invariants pass.
- New tests fail if any registered vertical bypasses router.

### PR-3.0.7 — Deploy, ops, and release docs

Deliverables:

- Update deployment scripts:
  - deploy PoolRegistry;
  - deploy SettlementRouter;
  - deploy Bank per pool;
  - register pools;
  - register/allow GameHub;
  - wire Bank to router.
- Update deploy params and checklist.
- Update ops alerts/runbooks for:
  - router position stalls;
  - pool reserve anomalies;
  - hub allowlist drift;
  - risk-in pause per pool.
- Update release artifact schema with pool ids and router address.

Acceptance:

- Local deployment script produces a complete router/pool/GameHub config.
- Release lock includes PoolRegistry, SettlementRouter, GameHub, VRFHub, and pool map.
- Docs no longer describe old `asset -> Bank -> Hub` as production target.

## SportsHub follow-up milestone

Milestone 3.1 should implement the sportsbook MVP on top of this substrate:

- market registry;
- pre-match fixed-odds singles;
- signed or Merkle-root odds snapshots;
- SportsRiskEngine;
- result reporter quorum and challenge delay;
- independent sports pool;
- SportsHub-specific invariants.

## Acceptance for Milestone 3.0

Milestone 3.0 is complete when:

- ADR-0029 is accepted or explicitly superseded.
- `Bank` trusts only `SettlementRouter`.
- Casino bets complete end-to-end through `GameHub -> SettlementRouter -> Bank`.
- All existing casino security fixes remain covered.
- Pool isolation tests prove same-asset pools cannot settle against each other.
- The invariant suite treats `poolId` as the accounting/risk domain.
- Deployment docs use router/pool topology.

## Recommended validation commands

```bash
FOUNDRY_PROFILE=pr forge test -vv
FOUNDRY_PROFILE=pr forge test --match-path test/diff/StatefulSystemDiff.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/diff/StatefulSystemDiffAdapter.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/invariants/Invariants.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/invariants/InvariantsAdapter.t.sol -vv
git diff --check
```

## Risk controls

- Do not implement SportsHub before router invariants are green.
- Do not share casino and sports pools in the first SportsHub release.
- Do not add generic router callbacks.
- Do not add governance settlement powers.
- Do not treat oracle/compliance/indexing as frontend-only concerns.

## Links

- ADR: `docs/adr/0029-settlement-router-vertical-hubs.md`
- Research: `docs/research/sportsbook-architecture-2026-05.md`
