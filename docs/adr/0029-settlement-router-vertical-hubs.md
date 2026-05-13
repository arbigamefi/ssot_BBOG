# ADR-0029: Settlement Router + Vertical Hubs

- **Status:** Proposed
- **Date:** 2026-05-12

## Context

The current protocol is a casino-game SSOT:

- `Bank` custodies one ERC20 asset and maintains accounting buckets.
- `Hub` is the only bet authority for casino-game lifecycle.
- `VRFHub` is randomness transport.
- Game modules are pure deterministic modules over `(randomWords, params, stake)`.

This design is correct for VRF casino games, but it is not sufficient for sportsbook markets.
Sportsbook settlement depends on real-world event data, odds snapshots, market suspension, result
proposal/challenge, void rules, and correlated exposure caps. Those are not pure game-module concerns.

The project has not deployed to mainnet. Therefore, we can still make a foundational change without
preserving mainnet storage compatibility.

Research basis:

- `docs/research/sportsbook-architecture-2026-05.md`

## Decision

Introduce a shared settlement kernel with vertical hubs:

```text
PoolRegistry / Bank(poolId)
        |
SettlementRouter
        |
        +-- GameHub   -> VRFHub -> pure casino modules
        +-- SportsHub -> Odds/Result Oracle adapters -> SportsRiskEngine
        +-- FutureHub -> later verticals
```

The key design rule is:

> Bank owns money and accounting. Router owns settlement authority. Vertical hubs own domain
> lifecycle. No vertical hub should directly transfer bankroll funds.

## New components

### PoolRegistry

`PoolRegistry` replaces `asset -> Bank` as the primary routing registry.

Current `BankRegistry(asset -> Bank)` is not sufficient because casino USDC and sports USDC may need
separate bankrolls, risk limits, LP terms, and pause state.

Recommended storage:

```solidity
enum PoolDomain {
    Unknown,
    Casino,
    Sports,
    Future
}

struct Pool {
    address asset;
    address bank;
    PoolDomain domain;
    bool active;
}

mapping(uint64 => Pool) pools;
mapping(address => bool) registeredHubs;
mapping(uint64 => mapping(address => bool)) hubAllowedForPool;
```

Design constraints:

- `poolId` is the primary risk-domain id.
- Multiple pools may use the same ERC20 asset.
- Each pool binds to exactly one immutable `Bank`.
- A `Bank` belongs to exactly one pool.
- Registering a pool is one-way for production deployments.
- Pausing risk-in must not block debt-out settlement/refund.

### SettlementRouter

`SettlementRouter` is the only caller allowed to invoke Bank's bet-funds API.

Recommended storage:

```solidity
enum PositionState {
    None,
    Held,
    Settled,
    Refunded
}

struct Position {
    address ownerHub;
    uint64 poolId;
    address asset;
    address bank;
    address player;
    uint256 stake;
    uint256 reserved;
    PositionState state;
    bytes32 snapshotHash;
}

uint256 nextPositionId;
mapping(uint256 => Position) positions;
```

Required API:

```solidity
function openPosition(
    uint64 poolId,
    address player,
    uint256 stake,
    uint256 reserved,
    bytes32 snapshotHash
) external returns (uint256 positionId);

function settlePosition(
    uint256 positionId,
    uint256 payoutGross,
    uint256 payoutNet,
    uint256 refundAmount,
    uint256 protocolFeeAccrual,
    SSOTTypes.XPAward[] calldata xpAwards
) external;

function refundPosition(uint256 positionId, uint256 refundAmount) external;
```

Authorization rules:

- Only registered hubs can open positions.
- The opening hub must be allowed for the selected `poolId`.
- Only `position.ownerHub` can settle or refund the position.
- Governance can register pools/hubs and set risk-in pause, but cannot settle arbitrary positions.
- Router must not expose a generic `execute` or arbitrary callback path.

Router responsibilities:

