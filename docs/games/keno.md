# Keno module

This repository includes a pure, deterministic **Keno** module (`KenoModule`) designed to preserve SSOT guarantees:

- Module is **stateless** and purely semantic (deterministic given params, stake spec, and RNG seed).
- House edge is **not baked into the module**; it is applied by `GameHub` as **fee-on-payout** (ADR-0007).
- Multi-roll semantics (refund + stopGain/stopLoss) follow the current SSOT / ADR-0013.

## Rules (current config)

- Pool size: **N = 15** numbers, encoded as bits **0..14**.
- Draw size: **M = 5** numbers drawn **without replacement**.
- Player selection: select `played` numbers where `1 <= played <= 5`.

## Parameter encoding

- `params = abi.encode(uint40 numbers)`
- Bit `i` set => number `i` selected
- Validity:
  - `numbers != 0`
  - `numbers < 2^15 - 1` (cannot select all numbers)
  - `popcount(numbers) <= 5`

Helper library: `KenoParams.encode/decode`.

## RNG expansion and draw algorithm

Per SSOT canonical RNG expansion (`RNG.roll2`):

- `seed := randomWords[0]`
- For roll `r` and draw step `j`:
  - `x = keccak256("SSOT_RNG_V1", betId, r, j, seed)`

The module implements a **partial Fisher–Yates shuffle** to select 5 unique indices from `[0..14]`.

## Payout model (gross)

Let:

- `played` = number of selected numbers
- `matchCount` = `popcount(numbers & drawn)`

Define the hypergeometric probability:

- `P(k) = C(played, k) * C(N - played, M - k) / C(N, M)`

The module uses the same fair-outcome construction:

- `gainFactor(played,k) = floor( 10000 / (P(k) * (played + 1)) )`
- `payoutGross = amountPerRoll * gainFactor / 10000`

This yields (approximately) fair expectation (integer truncation introduces a tiny bias).

### Precomputed table

For N=15, M=5, the module uses a precomputed table of gain factors for `played ∈ [1..5]` and `k ∈ [0..played]`.
This avoids expensive factorial/combination math during settlement.

## Reserve (maxPayout)

`maxPayout(params, stakeSpec)` returns a conservative upper bound on the player's total owed:

- `reserved = stake * maxFactor / 10000`
- where `stake = amountPerRoll * betCount`
- and `maxFactor = gainFactor(played, played)` (all selected numbers match)

Note: for `played=5`, the all-hit max factor is 500.5x gross before fee-on-payout.

## Frontend

The room is a Carbon copy table (`frontend/apps/web/src/features/casino/keno-room/`;
`docs/design/04-page-blueprints.md` §4, `12-motion.md` §5). Its pays come from the gain table in
`@ssot/ssot/keno-gains`: one round pays `floor(stake * gainFactor / 10000)` gross, less the
release's house edge (`keno-model.ts`). The pay strip and the slip round quotes down to two
decimals; the receipt shows the exact settled amounts. Win chance counts only the numbers of hits
that pay more than the stake (24.2% for three picks with a 2% edge), and only a net win is
celebrated. The blower draws the numbers the settled outcome reports, one round after another.
