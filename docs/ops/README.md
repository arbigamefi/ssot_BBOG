> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# Ops

## Monitoring

- [Monitoring metrics inventory](metrics.md)
- [Alert rules inventory](alerts.md)

## Runbooks

- [VRF + refundCredit](runbooks/vrf-refundcredit.md)
- [Bank solvency / reserve anomalies](runbooks/bank-solvency.md)
- [Pause + config drift + governance safety](runbooks/pause-config-drift.md)
- [Game finalization stalls / diff anomalies](runbooks/game-finalization-diffs.md)
- [SportsHub odds, result finality, and exposure caps](runbooks/sportsbook-ops.md)
- [Sportsbook production controls](sportsbook-production-controls.md)
- [Casino frontend access policy](casino-frontend-access.md)
- [Sportsbook key custody and role control](sportsbook-key-custody-roles.md)
- [Sportsbook provider and evidence policy](sportsbook-provider-evidence-policy.md)
- [The Odds API provider ingestion](sportsbook-provider-the-odds-api.md)
- [Sportsbook frontend access policy](sportsbook-frontend-access.md)
- [Sportsbook bankroll and risk caps](sportsbook-bankroll-risk-caps.md)
- [Sportsbook monitoring and keeper coverage](sportsbook-ops-coverage.md)
- [Sportsbook Phase 2 go/no-go packet](sportsbook-phase2-gonogo-2026-05-14.md)

## Incident process

- [Incident + postmortem templates](incident-templates.md)

> Tip: always record the **release digest** from `deployments/release-latest-v13.json` in incident notes.
