# Milestone 2.2: Keno module (parity with refactored defaults)

## Goal

Deliver a deterministic, stateless Keno module under the SSOT architecture, including multi-roll/stopGain/stopLoss semantics and reserve calculation. Current product rules use N=15 and M=5.

## Acceptance criteria

- `KenoModule` implements `IGameModule`:
  - `validate` rejects invalid selections (0, all, >5 picks)
  - `maxPayout` returns conservative bound covering `payoutGross + refundAmount`
  - `resolve` supports multi-roll with correct refund and stopGain/stopLoss
- Unit tests cover:
  - single-roll hit case (played=1) with hub fee-on-payout
  - invalid param revert
- Documentation:
  - ADR-0017 added
  - `docs/games/keno.md` added
  - migration mapping updated

## Planned PRs

### PR-2.2.1: Add Keno module
- Add `src/modules/keno/KenoParams.sol`
- Add `src/modules/keno/KenoModule.sol`
  - precomputed gain factor table
  - canonical RNG draw via `RNG.roll2`

### PR-2.2.2: Tests + docs
- Register KENO in E2E setup
- Add E2E tests (hit + invalid)
- Add docs (ADR + game spec)
