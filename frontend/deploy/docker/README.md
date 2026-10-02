# Docker deployment

One deployment runs one explicitly selected chain, one primary keeper, the web
app, Caddy, and the dedicated `arbigamefi` PostgreSQL database. The first release
uses Base Sepolia (`84532`) and one USDC casino pool; sportsbook stays disabled.
No mainnet keeper is started by this stack. Browser RPC uses official public Base
endpoints; keeper HTTP uses Infura and keeper WebSocket uses Alchemy.

## 1. Prepare environment files

From `frontend/`:

```bash
cp deploy/docker/env/postgres.env.example deploy/docker/env/postgres.env
cp deploy/docker/env/web.production.env.example deploy/docker/env/web.production.env
cp deploy/docker/env/keeper.primary.env.example deploy/docker/env/keeper.primary.env
cp deploy/docker/env/proxy.env.example deploy/docker/env/proxy.env
export DEPLOY_CHAIN_ID=84532
```

Replace every placeholder. Keep the database identity and credentials identical
in Postgres, web and keeper. Both app chain IDs and the keeper release path must
match `DEPLOY_CHAIN_ID`. Compose owns the keeper health path; do not add health
path overrides to the web env. Never commit real env files or expose keeper RPC
keys through `NEXT_PUBLIC_*` values.

The browser chain, public RPCs and feature flags are baked into the image. Runtime
env changes do not rebuild them. Keep runtime values aligned with the build.

## 2. Build authenticated images

PR and push workflows build for validation only. Publishing images requires a
manual `Frontend Docker Images` run on the exact reviewed source commit, with:

- `release_tag`: GitHub release holding the signed deployment bundle;
- `bundle_name`: exact `.tar.gz` asset name;
- `bundle_sha256`: independently approved archive hash;
- `chain_id`: `84532` for this deployment;
- optional `image_tag` for discovery.

Configure repository variable `V16_RELEASE_SIGNER` to the approved release signer
and optionally secret `FORK_RPC_URL_BASE_SEPOLIA` to a dedicated RPC. A Base mainnet
build instead uses `FORK_RPC_URL_BASE`. Without a secret, governance verification
uses the selected chain's official public RPC and fails closed on any RPC error. These are independent trust inputs, never taken
from the uploaded bundle. Do not put keystore passwords in GitHub or chat.

The build verifies archive hash, complete inventory, and exact source commit,
then uses the existing strict artifact, signature and live governance checks.
Only after those pass does it retain the selected chain's embedded manifest.
Web and keeper are built from that input. A not-yet-accepted Safe takeover cannot
produce deployable images. Contract deployment and governance acceptance must
therefore precede this image build.

The `casino_enabled` and `lp_deposits_enabled` workflow inputs default to false
for the initial operational smoke check. Enable them only in a separately reviewed
build after the required acceptance checks; this reuses the same signed contract
release without changing source. Sportsbook stays disabled for this first release.

Images are published to `ghcr.io/arbigamefi/ssot-bbog-web` and
`ghcr.io/arbigamefi/ssot-bbog-keeper`. Tags are lookup conveniences; deploy only
immutable digests. Ordinary source builds cannot replace these release tags.

## 3. Prepare the host and validate

Download the `arbigamefi-docker-deploy-bundle` artifact from the same workflow run.
It contains Compose, deployment scripts, Caddy configuration and env examples,
without source or secrets. Unpack into `/opt/arbigamefi/frontend`; real env files
are not included and must not be overwritten.

```bash
cd /opt/arbigamefi/frontend
export DEPLOY_CHAIN_ID=84532
export WEB_IMAGE=ghcr.io/arbigamefi/ssot-bbog-web@sha256:<reviewed-web-digest>
export KEEPER_IMAGE=ghcr.io/arbigamefi/ssot-bbog-keeper@sha256:<reviewed-keeper-digest>
export EXPECTED_REVISION=<full-reviewed-40-character-source-commit>
export EXPECTED_RELEASE_DIGEST=<approved-0x-prefixed-v16-release-digest>
bash deploy/docker/check-production-env.sh
```

The host checks env chain alignment and database identity. Before service changes,
the image guard verifies both OCI revisions and chain labels, exactly one embedded
chain, the expected release digest, and matching web/keeper contract routes. A
placeholder, stale release, extra chain or missing manifest fails closed.

