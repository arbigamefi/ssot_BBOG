# ADR-0029: Settlement Router and domain hubs

Status: Implemented in the current prelaunch architecture. Amended 2026-10-11 by the
[launch candidate](../release/launch-candidate.zh-CN.md) (B9, Owner option A): SportsHub and
SportsRiskEngine were removed, GameHub is the only hub and every pool is a Casino pool. The Router,
registry and hub boundaries are unchanged; the SportsHub parts below record the removed design. Sports
would return only as a new implementation with its own ADR, audit and release ([roadmap](../roadmap.md) §4).

## Decision

Bank holds betting principal and liabilities; its LiquidityVault holds NFT deposit capital.
SettlementRouter owns position authorization.
GameHub and SportsHub own their respective domain lifecycles. Hubs never move
bankroll funds directly.

```text
GameHub -> VRFHub -> Chainlink wrapper             (request)
Chainlink wrapper -> VRFHub -> GameHub -> pure module (callback)
GameHub / SportsHub -> SettlementRouter -> Bank -> LiquidityVault
SettlementRouter -> PoolRegistry                  (admission lookup)
SportsHub -> oracle adapters and SportsRiskEngine
```

PoolRegistry assigns each `poolId` one asset, one Bank and one domain. A Bank is
registered to exactly one pool. Multiple pools may use the same asset while keeping
their reserves, NFT deposits and liabilities separate. Governance controls pool activity,
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
game modules compute outcomes without custody. A VRF callback persists the canonical
seed and attempts settlement through the Router, Bank and Vault in the same transaction,
including custody movements and player payment. Failed settlement keeps the same seed
available for retry; terminal state, accounting and acknowledgment are atomic.

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
Tests in `test/unit/PoolRegistry.t.sol`, `test/unit/SettlementRouter.t.sol`
and `test/unit/GameHubE2E.t.sol` exercise these boundaries; the SportsHub suites were removed with SportsHub.
See [SSOT v1.6](../constitution/SSOT.v1.6.md) and
[Executable SSOT v1.6](../constitution/ExecutableSSOT.v1.6.md) for the current contract
rules and acceptance gates.
