# Operations

The project has not launched. These documents describe the current application's first deployment
and operating procedures; they are not evidence of a running service. Start with the
[release facts](../release/README.md), [deployment workflow](../deploy/v16-release.md) and
[Docker configuration](../../frontend/deploy/docker/README.md).

- [Metrics and reconciliation](metrics.md)
- [Alerts and delivery](alerts.md)
- [Runbooks](runbooks/README.md)
- [Casino frontend access](casino-frontend-access.md)
- [Sports result evidence](sportsbook-provider-evidence-policy.md)
- [The Odds API integration](sportsbook-provider-the-odds-api.md)
- [Incident record](incident-templates.md)

Use the verified release digest, chain ID and contract addresses in every operational record.
The release gates in [ADR-0034](../adr/0034-async-lp-redemption-continuous-betting.md) remain prerequisites
for outside LP capital; a healthy process or a successful local test does not discharge them.
