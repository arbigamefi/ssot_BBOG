# Sportsbook Architecture Research (2026-05)

- **Status:** Research / non-normative
- **Date:** 2026-05-12
- **Scope:** Whether the current casino-game SSOT architecture should be extended to support on-chain sports betting, and what production architecture should be preferred before mainnet deployment.

## Executive verdict

The current project should **not** implement sports betting as another `IGameModule` inside the current VRF `Hub`.

The best production direction is:

```text
PoolRegistry / Bank(poolId)
        |
SettlementRouter
        |
        +-- GameHub   -> VRFHub -> pure casino modules
        +-- SportsHub -> Odds/Result Oracle adapters -> RiskEngine
        +-- FutureHub -> later verticals
```

This is **not** a full rewrite. The project should reuse the current SSOT discipline, Bank accounting model, proof strategy, debt-out liveness rules, and risk-in pause semantics. But sports betting needs a separate lifecycle because it depends on real-world event data, mutable odds, market suspension, void rules, result proposal/challenge, and per-market exposure caps.

The first sports version should use an **independent sports pool**, not shared casino liquidity. Shared liquidity across casino and sports is a later optimization after the sportsbook risk engine has live data, formal caps, and audit coverage.

## Why this research was necessary

The existing architecture was designed for casino games:

- `Hub` owns the bet lifecycle.
- `VRFHub` provides randomness transport.
- Game modules are pure functions over `(randomWords, params, stake)`.
- `Bank` holds, settles, and refunds based on a reserved worst-case payout.

Real sports betting is different:

- A sport result is not knowable from on-chain randomness.
- Odds move before the event starts and must be snapshotted at acceptance.
- Markets need `open`, `locked`, `suspended`, `voided`, and disputed states.
- Settlement rules differ by sport and market type.
- Risk is not only per bet; it is correlated by event, market, side, parlay leg, and data latency.

Therefore "pure on-chain sports betting" must mean **on-chain custody, market state, risk accounting, and settlement**, not "no oracle". A real-world sports result requires an oracle, a signer quorum, or an optimistic dispute mechanism.

## Industry patterns reviewed

### 1. Azuro: pool plus betting-engine architecture

Azuro is the closest public reference to the proposed `Bank -> SettlementRouter -> SportsHub` direction.

Relevant public docs:

