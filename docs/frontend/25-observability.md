# Observability

## Health

`/api/healthz?chainId=<id>` reports release, keeper, and bet-index checks. Inspect
`checks.release`, `checks.keeper`, and `checks.betIndex`, not HTTP success alone.
The [health implementation](../../frontend/apps/web/src/server/healthz.ts) checks
release warnings, keeper chain/status/freshness, and the durable read source.
An empty registry is degraded; Base mainnet requires Postgres reads.

`/ops/casino-keeper-health.json?chainId=<id>` exposes the selected keeper snapshot,
and `/ops` presents operational state. The
[keeper health reader](../../frontend/apps/web/src/server/ops/keeper-health.ts)
uses configured server paths. Keep health files outside `apps/web/public/ops`.
A healthy snapshot does not prove that a complete betting or redemption cycle passed.

## Sentry

[Client initialization](../../frontend/apps/web/instrumentation-client.ts) and
[server initialization](../../frontend/apps/web/instrumentation.ts) run when
`NEXT_PUBLIC_SENTRY_DSN` is configured. Current production tracing samples 10%.
[Release tags](../../frontend/apps/web/src/observability/sentry-config.ts) prefer
`NEXT_PUBLIC_SENTRY_RELEASE`, then `NEXT_PUBLIC_BUILD_SHA`; environment uses
`NEXT_PUBLIC_ENV` with a runtime fallback.

The [scrubber](../../frontend/apps/web/src/observability/sentry-scrub.ts) redacts
wallet-address strings and known sensitive query parameters within its supported
nesting depth. It is not a general secret filter: never add keys, signatures,
request bodies, or credentials to error context. Consult initialization code for
sampling/integration settings instead of assuming all telemetry or replay is off.

```bash
pnpm -C frontend/apps/web test -- src/app/api/healthz/route.test.ts src/app/ops/casino-keeper-health.json/route.test.ts src/observability/sentry-config.test.ts src/observability/sentry-scrub.test.ts
```
