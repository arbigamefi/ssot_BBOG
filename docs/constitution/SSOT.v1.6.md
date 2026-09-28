# Protocol Constitution — Current implementation

**Development status:** the project is not launched. This is the only supported contract model.
The current release identifier is v1.6. The rules below and
[ADR-0034](../adr/0034-async-lp-redemption-continuous-betting.md) and
[ADR-0035](../adr/0035-recovery-rights-without-exit-blocking.md) define deposits, redemptions and recovery rights.
Keywords MUST, MUST NOT, SHOULD and MAY have their RFC 2119 meanings.

## Core accounting and authority

- Each PoolRegistry pool binds to one immutable asset, Bank and domain. Multiple pools may use the
  same asset; reserves, shares, fees and liabilities MUST stay isolated by Bank.
- Only SettlementRouter may open, settle or refund Bank positions. The Router records the owner Hub,
  pool, Bank, player, stake, reserve and snapshot hash; only the owner Hub may terminate a position.
- GameHub owns casino lifecycles, SportsHub owns sports lifecycles, and game modules are pure functions.
  The registry and router MUST NOT custody pool assets. Contracts have no proxy upgrade path.
- Let B be the Bank token balance, PF protocol fees, XP referral liabilities, EP priced LP exits,
  PP player payables and P historical recovery backing. `NAV = B - PF - XP - EP - PP - P = totalAssets()`
  denotes active capital. `getSSOT().R = activeReserved()`; `totalReserved()` reports all held reserves.
  Cash MUST cover fixed liabilities and all held reserves; active NAV MUST cover active reserves.
- New risk requires `NAV - activeReserved_after >= floor(NAV * riskReserveBps / 10000)`.
  Optional PF/XP outflows use active capital's withdrawal buffer. Historical recovery backing and fixed
  liabilities MUST NOT back new bets or active shares.
- Governance or guardian may pause; only governance may unpause. Pause blocks deposits, LP claims,
  batch activation and optional outflows. It MUST NOT block valid settlement, refunds,
  player-payable claims or request/cancellation operations specified by ADR-0034.

## Deposits, redemptions and player debt

- Deposit/mint use active NAV/supply, virtual-offset conversion and directional rounding. New
  depositors share current-epoch risk but MUST NOT acquire previously frozen recovery rights.
- A queued request transfers current rights to its controller, remains cancellable until actual
  activation and joins the same queue after eligibility. Requests and cancellations cannot change
  earlier epochs' ownership. Bank/zero controllers and external share transfers/mints to Bank are invalid.
- LP operations MUST NOT independently stop adequately funded betting. Old unresolved epochs MUST NOT
  gate later activation or cash claims. There is one waiting queue and no global cap on open epochs.
- Activation freezes N, S and the current epoch's whole R0, segregates R0, prices liquid cash, burns
  queued Q once and advances the epoch. Every old hold belongs to exactly one epoch. Settlement MUST
  NOT loop over epochs or holders; share history uses the pinned OpenZeppelin checkpoints.
- Let `L=N-R0` and `G(x)=min(floor(S*(x+V)/(S+V)),x)`. Liquid batch assets are `floor(Q*G(L)/S)`.
  Old terminal cost C and remaining reserve R give `D=R0-C-R`, `H=G(L+D)-G(L)`, `U=D-H`.
  Every snapshot holder owns cumulative `floor(holderUnits*H/S)` recovery, minus prior claims.
  Completed positions can release recovery even while another position in that epoch remains open.
- Full reserve isolation, cumulative allocation, explicit virtual residuals and final dust follow
  ADR-0035. Protocol capital residuals MUST be separate from gameplay fee accrual; new LP NAV MUST NOT
  receive historical recovery or a full-exit residual. All-real-share exit cannot extinguish old rights.
- Bank MUST check combined terminal cost <= position reserve and hold reserve >= stake. Cost includes
  payoutNet, refund, PF and every XP bucket, whether paid or recorded as player debt. Later claims
  MUST NOT charge the epoch again. Historical backing and fixed liabilities cannot fund new risk.
