# Sic Bo module

`SicBoModule` is a pure, deterministic SSOT casino module for one-shot Sic Bo.

- Module state: none
- Settlement: single VRF seed expanded through canonical `RNG.roll2`
- House edge: applied only by `GameHub` as fee-on-payout
- Multi-roll: supported through `StakeSpec.betCount`, `stopGain`, and `stopLoss`

## Rules

Each roll throws three independent dice.

Per die:

`die[index] = (RNG.roll2(betId, rollIndex, index, seed) % 6) + 1`

Supported bet kinds:

| Kind | Name | Value |
|---:|---|---|
| 0 | Small | must be `0`; total `4..10`, excluding triples |
| 1 | Big | must be `0`; total `11..17`, excluding triples |
| 2 | Any Triple | must be `0`; any three equal dice |
| 3 | Specific Triple | face `1..6`; all three dice match face |
| 4 | Exact Total | total `4..17` |
| 5 | Specific Double | face `1..6`; at least two dice match face |
| 6 | Single Face | face `1..6`; pays per matching die |

## Parameter Encoding

`params = abi.encode(uint8 kind, uint8 value)`

Helper library: `SicBoParams.encode/decode`.

## Payout Model

Per-roll gross payout:

`payoutGross = amountPerRoll * factor / 10000`

The factors are normalized to fair gross EV floors before `GameHub` fee-on-payout.

| Bet | Winning outcomes | Factor |
|---|---:|---:|
| Small / Big | 105 / 216 | `2.0571x` |
| Any Triple | 6 / 216 | `36x` |
| Specific Triple | 1 / 216 | `216x` |
| Specific Double | 16 / 216 | `13.5x` |
| Single Face, one match | 75 / 216 | `2x` |
| Single Face, two matches | 15 / 216 | `4x` |
| Single Face, three matches | 1 / 216 | `6x` |

Exact total factors:

| Total | Outcomes | Factor |
|---:|---:|---:|
| 4 / 17 | 3 | `72x` |
| 5 / 16 | 6 | `36x` |
| 6 / 15 | 10 | `21.6x` |
| 7 / 14 | 15 | `14.4x` |
| 8 / 13 | 21 | `10.2857x` |
| 9 / 12 | 25 | `8.64x` |
| 10 / 11 | 27 | `8x` |

## Reserve

`maxPayout(params, stakeSpec)` returns:

`reserved = amountPerRoll * betCount * maxFactor / 10000`

The highest reserve path is Specific Triple at `216x`.
