# ADR-0015: Adopt OpenZeppelin primitives

- Status: Accepted
- Date: 2026-01-09

## Context
SSOT targets institution-grade correctness and auditability. Low-level ERC20 interactions, rounding, and reentrancy are frequent sources of subtle vulnerabilities and reviewer friction, especially under multi-asset support.

SSOT's constitution constrains **authority and liveness** (single custody, Hub-only bet lifecycle, debt-out always live). The use of standardized primitives must not change those guarantees.

## Decision
We adopt a vendored minimal subset of OpenZeppelin Contracts to standardize:

- `SafeERC20` for all ERC20 transfers/transferFrom/approve interactions.
- `Math.mulDiv` (and ceil rounding) for full-precision division.
- `ReentrancyGuard` for functions that move assets to external recipients.
- `Pausable` as the implementation mechanism for SSOT's **risk-in pause** flag within each Bank.
- (Optional) `SafeCast` where narrowing conversions are required.

This ADR is intentionally limited to primitives; **it does not introduce ERC4626** or alter SSOT's custody/authority model.

## Detailed mapping to SSOT semantics
### Risk-in pause
- SSOT defines a per-asset `riskInPaused` flag in each `Bank(asset)`.
- We map `riskInPaused` to OpenZeppelin `Pausable.paused()`.
- `Bank.setRiskInPaused(bool)` becomes idempotent and calls `_pause()`/`_unpause()`.
- **Debt-out paths remain unpaused**: `settleBet` and `refundBet` never check `paused()`.

### Reentrancy
`nonReentrant` is applied to entrypoints that perform external token transfers:
- LP flows: `deposit`, `mint`, `withdraw`, `redeem`
- Optional outflow: `claimXPAcrued`
- Hub-only bet funds flows: `holdBet`, `settleBet`, `refundBet`
- Governance rescue for non-asset tokens: `rescueToken`

This does not affect normal execution in honest tokens; it prevents malicious token reentry from creating cross-function inconsistencies.

## Alternatives considered
1. Keep custom SafeTransfer/Math utilities.
   - Rejected: increases audit surface and requires additional proof obligations.
2. Depend on OZ via submodules without vendoring.
   - Rejected: repository should remain buildable and reproducible without external fetches.

## Consequences
- Reduced bug surface and improved audit ergonomics.
- More predictable behavior across a wide range of ERC20 implementations.
- No change to SSOT authority/liveness constraints.

