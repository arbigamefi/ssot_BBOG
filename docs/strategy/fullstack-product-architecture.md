# Fullstack Product Architecture

ArbiGameFi is an unlaunched, single-brand casino and sportsbook project. Contracts enforce custody and settlement; the product serves players, LPs and referrers. Current requirements are in the [constitution](../constitution/SSOT.v1.6.md), [architecture overview](../architecture/overview.md) and [release guide](../release/README.md).

## Boundaries

```text
PoolRegistry / Bank
        |
SettlementRouter
        |
        +-- GameHub -> VRFHub -> casino modules
        +-- SportsHub -> odds and result evidence -> SportsRiskEngine
```

Bank owns asset custody, LP shares, reserves and every payable. Router binds each position to its originating hub and enforces settlement limits. Hubs own their business lifecycle. Casino modules calculate deterministic outcomes from randomness; sports uses independently authorized odds and event evidence. Casino and sports have separate bankrolls and admission requirements.

Casino LPs retain half the turnover house edge; protocol and referral rewards share the other half. Deposits are immediate. Redemption activation prices liquid cash and preserves full historical reserve and recovery rights for all snapshot holders. Old positions charge only their own epoch; later betting and exits use active capital. Both priced liquid claims and historical backing are outside active LP NAV. See the [economic design](economic-design.md).

VRF callbacks only record randomness and readiness. Settlement remains a separate public transaction. Transfer failure can create a fixed player payable; receipts must distinguish that debt from cash delivered.

## Runtime ownership

| Component                     | Responsibility                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `frontend/packages/ssot`      | Current contract ABI, release validation, SDK, parameter encoding and browser index    |
| `frontend/apps/keeper`        | Public finalization, eligible refunds, batch activation and historical-recovery alerts |
| `frontend/packages/bet-index` | Shared durable read model and receipt evidence                                         |
| Web application               | Wallet actions, understandable game and LP states, receipts and recovery               |

Consumers use the generated current ABI. Required state reads fail visibly when RPC reads fail. The chain remains authoritative; caches retain issuing chain, Hub and Bank identity and replace reorged facts atomically. Requests and escrow burns are lifecycle facts, not cash withdrawals.

## Product priorities

The [master plan](project-master-plan.zh-CN.md) owns sequencing; the [GTM plan](go-to-market.md) owns validation work. The complete player path includes rules, cost, authorization, submission uncertainty, terminal state and actual payment. LPs see wallet shares, pending requests, fixed claimable assets, historical recovery and cancellation boundaries separately.

LP exit batches never disable the casino room; active-capital insufficiency and emergency pause are displayed separately. A terminal bet with a player payable shows an outstanding payment and a public claim action; terminalization alone does not mean cash arrived. The site never asks a user to authorize a keeper as their redemption operator.

Sportsbook is a separate release decision. Its rules, data, deadlines, capital and operating evidence must support the accepted ticket lifecycle before admission to an async Bank.

## Complexity budget

Add complexity only for a concrete user task, funds invariant or operating need. Reuse the existing SDK, durable index and transaction journal. Keep the keeper outside the browser because it has independent uptime and funding needs. Keep detailed proofs near contracts and concise explanations in product flows.

The initial scope does not require white-label portals, a protocol token, a subgraph, cross-chain bankrolls or additional games. Expansion follows demonstrated demand and operating capacity. Local tests and a polished interface do not establish production deployment or launch readiness.
