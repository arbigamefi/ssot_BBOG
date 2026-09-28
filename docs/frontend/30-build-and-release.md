# Build and release

Use Node 24 and pnpm 9 as declared in the
[workspace package](../../frontend/package.json). Install from the lockfile:

```bash
pnpm -C frontend install --frozen-lockfile
pnpm -C frontend dev
```

Copy [web environment examples](../../frontend/apps/web/.env.example) into a local,
untracked environment file as needed. Basic site development does not require a
contract deployment; transaction flows require an authenticated current release.
For local durable-index development, start Postgres with
`pnpm -C frontend bet-index:db:up` and configure the corresponding database URL.

## Validation

Use the commands in [testing](24-testing.md), then check release data:

```bash
pnpm -C frontend check:release
```

This accepts an empty development registry. For a build intended to serve both
Base and Base Sepolia, require both releases:

```bash
REQUIRED_EMBEDDED_CHAIN_IDS=8453,84532 STRICT_RELEASE=1 pnpm -C frontend check:release
```

[Frontend CI](../../.github/workflows/frontend-ci.yml) and the
[Docker image workflow](../../.github/workflows/frontend-docker-images.yml)
define the automated checks and packaging. Build-time public configuration is
embedded in the web image; changing it requires rebuilding that image.

## First deployment

Follow the [contract release guide](../deploy/v16-release.md) to create and verify
a real current deployment, then import its signed bundle using `ssot:sync` with
the trusted signer and RPC configuration. Test fixtures do not satisfy this step.

The [Docker guide](../../frontend/deploy/docker/README.md) covers environment
preflight, image identity checks, services, and health verification. Web and keeper
must use the same reviewed release and source revision. Durable database recovery,
keeper operation, and full transaction cycles need verification separately from
a successful web build. A frontend image change does not reverse contract state
or database writes.
