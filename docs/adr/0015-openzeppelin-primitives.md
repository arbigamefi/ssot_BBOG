# ADR-0015: Adopt OpenZeppelin primitives

- Status: Accepted
- Date: 2026-01-09

## Context

SSOT targets institution-grade correctness and auditability. Low-level ERC20 interactions, rounding, and reentrancy are frequent sources of subtle vulnerabilities and reviewer friction, especially under multi-asset support.

SSOT's constitution constrains **authority and liveness**: Bank holds betting principal and liabilities,
its LiquidityVault holds NFT deposit capital, and only the SettlementRouter can terminalize Bank positions.
Debt settlement remains available during a risk-in pause. Standardized primitives must preserve these boundaries.

## Decision

We use the OpenZeppelin Contracts version pinned in `deps.lock`, imported through
`@openzeppelin/contracts`, to standardize:

- `SafeERC20` for all ERC20 transfers/transferFrom/approve interactions.
- `Math.mulDiv` (and ceil rounding) for full-precision division.
- `ReentrancyGuard` for functions that move assets to external recipients.
- `Pausable` as the implementation mechanism for SSOT's **risk-in pause** flag within each Bank.
- `SafeCast` for checked narrowing of capital, amounts and receipt storage.
- `ERC721Enumerable` for LiquidityVault deposit ownership and enumeration.

This ADR is limited to primitives. NFT deposit rights and the dual-custody model are defined in
[ADR-0034](0034-nft-liquidity-deposits.md).

## Detailed mapping to SSOT semantics

### Risk-in pause

- SSOT defines a per-asset `riskInPaused` flag in each `Bank(asset)`.
- We map `riskInPaused` to OpenZeppelin `Pausable.paused()`.
- `Bank.setRiskInPaused(bool)` becomes idempotent and calls `_pause()`/`_unpause()`.
- **Debt-out paths remain unpaused**: `settleBet` and `refundBet` never check `paused()`.

### Reentrancy

`nonReentrant` is applied to entrypoints that perform external token transfers:

- Vault LP flows: `addDeposit`, `addDepositFor`, `withdrawDeposit`
- Optional Bank outflows: `claimXPAccrued`, `claimProtocolFees`
- Router-only Bank funds flows: `holdBet`, `settleBet`, `refundBet`
- Fixed-player debt payment: `claimPlayerPayable`
- Bank-only Vault capital locking and settlement
- Governance rescue for non-asset tokens: `rescueToken`

This does not affect normal execution in honest tokens; it prevents malicious token reentry from creating cross-function inconsistencies.

## Alternatives considered

1. Keep custom SafeTransfer/Math utilities.
   - Rejected: increases audit surface and requires additional proof obligations.
2. Maintain a modified local copy of these primitives.
   - Rejected: use the pinned dependency and verify its provenance instead of maintaining a second implementation.

## Consequences

- Reduced bug surface and improved audit ergonomics.
- More predictable behavior across a wide range of ERC20 implementations.
- No change to SSOT authority/liveness constraints.