In an authenticated source build checkout, optionally run
`CHECK_EMBEDDED_RELEASE=1 bash deploy/docker/check-production-env.sh` to validate
the selected embedded release too.

## 4. Start and verify

```bash
bash deploy/docker/deploy-images.sh
curl -fsS "https://$ARBGAMEFI_DOMAIN/api/healthz?chainId=84532" | jq .
curl -fsS "https://$ARBGAMEFI_DOMAIN/ops/casino-keeper-health.json?chainId=84532" | jq .
docker compose -p arbigamefi -f compose.production.yml logs --tail=100 keeper-primary
```

Require `release.status`, `keeper.status` and `betIndex.status` to be `ok`, with
`betIndex.source=postgres`. Health snapshots alone do not prove settlement: verify
an actual new-contract bet, VRF callback, WS-triggered keeper settlement, on-chain
receipt and durable database record, then exercise HTTP recovery after WS loss.

For a public mainnet launch, prefer managed Postgres; a single-host database needs
a verified backup/recovery plan. A production backup keeper belongs on another
host/region with a distinct funded key and the configured backup delay.

## 6. Cloudflare

Use Cloudflare for DNS, CDN, WAF, and edge TLS. Caddy obtains and renews
publicly trusted **server certificates** with ACME HTTP-01 for the canonical
`ARBGAMEFI_DOMAIN` and its `www`/`dapp` aliases. Configure Cloudflare SSL/TLS mode
as **Full (strict)** for these three application hostnames. If the zone also
proxies unrelated services, use a hostname-scoped Configuration Rule instead
of changing the zone-wide mode without validating those services. The aliases redirect to the canonical HTTPS hostname while
preserving the request path and query.

Keep port 80 reachable through Cloudflare so HTTP-01 validation can reach
Caddy, and persist `caddy_data` for certificate/account storage. TLS-ALPN
validation is explicitly disabled because Cloudflare terminates public TLS;
no Cloudflare API token, manually copied certificate, or additional service is
needed for this deployment. Do not cache or block `/.well-known/acme-challenge/*`.

Validate the Caddy configuration before starting or reloading it. Verify origin TLS with normal CA
and hostname checks as well as through the public hostname.

Cloudflare settings:

- DNS `A` record points at the Docker host.
- Proxy status enabled.
- SSL/TLS mode: Full (strict) for the three application hostnames.
- Cache HTML bypassed or left default; Next static assets can be cached.
- WAF/rate-limit rules can sit in front of `/api/*`.

### OG image cache rule

Dynamic Open Graph images are generated by the Next.js app. The app sends
immutable cache headers for successful OG images and explicit `no-store` headers
for pending receipt images, but Cloudflare may still classify extensionless
dynamic image routes as `DYNAMIC` unless a cache rule makes them eligible for
edge caching.

Create a Cloudflare Cache Rule for the production hostname:

```text
When:
  Hostname equals arbigamefi.com
  AND (
    URI Path equals /opengraph-image
    OR URI Path contains /opengraph-image
    OR URI Path matches wildcard /casino/receipt/*/*/og
  )

Then:
  Cache eligibility: Eligible for cache / Cache everything
  Edge TTL: Respect origin headers
  Browser TTL: Respect origin headers
  Cache key: Include query string
```

Do not create a blanket cache rule for `/casino/receipt/*`; only the `/og`
image endpoint is immutable. The receipt page and receipt JSON/API paths must
remain normal dynamic responses.

Verify after deploying and applying the Cloudflare rule:

```bash
curl -sSI -A 'Twitterbot/1.0' "https://$ARBGAMEFI_DOMAIN/casino/receipt/84532/294/og" \
  | tr -d '\r' \
  | grep -Ei '^(cache-control|cdn-cache-control|cloudflare-cdn-cache-control|cf-cache-status|content-type):'

curl -sSI -A 'Twitterbot/1.0' "https://$ARBGAMEFI_DOMAIN/casino/receipt/84532/294/og" \
  | tr -d '\r' \
  | grep -Ei '^(cf-cache-status|age):'
```

Expected result after the second request: `content-type: image/png`,
immutable cache headers, and `cf-cache-status: HIT` or a warm-cache equivalent.

Verify through Cloudflare:

```bash
curl -fsS https://$ARBGAMEFI_DOMAIN/api/healthz | jq .
curl -fsS https://$ARBGAMEFI_DOMAIN/ops/casino-keeper-health.json | jq .
```
