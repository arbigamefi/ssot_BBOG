# Protocol Constitution (SSOT) v1.3 — SettlementRouter + Vertical Hubs

This document is **normative draft** until ADR-0029 is accepted. Keywords **MUST / MUST NOT / SHOULD /
MAY** are used as defined in RFC 2119.

v1.3 extends v1.2 by replacing direct `Hub -> Bank` settlement authority with a shared
`SettlementRouter` and by introducing `poolId` as the primary risk/accounting domain. All v1.2
obligations remain in force unless explicitly superseded here.

## 0. Additive axioms (v1.3)

9. **PoolId is the risk/accounting domain:** a protocol position MUST bind to exactly one `poolId`, and
   that pool MUST bind to exactly one immutable `Bank`. Multiple pools MAY use the same ERC20 asset, but
   their accounting, reserves, LP shares, pause state, and liabilities MUST remain isolated.

10. **Router-only Bank settlement:** `Bank.holdBet`, `Bank.settleBet`, and `Bank.refundBet` MUST be
    callable only by `SettlementRouter`. A vertical hub MUST NOT call Bank settlement functions directly.

11. **Vertical hubs own domain lifecycle:** `GameHub`, `SportsHub`, and future hubs MAY decide whether
    and when a position is opened, settled, or refunded for their domain, but they MUST route all money
    movement through `SettlementRouter`.

12. **Owner-hub settlement:** only the hub that opened a position MAY settle or refund that position.
    Governance MUST NOT have an arbitrary user-position settlement power.

13. **No cross-pool netting:** a position opened in pool `p` MUST NOT be settled, refunded, reserved, or
    made solvent using pool `q`.

14. **Debt-out liveness across router:** risk-in pause MAY block new positions, deposits, and optional
    outflows, but it MUST NOT block eligible settlement, refund, or other debt-out operations.

15. **Domain purity:** casino games MUST remain pure VRF modules. Sportsbook market state, odds, result
    oracle, challenge, and void logic MUST live in `SportsHub` or its explicit support contracts, not in
    casino game modules.

## 1. Pool model

### 1.1 Pool registry

The protocol MUST expose a governance-controlled pool registry with at least:

- `poolId`;
- settlement `asset`;
- `Bank`;
- pool domain (`Casino`, `Sports`, or future domain);
- active/risk-in status;
- allowed vertical hubs.

The registry MUST NOT custody user funds.

### 1.2 Same-asset isolation

The protocol MAY register multiple pools for the same ERC20 asset. Each such pool MUST use a distinct
Bank and MUST be proven independently solvent.

Example:

- `poolId = 1`: USDC casino pool
- `poolId = 2`: USDC sports pool

These pools share token denomination but MUST NOT share reserves, LP shares, NAV, protocol fees, or XP
liabilities.

## 2. SettlementRouter model

### 2.1 Position identity

`SettlementRouter` MUST allocate a global `positionId` for every opened position.

Each position MUST snapshot:

- owner hub;
- pool id;
- asset;
- Bank;
- player;
- stake;
- reserved liability;
- snapshot hash;
- lifecycle state.

### 2.2 Opening positions

A position MAY be opened only if:

- caller is a registered hub;
- caller is allowed for the selected pool;
- pool is active for risk-in;
- the selected Bank matches the pool registry;
- Bank hold succeeds.

### 2.3 Settling and refunding

Settlement and refund MUST:

- be callable only by the recorded owner hub;
- move the position to a terminal state;
- prevent double settlement/refund;
- call only the position's recorded Bank;
- preserve Bank's existing accounting obligations.

## 3. Casino GameHub model

The current VRF casino Hub becomes `GameHub`.

`GameHub` MUST:

- accept `poolId` instead of raw `asset` for new casino bets;
- validate pure module params and reserve bounds before opening a router position;
- bind VRF requests to `positionId`;
- keep finalize/refund permissionless;
- settle/refund through `SettlementRouter`;
- preserve v1.2 VRF fee and refundCredit obligations.

`GameHub` MUST NOT:

- parse sports market data;
- settle real-world event outcomes;
- bypass router settlement.

## 4. SportsHub model

SportsHub is out of scope for the initial router refactor but its boundary is normative.

SportsHub MUST:

- use an independent sports pool for the first release;
- bind every ticket to market id, outcome id, odds snapshot, rulebook hash, and result/finality state;
- reject stale odds;
- reject tickets after market lock;
- enforce exposure caps before opening a position;
- settle/refund only through `SettlementRouter`.

SportsHub MUST NOT:

- use VRF randomness as the source of real-world sports outcomes;
- share the casino pool in the MVP;
- rely on frontend-only risk checks.

## 5. Backward-compatibility stance

Because the protocol has not deployed to mainnet, v1.3 SHOULD be implemented as a clean pre-mainnet
refactor:

- remove misleading `hub()` vocabulary from Bank in favor of `settlementRouter()`;
- treat existing testnet addresses and release artifacts as historical;
- update deployment artifacts to include PoolRegistry, SettlementRouter, GameHub, VRFHub, and pool map.

## Links

- ADR-0029: `docs/adr/0029-settlement-router-vertical-hubs.md`
- Research: `docs/research/sportsbook-architecture-2026-05.md`
- Executable SSOT v1.3: `docs/constitution/ExecutableSSOT.v1.3.md`
