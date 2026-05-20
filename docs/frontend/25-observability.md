# 25 · Observability

| Owner | Frontend Lead + SRE |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `23-security.md`, `24-testing.md` |
| Supersedes | Draft v1 analytics taxonomy |

Observability exists to answer operational questions, not to create a full
analytics bureaucracy before product usage exists.

The MVP questions are:

1. Is the web app broken?
2. Is the casino round flow stuck?
3. Is the keeper healthy?
4. Are durable bet-index reads failing or falling back?
5. Are users reaching the main conversion steps?

## 1. Tooling

| Concern                  | Tool                                      |
| ------------------------ | ----------------------------------------- |
| Frontend/server errors   | Sentry via `@sentry/nextjs`               |
| Web Vitals               | Sentry/Vercel route-level metrics         |
| Keeper health            | `/ops/casino-keeper-health.json`          |
| Durable bet index health | API route logs + Sentry tags              |
| Product funnel MVP       | typed in-app events only when implemented |

PostHog, session replay, tag managers, and broad autocapture are out of scope
until there is real funnel traffic and a privacy review.

## 2. Privacy Rules

- Do not send raw wallet addresses to analytics.
- Do not send private keys, signatures, request bodies, or env values.
- Do not enable Sentry replay by default.
- Do not use third-party tag managers.
- Amounts, if tracked, must be binned rather than raw bigint strings.
- Product events should use route patterns such as `/casino/[slug]`, not full
  URLs with query parameters.

## 3. Minimum Events

Only track events that answer current product or operations questions:

| Event                         | Purpose                              |
| ----------------------------- | ------------------------------------ |
| `wallet.connected`            | Visitor reached wallet connection.   |
| `casino.bet.place_started`    | User attempted a casino round.       |
| `casino.bet.place_mined`      | `placeBet` landed on-chain.          |
| `casino.bet.random_ready`     | VRF result became readable.          |
| `casino.bet.settled`          | Round reached terminal settlement.   |
| `casino.bet.failed`           | UI showed a terminal failure state.  |
| `sports.ticket.place_started` | User attempted a sportsbook ticket.  |
| `sports.ticket.place_mined`   | Ticket landed on-chain.              |
| `lp.deposit.started`          | LP flow began.                       |
| `error.shown`                 | A user-visible error state rendered. |

Adding more events requires a clear question they answer. Do not add a taxonomy
because a future dashboard might use it.

## 4. Required Tags

Errors and events should attach only low-risk context:

```ts
type ObservabilityContext = {
  chainId: number;
  releaseDigest?: string;
  appVersion?: string;
  routePattern: string;
  locale: string;
  walletHash?: string; // sha256(address).slice(0, 12), never raw address
};
```

## 5. Casino Round SLOs

Track these once Sentry metrics or equivalent are wired:

| Metric                          | Target                        | Alert          |
| ------------------------------- | ----------------------------- | -------------- |
| `placeBet mined -> randomReady` | p95 < 60s on testnet          | p95 > 120s     |
| `randomReady -> settled`        | p95 < 20s with keeper running | p95 > 60s      |
| manual settle offered rate      | < 2%                          | > 5%           |
| refund path rate                | < 0.5%                        | > 2%           |
| raw error copy shown            | 0                             | any occurrence |

These SLOs are product-health signals. They do not change the contract liveness
model: permissionless finalize/refund remains the backstop.

## 6. Health Surfaces

Keep these visible to operators:

- `/ops/casino-keeper-health.json`
- `/ops` keeper health panel
- `/api/bets/recent` degraded/fallback state
- `/api/bets/player/[address]` degraded/fallback state
- release digest and chain id in the product shell

Health files must not live in `apps/web/public/ops`; that path conflicts with
the Next route.

## 7. Sentry Setup Requirements

Sentry must:

- use release/build tags;
- set `sendDefaultPii: false`;
- scrub URLs and breadcrumbs;
- group known app errors by stable error code when possible;
- upload sourcemaps only through CI secrets;
- avoid session replay unless explicitly reviewed.

## 8. Do Not Do

- Do not introduce PostHog/autocapture before consent and privacy review.
- Do not send raw wallet addresses, raw amounts, signatures, or request bodies.
- Do not build dashboards for events that are not emitted.
- Do not treat analytics as the chain source of truth.
- Do not let observability failures block settlement or keeper operation.

## 9. Verification

```bash
# No obvious raw wallet tracking.
rg -nE "track\\(.*address|track\\(.*signer|track\\(.*0x[0-9a-fA-F]{40}" frontend/apps/web/src

# No product code console noise outside tests/fixtures.
rg -nE "console\\.(log|error|warn)\\(" frontend/apps/web/src \
  | rg -v "test|stories|fixture"

# Keeper health route test.
pnpm -C frontend/apps/web test -- src/app/ops/casino-keeper-health.json/route.test.ts
```
