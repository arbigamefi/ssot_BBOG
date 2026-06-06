# ADR-0030: Bank observability counters and ERC4626 events

- **Status:** Accepted
- **Date:** 2026-06-06

## Context

ArbiGameFi's current go-to-market strategy is B2C casino/sportsbook first, with
bankroll providers as the decisive supply side. The provider story is not generic
APY marketing. It is an underwriting story:

```text
provider yield ~= realized hold% x capital velocity - costs
capital velocity = turnover / vault TVL
```

The current contracts expose strong point-in-time accounting:

- `Bank.totalAssets()` / `Bank.getSSOT().NAV`
- `Bank.totalReserved()`
- `Bank.totalSupply()`
- `Bank.protocolFeesPayable()`
- `SettlementRouter.nextPositionId()`

Those views are enough for bankroll size, current reserves, share price, current
protocol fees payable, and total position count. They are not enough for a
provider-grade velocity and realized-hold surface because the protocol does not
currently expose lifetime turnover or lifetime payout counters per Bank.

The current `Bank` is also only ERC4626-like. It has ERC20 share `Transfer` and
`Approval` events, but it does not emit standard ERC4626 `Deposit` and
`Withdraw` events. As a result, `/earn` and the durable ledger must reconstruct
provider activity from share mint/burn transfers and matching asset transfers.
That is usable, but it is not a clean vault integration surface for DeFiLlama,
wallets, explorers, or ArbiGameFi's own provider dashboard.

`Bank.maxWithdraw(owner)` also currently exposes the optional-outflow cap without
scoping it to `owner` share balance. That is not ERC4626-compatible and can make
consumer UIs present the Bank-wide withdrawal capacity as if it were the
connected provider's own withdrawable balance.

This decision covers a V14 pre-launch contract release. It does not reopen the
settlement architecture, multi-asset architecture, VRF architecture, or game
module design.

## Decision

For V14, add standard vault events and per-Bank lifetime performance counters.

### 1. Emit ERC4626-standard provider events

`Bank` MUST emit the ERC4626 event pair while preserving existing ERC20 share
`Transfer` semantics.

```solidity
event Deposit(
    address indexed sender,
    address indexed owner,
    uint256 assets,
    uint256 shares
);

event Withdraw(
    address indexed sender,
    address indexed receiver,
    address indexed owner,
    uint256 assets,
    uint256 shares
);
```

Emission rules:

- `deposit(assets, receiver)` emits `Deposit(msg.sender, receiver, assets, shares)`.
- `mint(shares, receiver)` emits `Deposit(msg.sender, receiver, assets, shares)`.
- `withdraw(assets, receiver, owner)` emits `Withdraw(msg.sender, receiver, owner, assets, shares)`.
- `redeem(shares, receiver, owner)` emits `Withdraw(msg.sender, receiver, owner, assets, shares)`.
- Existing share `Transfer` events remain unchanged.

`maxWithdraw(owner)` MUST return `min(optionalOutflowCap, convertToAssets(balanceOf(owner)))`,
not the Bank-wide outflow cap. `maxRedeem(owner)` already uses this owner-scoped
pattern and should remain unchanged.

### 2. Add Bank-level lifetime counters

Each `Bank` is a single-asset risk/accounting domain. Lifetime performance
counters MUST be maintained per Bank, in that Bank's asset units, with no
cross-asset conversion and no oracle dependency.

Recommended storage:

```solidity
uint256 public totalTurnover;            // settled, refund-adjusted wagered amount
uint256 public totalPayoutGross;         // payout before fee-on-payout
uint256 public totalPayoutNet;           // amount paid to players excluding refunds
uint256 public totalRefunded;            // refunded stake amount
uint256 public totalFeeOnPayout;         // payoutGross - payoutNet
uint256 public totalProtocolFeeAccrued;  // lifetime protocol fee accrual
uint256 public totalBetsHeld;
uint256 public totalBetsSettled;
uint256 public totalBetsRefunded;
```

Counter update rules:

- `holdBet(...)` increments `totalBetsHeld`.
- `settleBet(...)` increments:
  - `totalTurnover += stake - refundAmount`
  - `totalPayoutGross += payoutGross`
  - `totalPayoutNet += payoutNet`
  - `totalRefunded += refundAmount`
  - `totalFeeOnPayout += payoutGross - payoutNet`
  - `totalProtocolFeeAccrued += protocolFeeAccrual`
  - `totalBetsSettled += 1`
- `refundBet(...)` increments:
  - `totalRefunded += refundAmount`
  - `totalBetsRefunded += 1`

The turnover definition is intentionally **settled and refund-adjusted**. A
placed bet that is later refunded due to VRF timeout or invalid resolution does
not create provider yield and must not inflate velocity.

### 3. Add one aggregate read method

The UI and SDK SHOULD be able to read the performance surface with one call.
Expose an aggregate view, either as a tuple or an `SSOTTypes` struct.

Recommended interface:

```solidity
function getPerformance()
    external
    view
    returns (
        uint256 totalTurnover,
        uint256 totalPayoutGross,
        uint256 totalPayoutNet,
        uint256 totalRefunded,
        uint256 totalFeeOnPayout,
        uint256 totalProtocolFeeAccrued,
        uint256 totalBetsHeld,
        uint256 totalBetsSettled,
        uint256 totalBetsRefunded
    );
```

### 4. Do not put time-series analytics on-chain

The following remain index responsibilities:

- daily/hourly turnover buckets;
- 7d/30d velocity;
- realized hold% by window;
- drawdown curves;
- per-game volume;
- player count;
- leaderboards;
- retention and cohort metrics.

The chain provides the lifetime counters. The keeper/Postgres layer records
snapshots of those counters and derives windows:

