# ADR-0016: Roulette typed parameter encoding (kind + payload) with legacy bitmask support

## Context

The refactored `RouletteV2` game represents bets as a `uint40` bitmask selecting numbers 0..36, and computes fair payout as `stake × 37 / popcount(mask)`.

For SSOT, this raw bitmask encoding is both:
- **powerful** (any inside/outside bet can be represented as a set of numbers), and
- **minimal** (one 40-bit value).

However, user interfaces and SDKs often prefer *typed* bets (e.g., *Red*, *Even*, *Dozen #2*, *Street starting 10*), where the contract can validate the bet structure and derive the corresponding bitmask.

We want to add a typed encoding **without** breaking compatibility for existing callers and reference-model tests that use the raw bitmask.

## Decision

1) Keep the **raw bitmask** encoding as the canonical low-level representation.

2) Extend roulette params to support a **typed encoding**:

- Legacy:
  - `params = abi.encode(uint40 numbersBitmask)`

- Typed:
  - `params = abi.encode(uint8 kind, uint40 payload)`

The module decodes either form into a `uint40 numbersBitmask` and then proceeds identically:
- validate `numbers != 0` and `numbers < 2^37 - 1` (cannot select all numbers)
- payout per hit: `amountPerRoll × 37 / popcount(numbers)` (fair odds)

3) Define stable `kind` values (do not reorder) for:
- `Bitmask`, `Straight`, `Split`, `Street`, `Corner`, `SixLine`, `Dozen`, `Column`, `Red`, `Black`, `Odd`, `Even`, `Low`, `High`.

## Consequences

- **Backwards compatible**: existing raw-bitmask clients continue to work.
- **UI/SDK friendly**: clients can submit typed bets without locally maintaining number sets.
- **No new trust surface**: all decoding is pure and local to the module.
- **Proof friendliness**: reference model can normalize params to a bitmask and reuse the same payout logic.

## Alternatives considered

1) *Only raw bitmask* (status quo)
- Pros: minimal ABI
- Cons: clients must implement and audit bet-to-bitmask mapping offchain.

2) *Only typed encoding* (remove raw bitmask)
- Pros: consistent typed interface
- Cons: breaks parity and requires migrating existing callers and tests.

3) *Support multiple independent encodings per bet type* (separate structs)
- Pros: explicit
- Cons: increases ABI surface and complexity without adding correctness.
