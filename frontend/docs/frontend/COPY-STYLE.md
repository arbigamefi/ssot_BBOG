# Copy & Error Message Style Guide

## Voice
- Neutral, precise, non-hype.
- Prefer **actionable** messages (what happened, what to do next).

## Error presentation (MUST)
- UI must display **DomainError** (code + friendly message), never raw revert data.
- Include **one next step** whenever possible.
- Avoid blaming the user; treat most failures as environmental (RPC, reorg, gas, fee drift).
- Avoid ambiguous terms: prefer "VRF fee" vs "gas", "Bank" vs "pool".

## Formatting
- Use sentence case.
- Keep the headline under ~70 characters.
- Put technical details (tx hash, bet id, raw selector) behind an "Details" accordion.

## Severity
- **info**: user action not needed.
- **warning**: user action recommended.
- **error**: user action required.

## User-facing content must not mention
- Internal code names.
- Raw revert selectors.
- Internal file paths.

## Templates

### Allowance insufficient
> "Approval required. Approve {symbol} spending in the Bank to continue."

### VRF fee insufficient
> "Insufficient VRF fee. Please retry; the required fee may have changed."

### RPC temporarily unavailable
> "Network temporarily unavailable. Please try again in a moment or switch RPC."

### Release snapshot invalid (read-only)
> "Writes are disabled because the current Release configuration is invalid."
