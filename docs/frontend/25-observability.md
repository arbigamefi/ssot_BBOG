# 25 · Observability & Analytics

| Owner | Frontend Lead + SRE |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `../design/00-charter.md`, `../design/13-web3-ux.md`, `../design/14-data-and-state.md`, `23-security.md` |
| Supersedes | — |

The frontend must answer three questions at all times:

1. **Is it broken right now?** (errors, exceptions, broken flows)
2. **Is it slow right now?** (Core Web Vitals, RPC latency)
3. **Are users doing the things we built it for?** (conversion, drop-off, recovery)

This document is the operational contract for those three questions.

## 1. Tooling Selection

| Concern                       | Tool                                           | Why                                                               |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| Errors / breadcrumbs          | **Sentry** (`@sentry/nextjs`)                  | already in deps; RSC + Edge support; sourcemap pipeline           |
| Real-user monitoring (RUM)    | **Sentry RUM** + **Vercel Analytics**          | Sentry covers Web Vitals + custom; Vercel adds free per-route p75 |
| Product analytics             | **PostHog (self-hosted)**                      | event taxonomy, funnel, retention; privacy-controllable           |
| Log aggregation (server logs) | **Vercel Logs** + **Sentry transport**         | server-side errors flow to Sentry                                 |
| Status page                   | **Statuspage.io** (or open-source alternative) | external uptime                                                   |

Rejected:

- Google Analytics — 3rd-party cookies, privacy regression.
- Segment / Mixpanel — vendor lock + cost.
- DataDog RUM — over-spec for v1.

If a different stack is adopted later, the **event taxonomy** in §3 stays
invariant.

## 2. Privacy Contract

Per `23-security.md §9`:

- We **never** send raw wallet addresses to analytics or Sentry.
- A wallet identifier is computed as `sha256(address).slice(0, 12)` and used as a
  pseudo-id. We never reverse-link it.
