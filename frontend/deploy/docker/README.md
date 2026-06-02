# ArbiGameFi Docker Production Deploy

This path runs the production app as normal long-lived processes:

- Cloudflare: DNS/CDN/WAF only.
- Caddy: TLS termination and reverse proxy.
- `web`: Next.js standalone server.
- `keeper-primary`: permissionless casino/sportsbook finalizer and bet-index writer.
- `postgres`: durable bet-index store.

For a public mainnet launch, prefer managed Postgres. The bundled Postgres
service is suitable for staging, canaries, and early single-host soft launches
only if automated backups are configured.

## 1. Prepare Environment Files

From `frontend/`:

```bash
cp deploy/docker/env/postgres.env.example deploy/docker/env/postgres.env
cp deploy/docker/env/web.production.env.example deploy/docker/env/web.production.env
cp deploy/docker/env/keeper.primary.env.example deploy/docker/env/keeper.primary.env
cp deploy/docker/env/proxy.env.example deploy/docker/env/proxy.env
```

Optional local backup keeper drill:

```bash
cp deploy/docker/env/keeper.backup.env.example deploy/docker/env/keeper.backup.env
```

Edit every copied file. The same database username, password, and database name
must be reflected in:

- `deploy/docker/env/postgres.env`
- `BET_INDEX_DATABASE_URL` in `web.production.env`
- `BET_INDEX_DATABASE_URL` in `keeper.primary.env`
- `BET_INDEX_DATABASE_URL` in `keeper.backup.env`, if used

Never commit the real `.env` files.

## 2. Preflight

```bash
cd frontend
bash deploy/docker/check-production-env.sh
```

This checks that required env files exist, no placeholder values remain, the
Compose graph is valid, and the embedded Base mainnet release is present.

## 3. Build or Pull Images

Preferred production path: build images in GitHub Actions and run only pulled
images on the VPS. This keeps low-memory hosts from running `next build`.

The workflow publishes:

- `ghcr.io/arbigamefi/ssot-bbog-web`
- `ghcr.io/arbigamefi/ssot-bbog-keeper`

Tags:

- `latest` on `master`
- `sha-<git-sha>` on pushed builds
- `v*` git tags
- optional manual `image_tag` from the workflow dispatch form

On the VPS, from `frontend/`:

```bash
bash deploy/docker/deploy-images.sh
```

For a pinned rollout, export exact image tags before running the script:

```bash
export WEB_IMAGE=ghcr.io/arbigamefi/ssot-bbog-web:sha-<git-sha>
export KEEPER_IMAGE=ghcr.io/arbigamefi/ssot-bbog-keeper:sha-<git-sha>
bash deploy/docker/deploy-images.sh
```

The script uses `docker compose up --no-build`, so the VPS does not compile the
Next.js app.

Fallback local build path:

```bash
docker compose -f compose.production.yml build web keeper-primary
```

The web image uses `next build` with `output: "standalone"` and runs
`node apps/web/server.js`. The keeper image builds TypeScript and runs
`node apps/keeper/dist/cli.js`.

## 4. Start

```bash
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml ps
```

For a local backup keeper drill on the same host:

```bash
docker compose -f compose.production.yml --profile backup-local up -d keeper-backup
```

Production backup keepers should run on another host/region with a different
funded keeper key and a 5 second delay.

## 5. Verify

```bash
curl -fsS https://$ARBGAMEFI_DOMAIN/api/healthz | jq .
curl -fsS https://$ARBGAMEFI_DOMAIN/ops/casino-keeper-health.json | jq .
docker compose -f compose.production.yml logs --tail=100 web
docker compose -f compose.production.yml logs --tail=100 keeper-primary
```

Expected posture:

- `release.status = ok`
- `keeper.status = ok`
- `betIndex.status = ok`
- `betIndex.source = postgres`

## 6. Cloudflare

Use Cloudflare for DNS, CDN, and WAF:

- DNS `A` record points at the Docker host.
- Proxy status enabled.
- SSL/TLS mode: Full (strict).
- Cache HTML bypassed or left default; Next static assets can be cached.
- WAF/rate-limit rules can sit in front of `/api/*`.

## 7. Rollback

Keep the previous image tag available. A minimal rollback is:

```bash
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d --no-deps web
curl -fsS https://$ARBGAMEFI_DOMAIN/api/healthz | jq .
```

Database rollback is separate and must use a tested Postgres backup/restore
procedure before public-risk launch.
