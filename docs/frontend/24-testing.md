# Testing

From the repository root:

```bash
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend build
pnpm -C frontend check:bundle
```

The [workspace scripts](../../frontend/package.json) run each package's checks.
Current golden-vector tests require their fixture in the normal test suite.

Tests should exercise the affected boundary: exact encoding, chain/pool identity,
transaction preflight, receipt payment status, async redemption accounting,
idempotent event processing, or recovery after a restart. Production keeper
recovery uses the durable database; do not assume an unavailable database can
always be bypassed with recent RPC logs.

## Test data

[Current contract fixtures](../../frontend/packages/ssot/src/fixtures) are local
test data, not deployed contracts. Web tests use the explicit
[current-release helper](../../frontend/apps/web/src/test/current-release.ts)
when they need a configured release. Keep empty-registry and unsupported-chain
cases covered; never populate the real embedded registry to satisfy a test.
Tests that need Postgres or Anvil document their environment requirements in their
source. A skipped integration test is not evidence that its boundary passed.

## Browser checks

Run a local web server, then use Playwright:

```bash
pnpm -C frontend dev
# In a second terminal:
pnpm -C frontend/apps/web e2e
```

[Playwright configuration](../../frontend/apps/web/playwright.config.ts) uses
`http://localhost:3000` by default, or `PLAYWRIGHT_BASE_URL`. With `CI=true`, it starts
a production server automatically. The [E2E suite](../../frontend/apps/web/e2e)
covers smoke, accessibility, and the real wallet selector. Physical wallet-app
handoff still needs device testing. Docs-only changes need local link and command
checks, without rerunning unrelated runtime suites.