- Ordinary liquid claims retain ERC-7540 controller/operator authorization and rounding rules;
  recovery claims are a separate per-epoch extension. Views and bookkeeping agree, sync is permissionless
  and idempotent, and failed payments preserve entitlements. Claims never repeat the activation burn.
- A failed player transfer books debt without invalidating the terminal position. Anyone may trigger
  its claim, including during pause, but assets go only to the player. Valid winners are not voided
  to enable an LP exit. The application MUST NOT ask for keeper operator approval.

## Casino lifecycle and randomness

- Casino bets follow `Held -> PendingVRF -> RandomReady -> Settled`, or an eligible refund path.
  The player is the payer. Stake, payout cap, pricing, payees and fees are snapshotted at acceptance.
- `amountPerRoll * betCount` is the stake. Multi-roll stop conditions refund unused stake and charge
  house edge only on used turnover. Canonical RNG expansion is implemented once in `src/libs/RNG.sol`.
- VRFHub transports randomness and supports detachment. Unknown/detached requests are ignored;
  downstream callback failures are caught. Fulfillment is not an unconditional no-revert promise.
- Native VRF charges, credits and adapter refunds MUST conserve value. Public eligible timeout
  refunds and admitted modules' finalization paths provide recovery; a valid winner is not voided
  to unblock a batch. Sports admission needs independent bounded terminal-path acceptance.
- Modules share validate/maxPayout/resolve interfaces. Inputs use only current typed encodings;
  roulette uses `(uint8 kind, uint40 payload)`. No raw historical payload formats are supported.

## Referral liabilities

- The registry uses first-touch binding, bounded anti-cycle checking and no rebinding. Pricing and
  payees are resolved at bet acceptance. Later governance or referral changes are non-retroactive.
- XP is the sum of accrued, locked and holdback buckets. Unlocking and vesting move liabilities
  between buckets without changing NAV. Claims pay the entitled address through the Bank's checks.
- Current edge allocation, referral caps and markup constraints follow below. LPs retain a fixed
  50% share of the turnover edge; governance cannot change that share.

## 1. Definitions

All amounts are in the smallest unit of the pool asset. All rates are basis points (bps). `floor` is
integer division.

| Symbol       | Meaning                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| `S`          | stake escrowed for the position                                                               |
| `Q`          | unused stake refunded at settlement, `0 ≤ Q ≤ S`                                              |
| `U`          | used turnover, `U = S − Q`                                                                    |
| `h_b`        | base house edge snapshotted at acceptance                                                     |
| `h_e`        | effective house edge snapshotted at acceptance, `h_e = h_b + Δ`, `Δ ≥ 0` the affiliate markup |
| `E`          | turnover edge, `floor(U × h_e / 10000)`                                                       |
| `E_b`        | base turnover edge, `floor(U × h_b / 10000)`                                                  |
| `E_Δ`        | markup turnover edge, `E − E_b`                                                               |
| `O`          | operator share, `floor(E × (10000 − LP_SHARE_BPS) / 10000)`                                   |
| `R0, R1, R2` | referral amounts accrued to L0, L1, L2                                                        |
| `M`          | markup amounts accrued to skyline payees                                                      |
| `PF_new`     | protocol fees accrued at settlement                                                           |
| `XP_new`     | all new referral liabilities: accrued + locked + holdback, including `R0 + R1 + R2 + M`       |

Constants of the release unit:

| Constant             |  Value |
| -------------------- | -----: |
| `LP_SHARE_BPS`       |   5000 |
| `MAX_REFERRAL_BPS`   |   3500 |
| `MAX_HOUSE_EDGE_BPS` |    500 |
| `EDGE_CHANGE_DELAY`  | 7 days |

## 2. Allocation at settlement

When a casino position settles through `finalize`, the hub (in the reference implementation, through its
referral engine) MUST compute, in this order:

