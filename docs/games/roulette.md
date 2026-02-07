# Roulette (European 0..36)

Roulette is implemented as a **pure SSOT module** with:
- **Fair odds** inside the module, and
- **house edge** applied exclusively via SSOT "fee-on-payout" in the Hub.

## Wheel

- 37 numbers: `0..36` (European roulette)

## Winning condition

The bet selects a set of numbers `S`.
A roll wins iff the rolled number `r` is in `S`.

## Payout (gross)

Let `k = |S|` (popcount of the bitmask).
For each roll:
- If win: `payoutGross = amountPerRoll × 37 / k` (integer `mulDiv`)
- If lose: `payoutGross = 0`

This is **fair** because `P(win) = k/37` and the expected gross payout equals `amountPerRoll`.
The house edge is applied by the Hub as `feeOnPayoutBps`.

## Param encoding

Two encodings are supported (see ADR-0016):

### 1) Raw bitmask (legacy / parity with refactored)

`params = abi.encode(uint40 numbersBitmask)`

### 2) Typed bets (UI friendly)

`params = abi.encode(uint8 kind, uint40 payload)`

Typed kinds include:
- `Red`, `Black`, `Odd`, `Even`, `Low(1-18)`, `High(19-36)`
- `Dozen(1..3)`, `Column(1..3)`
- `Straight(n)`, `Split(n0,n1)`, `Street(start)`, `Corner(topLeft)`, `SixLine(start)`

The module always normalizes the decoded parameters into a single numbers bitmask.
