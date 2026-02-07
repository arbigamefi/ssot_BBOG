# ADR-0026: Error taxonomy — separate authorization errors from balance errors

## Context

`Errors.InsufficientBalance()` is used in 18 locations across the codebase. Four of those
are **authorization or configuration** checks, not balance checks:

| Location | Purpose | Actual semantics |
|----------|---------|-----------------|
| `Governable.onlyGov` (line 14) | caller != governance | Authorization |
| `Governable.acceptGovernance` (line 32) | caller != pendingGovernance | Authorization |
| `Bank.setRiskInPaused` (line 105) | caller not governance and not hub | Authorization |
| `Bank.setHubOnce` (line 116) | hub already set | Configuration guard |
| `Bank.rescueToken` (line 139) | token == asset (policy guard) | Configuration guard |

Reusing a balance error for authorization failures:
- misleads off-chain monitoring (balance alerts fire on auth failures)
- hinders forensic triage (cannot distinguish "not enough funds" from "not authorized")
- violates the principle of least surprise for integrators parsing ABI errors

## Decision

1. Add `error Unauthorized()` to `Errors.sol`.
2. Replace auth misuses:
   - `Governable:14,32` -> `Errors.Unauthorized()`
   - `Bank:105` -> `Errors.Unauthorized()`
3. Replace config-guard misuses:
   - `Bank:116` (hub already set) -> `Errors.InvalidConfig()`
   - `Bank:139` (rescueToken rejecting asset token) -> `Errors.InvalidConfig()`

## Consequences

- Off-chain monitoring can filter `Unauthorized()` for access-control alerts separately
  from `InsufficientBalance()` for solvency alerts.
- ABI change: new error selector `Unauthorized()` (0x82b42900) is emitted by
  `Governable`, `Bank`.
- No invariant changes needed: invariants test state transitions, not error selectors.
- No constitution changes: the SSOT constitution does not reference error names.
- Remaining 13 usages of `InsufficientBalance` are all legitimate balance/amount checks.

## Alternatives considered

1. **OZ-style `OwnableUnauthorizedAccount(address)` with caller argument.**
   Rejected: adds gas overhead for an argument rarely consumed on-chain; the caller
   is always available in transaction metadata.
2. **Per-contract access errors (e.g., `NotGovernance`, `NotHub`).**
   Rejected: over-engineering for v1; `Unauthorized()` is sufficient for all auth checks.
   Contract-specific errors like `NotHub()` already exist in `IBank.sol` for the
   hub-gating use case.
