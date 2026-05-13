# Executable SSOT (Invariants) v1.3 — SettlementRouter + Pool Isolation

This document defines the machine-checkable proof obligations for SSOT v1.3.

v1.3 extends ExecutableSSOT v1.2. All v1.2 statements remain in force.

> Related ADR:
> - ADR-0029 (SettlementRouter + Vertical Hubs)

## Scope & implementation

The authoritative enforcement points after implementation SHOULD include:

- unit tests for `PoolRegistry`;
- unit tests for `SettlementRouter`;
- migrated casino E2E tests through `GameHub -> SettlementRouter -> Bank`;
- stateful system diff tests with router positions;
- invariant handlers that track active positions per pool;
- adapter-mode tests proving VRF fee behavior survives the `GameHub` migration.

Current branch status:

- `test/unit/GameHubE2E.t.sol` proves real Dice/Coin/Roulette/Keno/Slots/Baccarat/Plinko/Sic Bo flows through
  `GameHub -> SettlementRouter -> Bank`.
- `test/invariants/SettlementRouterInvariants.t.sol` tracks router positions and same-asset,
  different-Bank pools to prove per-pool reserved liability, position immutability, ownerHub-only
  debt-out, and Bank settlement-router exclusivity.
- `test/diff/StatefulSystemDiff.t.sol` and `test/diff/StatefulSystemDiffAdapter.t.sol` exercise
  router-backed `GameHub` flows, including adapter-mode VRF fee/refundCredit behavior.

## Notation

- `Pool[p]` = pool registry record for `poolId = p`
- `Bank[p]` = `Pool[p].bank`
- `Asset[p]` = `Pool[p].asset`
- `Pos[i]` = router position with `positionId = i`
- `Owner[i]` = `Pos[i].ownerHub`
- `Reserved[i]` = `Pos[i].reserved` if `Pos[i].state == Held`, otherwise 0

---

## R — Router authority and lifecycle

### R1. Registered hub opens only

**Statement:** `SettlementRouter.openPosition` MUST succeed only when `msg.sender` is a registered hub
and is allowed for the selected pool.

- Owner: PoolRegistry + SettlementRouter
- Proof:
  - Unit: unregistered hub rejection
  - Unit: registered but not pool-allowed hub rejection
  - Unit: registered and pool-allowed hub success

### R2. Owner hub settles/refunds only

**Statement:** for every position `i`, only `Owner[i]` MAY call `settlePosition(i, ...)` or
`refundPosition(i, ...)`.

- Owner: SettlementRouter
- Proof:
  - Unit: non-owner hub rejection
  - Invariant: no action from another registered hub can terminalize someone else's position

### R3. Position terminality

**Statement:** a position in `Settled` or `Refunded` state MUST NOT be settled or refunded again.

- Owner: SettlementRouter
- Proof:
  - Unit: double settlement rejection
  - Unit: settle-then-refund rejection
  - Unit: refund-then-settle rejection
  - Stateful diff: terminal states are monotonic

### R4. Router is the only Bank settlement caller

**Statement:** Bank hold/settle/refund functions MUST reject every caller except SettlementRouter.

- Owner: Bank
- Proof:
  - Unit: direct hub call rejection
  - Unit: governance direct settlement rejection
  - Unit: router settlement success
  - Invariant: registered vertical hubs cannot call Bank hold/settle/refund directly

---

## P — Pool isolation

### P1. Position binds to one pool

**Statement:** every held position MUST bind to exactly one `poolId`, and settlement/refund MUST use the
Bank snapshotted at open time.

- Owner: SettlementRouter
- Proof:
  - Unit: position snapshot checks
  - Invariant: no position bank changes after open

### P2. Reserved liability matches per-pool Bank

**Statement:** for each pool `p`, `Bank[p].totalReserved()` MUST include the sum of active router
positions bound to `p`.

- Owner: SettlementRouter + Bank
- Proof:
  - Invariant: `Bank[p].totalReserved() == Σ Reserved[i] for Pos[i].poolId == p`, adjusted only if
    tests intentionally track external/manual holds

### P3. No cross-pool netting

**Statement:** a position opened in pool `p` MUST NOT change reserved liability, protocol fees, XP
liabilities, or asset balance of pool `q != p`.

- Owner: SettlementRouter + Bank
- Proof:
  - Unit: same-asset, different-Bank pool isolation
  - Invariant: per-pool reserved liability remains isolated across same-asset pools
  - Stateful diff: per-pool accounting deltas

### P4. Same asset does not imply same risk domain

**Statement:** if two pools share the same ERC20 asset, their Banks MUST remain independent and their LP
shares MUST NOT be interchangeable.

- Owner: PoolRegistry + Bank
- Proof:
  - Unit: same-token pool registration with distinct Banks
  - Invariant: Bank A never records or opens Bank B's router position ids

---

## L — Liveness under pause

### L1. Risk-in pause blocks new positions

**Statement:** inactive/paused pools MUST reject `openPosition`.

- Owner: PoolRegistry + SettlementRouter
- Proof:
  - Unit: inactive pool open rejection
  - Invariant: no new held position enters paused pool

### L2. Debt-out remains live

**Statement:** if a position was opened before pause and is eligible for settlement/refund, pool pause
MUST NOT block `settlePosition` or `refundPosition`.

- Owner: SettlementRouter + Bank
- Proof:
  - Unit: pause after open, then settle succeeds
  - Unit: pause after open, then refund succeeds

---

## G — GameHub migration

### G1. VRF request maps to router position

**Statement:** a GameHub VRF request MUST map to a live router position opened by GameHub.

- Owner: GameHub + VRFHub
- Proof:
  - Unit/E2E: `requestId -> positionId` mapping
  - Invariant: request mapping exists only while the casino position is pending/random-ready

### G2. Casino module purity preserved

**Statement:** casino modules MUST remain deterministic and custody-free after router migration.

- Owner: GameHub + modules
- Proof:
  - Existing module tests
  - Static/code review: modules do not import Bank/Router

### G3. Existing v1.2 VRF fee obligations survive

**Statement:** charged VRF fee, refund credit, and adapter-mode ETH/Credit invariants from v1.2 MUST
remain valid after `Hub` becomes `GameHub`.

- Owner: GameHub + VRFHub + Adapter
- Proof:
  - Existing V-class unit tests migrated to GameHub
  - Existing Z-class adapter invariants migrated to GameHub

## Proof gates

- **PR gate:** unit + router/pool invariants + migrated casino diff
- **Nightly gate:** deep router/pool invariants + adapter diff
- **Release gate:** deployment artifact lock includes PoolRegistry, SettlementRouter, GameHub, VRFHub,
  and pool map
