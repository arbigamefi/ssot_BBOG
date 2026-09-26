# ADR-0032: Fixed LP share of the turnover house edge; operator-funded referrals

- **Status:** Accepted. Implemented in source (see [Implementation](#implementation)); not audited or deployed
- **Date:** 2026-09-26
- **Applies to:** the next casino release unit built on [SSOT v1.6](../constitution/SSOT.v1.6.md).
  Deployed v1.5 contracts are immutable and keep their current allocation.
- **Supersedes, for that release unit:** the fee-accrual clause of [ADR-0007](0007-fee-on-payout-house-edge.md),
  the non-budget rule of [ADR-0008](0008-skyline-pricing-and-delta-budget.md), and SSOT v1.0 section 3.3.2.
  It also supersedes the allocation model drafted in [economic design](../strategy/economic-design.md) sections 1–2.

## Context

**v1.5 gives LPs no share of the house edge.** At finalize, GameHub computes the turnover edge
`E = usedTurnover × houseEdgeBps / 10000` and accrues all of it as liabilities:

```solidity
protocolFeeAccrual = nonBudgetBase + nonBudgetDelta + planB.sink + planD.sink; // rest of E is XP
```

The fee withheld from winning payouts stays in the Bank, but for fair modules its expectation equals
`E`, so the two cancel. LPs carry the variance of game results with zero expected share of the edge
([repository review](../audit/RepositoryReview-2026-09-25.zh-CN.md) finding R01). On Base mainnet at
block 51799339 the USDC Bank had accrued protocol fees of exactly 2.000% of used turnover, with no
referral liabilities.

**No configuration fixes this.** `baseBudgetBps`, `levelBps` and `levels` only move value between
protocol fees (PF) and referral liabilities (XP). A configuration with `levels = 0` would leave the budget
in the pool, but `setActiveReferralConfig` rejects it. All of this was pinned against the v1.5 source by
`test/unit/HouseEdgeAllocationV15.t.sol` at commit `efb83e0a4`. The test was removed when the source moved
to v1.6.

**The intent never reached a specification.** The owner's design intent was an explicit split in which
LPs keep a share. The predecessor protocol (`bankroll_protocol_refactored_v0.7.x`) let LPs keep the whole
edge only while the referral program was disabled; enabling referrals sent everything to the protocol and
referrers. SSOT v1.0 removed the disabled-program path, although the migration mapping aimed for "same
economics". No version split the edge three ways.

**Industry practice points the same way.** Capital providers receive an explicit share: BetSwirl allocates
fixed rates to its Bank, and Azuro gives LPs 20% of pool profit and loss. Affiliate commissions are
wager-based and independent of outcomes; Stake pays `house edge × wagered / 2 × commission rate`. Player
rakeback is a share of the house edge; Stake pays 3.5% after a US$10,000 wagering threshold. Operators, not
capital providers, fund acquisition.

## Decision

### 1. One allocation base: the turnover edge

For every settled casino position, with `U = stake − refundAmount` and the effective edge `h_e`
snapshotted when the bet was accepted:

```text
E   = floor(U × h_e / 10000)
E_b = floor(U × h_b / 10000)     base edge, h_b = snapshotted base edge
E_Δ = E − E_b                    affiliate markup part, zero while markup is disabled
```

Allocation is accrued at settlement whether the player wins or loses. A pure refund allocates nothing.

### 2. LPs keep a fixed half

`LP_SHARE_BPS = 5000` is a constant of the release unit. The operator budget is
`O = floor(E × (10000 − LP_SHARE_BPS) / 10000)`. LPs retain `E − O`, which is never accrued as a
liability, so it stays in `NAV = B − PF − XP`.

### 3. Referrals are funded from the operator budget

Rates are basis points of `E_b`:

| Level | Payee                   | Condition                                                 | Initial rate |
| ----- | ----------------------- | --------------------------------------------------------- | -----------: |
| L0    | the player (rakeback)   | the player had a bound referrer when the bet was accepted |         1000 |
| L1    | the player's referrer   | the referrer exists                                       |         2000 |
| L2    | the referrer's referrer | that address exists                                       |          500 |

`L0 + L1 + L2 ≤ MAX_REFERRAL_BPS = 3500` is a constant. Referral depth is capped at L2. A missing payee or
a rounding remainder is not paid to anyone else; it becomes protocol fees.

### 4. The protocol keeps the rest of the operator budget

```text
PF_new = O − R0 − R1 − R2 − M
```

`R0`, `R1`, `R2` are the referral amounts actually accrued and `M` is the markup payout (section 5). With the
constants above the protocol keeps at least 15% of `E_b`, and 50% of `E` from players without a referrer.

### 5. Affiliate markup stays possible but starts disabled

The skyline markup from ADR-0008 is retained so it can be enabled later without a new release unit. At
deployment `maxAffiliateDeltaBps = 0`, which makes `h_e = h_b`. If governance enables it, LPs still retain
`E − O` of the full edge including markup. The operator part of the markup,
`floor(E_Δ × (10000 − LP_SHARE_BPS) / 10000)`, is paid to the skyline payees in proportion to their
increments, and any unallocated amount becomes protocol fees.

### 6. The settlement boundary enforces the LP share

The hub computes the split (through its referral engine); the SettlementRouter enforces the LP floor without
trusting it. The Router
stores `h_e` when a position is opened, bounded by the constant `MAX_HOUSE_EDGE_BPS = 500`, and on
settlement requires:

```text
protocolFeeAccrual + Σ(new XP: accrued + locked + holdback) ≤ floor(floor(U × h_e / 10000) × 5000 / 10000)
```

A buggy or malicious hub therefore cannot take more than the operator half.

### 7. Parameters and governance

| Parameter                                                | Adjustable       | Rule                                                                                             |
| -------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `LP_SHARE_BPS`, `MAX_REFERRAL_BPS`, `MAX_HOUSE_EDGE_BPS` | No               | Constants; changing them requires a new release unit                                             |
| Base edge `h_b`                                          | Yes, by the Safe | Takes effect no earlier than 7 days after it is queued                                           |
| `maxAffiliateDeltaBps`                                   | Yes, by the Safe | Raising it takes effect no earlier than 7 days after it is queued                                |
| L0 / L1 / L2 rates                                       | Yes, by the Safe | New versioned configuration; `L0 + L1 + L2 ≤ 3500`; effective for bets accepted after activation |

Every bet snapshots the configuration it was accepted under. Changes never apply to accepted bets.

### 8. Scope

This ADR covers casino-domain positions. Sports tickets accrue nothing through the Router today and must
not accrue protocol or referral liabilities in a v1.6 unit until a separate ADR defines sports allocation.

## Consequences

- **LPs** expect 50% of the theoretical edge: at `h_b = 2%`, 1.0% of used turnover. They still bear the
  variance of game results. This is not a return guarantee.
- **The protocol** receives between 15% of `E_b` (fully referred traffic) and 50% of `E` (no referrer). At
  2% this is 0.3%–1.0% of used turnover, which must cover keeper gas and fixed operating costs. It sets a
  minimum economic bet size.
- **Players** with a referrer see an effective edge of 1.8% at the initial rates. A player who refers
  themselves through extra wallets can recover the whole 35% cap, an effective edge of 1.3%. That is
  accepted as the maximum discount and does not touch the LP share.
- **Referrers** earn predictable, outcome-independent commissions, comparable to wager-based industry
  programs.
- **Implementation** needs a new release unit: GameHub allocation, a SettlementRouter `openPosition` that
  records `h_e` and enforces the cap, an allocation event, and LP migration. At the time of writing the only
  LP in the v1.5 mainnet pool is the deployer, holding 6 USDC.
- **Downstream changes:** the indexer, receipts, pools page, affiliate dashboard, fact table, both
  whitepapers and the economic design must describe this allocation before any public claim uses it.

## Implementation

The source implements this decision for the next release unit. The deployed v1.5 contracts are unchanged.

| Part | Where |
| --- | --- |
| Constants and the shared `turnoverEdge` / `operatorShare` arithmetic | `src/libs/HouseEdgeLib.sol` |
| Payee snapshot, schedules, delayed edge changes (`queueEdgeChange`, `activateEdgeChange`, `cancelEdgeChange`), `HouseEdgeAllocated` event | `src/core/GameHub.sol` |
| The allocation (`E`, `O`, `R0`–`R2`, markup, protocol fee) and the XP awards that pay it | `DefaultReferralEngine.allocate` in `src/engines/referral/DefaultReferralEngine.sol` |
| Edge recorded at `openPosition`; settlement cap; `allocationCap` view | `src/core/SettlementRouter.sol` |
| Sports positions opened with edge `0` | `src/core/SportsHub.sol` |
| Obligations A1–A9, B1–B2, G1–G4 | [ExecutableSSOT v1.6](../constitution/ExecutableSSOT.v1.6.md#test-mapping) |

Choices the decision above left open:

- Activation of a queued base-edge change or markup-cap increase is permissionless once the delay has
  passed. Only governance can queue or cancel.
- A markup-cap decrease also discards any queued increase.
- A stored affiliate edge is clamped to the current cap when a bet is priced, so lowering the cap or the
  base edge takes effect for new bets without affiliates having to act.
- Referral payees are stored per bet and included in the bet's snapshot hash. Only L1 and L2 are
  stored; L0 eligibility is "L1 is set".
- XP awards carry the reasons `REF_L0`, `REF_L1`, `REF_L2` and `REF_MARKUP`.
- The Router exposes `allocationCap(positionId, refundAmount)` so indexers and auditors can check each
  settlement against the cap.
- The allocation arithmetic lives in the referral engine rather than GameHub. GameHub was already at the
  EIP-170 code-size limit: the deployed v1.5 GameHub is 24,455 of 24,576 bytes, and computing the allocation
  inline took it to 25,686. With the engine doing the arithmetic, GameHub is 23,978 bytes.
  `test/unit/ContractSizes.t.sol` checks every contract the deploy script deploys, because Forge's test EVM
  does not enforce the limit. Further growth of GameHub needs a split.

## Alternatives considered

- **Allocate the actual payout fee instead of turnover** (the economic design draft). Expectations are the
  same, the Bank could verify it from `payoutGross − payoutNet`, and players would see a single fee
  concept. Rejected: protocol and referral income would arrive only on rounds with a payout, in proportion
  to what players win. That is lumpy and runs against wager-based industry norms. The turnover rule remains
  enforceable once the Router records `h_e`.
- **Unclaimed referral shares stay with LPs.** Rejected: LPs do not control acquisition spending, and a
  fixed LP share is simpler to state and verify. The operator funds acquisition, as operators do elsewhere.
- **No protocol fee.** Rejected: the protocol has per-bet and fixed costs, including keeper gas and RPC and
  infrastructure plans.
- **An adjustable LP share with a floor.** Rejected for simplicity and for LP certainty.
- **Referral depth up to six levels.** Rejected: two tiers is standard for affiliate programs, and deeper
  structures carry multi-level-marketing regulatory risk.
- **Reconfigure v1.5.** Not possible: `PF + XP = E` by construction, and the only configuration that would
  retain value in the pool cannot be activated.

## References

- SSOT v1.0 section 3.3; [SSOT v1.6](../constitution/SSOT.v1.6.md) (draft);
  [Executable SSOT v1.6](../constitution/ExecutableSSOT.v1.6.md) (draft invariants)
- `src/core/GameHub.sol` (`finalize`, `setActiveReferralConfig`), `src/engines/referral/DefaultReferralEngine.sol`
- `test/unit/HouseEdgeAllocationV16.t.sol`, `test/unit/SettlementRouter.t.sol`, `test/unit/GameHubE2E.t.sol`,
  `test/diff/StatefulSystemDiff.t.sol`; the v1.5 baseline `test/unit/HouseEdgeAllocationV15.t.sol` at `efb83e0a4`
- [Stake: affiliate commission](https://help.stake.com/en/articles/9995651-how-to-get-an-affiliate-commission-with-stake),
  [Stake: rakeback](https://help.stake.com/en/articles/4821738-what-is-rakeback),
  [Azuro: reward distribution](https://dev-gem.azuro.org/knowledge-hub/how-azuro-works/reward-distribution),
  BetSwirl revenue distribution (documentation.betswirl.com; read through search extracts, 2026-09-26)
