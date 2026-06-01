# Casino Frontend Access Policy

This policy defines the approval record required before any public-money casino
risk-in entrypoint is enabled from a project-controlled frontend.

The current repo state is **draft only**. It records the required decision
shape, but it does not approve any jurisdiction, user-access model, or public
casino launch.

## Approval Record

The approval memo must use schema `casino.frontend-access.v1` and start from:

`docs/ops/templates/casino-frontend-access.example.json`

Validate the memo with:

```bash
make casino-frontend-access-check-v13
```

Before Base mainnet public traffic, rerun it in approval mode:

```bash
REQUIRE_APPROVED=1 make casino-frontend-access-check-v13 FRONTEND_ACCESS_FILE=<approved-casino-frontend-access.json>
```

## Required Decisions

The approved memo must record:

- target jurisdictions and restricted jurisdictions;
- license, exemption, or legal basis for each target jurisdiction;
- minimum age, KYC posture, sanctions screening, geo-restriction provider, and
  VPN/proxy policy;
- cookie-consent policy before analytics or marketing tracking;
- responsible-gaming controls, self-exclusion policy, and stake-limit policy;
- frontend enablement behavior for unknown or restricted jurisdictions;
- the runtime enablement flag `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED`;
- links to terms, privacy policy, risk disclaimer, responsible-gaming page, and
  support channel;
- legal, compliance, frontend, and operations approvals with evidence URI.

## Product Boundary

GameHub, VRF, and Bank accounting provide on-chain fairness and settlement
proof. They do not solve jurisdiction, age, KYC, sanctions, cookie-consent, or
responsible-gaming requirements. "Pure on-chain" must not be treated as a
substitute for access-control approval.

For the first Base mainnet casino launch, the default position is:

- unknown jurisdiction blocks risk-in;
- restricted jurisdiction blocks risk-in;
- public casino launch is not coupled to contract deployment;
- Base mainnet risk-in remains disabled unless `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED=true`;
- any public canary starts with minimal stake, named support owner, and live
  keeper/bet-index monitoring.

## No-Go Conditions

Do not enable public casino risk-in if any of these are true:

- the approval memo is missing, still `draft`, or fails `REQUIRE_APPROVED=1`;
- the approved deployment does not explicitly set `NEXT_PUBLIC_CASINO_RISK_IN_ENABLED=true`;
- target and restricted jurisdictions overlap;
- age, KYC, sanctions, geo-restriction, VPN/proxy, cookie-consent, or
  responsible-gaming handling is unresolved;
- the frontend can place bets while jurisdiction or approval state is unknown;
- terms, privacy policy, risk disclaimer, responsible-gaming page, or support
  contact cannot be reached from the casino flow;
- `/api/healthz` is degraded for release, keeper, or bet-index checks.
