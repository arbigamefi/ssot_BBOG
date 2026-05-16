# ArbiGameFi Frontend — Design SSOT Index

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Audience | designers, frontend engineers, product, ops, AI coding assistants |

This directory is the **single source of truth** for everything user-facing in
ArbiGameFi: brand, voice, information architecture, design tokens, components,
motion, web3 UX, data flow, forms, and mobile.

Engineering-quality SSOT (a11y, i18n, performance, security, testing,
observability, build, governance) lives in [`../frontend/`](../frontend/).

## Reading Order

Read top-down. Lower-numbered documents constrain higher-numbered ones.

### Layer 0 · Charter

- [`00-charter.md`](./00-charter.md) — Project mission, non-goals, decision rights, success metrics

### Layer 1 · Identity & Vision

- [`01-brand.md`](./01-brand.md) — Logo, brand palette, illustration, photography, anti-patterns
- [`02-voice-and-copy.md`](./02-voice-and-copy.md) — Tone of voice, action verbs, error language, number / date / address formats
- [`03-information-architecture.md`](./03-information-architecture.md) — Personas, user journeys, route map, navigation hierarchy
- [`04-page-blueprints.md`](./04-page-blueprints.md) — Per-page wireframes + the 7-state matrix (idle/loading/empty/error/disabled/gated/connected)

### Layer 2 · System

- [`10-design-tokens.md`](./10-design-tokens.md) — Colors, typography, radius, elevation, motion tokens (the canonical spec)
- [`11-component-library.md`](./11-component-library.md) — Primitives, patterns, API contracts, lifecycle (alpha → stable → deprecated → removed)
- [`12-motion.md`](./12-motion.md) — When to animate, when not, presets, reduced-motion rules
- [`13-web3-ux.md`](./13-web3-ux.md) — Wallet connect, chain switching, approve / signature flows, pending tx UI
- [`14-data-and-state.md`](./14-data-and-state.md) — TanStack Query keys, invalidation, optimistic updates, indexer fallbacks, error boundaries
- [`15-forms.md`](./15-forms.md) — react-hook-form + zod, bigint amount inputs, multi-step form state machines
- [`16-mobile.md`](./16-mobile.md) — Breakpoints, touch targets, mobile navigation, PWA manifest

### Companion Docs

- [`north-star.md`](./north-star.md) — Visual-language summary (entry point for cross-team readers)
- [`frontend-rewrite-blueprint.md`](./frontend-rewrite-blueprint.md) — Execution playbook (rebuild order, deletion ledger, cutover)
- [`frontend-implementation-roadmap.md`](./frontend-implementation-roadmap.md) — Current branch gap audit and phase-by-phase execution order
- [`frontend-kill-list.md`](./frontend-kill-list.md) — Physical keep / rewrite / delete inventory
- [`casino-placebet-ux.md`](./casino-placebet-ux.md) — Casino round UX, VRF waiting, keeper settlement, and manual fallback contract

### Decision Records

- [`adr/`](./adr/) — Frontend Architecture Decision Records

## Gates

No production-route UI code may be written until the following gates pass.

### Gate A · Identity (frozen before any UI design begins)

- `00-charter`, `01-brand`, `02-voice-and-copy`, `03-information-architecture`,
  `04-page-blueprints` — all `Status: Accepted`
- one approved hi-fi concept per primary route (desktop + mobile)
- a written record of every Layer-1 decision (ADR-001 onward)

### Gate B · System (frozen before any product page is implemented)

- `10`–`16` all `Status: Accepted`
- `@ssot/ui` rebuilt: tokens, primitives, patterns, motion, icons
- Storybook coverage = 100 % primitives, ≥ 80 % patterns
- visual regression baseline established (Chromatic or Playwright snapshots)

### Gate C · Quality (frozen before public launch)

- engineering-quality SSOT (`../frontend/20`–`25`) all `Status: Accepted`
- CI pipelines green: typecheck, unit, component, visual, a11y, performance,
  e2e
- Sentry, RUM, and analytics wired with version-tagged releases

## Current Status

This directory is the planning SSOT for the clean-room rewrite. Most numbered
documents are `Draft v1` until Gate A/B/C sign-off. Draft documents may define
target-state enforcement commands before the scripts exist; those commands must
be implemented before the relevant gate can close.

The older pre-clean-room frontend planning directory has been removed. Active
frontend SSOT lives only under `docs/design/` and `docs/frontend/`.

## Document Contract

Every numbered SSOT document in this directory MUST:

1. Begin with the header table: `Owner / Status / Last Updated / Depends-on / Supersedes`.
2. Have a "Don'ts" section (or "Anti-patterns") — the document is incomplete if
   it only says what to do.
3. Have a "How To Enforce" section listing at least one of:
   `grep`/`rg` invocation, ESLint rule, Stylelint rule, CI step, or PR
   checklist line.
4. Be ≤ 8 main pages. Appendices may extend.
5. Cite source files by absolute repo path, not screenshots.
6. Use Mermaid for diagrams (renders inline in GitHub).
7. Be versioned by ADR when changed in a breaking way.

ADR files under `adr/` follow the ADR template instead of this numbered-SSOT
contract.

## How To Propose Changes

1. Open an ADR under `adr/` describing the proposal, motivation, and impact.
2. Reference the ADR from the affected SSOT document(s).
3. If the change affects multiple layers, list every downstream document that
   needs to be updated.
4. Merge the ADR first. Update SSOT documents in a follow-up PR so reviewers
   can see "what changed and why" in one place.

## Anti-Patterns We Are Eliminating

The original frontend allowed all of the following. After the rewrite, none of
them may survive a code review:

- multiple parallel design-token systems
- hard-coded hex colors in product UI
- per-game brand color families
- production routes that share the App Router with prototypes
- "god component" multi-game page files
- multiple competing shell components
- inline arbitrary shadows and border-radius values
- placeholder pages linked from marketing CTAs
- duplicated marketing copy between `/` and a prototype route
- decorative assets fetched from third-party domains

If you see one in a PR diff, block the PR.