- allocate global `positionId`;
- bind `ownerHub`, `poolId`, `asset`, `bank`, `player`, `stake`, `reserved`, and `snapshotHash`;
- call `Bank.holdBet`, `Bank.settleBet`, and `Bank.refundBet`;
- emit auditable settlement events;
- prevent double settlement/refund;
- preserve debt-out liveness.

Router non-responsibilities:

- no randomness;
- no odds calculation;
- no sports result adjudication;
- no market lifecycle;
- no game parameter parsing;
- no cross-pool netting;
- no custody.

### Bank

`Bank` remains the custody and accounting SSOT.

Required change:

- Replace the trusted `hub` caller with a trusted `settlementRouter` caller.

Recommended interface rename:

```solidity
function settlementRouter() external view returns (address);
function setSettlementRouterOnce(address router) external;
```

The existing `hub()` / `setHubOnce()` vocabulary is removed during the pre-mainnet refactor instead
of being carried forward as misleading compatibility surface.

Bank MUST NOT:

- know whether a position came from casino, sports, or a future vertical;
- parse sportsbook markets, odds, results, or rulebooks;
- allow governance to bypass router settlement;
- merge liabilities across pools.

### GameHub

`GameHub` is the current `Hub` after narrowing its name and role to VRF casino games.

Preserved responsibilities:

- casino game module registry;
- VRF fee quote and request;
- `requestId -> positionId` transport binding;
- random-ready state;
- permissionless finalize/refund;
- referral/pricing snapshots for casino games.

Changed responsibilities:

- `GameHub` calls `SettlementRouter.openPosition(...)` instead of `Bank.holdBet(...)`;
- `positionId` becomes the global casino bet id;
- `GameHub` settles/refunds through `SettlementRouter`;
- `GameHub` no longer needs asset-to-bank lookup; it selects a `poolId`.

Recommended casino placement flow:

1. Player calls `GameHub.placeBet(gameId, poolId, params, stakeSpec, affiliate, maxHouseEdgeBps)`.
2. `GameHub` validates game params and computes worst-case reserve.
3. `GameHub` snapshots pricing/referral/game params.
4. `GameHub` calls `SettlementRouter.openPosition(...)` and receives `positionId`.
5. `GameHub` requests VRF and records `requestId -> positionId`.
6. Anyone finalizes after randomness is ready.
7. `GameHub` resolves the pure module and calls `SettlementRouter.settlePosition(...)`.

### SportsHub

`SportsHub` owns sportsbook market lifecycle.

Initial market states:

```text
Draft -> Open -> Locked -> ResultProposed -> Resolved
              \          \-> Challenged -> Resolved | Voided
               \-> Suspended
               \-> Voided
```

Initial ticket states:

```text
Held -> Settled
     -> Refunded
     -> Voided
```

SportsHub responsibilities:

- event and market registration;
- market open/lock/suspend/void;
- odds snapshot validation;
- ticket creation;
- result proposal/challenge/finality;
- rulebook-hash binding;
- risk-cap checks;
- settlement/refund calls through `SettlementRouter`.

SportsHub MUST NOT:

- custody bankroll funds;
- bypass `SettlementRouter`;
- settle before configured finality/challenge conditions;
- accept stale odds;
- accept tickets after market lock;
- share a casino pool by default.

### SportsRiskEngine

Sports risk must be first-class, not a UI-only rule.

MVP checks:

- max stake per ticket;
- max payout per ticket;
- per-market exposure cap;
- per-outcome exposure cap;
- per-pool/event aggregate cap;
- odds expiry / stale window;
- market suspension override.

The first implementation may be a library or contract, but it must have independent unit tests and
must not depend on frontend enforcement.

### OutcomeOracle

Sports outcomes require an explicit oracle path.

MVP recommendation:

- allowlisted reporter quorum;
- public result proposal;
- challenge delay;
- governance emergency pause;
- final result event.

Production direction:

- replace or augment reporter quorum with a provider-backed or optimistic oracle path.

Every result must bind:

- `eventId`;
- `marketId`;
- `resultPayload`;
- `rulebookHash`;
- `reportedAt`;
- `finalizedAt`;
- reporter/proposer identity.

## MVP scope

The first sportsbook release SHOULD be narrow:

- one ERC20 settlement asset, preferably USDC;
- independent sports pool;
- pre-match only;
- single-leg fixed-odds tickets only;
- no live betting;
- no parlays;
- no player props;
- no futures/outrights;
- no tradable outcome tokens;
- allowlisted market creation;
- signed odds snapshots or Merkle-root odds;
- result reporter quorum with challenge delay.

## Invariants

### Router invariants

- Every held position maps to exactly one pool and one bank.
- `position.bank.totalReserved()` includes active reserved liabilities.
- A position cannot be settled/refunded twice.
- Only `position.ownerHub` can settle/refund.
- Router cannot move funds across `poolId`.
- Governance cannot settle arbitrary user positions.
- Risk-in pause blocks new positions but not eligible settlement/refund.

### GameHub invariants

- VRF request mappings point only to active GameHub positions.
- Random fulfillment never transfers funds directly.
- Finalize/refund remains permissionless.
- Pure modules remain custody-free.
- Casino settlement through router preserves existing Bank accounting invariants.

### SportsHub invariants

- No ticket can be accepted after market lock/start.
- No ticket can be accepted with expired odds.
- No ticket can exceed configured exposure caps.
- No market can settle before finality/challenge conditions.
- A final result is unique per market.
- Voided tickets refund according to the bound rulebook.
- Suspended markets block risk-in but allow eligible debt-out.

## Deployment implications

Because there is no mainnet deployment yet, this ADR recommends a clean pre-mainnet refactor:

- deploy new `PoolRegistry`;
- deploy new `SettlementRouter`;
- deploy `Bank` instances wired to router, not old Hub;
- evolve current `Hub` into `GameHub`;
- do not preserve old `BankRegistry(asset -> Bank)` as production routing authority;
- update deploy scripts and release artifacts to treat `poolId` as first-class.

Existing testnet/release-pack addresses become historical snapshots, not production compatibility
constraints.

## Consequences

Positive:

- Sportsbook expansion does not pollute casino VRF lifecycle.
- Bank remains small and auditable.
- Every vertical settles through one authority path.
- Same-token pool isolation becomes possible.
- Future verticals can be added without granting direct Bank access.

Negative:

- Pre-mainnet refactor is larger than adding a new module.
- Existing tests and docs must migrate from `Hub`/`asset` routing to `GameHub`/`poolId` routing.
- Router introduces a new critical contract requiring dedicated audit coverage.
- Sports still requires off-chain data operations, oracle policy, risk operations, and compliance review.

## Alternatives considered

1. **Sports as another `IGameModule`.**
   - Rejected. Sports outcomes are not VRF-random pure functions and require market/result lifecycle.

2. **Separate standalone sportsbook stack.**
   - Rejected for the first production path. It discards the current Bank/accounting proof work and
     duplicates settlement surface.

3. **Keep `asset -> Bank` only.**
   - Rejected. It cannot isolate casino USDC and sports USDC risk domains.

4. **Let every vertical call Bank directly.**
   - Rejected. This recreates a multi-authority settlement surface and weakens auditability.

## Acceptance

- ADR accepted by maintainers.
- Milestone plan exists for implementation steps.
- SSOT v1.3 draft defines router/pool/vertical-hub invariants.
- No mainnet deployment proceeds before the router/pool decision is resolved.

## Links

- Research: `docs/research/sportsbook-architecture-2026-05.md`
- SSOT v1.3 draft: `docs/constitution/SSOT.v1.3.md`
- Executable SSOT v1.3 draft: `docs/constitution/ExecutableSSOT.v1.3.md`
- Architecture overview: `docs/architecture/overview.md`
- Current multi-game ADR: `docs/adr/0011-multi-game-expansion-without-new-trust-surface.md`
- Current multi-asset ADR: `docs/adr/0012-multi-asset-banks-single-hub.md`