- IP addresses are dropped at the edge (Sentry: `sendDefaultPii: false`).
- No PII in event properties. Schemas in §3 enforce this.
- DNT (`Do Not Track`) honored — no analytics or Sentry breadcrumbs.
- Cookie-banner: not required (we don't set non-essential cookies in v1).
  When PostHog autocapture is enabled, a consent banner becomes mandatory.

## 3. Event Taxonomy

A finite, versioned catalog. Adding an event requires a PR touching this
document and `apps/web/src/lib/analytics/events.ts`.

### 3.1 Event naming convention

`<surface>.<noun>.<verb_past_or_present>`

- `wallet.connect.requested`
- `wallet.connect.succeeded`
- `wallet.connect.failed`
- `bet.simulate.requested`
- `bet.simulate.failed`
- `bet.place.signed`
- `bet.place.mined`
- `bet.place.reverted`
- `bet.finalize.requested`
- `bet.finalize.mined`
- `lp.deposit.signed`
- `lp.deposit.mined`
- `lp.withdraw.signed`
- `lp.withdraw.mined`
- `lp.withdraw.a4_blocked`
- `ticket.place.signed`
- `ticket.place.mined`
- `ticket.settle.requested`
- `ticket.refund.requested`
- `error.shown`
- `route.navigated`
- `release.proof.opened`

### 3.2 Common properties (auto-attached)

```ts
type CommonProps = {
  release_digest: string; // truncated hash
  chain_id: number;
  app_version: string; // NEXT_PUBLIC_BUILD_SHA
  locale: string; // resolved locale
  theme: "dark" | "light";
  walletHash?: string; // sha256 first 12, only when connected
  pageRoute: string; // route pattern, not URL
  ts: number; // ms epoch
};
```

`pageRoute` uses the Next.js route pattern (`/casino/[slug]`), never the
expanded path.

### 3.3 Per-event properties (excerpt)

```ts
type Events = {
  "wallet.connect.requested": { connector: string };
  "wallet.connect.succeeded": { connector: string; chain_id: number };
  "wallet.connect.failed": { connector: string; code: string };

  "bet.simulate.requested": {
    game_slug: string;
    asset_symbol: string;
    bet_count: number;
  };
  "bet.simulate.failed": { game_slug: string; code: ErrorCode };
  "bet.place.signed": {
    game_slug: string;
    asset_symbol: string;
    tx_hash: string;
  };
  "bet.place.mined": {
    game_slug: string;
    asset_symbol: string;
    tx_hash: string;
    outcome: "won" | "lost" | "refunded";
  };
  "bet.place.reverted": {
    game_slug: string;
    tx_hash: string;
    reason_code?: string;
  };
  "bet.finalize.requested": { game_slug: string };
  "bet.finalize.mined": {
    game_slug: string;
    outcome: "won" | "lost" | "refunded";
  };

  "lp.deposit.signed": {
    asset_symbol: string;
    bigint_amount_bin: string /* binned, not raw */;
    tx_hash: string;
  };
  "lp.deposit.mined": {
    asset_symbol: string;
    bigint_amount_bin: string;
    tx_hash: string;
  };
  "lp.withdraw.a4_blocked": { asset_symbol: string };

  "ticket.place.signed": {
    market_id: string;
    outcome_id: number;
    tx_hash: string;
  };
  "ticket.place.mined": {
    market_id: string;
    outcome_id: number;
    tx_hash: string;
  };

  "error.shown": {
    code: ErrorCode;
    pageRoute: string;
    severity: "info" | "warn" | "danger";
  };
  "route.navigated": {
    from: string;
    to: string;
    navigation_type: "click" | "back" | "forward";
  };
  "release.proof.opened": { source: "header" | "banner" };
};
```

### 3.4 Amount handling in events

We never send raw `bigint` strings. Instead we **bin** amounts to coarse
buckets (`0.01-0.1`, `0.1-1`, `1-10`, `10-100`, `100-1k`, `1k-10k`,
`10k-100k`, `>100k`) per asset, normalized by decimals. The bin function
lives in `apps/web/src/lib/analytics/binning.ts`.

This protects user privacy while preserving funnel insight.

### 3.5 Schema enforcement

`zod` schema per event:

```ts
const Schemas = {
  "bet.place.signed": z.object({
    game_slug: z.enum([
      "dice",
      "cointoss",
      "roulette",
      "keno",
      "plinko",
      "sicbo",
      "slots",
      "baccarat",
    ]),
    asset_symbol: z.string().max(10),
    tx_hash: zHash,
  }),
  // ...
};
```

Sending an event with the wrong shape throws in dev and is dropped (+ Sentry
warning) in prod.

## 4. Sentry Configuration

### 4.1 SDK setup

`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
generated by `@sentry/nextjs`. Required options:

```ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_BUILD_SHA,
  environment: process.env.NEXT_PUBLIC_ENV, // 'production' | 'preview' | 'staging' | 'development'
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0, // off by default; v1 has no replays
  replaysOnErrorSampleRate: 0.1, // only on error
  sendDefaultPii: false,
  beforeSend: scrubPiiBreadcrumbs,
});
```

### 4.2 Sourcemap upload

`SENTRY_AUTH_TOKEN` is a build-time CI secret. Maps are uploaded but not
served publicly (`23-security.md §10`).

### 4.3 Release tagging

`release` matches `NEXT_PUBLIC_BUILD_SHA`. Sentry auto-correlates errors with
the deploy.

### 4.4 Breadcrumb hygiene

`beforeBreadcrumb` strips:

- URL search params named `address|account|wallet|signer|tx`
- request bodies entirely (no inadvertent JSON capture)
- console messages tagged with private data (we use a tag system)

### 4.5 Error categorization

Each application error includes a `tags.code` aligned with the error
taxonomy from `../design/13-web3-ux.md §6`. Sentry groups by `code` so
"100 different ways the bank is paused" aren't 100 separate issues.

## 5. Web Vitals

### 5.1 Capture

`web-vitals` library reports LCP, INP, CLS, TTFB, FCP. Reported to both:

- Sentry (`Sentry.metrics.distribution`)
- Vercel Analytics (automatic)
- PostHog as an event `webvitals.report`

### 5.2 Dashboards

- p75 per route → Sentry dashboard `Frontend / Web Vitals by Route`.
- Bundle size per release → Sentry release page.
- Long-task spikes → alert if p95 > 200 ms for 15 min.

### 5.3 Alerts

| Condition                                               | Severity | Action            |
| ------------------------------------------------------- | -------- | ----------------- |
| p75 LCP > 2.5 s for 1 h on `/`                          | warn     | Slack `#frontend` |
| p75 LCP > 3.5 s on `/`                                  | critical | page on-call      |
| Error rate > 1% for 15 min                              | critical | page on-call      |
| Sentry crash event count > 50/h                         | critical | page on-call      |
| New crash in last release (k = 5 occurrences in 10 min) | warn     | Slack             |

