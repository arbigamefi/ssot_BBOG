# 23 · Security & Privacy

| Owner | Frontend Lead + Security |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `../design/00-charter.md`, `../design/13-web3-ux.md` |
| Supersedes | — |

A wallet-facing dApp is **a phishing target**. This document is the frontend
security baseline. Every page, every dependency, every header, every secret
must conform.

## 1. Threat Model (frontend)

| Threat                  | Vector                             | Mitigation                                                               |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Phishing                | Look-alike domain                  | Domain pill in shell, release-digest verification, official social links |
| Wallet draining         | Malicious script injected via dep  | CSP `script-src 'self'`, SRI, supply-chain auditing                      |
| Approve-all exploit     | User signs unlimited allowance     | Default exact-amount, "advanced" toggle for max                          |
| Replay tx               | Old signed odds reused             | Permit2 nonces, server-issued nonces for sportsbook odds                 |
| Clickjacking            | iframe embedding                   | `X-Frame-Options: DENY`, `frame-ancestors 'none'`                        |
| Spoofed tx preview      | Malicious script alters simulation | Simulation runs in our own SDK, deterministic, displayed verbatim        |
| Stolen API key          | NEXT_PUBLIC leak                   | No private keys / API secrets in client envs                             |
| Browser extension abuse | Malicious extension steals address | Out of scope; warn users via docs                                        |
| DNS hijack              | Domain takeover                    | Domain registrar lock, monitoring, fallback IPFS                         |
| RPC tampering           | Hostile RPC provider               | RPC allowlist + multi-provider fallback                                  |

## 2. Content Security Policy

Strict CSP per route, served via Next.js `headers()`:

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';                   /* tailwind needs inline */
img-src 'self' data: blob: https://*.arbigamefi.com;
font-src 'self';
connect-src 'self'
  https://*.arbigamefi.com
  https://*.alchemy.com https://*.quicknode.com https://*.infura.io
  wss://*.arbigamefi.com
  https://*.coinbase.com https://*.walletconnect.com
  https://o4505*.ingest.sentry.io;
frame-src 'none';
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

Adjustments per environment (staging adds `*.vercel.app`).

### 2.1 No inline scripts

Theme-init script (currently in `app/layout.tsx`) must move to:

- a small `app/theme-init.ts` exported as a route handler returning a JS file
  with `Cache-Control: public, max-age=31536000, immutable`, included via
  `<script src="/_theme-init.js">`, **or**
- a nonce-based inline script (`script-src 'self' 'nonce-<nonce>'`).

We choose option 2 with rotating nonce per response.

## 3. Cross-Origin Policies

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

`COOP: same-origin` allows `SharedArrayBuffer` if ever needed.
`Permissions-Policy` denies sensors and credentials APIs.

## 4. Secrets and Env Vars

### 4.1 Allowlist

Public env vars (`NEXT_PUBLIC_*`) — these are visible to all clients:

```
NEXT_PUBLIC_DEFAULT_CHAIN_ID
NEXT_PUBLIC_RPC_FALLBACK_URL
NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_RELEASE_DIGEST
NEXT_PUBLIC_BUILD_SHA
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_INDEXER_BASE_URL
```

Anything else marked `NEXT_PUBLIC_*` requires a security review.

### 4.2 Forbidden in `NEXT_PUBLIC_*`

- private keys
- signing keys
- DB credentials
- vendor API keys with write or large-cost access
- internal-only RPC URLs (use the public fallback path)

### 4.3 Secret scanning

`gitleaks` runs on every PR.
`secretlint` runs in pre-commit.
Both block on any match.

## 5. Supply Chain

### 5.1 Lockfile

`pnpm-lock.yaml` is canonical. Every PR runs:

```bash
pnpm install --frozen-lockfile
```

### 5.2 Dependency reviews

- `pnpm audit --prod` weekly + on dependency PRs; blocks on `critical`.
- `socket.dev` (or equivalent) integration flags malicious packages,
  install-time scripts, postinstall obfuscation.
- New direct dependency requires ADR. Renames/forks of known packages are
  rejected.
- License whitelist: MIT, Apache-2.0, ISC, BSD-{2,3}-Clause, CC0-1.0.
  Anything else needs Legal review.

### 5.3 Renovate / Dependabot

Automated PR per minor/patch on a weekly cadence. Major updates land via
manual PR with notes. Auto-merge enabled only for patch updates of trusted
publishers.

### 5.4 SRI for any external `<script>` or `<link>`

We don't ship external runtime resources in v1. If introduced, every
external resource carries `integrity="sha384-..."` and `crossorigin="anonymous"`.

## 6. Wallet Safety Patterns

(Some duplicated from `../design/13-web3-ux.md` — security-critical
restatement.)

- **No** automatic chain switch.
- **No** automatic `approve(MAX_UINT256)`.
- **No** transaction send without prior `eth_call` simulation.
- **No** displaying tx data interpreted in a way that differs from the SDK
  encoding (the displayed `Approve 100 USDC` must equal calldata).
- **No** raw signature requests without `<SignaturePreview>` (`13-web3-ux §10`).
- **No** persisting signatures or raw messages.

