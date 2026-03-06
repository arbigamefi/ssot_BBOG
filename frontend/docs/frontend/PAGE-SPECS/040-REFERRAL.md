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

## Data Sources
- `sdk.referral.getReferrer(user)`
- `sdk.referral.bindReferrer(referrer)`
- `sdk.referral.getAffiliateHouseEdge(affiliate)` (if enabled)

## UX Rules
- Binding MUST be a write action that uses the standard stepper
- Once bound (if immutable), UI MUST clearly state binding status
- No raw addresses without short display + copy button

## Acceptance Criteria
- Uses DomainError only (no raw reverts)
- Never blocks non-referral users from betting