```text
30d velocity = (turnover_now - turnover_30d_ago) / avg_TVL_30d
30d realized hold% = (turnover_delta - payout_net_delta - refunded_delta) / turnover_delta
```

Those derived values must be labeled as indexed or snapshot-derived. Only the
underlying current Bank views and lifetime Bank counters may be labeled
on-chain verifiable.

## Frontend and index consequences

### `/earn`

The provider dashboard should use V14 reads as the trust anchor:

- share price: `totalAssets / totalSupply`;
- TVL / NAV: `totalAssets` or `getSSOT().NAV`;
- current risk: `totalReserved / totalAssets`;
- lifetime turnover: `Bank.totalTurnover`;
- lifetime realized hold: derived from lifetime counters;
- 7d/30d velocity and drawdown: Postgres snapshots of Bank counters.

Provider transaction history should prefer `Deposit` / `Withdraw` events over
share-transfer reconstruction. The existing reconstruction path can remain as a
V13 compatibility fallback only when reading old deployments.

### Homepage

The current homepage may continue to use `SettlementRouter.nextPositionId() - 1`
as a chain-verifiable total bet count. After V14, the stronger provider-facing
metric is per-asset total wagered:

- `Bank.totalTurnover` for each active casino Bank;
- displayed per asset, not summed across assets unless a price oracle or
off-chain quote source is explicitly introduced.

### Casino analytics

Room-level RTP, leaderboards, and daily volume remain indexed surfaces. They
should not be relabeled as on-chain verifiable. V14 counters can add a separate
"Bank lifetime" proof row but should not replace game-specific analytics.

### Durable index

The keeper should record periodic Bank performance snapshots:

- `chainId`
- `poolId`
- `bank`
- `asset`
- `blockNumber`
- `timestamp`
- `totalAssets`
- `totalSupply`
- `totalReserved`
- all V14 performance counters

This gives `/earn` reliable 7d/30d velocity and drawdown without archival RPC
queries.

## Testing and release gates

V14 must add tests for:

1. `Deposit` and `Withdraw` event emission for all four vault entrypoints:
   `deposit`, `mint`, `withdraw`, and `redeem`.
2. `maxWithdraw(owner)` returning the owner-scoped withdrawable amount rather
   than the Bank-wide optional-outflow cap.
3. Counter monotonicity.
4. Refund-adjusted turnover:
   - settled no-refund bet counts full stake;
   - multi-roll stop/refund counts `stake - refundAmount`;
   - full refund counts zero turnover.
5. Multi-asset isolation:
   - USDC Bank counters do not change when WETH Bank settles;
   - WETH Bank counters do not change when USDC Bank settles.
6. Existing solvency invariants:
   - A1-A4 / B3 / debt-out liveness remain unchanged.
7. SDK and ABI integration:
   - `sdk.bank.snapshot` or equivalent exposes the new performance surface.

Release gates:

- regenerate ABI, SDK release metadata, and golden vectors;
- rerun invariant suite and stateful diff suite;
- run Base Sepolia canary with deposit, withdraw, place, finalize, and refund;
- update deployment manifests and release digest;
- do not present V14 counters as including V13 historical activity unless the
  system explicitly displays a V13/V14 split.

## Migration posture

Because these counters are new storage, V14 counters start at zero for the V14
Bank deployment.

Do not add governance setters to backfill historical counters. Mutable backfill
would weaken the "do not trust, verify" story. If V13 historical activity must
be shown, show it as indexed archival history separate from V14 on-chain
counters.

If public LP deposits have not started, the recommended path is to deploy V14
Banks and treat V13 Banks as pre-launch/testnet artifacts. If public LP deposits
exist, a migration plan must define:

- V13 risk-in pause timing;
- withdrawal/redeposit path;
- public notice period;
- V13 archival dashboard;
- V14 pool activation block.

## Consequences

Positive:

- `/earn` gains provider-grade verifiable lifetime turnover and hold anchors.
- Vault integrations gain standard ERC4626 events.
- DeFiLlama and explorer tooling become easier and less error-prone.
- Postgres analytics can derive velocity from chain-counter snapshots instead
  of replaying every historical bet for every chart.

Costs:

- `settleBet` performs several additional `SSTORE`s.
- V14 requires a contract release, delta audit, new release digest, and new
  deployment artifacts.
- Lifetime counters are per-asset and cannot be naively summed across assets.

Non-goals:

- no daily buckets on-chain;
- no global USD turnover on-chain;
- no cross-asset netting;
- no price oracle;
- no subgraph dependency;
- no replacement of the durable Postgres read model.

## Alternatives considered

### Keep everything in Postgres

Rejected as the long-term provider story. Postgres is correct for time-series
and leaderboards, but provider-facing lifetime turnover and vault events are
important enough to anchor in the Bank.

### Add only events, no counters

Better than V13, but incomplete. Events make indexing cleaner, but a direct
contract read cannot prove lifetime turnover or realized hold without replaying
history.

### Add daily buckets on-chain

Rejected. Daily windows and charts are analytics, not settlement truth. They
increase gas and contract complexity without improving custody safety.

### One global protocol-wide counter

Rejected. The protocol is explicitly multi-asset and per-Bank. A global counter
would either mix decimals or require oracle pricing, both of which conflict with
ADR-0012.

## References

- ADR-0002: SSOT accounting identity
- ADR-0012: Multi-asset SSOT via per-asset Banks + single Hub
- ADR-0029: Settlement Router + Vertical Hubs
- `docs/strategy/go-to-market.md` section 5: bankroll-provider playbook
- `docs/migration/refactored-mapping.md`: ERC4626 exact API parity roadmap item
