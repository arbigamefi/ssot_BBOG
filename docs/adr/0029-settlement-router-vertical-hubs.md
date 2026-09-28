# ADR-0029: Settlement Router and domain hubs

Status: Implemented in the current prelaunch architecture.

## Decision

Bank owns custody and accounting. SettlementRouter owns position authorization.
GameHub and SportsHub own their respective domain lifecycles. Hubs never move
bankroll funds directly.

```text
GameHub   -> VRFHub -> pure casino modules
    |
SettlementRouter -> PoolRegistry -> Bank per pool
    |
SportsHub -> oracle adapters and SportsRiskEngine
```

PoolRegistry assigns each `poolId` one asset, one Bank and one domain. A Bank is
registered to exactly one pool. Multiple pools may use the same asset while keeping
their reserves, LP shares and liabilities separate. Governance controls pool activity,
Hub registration and per-pool admission.

SettlementRouter assigns each position an ID and snapshots its owner Hub, pool,
Bank, asset, player, stake, reserve, house edge and commitment hash. Only a registered
Hub admitted to an active pool can open a position. Only its owner Hub can settle or
refund it, exactly once. Disabling admission does not disable existing debt settlement.
Governance has no arbitrary position-settlement or generic execution path.

The Router checks payout, refund and reserve bounds, and enforces the operator
allocation cap from the snapshotted edge. [ADR-0032](0032-fixed-lp-share-operator-funded-referrals.md)
defines that allocation. The Bank independently enforces backing and is bound once
to its Router through `setSettlementRouterOnce`.

GameHub validates casino parameters, snapshots pricing and referrals, opens the
position, requests randomness, and finalizes or refunds through the Router. Pure
game modules compute outcomes without custody. VRF callbacks never transfer funds.

SportsHub manages markets, odds snapshots, ticket exposure, result proposals,
challenges and terminalization. SportsRiskEngine enforces risk limits on chain.
Sports uses separately admitted pools; its release requires a complete terminalization
review and is not enabled by casino acceptance.

## Invariants and verification

- Every position belongs to exactly one Hub, pool and Bank.
- No Hub can settle another Hub's position or transfer risk across pools.
- A position cannot settle or refund twice.
- New-risk admission and debt settlement are separate permissions.
- Protocol fees and referral awards cannot consume the LP share of the edge.
- Bank accounting, casino randomness and sports adjudication have separate owners.

The source interfaces are authoritative for signatures and storage structures.
Tests in `test/unit/PoolRegistry.t.sol`, `test/unit/SettlementRouter.t.sol`,
`test/unit/GameHubE2E.t.sol` and the `test/unit/SportsHub*.t.sol` suites exercise these boundaries.
See [SSOT v1.6](../constitution/SSOT.v1.6.md) and
[Executable SSOT v1.6](../constitution/ExecutableSSOT.v1.6.md) for the current contract
rules and acceptance gates.
