# ADR-0032: Fixed LP share; operator-funded referrals

Status: Accepted. Current prelaunch implementation.

LPs receive a fixed half of the turnover edge. The operator half funds referral awards and protocol fees.

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
`O = floor(E × (10000 − LP_SHARE_BPS) / 10000)`. LPs retain `E − O` in gameplay accounting;
it must not be charged a second time as gameplay PF or XP. Active capital, ordinary liquid exits
and historical recovery follow ADR-0034/0035. The virtual-capital residual defined there is a distinct
capital-accounting credit, not additional turnover edge or gameplay fee accrual.

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
- **Downstream changes:** the indexer, receipts, pools page, affiliate dashboard, fact table, both
  whitepapers and the economic design must describe this allocation before any public claim uses it.

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

## References

- [Executable SSOT v1.6](../constitution/ExecutableSSOT.v1.6.md)
- `src/core/GameHub.sol` (`finalize`, `setActiveReferralConfig`), `src/engines/referral/DefaultReferralEngine.sol`
- `test/unit/HouseEdgeAllocationV16.t.sol`, `test/unit/SettlementRouter.t.sol`, `test/unit/GameHubE2E.t.sol`
- [Stake: affiliate commission](https://help.stake.com/en/articles/9995651-how-to-get-an-affiliate-commission-with-stake),
  [Stake: rakeback](https://help.stake.com/en/articles/4821738-what-is-rakeback),
  [Azuro: reward distribution](https://dev-gem.azuro.org/knowledge-hub/how-azuro-works/reward-distribution),
  BetSwirl revenue distribution (documentation.betswirl.com; read through search extracts, 2026-09-26)
