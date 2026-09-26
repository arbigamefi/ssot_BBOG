# Protocol Constitution (SSOT) v1.6 — House-edge allocation (draft)

> **Status: draft for review.** Nothing in this document is implemented or deployed. It governs the next
> casino release unit only. Deployed v1.5 contracts are immutable and keep their current allocation.
> Decision record: [ADR-0032](../adr/0032-fixed-lp-share-operator-funded-referrals.md). Executable
> invariants: [ExecutableSSOT v1.6](ExecutableSSOT.v1.6.md).

This document is **normative**. Keywords **MUST / MUST NOT / SHOULD / MAY** are used as defined in RFC 2119.

v1.6 replaces the turnover-budget rule of SSOT v1.0 section 3.3.2, as carried through v1.3, with an
allocation in which LPs keep a fixed share of the house edge and referrals are funded from the operator's
share. Everything else in v1.3, and the deployed v1.4/v1.5 behavior, remains in force unless this document
changes it. The v1.4 and v1.5 deltas (guardian pause, bounded unlock threshold, single release line) have
not yet been written up as constitution documents; that gap is tracked separately and is not closed here.

## 0. Additive axioms (v1.6)

9. **Fixed LP share.** For every settled casino position, LPs MUST retain exactly
   `E − floor(E × (10000 − LP_SHARE_BPS) / 10000)` of the turnover edge `E`, where `LP_SHARE_BPS = 5000` is a
   constant of the release unit. Governance MUST NOT be able to change it.

10. **Operator-funded referrals.** Referral rewards and player rakeback MUST be paid from the operator share.
    Any operator share that is not paid to an existing referral payee MUST accrue as protocol fees.

11. **Settlement-boundary enforcement.** The SettlementRouter MUST enforce the LP share from its own record
    of the position. It MUST NOT rely on the hub's arithmetic.

12. **Non-retroactivity.** A position MUST settle under the edge, referral schedule and referral payees that
    applied when the bet was accepted.

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

When a casino position settles through `finalize`, the hub MUST compute, in this order:

1. `E`, `E_b`, `E_Δ` from `U` and the snapshotted `h_b`, `h_e`.
2. `O = floor(E × (10000 − LP_SHARE_BPS) / 10000)`.
3. Referral amounts from the snapshotted schedule `(l0, l1, l2)` and snapshotted payees:
   - `R0 = floor(E_b × l0 / 10000)` if the player had a bound referrer at acceptance, else `0`; paid to the player.
   - `R1 = floor(E_b × l1 / 10000)` if the L1 payee exists, else `0`.
   - `R2 = floor(E_b × l2 / 10000)` if the L2 payee exists, else `0`.
4. Markup amounts per section 4. They are `0` while markup is disabled.
5. `PF_new = O − R0 − R1 − R2 − M`.

LPs retain `E − O`. That amount MUST NOT be accrued as a liability of any kind; it remains in
`NAV = B − PF − XP`.

`PF_new ≥ 0` always holds, because `R0 + R1 + R2 ≤ floor(E_b × MAX_REFERRAL_BPS / 10000) ≤ floor(E_b / 2)`,
`M ≤ floor(E_Δ / 2)` and `O ≥ floor(E_b / 2) + floor(E_Δ / 2)`.

The fee withheld from a winning payout (`payoutGross − payoutNet`, ADR-0007) continues to apply to players
unchanged. It stays in the Bank and is part of the game result LPs bear. It is not a second allocation base.

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
- The markup operator share is `M_total = floor(E_Δ × (10000 − LP_SHARE_BPS) / 10000)`. It MUST be paid to the
  snapshotted skyline payees in proportion to their increments, each share rounded down. Any unallocated
  remainder accrues to `PF_new`.
- LPs retain `E − O` of the whole edge, markup included.

## 5. Settlement-boundary enforcement

The SettlementRouter interface changes as follows for the v1.6 release unit:

- `openPosition(poolId, player, stake, reserved, snapshotHash, edgeBps)` MUST record `edgeBps` with the
  position and MUST revert if `edgeBps > MAX_HOUSE_EDGE_BPS`. Casino hubs pass `h_e`. Sports hubs pass `0`.
- `settlePosition(...)` MUST compute, from its own record, `U = stake − refundAmount`,
  `E_R = floor(U × edgeBps / 10000)` and `cap = floor(E_R × (10000 − LP_SHARE_BPS) / 10000)`, and MUST revert
  unless `protocolFeeAccrual + Σ(accrued + locked + holdback over xpAwards) ≤ cap`.
- A hub MAY accrue less than `cap`. Any difference remains with LPs.
- The existing reserve, refund and net-payout checks remain in force.

This bounds what any authorized hub can take from a pool. It does not let the Router verify the game
result or the correctness of `payoutGross`; module review, randomness and hub authorization still do that.

## 6. Parameters and governance

| Parameter                                                                     | Who               | Rule                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `LP_SHARE_BPS`, `MAX_REFERRAL_BPS`, `MAX_HOUSE_EDGE_BPS`, `EDGE_CHANGE_DELAY` | none              | Constants of the release unit                                                                                 |
| Base edge `h_b`                                                               | governance (Safe) | MUST be queued and MAY be activated only after `EDGE_CHANGE_DELAY`; applies to bets accepted after activation |
| `maxAffiliateDeltaBps`                                                        | governance (Safe) | Increases MUST be queued with `EDGE_CHANGE_DELAY`; decreases MAY take effect immediately                      |
| Referral schedule `(l0, l1, l2)`                                              | governance (Safe) | Created as a new immutable version; activation MAY be immediate; applies to bets accepted after activation    |

- Every bet MUST snapshot `h_b`, `h_e`, the referral schedule version and its payees.
- Governance actions MUST emit events carrying the old value, the new value and, for queued changes, the
  activation time.
- The guardian keeps pause-only authority. It MUST NOT change any allocation parameter.

## 7. Events and auditability

- The hub MUST emit, per settled casino position, an allocation event carrying at least:
  `positionId, U, h_e, E, O, lpRetained, PF_new, R0, R1, R2, M`.
- `lpRetained + PF_new + XP_new = E` MUST be recomputable from events alone.
- Receipts and pool pages SHOULD display the allocation of each position from this event.

## 8. Out of scope

- Sports-domain allocation. Sports positions MUST settle with `PF_new = XP_new = 0` until a separate ADR
  defines it.
- Migration of v1.5 pools. The operational plan belongs in a release runbook. LP migration MUST be voluntary.
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