- [Azuro docs home](https://gem.azuro.org/)
- [Azuro Pools](https://gem.azuro.org/knowledge-hub/how-azuro-works/components/pools)
- [Azuro Betting Engines](https://gem.azuro.org/knowledge-hub/how-azuro-works/components/betting-engines)
- [Azuro Data Providers](https://gem.azuro.org/knowledge-hub/how-azuro-works/protocol-actors/data-providers)
- [Azuro Contracts FAQ](https://gem.azuro.org/knowledge-hub/faqs/contracts)

Observed design:

- A Pool is a system of contracts forming a unified betting platform.
- A Pool owner can plug in multiple Betting Engines.
- Betting Engines handle conditions, bet acceptance, payout computation, and app rewards.
- Data Providers create/cancel events and update odds.
- Reinforcement represents maximum potential loss for a condition.
- LiquidityTree tracks virtual fund balance changes across prediction markets and booked liquidity.
- vAMM adjusts on-chain odds on top of pushed sell-side odds.

Implication for this repo:

- Our current `Bank` is analogous to the custody/accounting side, but it is keyed by asset. Sports requires a `poolId` layer because casino-USDC and sports-USDC may need separate risk pools even when the token is the same.
- A thin `SettlementRouter` is justified: Azuro's separation between pool liquidity and plugged-in betting engines supports the same direction.
- Sports market logic should live in a vertical engine/hub, not in the shared bankroll contract.

### 2. Overtime: on-chain sportsbook AMM with odds feeds and risk caps

Overtime is the strongest public reference for a full sportsbook product.

Relevant public docs:

- [How Overtime Works](https://docs.overtime.io/learn-about-overtime/how-overtime-works)
- [Overtime AMM and Liquidity Mechanics](https://docs.overtime.io/learn-about-overtime/overtime-amm-and-liquidity-mechanics)
- [Market Creation and Trading](https://docs.overtime.io/learn-about-overtime/market-creation-and-trading)
- [Onchain Market Settlement](https://docs.overtime.io/learn-about-overtime/onchain-market-settlement)
- [About Odds Providers](https://docs.overtime.io/learn-about-overtime/about-odds-providers)
- [Sports Trading Guidelines](https://docs.overtime.io/learn-about-overtime/sports-trading-guidelines)
- [Overtime Smart Contract Architecture](https://docs.overtime.io/overtimes-smart-contract-architecture)

Observed design:

- Pool-vs-peer liquidity: LPs back the AMM and take the house side at portfolio level.
- Odds oracles provide real-time pricing.
- Per-market open-interest/risk caps stop the AMM from taking unlimited directional exposure.
- Overtime V2 uses Merkle roots to push game/odds data efficiently.
- Chainlink nodes/results feeds are used for sports market result verification.
- Market rules explicitly handle voids, walkovers, abandonments, start-time windows, pushes, corrections, and rule precedence.
- Settlement is mostly automatic but still acknowledges that niche markets can require review.

Implication for this repo:

- SportsHub needs first-class market state, odds snapshotting, stale-odds protection, and risk limits.
- A sports rulebook is not a UI document; it is settlement-critical protocol metadata. Each market should bind to a rulebook hash/version.
- Live betting, parlays, player props, and futures should be out of MVP scope because they multiply oracle latency and correlated-risk complexity.

### 3. SX Bet: peer-to-peer exchange and escrow model

SX Bet represents the exchange route rather than the house-pool route.

Relevant public docs:

- [How SX Bet Works](https://learn.sx.bet/developers/how-sx-bet-works)
- [SX Bet Developer Hub](https://docs.sx.bet/developers/introduction)
- [SX Bet API](https://learn.sx.bet/developers/api)
- [SX Bet overview](https://docs.sx.bet/user-guides/getting-started/overview)
- [SX Bet real-time data](https://docs.sx.bet/developers/real-time)

Observed design:

- Users bet against other users, not against a house pool.
- Markets are registered with sport, league, teams, start time, and market type.
- Matched orders move assets atomically into escrow.
- Outcome reporting supports `Outcome1`, `Outcome2`, and `Void`.
- The public developer surface emphasizes API access, orderbook data, real-time updates, market makers, takers, and order signing.

Implication for this repo:

- A P2P exchange would reduce bankroll directional risk but requires a matching/orderbook/market-maker product from day one.
- It is a different product than the current casino bankroll model.
- It is not the fastest extension of this repo unless the goal shifts from "casino + sportsbook backed by protocol liquidity" to "sports prediction exchange".

### 4. Polymarket / UMA: generalized prediction-market model

Polymarket is useful for event-market resolution design, but it is not the closest match for sportsbook UX.

Relevant public docs:

- [Polymarket 101](https://docs.polymarket.com/polymarket-101)
- [Polymarket CLOB overview](https://docs.polymarket.com/trading/overview)
- [Polymarket Conditional Token Framework](https://docs.polymarket.com/trading/ctf/overview)
- [Polymarket + UMA](https://legacy-docs.polymarket.com/polymarket-+-uma)
- [UMA oracle overview](https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work)
- [UMA custom bond and liveness parameters](https://docs.uma.xyz/developers/setting-custom-bond-and-liveness-parameters)

Observed design:

- Users trade outcome tokens in a peer-to-peer CLOB.
- Orders are signed off-chain and settle atomically on-chain.
- Outcome shares are ERC1155 conditional tokens backed by collateral.
- UMA-style resolution uses proposer bonds, challenge windows, disputes, and DVM escalation.

Implication for this repo:

- UMA's optimistic lifecycle is a strong pattern for disputed sports results.
- CTF outcome tokens are powerful for secondary-market trading, but they are probably too large a jump for this project's first sportsbook MVP.
- The first product should be fixed-odds tickets, not fully tokenized outcome shares, unless the business goal becomes prediction-market trading.

### 5. Betfair: off-chain exchange benchmark

Betfair is not on-chain, but it is the canonical exchange benchmark for market data, orderbooks, and professional trading UX.

Relevant public docs:

- [Betfair Exchange API](https://developer.betfair.com/exchange-api/)
- [Betfair API licence requirements](https://support.developer.betfair.com/hc/en-us/articles/360002464152-Which-API-Licence-Do-I-Require)

Observed design:

- The API exposes market navigation, odds/volume retrieval, bet placement, account operations, and streaming market/order updates.
- Access is tied to KYC-verified Betfair accounts and licensing categories.

Implication for this repo:

- If the project chooses the P2P exchange route, data/API reliability and market-maker workflows become core protocol/product requirements.
- Even exchange-style betting is not "just contracts"; it needs identity, licensing, market data, and operator controls.

## Market size, saturation, and business viability

### Source-quality note

Market numbers in gambling are easy to misread. This document distinguishes:

- **Handle / wager volume:** total amount bet or traded.
- **GGR / gross gaming revenue:** player losses before operator costs.
- **Net gaming revenue / operator revenue:** after promotional deductions or other adjustments.
- **Protocol fees / pool profits:** on-chain fee or LP-profit definitions, often not comparable to GGR.
- **Prediction-market trading volume:** notional matched trades, not the same as sportsbook handle.

The most decision-useful sources are public-company filings, official industry associations, protocol docs/APIs, and chain-indexed data. Crypto casino reports and media estimates are useful for trend direction, but should be treated as lower-confidence unless independently audited.

### 1. Addressable market is large, but not evenly reachable

Sports betting is a large global market. H2 Gambling Capital estimates cited in Super Group's 2025 Form 20-F project global online sports betting GGR from **$110.1B in 2025** to **$151.7B in 2028**.

The U.S. regulated market is already material. AGA reported 2025 U.S. commercial sports betting revenue of **$16.96B** on **$166.94B** handle. That implies an industry-level GGR/handle ratio of roughly **10.2%** before operator-specific promotional, tax, payment, affiliate, data, and operating costs.

This does **not** mean a new on-chain product can access that market directly. In the U.S., state licensing, market-access agreements, responsible-gaming obligations, KYC/age gating, taxes, and federal-vs-state prediction-market disputes determine what can actually be served.

### 2. Traditional sportsbook is not saturated in revenue, but generic entry is saturated

The market is still growing, but the generic "new sportsbook app" wedge is weak.

Evidence:

- FanDuel reported a **41% U.S. sportsbook GGR market share** in Q4 2025.
- DraftKings reported **$53.6B sportsbook handle** and **7.1% sportsbook net revenue margin** for 2025.
- DraftKings' 2025 sales and marketing expense was about **$1.4B**, with advertising cost above **$1.1B**.
- ESPN Bet, Barstool Sportsbook, SI Sportsbook, Fox Bet, and MaximBet are public examples that media distribution alone did not beat FanDuel/DraftKings entrenchment.

Conclusion:

- The market is not "finished", but a commodity sportsbook is a bad startup entry point.
- Competing head-to-head with FanDuel/DraftKings on U.S. retail acquisition requires massive marketing, licensing, payment, and compliance spend.
- A crypto-native project should not try to win by being "same sportsbook, but on-chain".

### 3. Crypto casino and GambleFi are large, but source quality varies

Crypto casino demand is real, but public numbers are less standardized than regulated sportsbook data.

Useful signals:

- SOFTSWISS' 2024 State of Crypto report, based on more than 500 iGaming brands in its dataset, says total bet sum grew **35.9%** in 2024; fiat bet sum grew **40.1%**; crypto bet sum grew **18.7%**; crypto bet count declined **12.8%**; average crypto bet size rose **1.4x**; altcoins reached nearly half of crypto wagers.
- Surgence Labs' 2026 crypto casino report cites crypto gambling GGR of **$81.4B in 2024** and names Stake.com as the category benchmark with **$4.7B GGR** and **127M monthly visits**. Cointelegraph reported similar figures while attributing the underlying crypto-casino GGR estimate to Yield Sec / Financial Times reporting.
- These crypto casino figures are directionally important, but they are not as clean as U.S. regulated handle/revenue data because operator-level reporting, jurisdiction scope, gray-market traffic, and "crypto casino" definitions vary.

Implication:

- The casino market validates demand for wallet/stablecoin-native gambling.
- But a new protocol should not copy Stake/Rollbit as a pure consumer casino unless it has a serious distribution wedge.
- This repo's stronger wedge is still provable custody, bankroll accounting, and settlement rails, not celebrity/streamer-driven user acquisition.

### 4. Prediction markets are the high-growth disruption layer

Prediction markets have shown far larger recent trading-volume velocity than chain-native sportsbooks.

As of the DeFi Rate update on **2026-05-12**, Polymarket international volume showed:

- **2026-03:** about **$12.22B** monthly trading volume.
- **2026-04:** about **$9.14B** monthly trading volume.
- **2026-05 month-to-date:** about **$690.9M**.
- Sports category volume peaked at about **$4.58B** in March 2026 and **$3.03B** in April 2026.
- Weekly Polymarket volume remained around **$1.96B-$1.98B** for the weeks ending 2026-05-03 and 2026-05-10.

These numbers are **not directly comparable** to sportsbook handle:

- Polymarket is taker notional trading volume, not house handle.
- Kalshi and Polymarket count volume differently.
- Open interest, fee revenue, wash trading, market-making churn, and user PnL must be analyzed separately.
- Sports markets can have higher artificial-volume risk than slower event categories.

Still, prediction markets show a clear demand signal: users want liquid, tradable, real-world event markets, and sports is one of the biggest categories.

### 5. Pure on-chain sportsbook protocols are still early and subscale

Compared with regulated sportsbooks and Polymarket/Kalshi, fully on-chain sportsbook protocols remain early.

Indicative public data:

- Azuro research sources report cumulative volume in the **hundreds of millions of dollars**, with tens of thousands of users and many frontends/apps. DeFiLlama's 2026-05-12 snapshot showed Azuro TVL around **$0.94M** and all-time tracked pool-profit/revenue around **$5.61M** under its methodology.
- Azuro's official Graph API exposes live bet history. A direct 2026-05-12 sample across the documented V3 endpoints showed Polygon V3 at roughly **658 bets / 107 bettors / 46,962 token units** over the prior 24 hours and roughly **5,324 bets / 251 bettors / 476,780 token units** over the prior 7 days. This is an operational sample, not a full audited USD volume report.
- Overtime's official docs emphasize product depth: pool-vs-peer AMM, odds oracles, open-interest caps, singles, parlays, SGPs, live markets, futures, and player props across Optimism, Arbitrum, and Base. DeFiLlama's 2026-05-12 snapshot showed Overtime TVL around **$1.74M**, tracked 30-day fees around **$104k**, and all-time tracked fees around **$1.28M** under its methodology.
- SX Bet is exchange-like rather than pool-vs-peer. DeFiLlama's 2026-05-12 dimension snapshot showed about **$2.10M** 24h DEX volume and about **$1.14M** 24h open interest under its indexed methodology, while its TVL endpoint showed a stale latest TVL point around **$0.64M**.

Conclusion:

- The chain-native sportsbook segment is **not saturated**.
- The real bottlenecks are not Solidity alone; they are liquidity, odds quality, oracle reliability, UX, compliance, and distribution.
- There is room for a well-designed protocol, but the winning wedge must be differentiated.

## Differentiation strategy

The project should avoid these weak positions:

- "No KYC sportsbook" as the main brand promise.
- "Polymarket clone for sports".
- "Overtime/Azuro clone with fewer markets and worse liquidity".
- "Same odds as centralized books, but with gas and wallet friction".

Stronger wedges:

1. **Provable bankroll and settlement**
   - Make LP NAV, reserved liability, max payout, exposure caps, and every settlement event reconstructible on-chain.
   - This aligns with the current SSOT advantage.

2. **B2B/on-chain sportsbook rails**
   - Let third-party frontends, communities, games, and wallets plug into shared settlement and liquidity.
   - This is closer to Azuro's infrastructure direction than a pure consumer sportsbook.

3. **Transparent risk engine**
   - Public per-market exposure, per-outcome cap, stale-odds windows, and rulebook hashes.
   - Most users cannot inspect centralized bookmaker risk controls.

4. **Niche markets before broad sports parity**
   - Start with markets where crypto-native distribution is plausible: esports, combat sports, creator/community events, crypto-adjacent competitions, and selected major sports markets.
   - Competing on every NFL/NBA market from day one forces comparison with mature books.

5. **Oracle/dispute transparency**
   - Result proposals, challenge windows, rulebook versions, and settlement proofs should be user-visible.
   - This can differentiate from both opaque sportsbooks and ambiguous prediction-market disputes.

6. **Composable tickets**
   - Once MVP is stable, tickets can become transferable positions or collateralizable claims.
   - Do not start here; add it after core settlement/risk is proven.

## Investment and operating cost estimate

### Lean on-chain MVP

Expected scope:

- `SettlementRouter` refactor;
- independent sports pool;
- `SportsHub` for pre-match fixed-odds singles;
- signed odds snapshots or Merkle-root odds;
- allowlisted result reporter quorum plus challenge delay;
- basic risk caps;
- indexer/API/frontend;
- one external audit pass.

Indicative effort:

- 3-6 months.
- 2-4 smart contract engineers.
- 1 backend/indexing engineer.
- 1 frontend engineer.
- 1 odds/risk operator or consultant.
- 1 product/operator.
- legal/compliance review before any real-money launch.

Indicative cash need excluding bankroll:

- Low six figures for a tight internal prototype.
- Mid six figures to low seven figures for a production MVP with audit, monitoring, frontend, oracle/data integration, and legal review.

### Production sportsbook

Expected additions:

- professional odds/data provider;
- production oracle integration;
- compliance stack;
- responsible-gaming controls;
- market/risk operations;
- customer support;
- affiliate/referral operations;
- security monitoring;
- repeated audits.

Indicative cash need excluding bankroll:

- Low seven figures for a lean crypto-native launch.
- Multiple millions if pursuing regulated jurisdictions, high-volume sports coverage, live betting, or paid acquisition.
- Tens of millions or more if attempting a mainstream U.S. consumer sportsbook.

### Liquidity / bankroll

Practical minimums:

- **<$500k:** usable only for tests, very small limits, or closed beta.
- **$500k-$2M:** narrow MVP with small to moderate pre-match limits.
- **$5M-$20M+:** needed for broader market coverage and credible limits.
- Shared casino/sports liquidity should wait until sports risk has live evidence.

## Profit-space model

Sports betting economics are volume-sensitive.

Useful simple model:

```text
GGR = handle * hold
protocol gross revenue = handle * protocol take
net contribution = protocol gross revenue
                 - LP share
                 - oracle/data cost
                 - affiliates/referrals
                 - incentives/bonuses
                 - chain/indexing/ops
                 - compliance/legal/tax where applicable
```

Reference points:

- U.S. regulated sports betting in 2025: roughly **10.2% GGR/handle** at industry level from AGA data.
- DraftKings 2025 sportsbook net revenue margin: **7.1%**.
- Azuro research cited an average protocol take rate around **2.27%** in one 2024 Messari snapshot, while another DappRadar ecosystem report cited **4.28%** for a different period/scope.

For this project, a realistic early assumption is:

- protocol take: **1%-4% of handle**;
- LP expected yield: paid from embedded margin but volatile;
- net protocol margin after LP share, data, incentives, ops, and compliance: materially lower than gross take.

Example:

- $10M monthly handle at 3% protocol take = $300k gross protocol revenue before costs and LP economics.
- $1M monthly handle at 3% protocol take = $30k gross protocol revenue, likely not enough for a full professional operation.
- $100M monthly handle at 2% protocol take = $2M gross protocol revenue, but requires serious liquidity, odds, distribution, and risk operations.

Therefore the business is attractive only if the product can reach meaningful recurring handle without buying users at sportsbook-level CAC.

## Saturation verdict

The practical answer:

- **Traditional regulated sportsbook:** large and growing, but generic entry is saturated by distribution, licenses, and marketing economics.
- **Prediction markets:** not saturated; extremely active; but regulatory treatment and volume quality are unresolved.
- **Pure on-chain sportsbook rails:** not saturated; still early; the opportunity is real, but current leaders remain much smaller than Polymarket/Kalshi and traditional books.
- **This repo's opportunity:** strongest as transparent on-chain settlement/liquidity infrastructure plus a narrow sportsbook MVP, not as a direct DraftKings/FanDuel consumer clone.

The recommended bet is to build a differentiated protocol wedge first, prove real handle and LP economics in a narrow market, then expand market types. The wrong move is to overbuild a complete sportsbook before proving distribution and risk economics.

## Regulatory and responsible-gaming constraints

Relevant public sources:

- [AGA State of Play Map](https://www.americangaming.org/research/state-of-play-map/)
- [AGA Responsible Play](https://americangaming.org/responsibility/responsible-play/)
- [AGA Sports Event Contracts](https://americangaming.org/sports-event-contracts/?mod=article_inline)

Sports betting is a regulated product, not merely a DeFi primitive. For any US-facing deployment, the production system should assume:

- jurisdiction gating and legal review are launch blockers;
- KYC/age verification and sanctions controls may be required;
- responsible gaming controls are not optional product polish;
- marketing the activity as "investment" rather than gambling is a regulatory and consumer-protection risk;
- prediction-market framing does not automatically avoid sports-betting regulation.

This document does not provide legal advice. It records that production architecture must reserve room for compliance gates before deposits, bet placement, withdrawals, affiliate rewards, and front-end access.

## Architecture options

### Option A: put sports into current `Hub` as another game module

This is rejected.

Pros:

- Fastest surface-level implementation.
- Reuses current `Hub.placeBet` and `Bank.holdBet` paths.

Cons:

- Violates the current module assumption that outcomes are pure deterministic functions of randomness and params.
- Forces real-world oracle state into a VRF lifecycle.
- Cannot model market lock/suspension/result/challenge/void cleanly.
- Correlates casino and sports risk without an explicit risk engine.
- Makes the current invariant suite misleading because a "bet" is no longer one lifecycle type.

### Option B: full standalone sportsbook architecture

This is rejected for now.

Pros:

- Cleanest domain model.
- Avoids coupling with casino code.

Cons:

- Throws away the already-audited SSOT accounting, reserve, pause, and debt-out model.
- Doubles audit surface.
- Makes protocol liquidity and LP story fragmented.
- Slows mainnet readiness when the current project has not yet deployed.

### Option C: shared settlement kernel with vertical hubs

This is recommended.

Pros:

- Reuses the strongest part of the current repo: custody/accounting invariants.
- Keeps casino games simple through `GameHub + VRFHub + pure modules`.
- Lets sports have its own market lifecycle through `SportsHub`.
- Allows future verticals without giving every vertical direct `Bank` authority.
- Keeps a global position namespace and one settlement authority path.

Cons:

- Requires pre-mainnet refactor: `Bank` currently trusts one `hub`; it should trust `SettlementRouter`.
- Requires new invariants around router authorization and pool isolation.
- Requires a `poolId` model, not only `asset -> Bank`, if same-token pools need separate risk domains.

## Recommended target architecture

### Core contracts

#### `PoolRegistry`

Maps `poolId -> Bank` and records pool metadata:

- settlement asset;
- risk domain (`CASINO`, `SPORTS`, future vertical);
- active / risk-in paused status;
- allowed hubs;
- optional operator/compliance policy hooks.

This supersedes or extends the current `BankRegistry(asset -> Bank)` because sports and casino may both use USDC but should not necessarily share LP risk.

#### `Bank`

Keep the Bank focused on custody/accounting:

- LP shares and NAV;
- protocol fees and external payables;
- reserve accounting;
- debt-out liveness;
- optional outflows constrained by solvency.

Change the trusted caller from `Hub` to `SettlementRouter`. Bank should not parse game params, sports markets, odds, or result rules.

#### `SettlementRouter`

The router should be deliberately boring.

Responsibilities:

- allocate global `positionId`;
- record `ownerHub`, `poolId`, `asset`, `bank`, `player`, `stake`, `reserved`, `snapshotHash`, and state;
- call `Bank.holdBet`, `Bank.settleBet`, and `Bank.refundBet`;
- enforce "only registered hub can open";
- enforce "only owner hub can settle/refund/void";
- expose queryable settlement facts.

Non-responsibilities:

- no randomness;
- no odds calculation;
- no sports result adjudication;
- no market state machine;
- no arbitrary external execution;
- no generic plugin callback;
- no cross-pool netting.

#### `GameHub`

This is the current `Hub` evolved/renamed for casino games:

- VRF lifecycle;
- pure casino module registry;
- pricing/referral snapshots;
- finalize/refund liveness.

`GameHub` opens and settles positions through `SettlementRouter`, not directly through `Bank`.

#### `SportsHub`

SportsHub owns the sportsbook lifecycle:

- event and market registration;
- odds snapshot validation;
- market open/lock/suspend/void;
- ticket creation;
- result proposal/challenge;
- settlement rule application;
- calls `SettlementRouter` for hold/settle/refund.

SportsHub should not custody funds and should not directly transfer LP assets.

#### `SportsRiskEngine`

First-class risk logic:

- per-market and per-outcome exposure caps;
- per-event aggregate exposure;
- per-league/sport limits;
- max stake / max payout;
- stale-odds windows;
- signer/oracle health controls;
- cap release on settle/void/refund.

This can begin as a library or separate contract, but it must be testable independently.

#### `OutcomeOracle`

Sports result intake should be explicit and replaceable:

- MVP: allowlisted reporter quorum plus delay and emergency pause.
- Production: oracle provider integration or optimistic oracle with proposer bond, challenge period, and escalation path.

Every result should bind to:

- event id;
- market id;
- result payload;
- data source / signer set;
- timestamp;
- rulebook version;
- finality window.

## SportsHub lifecycle

### Market states

```text
Draft -> Open -> Locked -> ResultProposed -> Resolved
              \          \-> Challenged -> Resolved | Voided
               \-> Suspended
               \-> Voided
```

Required semantics:

- `Draft`: market exists but cannot accept tickets.
- `Open`: tickets can be accepted if odds snapshots are valid and risk caps allow.
- `Locked`: no new tickets; normally reached at event start or on data-risk trigger.
- `Suspended`: temporary no-risk-in state; debt-out remains live.
- `ResultProposed`: result is visible but not necessarily final.
- `Challenged`: dispute path active.
- `Resolved`: winning tickets can be settled.
- `Voided`: tickets refund according to rulebook.

### Ticket states

```text
Held -> Settled
     -> Refunded
     -> Voided
```

Ticket metadata should include:

- `marketId`;
- `outcomeId`;
- stake;
- decimal/implied odds snapshot;
- max payout;
- reserve amount;
- odds version or Merkle root;
- market version;
- rulebook hash;
- acceptance timestamp and expiry.

## MVP recommendation

The first sportsbook release should be deliberately narrow:

- USDC only.
- Independent sports pool.
- Pre-match only.
- Singles only.
- Fixed odds only.
- Moneyline / two-way totals / simple spread.
- No live betting.
- No parlays.
- No player props.
- No futures/outrights.
- No CTF outcome-token secondary market.
- Allowlisted market creation.
- Signed odds snapshots with short expiry, or Merkle-root odds pushes.
- Result oracle via allowlisted quorum plus challenge delay, then upgraded to an optimistic or provider-backed oracle.

This is the smallest shape that proves the core sportsbook system without importing the hardest parts of Overtime/SX/Polymarket all at once.

## Data and oracle requirements

### Odds intake

SportsHub must protect against stale or replayed odds:

- odds payload signed by authorized signer set or proven under a current Merkle root;
- odds include `marketId`, `marketVersion`, `outcomeId`, `price`, `maxPayout`, `expiresAt`, and `nonce`;
- user call includes max acceptable price/slippage and deadline;
- market is rejected if suspended, locked, stale, or over cap.

### Result intake

Result payloads need stricter finality than odds:

- result proposal must be public;
- challenge period must be explicit;
- disputed results cannot settle until resolved;
- rulebook hash must determine void/push semantics;
- corrections after finality should be impossible or restricted to a governance/emergency path with time delay and clear audit trail.

### Indexing and APIs

Even when settlement is on-chain, a sportsbook needs off-chain services:

- market discovery;
- odds rendering;
- event schedules;
- ticket history;
- oracle proposal/challenge monitoring;
- risk dashboard;
- LP exposure dashboard;
- responsible-gaming and compliance checks.

This is normal. The production goal is not "no backend"; it is "backend cannot secretly change custody or settlement facts."

## Invariant additions

Router-level invariants:

- For every active position, `position.bank.totalReserved()` includes the reserved amount.
- Only `ownerHub` can settle/refund/void a position.
- A position cannot be settled/refunded twice.
- Router cannot move value across poolIds.
- Debt-out operations remain callable under risk-in pause.

SportsHub-level invariants:

- No ticket can be accepted after market lock/start.
- No ticket can be accepted with expired odds.
- No ticket can exceed market/outcome/event exposure caps.
- Sum of active reserved payout liability per pool is bounded by Bank reserves/NAV policy.
- A result cannot settle before challenge/finality conditions are met.
- Void refunds cannot pay more than the held stake plus explicitly allowed rulebook terms.
- Suspended markets cannot accept new tickets but must allow settlement/refund when eligible.

Oracle-level invariants:

- Each market result has at most one final result.
- Disputed result cannot become final without the configured path.
- Result payload must match the bound event/market/rulebook version.
- Emergency actions are time-delayed, evented, and cannot seize user funds.

## Product and deployment sequencing

### Phase 1: architecture ADR and SSOT v1.3

Write a normative ADR and SSOT update for:

- `PoolRegistry`;
- `SettlementRouter`;
- vertical hubs;
- poolId isolation;
- router authorization;
- sports lifecycle boundaries.

### Phase 2: router refactor

Before mainnet deployment:

- change `Bank` trusted caller from `Hub` to `SettlementRouter`;
- rename/evolve current `Hub` into `GameHub`;
- preserve all existing casino tests through adapter/refactor;
- add router authorization and pool isolation tests.

### Phase 3: SportsHub MVP

Implement minimal pre-match fixed-odds singles:

- market registry;
- signed odds snapshot or Merkle root;
- risk caps;
- ticket lifecycle;
- result proposal/finality/void;
- USDC sports pool.

### Phase 4: production hardening

Add:

- oracle provider integration or optimistic oracle;
- monitoring and runbooks;
- challenge/dispute UI;
- compliance and responsible-gaming gates;
- external audit focused on router, sports market lifecycle, oracle, and risk caps.

### Phase 5: advanced products

Only after MVP has evidence:

- parlays;
- live betting;
- futures;
- player props;
- shared liquidity between casino and sports;
- CTF-like tradable outcome tokens;
- P2P exchange/orderbook.

## Best-practice decision

Given the project has not deployed to mainnet yet, the best practice is:

1. Refactor now to a thin `SettlementRouter` and vertical-hub architecture.
2. Preserve the current casino architecture as `GameHub + VRFHub + pure modules`.
3. Add `poolId` before sports, because `asset -> Bank` is not enough for same-token risk isolation.
4. Build `SportsHub` separately from `GameHub`.
5. Launch sports with an independent bankroll and narrow fixed-odds pre-match scope.
6. Treat oracle/risk/compliance as launch-critical systems, not later product polish.

The resulting design follows the strongest pattern seen in Azuro and Overtime while avoiding the product jump required by SX Bet or Polymarket-style exchanges.

## Source index

- Azuro: [docs home](https://gem.azuro.org/), [Pools](https://gem.azuro.org/knowledge-hub/how-azuro-works/components/pools), [Betting Engines](https://gem.azuro.org/knowledge-hub/how-azuro-works/components/betting-engines), [Data Providers](https://gem.azuro.org/knowledge-hub/how-azuro-works/protocol-actors/data-providers), [Contracts FAQ](https://gem.azuro.org/knowledge-hub/faqs/contracts)
- Overtime: [How Overtime Works](https://docs.overtime.io/learn-about-overtime/how-overtime-works), [AMM and liquidity](https://docs.overtime.io/learn-about-overtime/overtime-amm-and-liquidity-mechanics), [Market creation](https://docs.overtime.io/learn-about-overtime/market-creation-and-trading), [Settlement](https://docs.overtime.io/learn-about-overtime/onchain-market-settlement), [Odds providers](https://docs.overtime.io/learn-about-overtime/about-odds-providers), [Trading guidelines](https://docs.overtime.io/learn-about-overtime/sports-trading-guidelines), [Smart contract architecture](https://docs.overtime.io/overtimes-smart-contract-architecture)
- SX Bet: [How SX Bet Works](https://learn.sx.bet/developers/how-sx-bet-works), [Developer Hub](https://docs.sx.bet/developers/introduction), [API](https://learn.sx.bet/developers/api), [Overview](https://docs.sx.bet/user-guides/getting-started/overview), [Real-time data](https://docs.sx.bet/developers/real-time)
- Polymarket / UMA: [Polymarket 101](https://docs.polymarket.com/polymarket-101), [CLOB overview](https://docs.polymarket.com/trading/overview), [CTF overview](https://docs.polymarket.com/trading/ctf/overview), [Polymarket + UMA](https://legacy-docs.polymarket.com/polymarket-+-uma), [UMA oracle overview](https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work), [UMA bond/liveness parameters](https://docs.uma.xyz/developers/setting-custom-bond-and-liveness-parameters)
- Betfair: [Exchange API](https://developer.betfair.com/exchange-api/), [API licence requirements](https://support.developer.betfair.com/hc/en-us/articles/360002464152-Which-API-Licence-Do-I-Require)
- Regulation / responsible gaming: [AGA State of Play](https://www.americangaming.org/research/state-of-play-map/), [AGA Responsible Play](https://americangaming.org/responsibility/responsible-play/), [AGA Sports Event Contracts](https://americangaming.org/sports-event-contracts/?mod=article_inline)
- Market size and public-company economics: [AGA 2025 commercial gaming revenue](https://www.americangaming.org/commercial-gaming-revenue-hits-78-7-billion-in-2025-driving-record-18-1-billion-in-gaming-taxes-nationwide/), [AGA Commercial Gaming Revenue Tracker](https://www.americangaming.org/resources/commercial-gaming-revenue-tracker/), [Super Group 2025 Form 20-F](https://s205.q4cdn.com/195659402/files/doc_financials/2025/ar/Super-Group-SGHC-Limited-20-F-Annual-and-Transition-Report-foreign-private-issuer.pdf), [Flutter Q4 2025 earnings release](https://flutter.com/media/hdshhrmb/q4-2025-earnings-release.pdf), [DraftKings 2025 10-K summary mirror](https://www.stocktitan.net/sec-filings/DKNG/10-k-draft-kings-inc-files-annual-report-da6122a78a0b.html)
- Crypto casino / GambleFi: [SOFTSWISS State of Crypto 2024](https://www.softswiss.com/news/state-of-crypto-2024/), [Surgence Labs Crypto Casino Industry Report 2026](https://surgence.io/blog/crypto-casino), [Cointelegraph on Yield Sec / FT crypto casino estimates](https://cointelegraph.com/news/crypto-casino-revenue-81-billion-2024)
- Prediction-market activity: [DeFi Rate Polymarket volume tracker](https://defirate.com/prediction-markets/volume/polymarket/), [Dune prediction markets dashboard](https://dune.com/datadashboards/prediction-markets), [AP on sports prediction markets](https://apnews.com/article/kalshi-polymarket-nfl-nba-mlb-nhl-663ec7f5da78aeed7d7c145bb9cb65ca), [MoneyWeek prediction-market overview](https://moneyweek.com/trading/the-rise-and-risks-of-prediction-markets)
- On-chain data surfaces: [Azuro Graph API](https://gem.azuro.org/hub/apps/APIs/graph), [Azuro Dune dashboards](https://dune.com/azuro/stats), [Overtime API docs](https://docs.overtime.io/overtime-v2-integration/overtime-v2-markets), [DeFiLlama API](https://api.llama.fi/)