## 7. Anti-phishing

### 7.1 Domain pill

A persistent UI element in `<AppShell>` shows the served origin and the
release digest. If `window.location.origin !== expectedOrigin` (from
release manifest), the pill turns danger-red.

### 7.2 Official social channels

Listed in `/legal/disclaimer` and at the bottom of OG description. Never
inside a banner that could be tampered with by injection.

### 7.3 Email / domain hygiene

DKIM / SPF / DMARC configured by Ops. Not a frontend concern but referenced
here for completeness.

## 8. RPC Safety

### 8.1 Allowlist

`wagmi` config accepts only providers from the release manifest's
`rpcAllowlist`. Custom RPC entry from the user is **disabled in production**.

### 8.2 Multi-provider fallback

`wagmi` is configured with multiple providers per chain. Health-check
ranks providers by latency + success rate; auto-rotates on consecutive
failures.

### 8.3 Read-only key separation

Read RPC (chain reads, indexer subgraph) is fronted by a public-safe
endpoint. Write RPC (sending tx) is wallet-supplied; we never use a
custodial RPC for write.

## 9. User Data & Privacy

### 9.1 We do not collect

- Email addresses (no account system).
- Names / DOB / KYC data (out of scope for v1).
- Wallet seed phrases — wallets handle that, not us.

### 9.2 We do collect (with consent or essential-only basis)

- Wallet address hash (sha256, truncated 8 chars) for analytics — never
  full address.
- Page URL (sanitized — no query params containing addresses).
- Sentry breadcrumbs scrubbed of personal data.
- Theme preference, locale (functional cookies — essential).

### 9.3 Cookie inventory

| Name                       | Purpose                                   | Type       | Lifespan |
| -------------------------- | ----------------------------------------- | ---------- | -------- |
| `arbi-locale`              | locale preference                         | functional | 1 year   |
| `arbi-theme`               | dark/light preference                     | functional | 1 year   |
| `arbi-installed-dismissed` | PWA install prompt dismissal              | functional | 30 days  |
| `arbi-flags-*`             | per-env feature flag overrides (dev-only) | functional | 30 days  |

No third-party cookies. No tracking cookies. No `localStorage` for
analytics IDs.

### 9.4 Right to erasure

Since we do not store personal data on our servers (all activity is
on-chain), no DSAR pipeline is required. Local data (theme, locale) can be
cleared by the user via browser settings or the in-app `Clear local data`
control under `/portfolio`.

## 10. Build & Release Security

- Source maps are uploaded to Sentry but **not** served publicly.
- Production builds run on isolated GitHub runners with no inbound network
  access beyond pnpm registry + Sentry release upload.
- Releases are tagged with a build SHA + the contract release digest. The
  build's `NEXT_PUBLIC_BUILD_SHA` matches the deployed commit.
- A release is rejected if the deployed `release-digest` does not match the
  one in the manifest.

## 11. Don'ts

- No `eval`, `Function()`, `setTimeout(string)`, `setInterval(string)`.
- No inline scripts without nonce.
- No `dangerouslySetInnerHTML` from untrusted data.
- No custom RPC entry in production UI.
- No "trust me" buttons (e.g., "Trust this contract"). The release digest
  is the source of truth.
- No third-party widgets on production routes (chat, support widgets — use
  a `/legal/contact` page with email instead).
- No `unsafe-eval` in CSP except `wasm-unsafe-eval` for WebAssembly (used by
  crypto libs like blake3-wasm if introduced).
- No service worker that intercepts wallet RPC calls.

## 12. How To Enforce

```bash
# Banned eval / new Function
rg -nE "\\beval\\(|new Function\\(" frontend/apps/web/src frontend/packages/ui/src

# Inline scripts in HTML files
rg -nE "<script>[^<]" frontend/apps/web

# Secrets
gitleaks detect --redact --config=.gitleaks.toml

# CSP headers present in next.config
node scripts/check-csp-headers.mjs

# License audit
pnpm licenses ls --prod --json | node scripts/check-license-allowlist.mjs

# RPC allowlist enforced
node scripts/check-rpc-allowlist.mjs
```

## 13. Incident Response

A frontend security incident (XSS, compromised dependency, phishing site
takeover) follows:

1. Page on-call (per `docs/ops/runbooks/`).
2. Roll back to last known-good release in Vercel.
3. Revoke compromised credentials (rotate WalletConnect project id, RPC
   provider key, Sentry DSN if needed).
4. Post-mortem within 24h, published in `docs/ops/incident-templates/`.

## 14. Glossary

| Term               | Meaning                                            |
| ------------------ | -------------------------------------------------- |
| CSP                | Content Security Policy                            |
| COOP/COEP          | Cross-Origin Opener/Embedder Policy                |
| SRI                | Subresource Integrity                              |
| Permit2            | Uniswap universal allowance contract               |
| DSAR               | Data Subject Access Request                        |
| `unsafe-eval`      | CSP directive permitting `eval` and `new Function` |
| `wasm-unsafe-eval` | CSP directive permitting WebAssembly compilation   |
