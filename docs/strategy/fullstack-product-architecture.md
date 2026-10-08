# Fullstack Product Architecture

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

ArbiGameFi is an unlaunched, single-brand casino and sportsbook project. Contracts enforce custody and settlement; the product serves players, LPs and referrers. Current requirements are in the [constitution](../constitution/SSOT.v1.6.md), [architecture overview](../architecture/overview.md) and [release guide](../release/README.md).

## Boundaries

```text
PoolRegistry / Bank <-> LiquidityVault (ERC-721 + LiquidityTree)
        |
SettlementRouter
        |
        +-- GameHub -> VRFHub -> casino modules
        +-- SportsHub -> odds and result evidence -> SportsRiskEngine
```

LiquidityVault owns LP custody, NFT deposit records and tree equity. Its fixed Bank holds bettor principal, reserves and payables, and snapshots the last deposit ID per bet. Router binds each position to its originating hub and enforces settlement limits. Hubs own their business lifecycle. Casino modules calculate deterministic outcomes from randomness; sports uses independently authorized odds and event evidence. Casino and sports have separate bankrolls and admission requirements.

Casino's turnover-edge split remains 50% for LP economics, with protocol/referral allocation from
the other half. Each addition mints a fresh NFT with a fixed 24-hour lock. Mature owner-only partial
withdrawal relocks its remaining value; full withdrawal burns the NFT and transfer keeps its deadline.
L is tree capital, K=R-P the net lock and G=L+P the betting basis. NFT withdrawal is limited by its
node value and L-K, not an extra buffer or final-share restriction. Bet P&L normally targets the
opening deposit-ID prefix; insufficient loss capacity or an empty profit prefix triggers whole-tree
fallback. Zero-root profit becomes protocol capital. See the [economic design](economic-design.md).

VRFHub directly consumes the wrapper, stores canonical randomness and attempts GameHub settlement in that transaction. Failure preserves the same result for public retry; an unbooked recorded result blocks LP operations in that pool. This does not establish protection against transaction ordering before fulfillment reaches the chain. Transfer failure can create a player payable; receipts must distinguish that debt from cash delivered.

## Runtime ownership

| Component                     | Responsibility                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `frontend/packages/ssot`      | Current contract ABI, release validation, SDK, parameter encoding and browser index |
| `frontend/apps/keeper`        | Exception finalization, eligible refunds, payables, WS events and HTTP catch-up     |
| `frontend/packages/bet-index` | Shared durable read model and receipt evidence                                      |
| Web application               | Wallet actions, understandable game and LP states, receipts and recovery            |

Consumers use the generated current ABI. Required state reads fail visibly when RPC reads fail. The chain remains authoritative; caches retain issuing chain, Hub and Bank identity and replace reorged facts atomically. Only a successful withdrawal receipt establishes an LP cash payment. Previewed equity or an unsuccessful transaction is not a withdrawal.

## Product priorities

The [master plan](project-master-plan.zh-CN.md) owns sequencing; the [GTM plan](go-to-market.md) owns validation work. The complete player path includes rules, cost, authorization, submission uncertainty, terminal state and actual payment. LPs see each owned NFT, its node value, 24-hour deadline and current free-capital limit. NFT transfers are ownership facts, not cash deposits; player debt remains separate. No unified share-price or historical recovery panel remains.

Ordinary LP withdrawals do not disable the casino room; capital insufficiency, an LP-only recorded-result fence and emergency pause are displayed separately. A terminal bet with a player payable shows an outstanding payment and a public claim action; terminalization alone does not mean cash arrived. Keeper has no LP withdrawal authority. NFT approvals may transfer ownership and are never requested for the official withdrawal flow.

Sportsbook is a separate release decision. Its rules, data, deadlines, capital and operating evidence must support the accepted ticket lifecycle before admission. Public real-world results may precede on-chain loss accounting; Sports LP valuation and ordering protections require separate validation and cannot inherit the casino VRF fence by assumption.

## Complexity budget

Add complexity only for a concrete user task, funds invariant or operating need. Reuse the existing SDK, durable index and transaction journal. Keep the keeper outside the browser because it has independent uptime and funding needs. Keep detailed proofs near contracts and concise explanations in product flows.

The initial scope does not require white-label portals, a protocol token, a subgraph, cross-chain bankrolls or additional games. Expansion follows demonstrated demand and operating capacity. Local tests and a polished interface do not establish production deployment or launch readiness.