1. `E`, `E_b`, `E_Δ` from `U` and the snapshotted `h_b`, `h_e`.
2. `O = floor(E × (10000 − LP_SHARE_BPS) / 10000)`.
3. Referral amounts from the snapshotted schedule `(l0, l1, l2)` and snapshotted payees:
   - `R0 = floor(E_b × l0 / 10000)` if the player had a bound referrer at acceptance, else `0`; paid to the player.
   - `R1 = floor(E_b × l1 / 10000)` if the L1 payee exists, else `0`.
   - `R2 = floor(E_b × l2 / 10000)` if the L2 payee exists, else `0`.
4. Markup amounts per section 4. They are `0` while markup is disabled.
5. `PF_new = O − R0 − R1 − R2 − M`.

LPs retain `E − O` in gameplay accounting. That amount MUST NOT be accrued again as gameplay PF or XP.
Capital ownership, ordinary exit liabilities and historical recovery backing follow ADR-0035. Its virtual
capital residuals are a separate capital-accounting source and MUST NOT inflate gameplay fee counters.

`PF_new ≥ 0` always holds, because `R0 + R1 + R2 ≤ floor(E_b × MAX_REFERRAL_BPS / 10000) ≤ floor(E_b / 2)`,
`M ≤ floor(E_Δ / 2)` and `O ≥ floor(E_b / 2) + floor(E_Δ / 2)`.

The fee withheld from a winning payout (`payoutGross − payoutNet`, ADR-0007) applies to players. It stays in the Bank and is part of the game result LPs bear. It is not a second allocation base.

A position that ends in a pure refund, including a VRF timeout refund, MUST allocate nothing:
`E = PF_new = XP_new = 0`.

## 3. Referral rules

