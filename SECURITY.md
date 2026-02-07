# Security Policy

## Reporting a vulnerability

Please report security issues **privately**.

- Email: security@example.com (replace with your security contact)
- Include: impact, reproduction steps, affected commit hash, and any suggested patch.

We aim to respond within 72 hours.

## Scope

In scope:
- Any issue that can lead to loss of funds (ASSET)
- Breaking the SSOT invariants (solvency, liveness, no backdoor)
- VRF fulfillment bricking
- Referral/XP accounting corruption

Out of scope:
- Issues in dependencies (unless exploitable through this repo)
- Social engineering and phishing

## Disclosure process

1. Acknowledge receipt
2. Triage severity
3. Provide fix timeline
4. Coordinate public disclosure after patch release

## Security objectives (v1.0)

- Solvency: `NAV >= R` always
- Liveness: accepted bets can settle/refund without admin cooperation
- No backdoor: no privileged ASSET exfiltration while violating SSOT
