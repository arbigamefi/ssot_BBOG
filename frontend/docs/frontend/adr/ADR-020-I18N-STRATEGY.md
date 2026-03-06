# ADR-020: Internationalization (i18n) strategy

**Status**: Accepted

## Context
SSOT Frontend v2 may need multi-language support in the future, but v2 phase-1 does not require a full i18n migration.

However, retrofit i18n late is costly if user-visible strings are scattered across components.

## Decision
1) **Establish an i18n seam now**, without forcing a full translation effort:
   - User-visible copy MUST live in a small number of places (feature copy modules and UI kit copy modules).
   - New features SHOULD use keyed messages rather than inline strings.

2) **Runtime locale selection** is deferred; default locale is `en`.
   A future milestone MAY adopt `next-intl` or a similar library.

3) **Error messages** remain DomainError-driven (code + message). Mapping from DomainError.code to localized copy may be added later.

## Alternatives considered
- Implement full i18n (next-intl) immediately.
  - Rejected for phase-1: adds complexity and delays protocol correctness work.

## Consequences
✅ Adding i18n later becomes incremental.
❗ Some existing hardcoded strings will need gradual migration to keyed messages.