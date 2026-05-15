# 00 · Frontend Charter

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | — |
| Supersedes | — |

The Charter is the **constitutional layer** of the ArbiGameFi frontend. Every
later decision document inherits from it. When a lower-level decision conflicts
with the Charter, the Charter wins until the Charter is itself amended (by ADR).

## 1. Mission

> Build a non-custodial on-chain casino + sportsbook frontend that feels closer
> to a **prime brokerage terminal** than a casino lobby. Every screen should
> communicate provability, isolation of risk, and operational maturity.

## 2. Non-Goals

We are not building:

- A mobile-first native app (mobile **web** matters; native does not).
- A fiat onramp UI (separate concern; we surface external providers if any).
- A social / chat layer.
- A reward-stacking growth surface (loyalty tier dashboards, daily streaks,
  spin-the-wheel marketing).
- A casino "lobby" experience filled with promotional banners, jackpots
  meters, animated mascots, or 50-game thumbnails.
- A multi-tenant white-label product (theming may exist; product
  differentiation does not).

If a feature pulls the UI toward any of these non-goals, it is rejected.

## 3. Principles (in priority order)

1. **Provability over decoration.** A user must be able to verify
   release-digest, contract addresses, and SSOT data on every primary
   surface without leaving the page.
2. **Consistency over novelty.** A second variant of an existing pattern is a
   regression. Use the existing primitive. If the existing primitive is wrong,
   fix the primitive.
3. **Restraint over excitement.** One brand color, one accent color, one
   display face. Hero typography exists only where it earns its weight.
4. **Operability over polish.** Empty / loading / error / gated states are
   first-class. A page is not complete until every state is designed and
   implemented.
5. **Composition over inheritance.** Pages compose feature view models and UI
   patterns. Pages do not import wagmi, viem, or RainbowKit directly.
6. **Server-first.** Default to React Server Components. Use Client Components
   only where the feature requires wallet, signing, IndexedDB, charts with
   browser APIs, or interactive bet parameters.
7. **Delete fearlessly.** Old code does not earn the right to stay. If it is
   not on the route map in `03-information-architecture.md`, it does not ship.

## 4. Success Metrics (what "done" looks like)

| Surface           | Metric                                 | Target                                 |
| ----------------- | -------------------------------------- | -------------------------------------- |
| Home (`/`)        | Lighthouse Performance                 | ≥ 95 mobile, ≥ 98 desktop              |
| Casino room       | Lighthouse Performance                 | ≥ 90 mobile, ≥ 95 desktop              |
| All routes        | Core Web Vitals (p75 RUM)              | LCP < 2.0 s, INP < 200 ms, CLS < 0.1   |
| All routes        | axe-core violations (Serious/Critical) | 0                                      |
| Bundle            | initial JS per route                   | ≤ 130 KB (gz)                          |
| Brand consistency | hex literals in product UI             | 0 (CI fail)                            |
| Brand consistency | per-game color families                | 0                                      |
| Brand consistency | parallel shell components              | 1 (`AppShell` with variants)           |
| Test coverage     | UI primitives                          | 100 % unit + storybook                 |
| Test coverage     | feature modules                        | ≥ 70 % unit + integration              |
| Visual regression | primary routes covered                 | 100 %                                  |
| Wallet UX         | failed-bet recovery path               | every error has a documented next step |

## 5. Decision Rights

| Concern                                                          | Owner                        | Reviewer                     |
| ---------------------------------------------------------------- | ---------------------------- | ---------------------------- |
| Charter (this doc)                                               | Frontend Lead + Product Lead | All hands                    |
| Layer 1 (brand / voice / IA / blueprints)                        | Design Lead                  | Frontend Lead + Product Lead |
| Layer 2 (tokens / components / UX patterns)                      | Frontend Lead + Design Lead  | Eng team                     |
| Layer 3 (a11y / perf / security / testing / obs)                 | Frontend Lead                | SRE + Security               |
| Layer 4 (build / governance / AI)                                | Frontend Lead                | Eng manager                  |
| Per-feature scope (casino / sportsbook / portfolio / earn / ops) | Feature Lead                 | Frontend Lead                |

A single document does not move from `Status: Draft` → `Status: Accepted`
without sign-off from the listed owner.

## 6. Change Management

1. Propose change via ADR (`docs/design/adr/NNNN-*.md`).
2. Identify which SSOT documents will need updating.
3. List every downstream consequence (UI, data, contract surface).
4. Approve ADR before touching code.
5. Update SSOT documents in a separate PR that references the ADR.

