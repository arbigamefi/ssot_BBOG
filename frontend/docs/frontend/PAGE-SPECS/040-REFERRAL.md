# Page Spec — Referral

## Route
- `/referral`

## Purpose
Expose SSOT referral binding and transparency without leaking protocol internals into UI.

## Modules
- `ReferralHeader`
- `BindReferrerCard` (address input, bind stepper)
- `CurrentReferrerCard` (referrerOf)
- `AffiliateHouseEdgeCard` (optional) 

## Truth Sources
- Release artifact:
  - read-only gating
- SDK read helpers:
  - `sdk.hub.referrerOf(player)`
- SDK write helpers:
  - `sdk.hub.bindReferrer(referrer)`
- Optional future read helpers:
  - affiliate house-edge display if the SDK surfaces it later

## UX Rules
- Binding MUST be a write action that uses the standard stepper
- Once bound (if immutable), UI MUST clearly state binding status
- No raw addresses without short display + copy button

## Acceptance Criteria
- Uses DomainError only (no raw reverts)
- Never blocks non-referral users from betting
- SDK-facing naming in the spec matches the current route implementation
