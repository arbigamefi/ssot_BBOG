# Baccarat module

`BaccaratModule` is a pure, deterministic SSOT casino module for Player / Banker / Tie baccarat.

- Module state: none
- Settlement: single VRF seed expanded through canonical `RNG.roll2`
- House edge: applied only by `GameHub` as fee-on-payout
- Multi-roll: supported through `StakeSpec.betCount`, `stopGain`, and `stopLoss`

## Rules

The module implements the standard baccarat third-card table:

- Initial deal: Player, Banker, Player, Banker
- Naturals: if either side has total `8` or `9`, both sides stand
- Player draws on totals `0..5` and stands on `6..7`
- Banker draw behavior follows the standard third-card table based on Banker total and Player third card

Card values:

- Ace = `1`
- `2..9` = face value
- `10/J/Q/K` = `0`
- hand total is modulo `10`

This is a stateless RNG game. It does not maintain or deplete a shoe; each card is drawn independently from the 13-rank distribution.

## Parameter Encoding

`params = abi.encode(uint8 side)`

Supported sides:

- `0`: Player
- `1`: Banker
- `2`: Tie

Helper library: `BaccaratParams.encode/decode`.

## Payout Model

No Banker commission is baked into the module. The module uses fair gross factors derived from the exact `13^6` outcome space for this RNG model:

| Side | Winning outcomes | Gross factor |
|---|---:|---:|
| Player | `2,153,464` | `22414 / 10000` |
| Banker | `2,212,744` | `21813 / 10000` |
| Tie | `460,601` | `104793 / 10000` |

Per-roll gross payout:

`payoutGross = amountPerRoll * factor / 10000`

The factors are floored, so each side is slightly player-unfavorable before `GameHub` applies fee-on-payout.

## Reserve

`maxPayout(params, stakeSpec)` returns:

`reserved = amountPerRoll * betCount * selectedSideFactor / 10000`

This covers the worst case where every roll wins for the selected side.