Emergency exceptions (production-blocking): write a follow-up ADR within 1
working day documenting what was done and why a normal cycle was skipped.

## 7. Non-Negotiables

These rules cannot be relaxed without amending the Charter:

| #   | Rule                                                                                            | Rationale                                                         |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| N1  | Single design-token source (CSS variables in `@ssot/ui`)                                        | Three-system drift was the root cause of the original chaos       |
| N2  | No per-game color family                                                                        | Casino is one product, not eight                                  |
| N3  | One AppShell with variants — no parallel shells                                                 | Five competing shells produced the previous mess                  |
| N4  | No prototype routes in the production App Router                                                | Production and exploration must be physically separated           |
| N5  | No hard-coded hex literals in product UI                                                        | All surface colors resolve to tokens                              |
| N6  | No external decorative URLs                                                                     | Production assets live in `public/`                               |
| N7  | No "god page" — `pageClient.tsx` over 600 lines is a CI failure                                 | Forces decomposition                                              |
| N8  | Every marketing CTA points to a route with product-grade content                                | Trust > polish                                                    |
| N9  | Wallet, viem, wagmi, RainbowKit only imported in `apps/web/src/app-shell/` and provider islands | Prevents leakage of imperative web3 calls into pages and features |
| N10 | All transactions show simulation results before signing                                         | User must know what they're signing                               |

CI rules enforcing these live in `../frontend/24-testing.md` and
`../frontend/30-build-and-release.md`.

## 8. Glossary (definitive vocabulary)

| Term                | Meaning                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Primitive**       | A `@ssot/ui` building block with no product semantics (Button, Input, Tabs, Table)                                 |
| **Pattern**         | A `@ssot/ui` composite with product semantics (AppShell, BetSlip, WalletGate)                                      |
| **Module**          | A `features/<vertical>/modules/<game>/` unit (DiceModule, PlinkoModule)                                            |
| **Feature**         | An `apps/web/src/features/<name>/` slice that owns data + composition for one product area                         |
| **Page**            | A file under `apps/web/src/app/.../page.tsx` that composes one route                                               |
| **Surface**         | The visible background layer of a UI region (page background, panel, hover fill) — always a token, never a literal |
| **SSOT**            | Single Source of Truth — for protocol data (chain), or for design / engineering rules (these docs)                 |
| **Vertical**        | A protocol product area: `casino`, `sportsbook`, `earn`, `portfolio`, `ops`                                        |
| **Provider Island** | A Client Component subtree wrapping wagmi/RainbowKit, mounted only inside the product route group                  |

## 9. Out Of Scope (for this Charter)

This document does not specify:

- The actual brand color values (see `01-brand.md` and `10-design-tokens.md`)
- The exact navigation layout (see `03-information-architecture.md`)
- Tech-stack version pins (see `../frontend/30-build-and-release.md`)
- Test framework choices (see `../frontend/24-testing.md`)
- Wallet UX flows (see `13-web3-ux.md`)

## 10. Don'ts

- Do not write feature code while this Charter is still `Status: Draft`.
- Do not propose any decision that conflicts with §3 (Principles) without an
  ADR.
- Do not add a Non-Goal feature without amending §2.
- Do not refer to this document only by name — link to the section number and
  paste a quote in the PR description.

## 11. How To Enforce

```bash
# Gate A: Charter must be Accepted before product UI lands
rg "^\| Status \| Accepted" docs/design/00-charter.md

# CI rule (in 32-ai-pairing.md and 24-testing.md):
# block any commit touching apps/web/src/app/**/page.tsx
# unless docs/design/00-charter.md has Status: Accepted
```

Build pipeline also requires that no commit modifying `apps/web/src/app/**/page.tsx`
exists at a point where the Charter is still `Draft`. CI enforcement contract
in `../frontend/30-build-and-release.md`.

## 12. Sign-off

| Role          | Name      | Date         | Signature  |
| ------------- | --------- | ------------ | ---------- |
| Product Lead  | _to fill_ | _yyyy-mm-dd_ | _initials_ |
| Frontend Lead | _to fill_ | _yyyy-mm-dd_ | _initials_ |
| Design Lead   | _to fill_ | _yyyy-mm-dd_ | _initials_ |
| Eng Manager   | _to fill_ | _yyyy-mm-dd_ | _initials_ |
