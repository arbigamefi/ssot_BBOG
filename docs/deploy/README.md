# Deployment

Use the [current deployment workflow](v16-release.md), the
[Base Sepolia parameter template](v16/chain-84532.env.example), which the preflight fills from its chain readback, and
the [Docker application setup](../../frontend/deploy/docker/README.md). The production host is rebuilt with each fresh
deployment ([production rebuild](../ops/runbooks/production-rebuild.md)).

The project has not launched. Generated test fixtures are not deployed releases. Deployment uses an
explicit chain packet, approved keystore, verified Safe configuration and signed release artifacts.
