# ADR-0017: Keno module (current N=15, M=5) with precomputed gain table

## Context

We want to add Keno functionality (as implemented in `refactored/KenoV2`) to the clean-room SSOT design.
The target properties are:

- No new trust surface: the module must be a pure semantic component (ADR-0011), not a custody holder.
- Determinism: resolve must be deterministic given (params, stakeSpec, betId, VRF seed) + immutable module rules (SSOT.v1.1).
- Multi-roll semantics: refund + stopGain/stopLoss must follow ADR-0013.
- House edge remains a Hub concern (ADR-0007), not embedded in game logic.

The refactored implementation uses a hypergeometric model with a gain-factor table and a Fisher–Yates draw.

## Decision

We implement `KenoModule` as a pure module with the current product configuration:

- Pool size: `N = 15`
- Draw size: `M = 5`
- Player selection size: `1..5`

Parameters:

- `params = abi.encode(uint40 numbersBitmask)`

Randomness:

- Use SSOT canonical RNG expansion with domain separation (`RNG.roll2(betId, rollIndex, drawStep, seed)`)
- Draw `M=5` numbers without replacement via partial Fisher–Yates

Payout model:

- Use the same fair-outcome construction as refactored:
  - `gainFactor(played,k) = floor( 10000 / (P(k) * (played+1)) )`
  - `payoutGross = amountPerRoll * gainFactor / 10000`
- Precompute gain factors for all `(played,k)` under `N=15, M=5` and embed as constants
  to avoid factorial/combination computation during settlement.

Reserve:

- `maxPayout` returns `stake * gainFactor(played, played) / 10000`.

## Consequences

Positive:

- Keno becomes a standard SSOT module: deterministic, composable, and does not expand custody trust.
- Multi-roll and refund semantics are consistent across games.
- Gas cost is bounded and predictable (table lookup + draw loops).

Trade-offs:

- The maximum multiplier for `played=5` is 500.5x gross before fee-on-payout, which is still high enough to require reserve checks but is product-appropriate for a compact 15-number board.
- Per-token configurability (changing `N` or `M`) is not included in v1.1 to preserve determinism and avoid introducing mutable module config.

## Alternatives considered

1. **Compute gain factors on-chain via factorial/combination**
   - Pros: no embedded constants
   - Cons: higher settlement gas and more arithmetic surface; no functional benefit for fixed defaults

2. **Allow per-asset configuration (mutable)**
   - Pros: more product flexibility
   - Cons: breaks determinism for old bets unless config is snapshotted per bet; increases proof burden

3. **Embed a manual paytable (non-hypergeometric)**
   - Pros: smaller max multipliers, more control
   - Cons: not parity with refactored and requires new economic specification

## References

- `docs/constitution/SSOT.v1.1.md`
- `docs/games/keno.md`
- `test/unit/E2E.t.sol:test_keno_single_pick_hit_fee_on_payout_assetA`
