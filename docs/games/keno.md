# Keno module

This repository includes a pure, deterministic **Keno** module (`KenoModule`) designed to preserve SSOT guarantees:

- Module is **stateless** and purely semantic (deterministic given params, stake spec, and RNG seed).
- House edge is **not baked into the module**; it is applied by the Hub as **fee-on-payout** (ADR-0007).
- Multi-roll semantics (refund + stopGain/stopLoss) follow SSOT.v1.1 / ADR-0013.

## Rules (default config)

- Pool size: **N = 40** numbers, encoded as bits **0..39**.
- Draw size: **M = 10** numbers drawn **without replacement**.
- Player selection: select `played` numbers where `1 <= played <= 10`.

## Parameter encoding

Legacy-compatible encoding:

- `params = abi.encode(uint40 numbers)`
- Bit `i` set => number `i` selected
- Validity:
  - `numbers != 0`
  - `numbers < 2^40 - 1` (cannot select all numbers)
  - `popcount(numbers) <= 10`

Helper library: `KenoParams.encode/decode`.

## RNG expansion and draw algorithm

Per SSOT canonical RNG expansion (`RNG.roll2`):

- `seed := randomWords[0]`
- For roll `r` and draw step `j`:
  - `x = keccak256("SSOT_RNG_V1", betId, r, j, seed)`

The module implements a **partial Fisher–Yates shuffle** to select 10 unique indices from `[0..39]`.

## Payout model (gross)

Let:
- `played` = number of selected numbers
- `matchCount` = `popcount(numbers & drawn)`

Define the hypergeometric probability:

- `P(k) = C(played, k) * C(N - played, M - k) / C(N, M)`

The module uses the same fair-outcome construction as `refactored/KenoV2`:

- `gainFactor(played,k) = floor( 10000 / (P(k) * (played + 1)) )`
- `payoutGross = amountPerRoll * gainFactor / 10000`

This yields (approximately) fair expectation (integer truncation introduces a tiny bias).

### Precomputed table

For N=40, M=10, the module uses a precomputed table of gain factors for `played ∈ [1..10]` and `k ∈ [0..played]`.
This avoids expensive factorial/combination math during settlement.

## Reserve (maxPayout)

`maxPayout(params, stakeSpec)` returns a conservative upper bound on the player's total owed:

- `reserved = stake * maxFactor / 10000`
- where `stake = amountPerRoll * betCount`
- and `maxFactor = gainFactor(played, played)` (all selected numbers match)

Note: for `played=10`, `maxFactor` is very large (rare-event payout), which naturally limits bet sizes unless liquidity is extremely deep.
