# Sportsbook Frontend Access Policy

This policy defines the production approval record required before any public SportsHub risk-in
entrypoint is enabled from a website, mobile frontend, embedded widget, or third-party interface
controlled by the project.

The current repo state is **draft only**. It records the required shape of the decision, but it does
not approve any jurisdiction, user-access model, or public sportsbook frontend launch.

## Approval Record

The approval memo must use schema `sportsbook.frontend-access.v1` and start from:

`docs/ops/templates/sportsbook-frontend-access.example.json`

Validate the memo with:

```bash
make sports-frontend-access-check-v13
```

Before any mainnet canary, public frontend risk-in, or third-party frontend enablement, rerun it in
approval mode:

```bash
REQUIRE_APPROVED=1 make sports-frontend-access-check-v13 FRONTEND_ACCESS_FILE=<approved-frontend-access.json>
```

## Required Decisions

The approved memo must record:

- target jurisdictions and restricted jurisdictions;
- license, exemption, or legal basis for each target jurisdiction;
- minimum age, KYC policy, sanctions screening, geo-restriction provider, and VPN/proxy policy;
- responsible-gaming controls available before Sports risk-in;
- frontend enablement flag, safe default state, and behavior for unknown or restricted jurisdictions;
- links to terms, privacy policy, risk disclaimer, and the active market rulebook;
- technical controls proving risk-in stays disabled until jurisdiction and approval state are known;
- legal, compliance, frontend, and operations approvals with evidence URI.

## Product Boundary

SportsHub can provide deterministic settlement and auditable on-chain state, but it does not solve
jurisdiction, age, KYC, sanctions, or responsible-gaming requirements by itself. "Pure on-chain" must
not be treated as a substitute for the access-control decision.

For Phase 2, the default position is:

- public sportsbook entry is disabled;
- unknown jurisdiction blocks risk-in;
- restricted jurisdiction blocks risk-in;
- frontend launch is not coupled to contract deployment;
- any public canary starts with the smallest market set and manually supervised bankroll limits.

## No-Go Conditions

Do not enable public Sports risk-in if any of these are true:

- the approval memo is missing, still `draft`, or fails `REQUIRE_APPROVED=1`;
- target and restricted jurisdictions overlap;
- KYC, sanctions, age, geo-restriction, or VPN/proxy handling is unresolved;
- responsible-gaming controls are not linked from the sportsbook flow;
- the frontend can place tickets while provider, role-custody, bankroll, or ops-coverage approval is
  unknown;
- the enablement flag defaults to exposing risk-in for unsupported jurisdictions;
- the risk disclaimer, terms, privacy policy, or rulebook cannot be reached from the sportsbook flow.
