# Plinko module

`PlinkoModule` is a pure, deterministic SSOT casino module for 8-row Plinko.

- Module state: none
- Settlement: single VRF seed expanded through canonical `RNG.roll2`
- House edge: applied only by `GameHub` as fee-on-payout
- Multi-roll: supported through `StakeSpec.betCount`, `stopGain`, and `stopLoss`

## Rules

Each roll drops one ball through 8 rows.

- Every row is a fair left/right branch.
- The final bucket is the number of right moves.
- Buckets are indexed `0..8`.

Per branch:

`branch[row] = RNG.roll2(betId, rollIndex, row, seed) & 1`

## Parameter Encoding

`params = abi.encode(uint8 risk)`

Supported risk profiles:

- `0`: Low
- `1`: Medium
- `2`: High

Helper library: `PlinkoParams.encode/decode`.

## Payout Model

Per-roll gross payout:

`payoutGross = amountPerRoll * factor / 10000`

The paytables are symmetric and normalized to approximately fair gross EV before `GameHub` fee-on-payout.
Integer flooring leaves a tiny house-favorable remainder.

| Bucket | Weight | Low | Medium | High |
|---:|---:|---:|---:|---:|
| 0 | 1 | `1.5264x` | `8.2714x` | `24.6153x` |
| 1 | 8 | `1.3083x` | `3.4464x` | `6.1538x` |
| 2 | 28 | `1.0902x` | `1.6542x` | `1.3186x` |
| 3 | 56 | `0.9812x` | `0.6892x` | `0.3076x` |
| 4 | 70 | `0.8722x` | `0.2067x` | `0x` |
| 5 | 56 | `0.9812x` | `0.6892x` | `0.3076x` |
| 6 | 28 | `1.0902x` | `1.6542x` | `1.3186x` |
| 7 | 8 | `1.3083x` | `3.4464x` | `6.1538x` |
| 8 | 1 | `1.5264x` | `8.2714x` | `24.6153x` |

The exact weighted shortfall from fair gross EV is:

- Low: `148 / (256 * 10000)`
- Medium: `202 / (256 * 10000)`
- High: `158 / (256 * 10000)`

## Reserve

`maxPayout(params, stakeSpec)` returns:

`reserved = amountPerRoll * betCount * maxFactor / 10000`

This covers the worst case where every roll lands in an edge bucket for the selected risk profile.
