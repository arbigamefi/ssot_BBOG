# Slots module

`SlotsModule` is a pure, deterministic SSOT casino module for a Classic 3-reel slot game.

- Module state: none
- Settlement: single VRF seed expanded through canonical `RNG.roll2`
- House edge: applied only by `GameHub` as fee-on-payout
- Multi-roll: supported through `StakeSpec.betCount`, `stopGain`, and `stopLoss`

## Rules

Classic profile uses:

- 3 reels
- 8 symbols per reel, indexed `0..7`
- symbol `7` as the jackpot symbol

Each roll draws one symbol per reel:

- `symbol[j] = RNG.roll2(betId, rollIndex, j, seed) % 8`

## Parameter Encoding

`params = abi.encode(uint8 profile)`

Supported profiles:

- `0`: Classic 3-reel / 8-symbol paytable

Helper library: `SlotsParams.encode/decode`.

## Payout Model

Per-roll gross payout:

- `7,7,7`: `amountPerRoll * 64`
- any other triple: `amountPerRoll * 16`
- exactly one pair: `amountPerRoll * 2`
- no pair: `0`

The Classic paytable is fair before `GameHub` fee-on-payout:

`(168 * 2 + 7 * 16 + 1 * 64) / 512 = 1`

where:

- `168` outcomes have exactly one pair
- `7` outcomes are non-jackpot triples
- `1` outcome is the jackpot triple
- `512 = 8^3` total outcomes

## Reserve

`maxPayout(params, stakeSpec)` returns:

`reserved = amountPerRoll * betCount * 64`

This covers the worst case where every roll hits `7,7,7`.
