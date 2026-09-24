# Local keeper configuration

This directory supplies local development and backfill helpers. Production uses only the [immutable Docker deployment](../docker/README.md); the old standalone systemd deployment has been retired.

Copy `primary.env.example` or `primary.base-mainnet.env.example` to a local ignored file and fill in the intended chain's current release and dedicated keeper credentials. Local helpers read only `frontend/deploy/casino-keeper/${KEEPER_ENV_FILE:-primary.env}`. Keep real files private and never commit keys. `backup` templates describe a standby role, not an archive.

Do not run a second local keeper with the production keeper's signing account. Keep health files outside `apps/web/public`. Backfill requires the intended chain's durable database and release start block.
