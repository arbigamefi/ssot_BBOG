> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# Sportsbook Monitoring and Keeper Coverage

Status: draft production-control policy. This file defines the minimum monitoring ownership and keeper
debt-out capability required before SportsHub public-money risk-in. It does not approve an operator
schedule by itself.

## Required Monitoring Coverage

The first SportsHub canary must have named owners and alert routing for all Sports metrics and alerts
in `docs/ops/metrics.md` and `docs/ops/alerts.md`:

- G1 odds reject spikes;
- G2 risk cap revert spikes;
- G3 exposure near cap;
- G3A market voided;
- G4 result finality stuck;
- G5 result challenged;
- G6 oracle config changed;
- G7 risk limits changed.

## Required Keeper Coverage

At least one keeper must be able to call:

- `finalizeResult(uint64)`;
- `settleTickets(uint256[])`;
- `refundTickets(uint256[])`;
- `voidTickets(uint256[])`.

The keeper procedure must include a retry-and-shrink plan because batch terminalization is atomic. If
one ticket causes a batch revert, operators must retry smaller batches and preserve the failure reason
in the incident record.

## Validation

Create an ops coverage memo from:

```text
docs/ops/templates/sportsbook-ops-coverage.example.json
```

Run:

```bash
make sports-ops-coverage-check-v13 OPS_COVERAGE_FILE=docs/ops/templates/sportsbook-ops-coverage.example.json
```

For production approval:

```bash
REQUIRE_APPROVED=1 make sports-ops-coverage-check-v13 OPS_COVERAGE_FILE=<approved-ops-coverage.json>
```

`REQUIRE_APPROVED=1` must fail unless the memo status is `approved`, all G-series alerts have an
owner/channel, the keeper capability is complete, and rehearsal records are filled.

## No-Go Conditions

Do not enable SportsHub public risk-in when any of the following is true:

- any Sports G-series alert lacks a named owner;
- alert routing is not monitored during market lock/result/finality windows;
- keeper cannot call all four terminalization functions;
- no retry-and-shrink procedure exists for failed batches;
- no rehearsal record proves keeper finalization and batch debt-out before the canary.
