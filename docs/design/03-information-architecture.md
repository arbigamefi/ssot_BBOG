# 03 · Information Architecture

| Owner | Product Lead + Design Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md`, `02-voice-and-copy.md` |
| Supersedes | the route map in `north-star.md §4` and `frontend-rewrite-blueprint.md §6` |

This document defines **who uses the product, what they're trying to do, where
they go, and what they see in every state**. Page-level visual blueprints with
slot definitions live in `04-page-blueprints.md`.

## 1. Personas

The four canonical users:

| ID        | Persona                        | Goals                                                                    | Primary surfaces                                |
| --------- | ------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------- |
| **P-PLY** | Player                         | Place a bet, see fairness proof, recover funds on a stuck bet            | `/`, `/casino/*`, `/sportsbook/*`, `/portfolio` |
| **P-LP**  | Liquidity Provider             | Deposit to a Bank, monitor NAV / reserved / yield, withdraw safely       | `/earn`, `/portfolio`, `/ops`                   |
| **P-OPS** | Operator / oracle / governance | Monitor release, indexer, exposure, pause, finalize stuck bets           | `/ops`, `/portfolio`                            |
| **P-AUD** | Auditor / partner / press      | Verify deploy digest, contract addresses, SSOT invariants, audit reports | `/`, `/ops`, `/legal/*`, links to GitHub & docs |

Every page in §3 declares which personas it primarily serves.

## 2. Core Journeys

### J1 · First-time Player → Place First Bet

```mermaid
flowchart LR
  A[/  marketing] --> B[/casino  directory]
  B --> C[/casino/dice  room]
  C --> D{Wallet connected?}
  D -- no --> E[Connect modal]
  E --> D
  D -- yes --> F[Approve USDC]
  F --> G[Configure bet params]
  G --> H[Confirm simulation]
  H --> I[Sign tx]
  I --> J[Pending VRF state]
  J --> K[Settled · win/loss]
  K --> L[/portfolio  ledger]
```

Failure branches that MUST be designed:

- Wrong chain → chain-switch banner inside the room.
- Insufficient native gas → friendly error before signing.
- Insufficient stake-asset balance → error before signing.
- VRF timeout → Refund button appears after `refundTimeoutSeconds`.
- VRF fulfilled but `module.resolve` reverts → status banner explains the
  fallback-refund path (see `13-web3-ux.md §8.2`).
- User closes wallet during sign → recover idle state, no zombie loading.

### J2 · LP Deposit → Withdraw

```mermaid
flowchart LR
  A[/earn] --> B[Approve allowance]
  B --> C[Choose asset + amount]
  C --> D[Confirm preview]
  D --> E[Sign deposit]
  E --> F[Hold LP shares]
  F --> G[Monitor NAV & APY in /portfolio]
  G --> H{Withdraw?}
  H -- yes --> I[Choose shares or assets]
  I --> J[Optional-outflow domain check]
  J -- pass --> K[Sign withdraw]
  J -- A4 fail --> L[Show free-liquidity limit]
  L --> I
  K --> M[Settled]
```

Edge cases:

- Bank paused (risk-in pause): deposit disabled with banner, withdraw and
  claim remain available (per smart-contract invariant LIVE).
- Bank's free-liquidity floor (NAV − R − MinLiq) is < requested amount: cap
  the amount slider and explain.

### J3 · Sportsbook Ticket Lifecycle

```mermaid
flowchart LR
  A[/sportsbook] --> B[Pick market]
  B --> C[Open ticket panel]
  C --> D[Receive signed odds snapshot]
  D --> E[Place ticket]
  E --> F[Market locks]
  F --> G[Reporter proposes result]
  G --> H{Challenged?}
  H -- no --> I[Auto-finalize after window]
  H -- yes --> J[Challenge UI]
  J --> K{Arbitration outcome}
  K -- uphold --> L[Settle tickets]
  K -- reopen --> G
  K -- void --> M[Refund tickets]
  I --> L
```

Each state node above maps to a defined UI in `04-page-blueprints.md §4`.

### J4 · Auditor Verification

A linear journey, but every step matters:

1. Open `/`.
2. See release digest in the chrome header (clickable → opens release proof
   drawer).
3. Read `/ops` for current chain, indexer status, contract addresses.
4. Follow link to GitHub release tag + audit report.

The "release proof drawer" is a shared `<ReleaseProof>` pattern available on
every product route; auditors don't need to leave the page.

## 3. Sitemap

```
/
├── /casino                     # directory
│   ├── /casino/dice
│   ├── /casino/coin-toss
│   ├── /casino/roulette
│   ├── /casino/keno
│   ├── /casino/plinko
│   ├── /casino/sicbo
│   ├── /casino/slots
│   └── /casino/baccarat
├── /sportsbook                 # market list
│   └── /sportsbook/[marketId]  # market detail + ticket
├── /portfolio
│   ├── /portfolio/activity     # bet + tx ledger
│   └── /portfolio/claims       # XP + refundCredit
├── /earn                       # LP deposit / withdraw
├── /ops                        # control room
└── /legal
    ├── /legal/privacy
    ├── /legal/terms
    └── /legal/disclaimer

# Legacy route policy
/dice, /roulette, /cointoss, /keno      → 404
/games, /games/[slug]                   → 404
/account, /bets, /bets/[id]             → 404
/claims, /referral                      → 404
/invest, /liquidity                     → 404
/privacy, /terms, /disclaimer           → 404
/prototype/*                            → 404 (production); accessible only in sandbox build
```

The clean-room frontend has no legacy public aliases. Product copy, AppShell
active-route logic, tests, and precheck gates must use canonical routes only.

| Route                    | Personas           | Description                                                              |
| ------------------------ | ------------------ | ------------------------------------------------------------------------ |
| `/`                      | P-AUD, P-PLY, P-LP | Marketing + proof landing                                                |
| `/casino`                | P-PLY              | Game directory                                                           |
| `/casino/[slug]`         | P-PLY              | Game room, bet panel, ledger panel                                       |
| `/sportsbook`            | P-PLY, P-AUD       | Market list, filters, risk caps                                          |
| `/sportsbook/[marketId]` | P-PLY              | Market detail, signed-odds panel, ticket flow                            |
| `/portfolio`             | P-PLY, P-LP        | Overview: balances, LP shares, open tickets, recent activity, claimables |
| `/portfolio/activity`    | P-PLY, P-LP, P-AUD | Full ledger with filters                                                 |
| `/portfolio/claims`      | P-PLY, P-LP        | XP buckets, refundCredit                                                 |
| `/earn`                  | P-LP               | Bank-by-Bank LP view, deposit / withdraw, NAV history                    |
| `/ops`                   | P-OPS, P-AUD       | Release, chain, indexer, exposure caps, recent events                    |
| `/legal/*`               | P-AUD              | Static legal copy                                                        |

## 4. Navigation Hierarchy

Primary navigation (header, all product routes):

```
Casino   Sportsbook   Portfolio   Earn   [right side: wallet, release-proof, theme]
```

Persona-specific entry (header right cluster):

- Wallet connect / connected pill.
- Release-proof button (opens drawer with digest, chainid, addresses).
- Theme toggle (dark default; light optional — see `10-design-tokens.md §4`).

Footer (marketing + product routes):

- Ops, Docs, GitHub, Audit Report, Status page, Legal.

`/ops` is **not** in primary nav. It is linked from the footer and the
release-proof drawer. Operators land there via direct URL.

### 4.1 Header rules

- Same header on every product route. No "game header" / "marketing header"
  / "ops header" variants. One `AppShell` with `variant` prop controls
  background and padding only.
- Active route is indicated by `--brand` underline + `aria-current="page"`.
- The wordmark always points to `/`.

### 4.2 Mobile nav

- ≤ 768 px: header collapses to wordmark + wallet + hamburger.
- Hamburger opens a full-screen drawer mirroring the primary nav (no
  bottom-tab bar — we are not a mobile-first product).

### 4.3 No popovers in primary nav

Primary nav items are flat links. Casino-game submenu lives inside
`/casino`, not as a hover popover.

## 5. The State Matrix (the central artifact of this document)

Every route × every state must be designed. The matrix below applies to every
primary route; details per page in `04-page-blueprints.md`.

| #   | State         | Trigger                                              | Required UI                     |
| --- | ------------- | ---------------------------------------------------- | ------------------------------- |
| 1   | **idle**      | Page just loaded, no pending interaction             | Default rendering               |
| 2   | **loading**   | Data still fetching                                  | Skeleton placeholders           |
| 3   | **empty**     | Data fetched, nothing to show                        | Empty-state copy + one CTA      |
| 4   | **error**     | Fetch / mutation failed                              | Error pattern with action       |
| 5   | **disabled**  | User must do something elsewhere                     | Inline explanation + link       |
| 6   | **gated**     | Wallet not connected, wrong chain, paused, ops-gated | Wallet/Chain/Paused gate banner |
| 7   | **connected** | Wallet connected and ready                           | Default interactive state       |

> A page is not complete until states 1-7 each have an approved Storybook
> story and a screenshot in `04-page-blueprints.md`.

## 6. Per-Route IA Contract

Every route owns a section in `04-page-blueprints.md` containing:

1. **Personas served**.
2. **Primary call-to-action** (exactly one).
3. **Secondary actions** (≤ 3).
4. **Data sources** (which `useXxx` hook, which contract calls).
5. **Wireframe** (mermaid grid or hand-drawn).
6. **State matrix** (the seven cells above).
7. **Failure paths** (which `13-web3-ux.md` error codes can show here).
8. **Tracking events fired** (see `../frontend/25-observability.md`).

## 7. Cross-Page Patterns

### 7.1 Release proof drawer

Available from every product route via the header. Owns:

- Release digest (`d3a5…ef12`).
- Chain ID + name + RPC.
- Bank registry, Hub addresses (clickable to block explorer).
- Indexer last-synced block + time.
- Audit-report link.

### 7.2 Wallet gate

Reusable pattern. Three modes:

- **Not connected**: `Connect your wallet to <action>.`
- **Wrong chain**: `Switch to <chain name> to <action>.` + CTA.
- **Paused**: `<Bank/Pool> risk-in is currently paused.` + ETA if known.

### 7.3 Audit-trail link

Every settlement, deposit, withdraw, claim row shows a tx-hash link to the
block explorer + a `Copy` button. No exceptions.

## 8. Anti-Patterns (IA-specific)

- **Hamburger inside primary nav while desktop nav is showing** — pick one.
- **Pop-over "quick actions"** that bypass the route flow.
- **Modal inside modal** (max stack depth = 1).
- **Tabs deeper than 2 levels** (e.g., `/portfolio` tabs containing tabs).
- **Toasts that block primary CTA** — position toasts top-right, not bottom-center.
- **Inline ads / promo banners** — there is no growth surface here.
- **Sticky banners** announcing release versions on every page — the release
  drawer carries that information.
- **Carousel galleries** — flat grids only.

## 9. Don'ts

- Do not add a route without an entry in §3 and `04-page-blueprints.md`.
- Do not link marketing CTAs to a route that lacks all 7 states implemented.
- Do not put `/ops` in primary nav.
- Do not introduce a per-game URL inside `/casino` other than `[slug]`.
- Do not show ops-only metadata (e.g., chain RPC URL, indexer cursor)
  outside `/ops` and the release-proof drawer.
- Do not keep compatibility redirects for pre-clean-room routes. Old public
  aliases must stay 404 unless a signed ADR explicitly reintroduces one.

## 10. How To Enforce

```bash
# Every route in the sitemap (§3) must have a matching page file
node scripts/check-route-map.mjs   # generated CI script (see 30-build-and-release)

# No nav link points to a route lacking all 7 states
node scripts/check-page-states.mjs # reads Storybook story manifests

# Legacy redirects are not part of the clean-room route surface
pnpm -C frontend precheck:frontend -- --strict
```

CI implements all three. See `../frontend/30-build-and-release.md §5`.

## 11. Migration From Current Site

Mapping from current routes to target routes:

| Current                                    | Target                                    | Action                                        |
| ------------------------------------------ | ----------------------------------------- | --------------------------------------------- |
| `/`                                        | `/`                                       | Rebuild from `04-page-blueprints §1`          |
| `/games`, `/games/[slug]`                  | `/casino`, `/casino/[slug]`               | New IA; old aliases deleted                   |
| `/dice`, `/cointoss`, `/roulette`, `/keno` | `/casino/<slug>`                          | Deleted; no compatibility redirect            |
| `/sportsbook` (stub)                       | `/sportsbook` (real)                      | Build per §J3                                 |
| `/account`, `/bets`, `/bets/[id]`          | `/portfolio`, `/portfolio/activity[/...]` | Merged                                        |
| `/claims` (stub)                           | `/portfolio/claims`                       | Built into portfolio                          |
| `/referral` (stub)                         | `/portfolio` (tab)                        | Built into portfolio                          |
| `/invest`, `/liquidity` (stubs)            | `/earn`                                   | Built                                         |
| `/ops`                                     | `/ops`                                    | Rebuild per `04-page-blueprints §9`           |
| `/privacy`, `/terms`, `/disclaimer`        | `/legal/{privacy,terms,disclaimer}`       | Move under legal segment; old aliases deleted |
| `/prototype/*`                             | (deleted)                                 | Move to `src/sandbox/` (non-routable)         |