## 6. Tx Funnel Metrics

The "place a bet" funnel is the most important metric.

```
wallet.connect.succeeded
   ↓
bet.simulate.requested
   ↓
bet.simulate.failed              ← drop-off A
   ↓
bet.place.signed                  ← drop-off B (user rejected)
   ↓
bet.place.mined                   ← drop-off C (tx reverted)
   ↓
bet.finalize.mined                ← drop-off D (stuck VRF)
```

PostHog funnel auto-built. Weekly review reports A/B/C/D drop-off rates and
trends.

## 7. Audit Trail

Tx events double as an in-app audit trail. `apps/web/src/features/_shared/tx-journal/`
persists events to IndexedDB with:

```ts
type JournalEntry = {
  id: string;
  ts: number;
  type: "bet.place" | "lp.deposit" | "lp.withdraw" | "claim" | "ticket.place";
  tx_hash?: string;
  chain_id: number;
  status: "signed" | "mined" | "reverted" | "timeout";
  release_digest: string;
};
```

Available at `/portfolio/activity`. Encrypted at rest is unnecessary (no
private info). Cleared by user via `Clear local data`.

## 8. Health Checks

The frontend exposes a `/api/healthz` route returning:

```json
{
  "status": "ok",
  "build": "<NEXT_PUBLIC_BUILD_SHA>",
  "release_digest": "<expected digest>",
  "ts": 1714563600000
}
```

Used by Statuspage's HTTP monitor + Vercel monitors.

A second endpoint `/api/release` returns the parsed release manifest with
30s cache for client-side verification.

## 9. Outage Playbook

On a critical alert (Web Vitals breach, error spike), on-call follows
`docs/ops/runbooks/frontend-outage.md` (to be authored under
`docs/ops/runbooks/`). Step summary:

1. Confirm via `/api/healthz` and Statuspage.
2. Inspect Sentry release dashboard.
3. Roll back the Vercel deployment if a recent release is implicated.
4. Communicate on Statuspage.
5. Post-mortem.

## 10. Don'ts

- No raw wallet address in any analytics payload.
- No untyped events. New event → schema + this doc.
- No sampling tx events. Funnels need 100% capture.
- No PostHog autocapture without consent UI.
- No third-party tag managers (GTM, Tealium).
- No Sentry Replays in v1 (privacy review pending).
- No analytics calls in RSC server boundary — events are client-side only.
- No `console.error` in production — convert to Sentry capture.

## 11. How To Enforce

```bash
# Event schema sync
node scripts/check-event-schemas.mjs

# Raw address scan in analytics calls
rg -nE "track\\(.*address|track\\(.*signer|track\\(.*0x[0-9a-fA-F]{40}" frontend/apps/web/src

# console.error / console.log scan
rg -nE "console\\.(log|error|warn)\\(" frontend/apps/web/src \
  | rg -v "test|stories|fixture"

# Sentry release tag presence at build
test -n "$NEXT_PUBLIC_BUILD_SHA"
```

## 12. Glossary

| Term            | Meaning                                                           |
| --------------- | ----------------------------------------------------------------- |
| RUM             | Real User Monitoring — production-user-collected performance data |
| LCP / INP / CLS | Core Web Vitals (`22-performance.md`)                             |
| Funnel          | A sequence of events used to measure conversion                   |
| Binning         | Coarsening a continuous value into buckets for privacy            |
| Walletash       | sha256(address).slice(0,12) — pseudo-id for analytics             |
| Replay          | Sentry Session Replay — DOM event capture (not used in v1)        |
