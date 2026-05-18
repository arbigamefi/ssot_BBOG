# Casino Keeper Deployment Templates

This directory contains production-oriented templates for the casino keeper.

Use them with the runbook:

```text
docs/ops/runbooks/casino-keeper-production.md
```

## Files

| File                                | Purpose                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `arbigamefi-casino-keeper@.service` | systemd template. Run `primary` and `backup` as separate units or on separate hosts. |
| `primary.env.example`               | primary keeper environment template.                                                 |
| `backup.env.example`                | backup keeper environment template with the 5s delay enabled.                        |

## Production defaults

- Run the primary and backup on different hosts or regions.
- Use different keeper EOAs and different RPC providers.
- Keep `KEEPER_HEALTH_PATH` outside `apps/web/public`.
- Prefer managed Postgres for `BET_INDEX_DATABASE_URL`; Docker Postgres is local/staging only.
- Build the keeper before starting the unit:

```bash
pnpm -C frontend install --frozen-lockfile
pnpm -C frontend keeper:build
```

Then install the service:

```bash
sudo install -m 0644 frontend/deploy/casino-keeper/arbigamefi-casino-keeper@.service \
  /etc/systemd/system/arbigamefi-casino-keeper@.service
sudo systemctl daemon-reload
sudo systemctl enable --now arbigamefi-casino-keeper@primary
```
