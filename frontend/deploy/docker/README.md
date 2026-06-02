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
cp deploy/docker/env/keeper.testnet.primary.env.example deploy/docker/env/keeper.testnet.primary.env
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
- `BET_INDEX_DATABASE_URL` in `keeper.testnet.primary.env`
- `BET_INDEX_DATABASE_URL` in `keeper.backup.env`, if used

Never commit the real `.env` files.

The default Docker stack runs two primary keepers:

- `keeper-primary`: Base mainnet (`8453`)
- `keeper-testnet-primary`: Base Sepolia (`84532`)

They write separate health snapshots into the shared `keeper_health` volume:

- `/var/lib/arbigamefi/casino-keeper/base-mainnet-primary-health.json`
- `/var/lib/arbigamefi/casino-keeper/base-sepolia-primary-health.json`

The web service reads both paths through `KEEPER_HEALTH_PATH_8453` and
`KEEPER_HEALTH_PATH_84532`. Use `?chainId=84532` on `/api/healthz` or
`/ops/casino-keeper-health.json` to inspect the testnet keeper.

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

Check both keeper chains explicitly:

```bash
curl -fsS "https://$ARBGAMEFI_DOMAIN/api/healthz?chainId=8453" | jq .
curl -fsS "https://$ARBGAMEFI_DOMAIN/api/healthz?chainId=84532" | jq .
curl -fsS "https://$ARBGAMEFI_DOMAIN/ops/casino-keeper-health.json?chainId=8453" | jq .
curl -fsS "https://$ARBGAMEFI_DOMAIN/ops/casino-keeper-health.json?chainId=84532" | jq .
```

## 6. Cloudflare

Use Cloudflare for DNS, CDN, WAF, and edge TLS. The Docker host should use a
Cloudflare Origin Certificate with Cloudflare SSL/TLS mode set to **Full
(strict)**.

Create the origin certificate in Cloudflare:

1. Open Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate.
2. Include `arbigamefi.com` as the hostname. Add `*.arbigamefi.com` only if
   this host will serve subdomains too.
3. Save the certificate to:

   ```text
   deploy/docker/certs/cloudflare-origin.pem
   ```

4. Save the private key to:

   ```text
   deploy/docker/certs/cloudflare-origin-key.pem
   ```

5. Keep the key private and restrict it on the host:

   ```bash
   chmod 600 deploy/docker/certs/cloudflare-origin-key.pem
   ```

The committed Caddyfile loads these files directly:

```text
tls {$CLOUDFLARE_ORIGIN_CERT_PATH} {$CLOUDFLARE_ORIGIN_KEY_PATH}
```

That means Caddy does not request a Let's Encrypt certificate for the production
site. This is intentional for orange-cloud deployments because Cloudflare
terminates public TLS at the edge and validates the private origin certificate
between Cloudflare and Caddy.

Cloudflare settings:

- DNS `A` record points at the Docker host.
- Proxy status enabled.
- SSL/TLS mode: Full (strict).
- Cache HTML bypassed or left default; Next static assets can be cached.
- WAF/rate-limit rules can sit in front of `/api/*`.

After copying the cert files to the VPS, restart only the proxy:

```bash
docker compose -f compose.production.yml up -d caddy
```

Verify through Cloudflare:

```bash
curl -fsS https://$ARBGAMEFI_DOMAIN/api/healthz | jq .
curl -fsS https://$ARBGAMEFI_DOMAIN/ops/casino-keeper-health.json | jq .
```

## 7. Rollback

Keep the previous image tag available. A minimal rollback is:

```bash
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d --no-deps web
curl -fsS https://$ARBGAMEFI_DOMAIN/api/healthz | jq .
```

Database rollback is separate and must use a tested Postgres backup/restore
procedure before public-risk launch.
