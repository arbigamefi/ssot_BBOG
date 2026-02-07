# ADR-0002: SSOT accounting: NAV = B - PF - XP

- **Status:** Accepted
- **Date:** 2026-01-08

## Context

LP shares must be backed by a single, formalizable accounting identity that excludes liabilities (fees payable and external payables).

## Decision

Define `NAV = B - PF - XP` in Bank and require `totalAssets() == NAV`.

## Consequences

- Prevents LP from implicitly withdrawing protocol/referral liabilities.
- Enables solvency proofs and invariant testing.
- Requires explicit bucket accounting for all liabilities.

## Alternatives considered

- Using `B` (raw balance) as totalAssets.
- Using `B - R` only.
These were rejected because they mix liabilities into LP backing.