- The referral schedule MUST have at most three entries: L0 (player rakeback), L1 (direct referrer), L2 (the
  referrer's referrer). Deeper levels MUST NOT be paid.
- `l0 + l1 + l2 ≤ MAX_REFERRAL_BPS` MUST be validated when a schedule is created.
- Payees MUST be resolved from bindings that existed when the bet was accepted, and the hub MUST snapshot
  them with the bet. A binding made after acceptance MUST NOT change that bet's allocation.
- L0 MUST be paid only when the player had a bound referrer at acceptance. A player without a referrer
  receives no rakeback.
- A missing L1 or L2 payee, and every rounding remainder, MUST accrue to `PF_new`. It MUST NOT be
  redistributed to other payees and MUST NOT be retained by LPs beyond `E − O`.
- `R0` accrues as immediately claimable XP to the player. `R1` and `R2` follow the existing XP bucket rules
  of ADR-0005: turnover-gated eligibility, holdback and linear vesting.
- The referral registry keeps first-touch binding and its anti-cycle check. Self-referral through additional
  wallets cannot be prevented on-chain; the cap `MAX_REFERRAL_BPS` bounds its effect.

## 4. Affiliate markup

- The skyline markup of ADR-0008 MAY be retained. At deployment `maxAffiliateDeltaBps` MUST be `0`, which
  forces `h_e = h_b` and `M = 0`.
- If markup is enabled, the player's `maxHouseEdgeBps` check at placement continues to apply, and `h_e` MUST
  NOT exceed `MAX_HOUSE_EDGE_BPS`.
- An affiliate's stored edge MUST be clamped to the current cap `min(h_b + maxAffiliateDeltaBps,
MAX_HOUSE_EDGE_BPS)` when a bet is priced, so a lower cap or base edge applies to new bets at once.
- The markup operator share is `M_total = floor(E_Δ × (10000 − LP_SHARE_BPS) / 10000)`. It MUST be paid to the
  snapshotted skyline payees in proportion to their increments, each share rounded down. Any unallocated
  remainder accrues to `PF_new`.
- LPs retain `E − O` of the whole edge, markup included.

## 5. Settlement-boundary enforcement

The SettlementRouter interface changes as follows for the Current release unit:

- `openPosition(poolId, player, stake, reserved, snapshotHash, edgeBps)` MUST record `edgeBps` with the
  position and MUST revert if `edgeBps > MAX_HOUSE_EDGE_BPS`. Casino hubs pass `h_e`. Sports hubs pass `0`.
- `settlePosition(...)` MUST compute, from its own record, `U = stake − refundAmount`,
  `E_R = floor(U × edgeBps / 10000)` and `cap = floor(E_R × (10000 − LP_SHARE_BPS) / 10000)`, and MUST revert
  unless `protocolFeeAccrual + Σ(accrued + locked + holdback over xpAwards) ≤ cap`.
- A hub MAY accrue less than `cap`. Any difference remains with LPs.
- The existing reserve, refund and net-payout checks remain in force. Bank also MUST enforce
  `payoutNet + refundAmount + protocolFeeAccrual + all XP <= reserved` atomically before payment.
- The Router SHOULD expose the cap as a view, `allocationCap(positionId, refundAmount)`, and SHOULD include
  `edgeBps` in its position-opened event.

This bounds what any authorized hub can take from a pool. It does not let the Router verify the game
result or the correctness of `payoutGross`; module review, randomness and hub authorization still do that.

## 6. Parameters and governance

| Parameter                                                                     | Who               | Rule                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `LP_SHARE_BPS`, `MAX_REFERRAL_BPS`, `MAX_HOUSE_EDGE_BPS`, `EDGE_CHANGE_DELAY` | none              | Constants of the release unit                                                                                 |
| Base edge `h_b`                                                               | governance (Safe) | MUST be queued and MAY be activated only after `EDGE_CHANGE_DELAY`; applies to bets accepted after activation |
| `maxAffiliateDeltaBps`                                                        | governance (Safe) | Increases MUST be queued with `EDGE_CHANGE_DELAY`; decreases MAY take effect immediately                      |
| Referral schedule `(l0, l1, l2)`                                              | governance (Safe) | Created as a new immutable version; activation MAY be immediate; applies to bets accepted after activation    |
| Refund timeout                                                                | governance (Safe) | MUST NOT exceed `MAX_REFUND_TIMEOUT_SECONDS = 1 day`, at deployment or later                                  |

- Every bet MUST snapshot `h_b`, `h_e`, the referral schedule version and its payees.
- Only governance MAY queue or cancel a delayed change. Once the delay has passed, anyone MAY activate it.
  A decrease of `maxAffiliateDeltaBps` also discards any queued increase.
- Governance actions MUST emit events carrying the old value, the new value and, for queued changes, the
  activation time.
- The guardian keeps pause-only authority. It MUST NOT change any allocation parameter.

## 7. Events and auditability

- The hub MUST emit, per settled casino position, an allocation event carrying at least:
  `positionId, U, h_e, E, O, lpRetained, PF_new, R0, R1, R2, M`. The reference hub emits
  `HouseEdgeAllocated` with these fields in this order.
- `lpRetained + PF_new + XP_new = E` MUST be recomputable from events alone.
- Receipts and pool pages SHOULD display the allocation of each position from this event.

## 8. Out of scope

- Sports-domain allocation. Sports positions MUST settle with `PF_new = XP_new = 0` until a separate ADR
  defines it.
- Values of the adjustable parameters. Initial proposals are in ADR-0032 and require calibration before
  deployment.

## 9. Worked example

`S = 100 USDC`, no refund, `h_b = h_e = 200`, schedule `(1000, 2000, 500)`:
`E = E_b = 2.00`, `O = 1.00`, LPs retain `1.00`.

| Case        |   R0 |   R1 |   R2 | PF_new | LP retains |
| ----------- | ---: | ---: | ---: | -----: | ---------: |
| No referrer |    0 |    0 |    0 |   1.00 |       1.00 |
| L1 only     | 0.20 | 0.40 |    0 |   0.40 |       1.00 |
| L1 and L2   | 0.20 | 0.40 | 0.10 |   0.30 |       1.00 |

The Router cap is `floor(2.00 × 5000 / 10000) = 1.00`. Each row accrues exactly `1.00` in total and passes.
