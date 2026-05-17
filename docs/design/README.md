# Frontend Design Docs — Lean Index

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `frontend-implementation-roadmap.md` |

This directory now serves the **lean frontend design and UX reference** for
ArbiGameFi. The fullstack boundary is defined by
[`../strategy/fullstack-product-architecture.md`](../strategy/fullstack-product-architecture.md):

> Protocol-grade contracts; lean B2C casino/sportsbook product; optional future
> infrastructure.

The previous clean-room rewrite plan used Gate A/B/C and a large numbered SSOT
set. That was useful during the rewrite, but it is no longer the operating
model. New frontend work should use the current roadmap, launch requirements,
and runtime evidence instead of reopening the gate process.

## Current Execution Entry Points

- [`frontend-implementation-roadmap.md`](./frontend-implementation-roadmap.md)
  — current priority order, keep/collapse decisions, and local verification
  commands.
- [`frontend-rewrite-blueprint.md`](./frontend-rewrite-blueprint.md) — slim
  architecture snapshot and deletion/cutover reference.
- [`casino-placebet-ux.md`](./casino-placebet-ux.md) — casino round UX,
  keeper-driven settlement, timeout, refund, and receipt rules.
- [`indexing-strategy.md`](./indexing-strategy.md) — no subgraph for MVP,
  chain truth + durable read model + client replay.
- [`durable-bet-index.md`](./durable-bet-index.md) — Postgres bet-index read
  model shared by web and keeper.

## Launch-Relevant Design References

Keep these as reference material when the implementation needs the details:

- [`10-design-tokens.md`](./10-design-tokens.md) — colors, typography, radius,
  elevation, and token rules.
- [`11-component-library.md`](./11-component-library.md) — primitives and
  reusable UI patterns.
- [`13-web3-ux.md`](./13-web3-ux.md) — wallet, chain, approval, signing, and
  transaction state rules.
- [`14-data-and-state.md`](./14-data-and-state.md) — data fetching, cache,
  indexer fallback, and error boundaries.
- [`15-forms.md`](./15-forms.md) — amount input, validation, and form state
  guidance.
- [`16-mobile.md`](./16-mobile.md) — responsive and touch constraints.

## Historical / Low-Churn References

These documents should not block runtime fixes. Use them only when changing
brand, copy, IA, or page structure:

- [`00-charter.md`](./00-charter.md)
- [`01-brand.md`](./01-brand.md)
- [`02-voice-and-copy.md`](./02-voice-and-copy.md)
- [`03-information-architecture.md`](./03-information-architecture.md)
- [`04-page-blueprints.md`](./04-page-blueprints.md)
- [`12-motion.md`](./12-motion.md)
- [`north-star.md`](./north-star.md)
- [`frontend-kill-list.md`](./frontend-kill-list.md)

## Decision Records

- [`adr/`](./adr/) — accepted frontend design/architecture decisions.

Current high-signal ADRs:

- ADR-0001: no per-game color family.
- ADR-0002: prototype routes stay out of production App Router.
- ADR-0003: single design-token source.
- ADR-0004: no subgraph for MVP indexing.
- ADR-0005: Postgres durable bet index.
- ADR-0006: terminal receipt view.

## How To Use These Docs

1. Start with the fullstack strategy.
2. Check the active roadmap for priority and non-goals.
3. Use only the launch-relevant reference that applies to the change.
4. Validate with code, tests, browser evidence, or canary evidence.
5. Update docs only when a decision changes, not to preserve chat history.

## Do Not Do

- Do not reintroduce Gate A/B/C as frontend workflow.
- Do not add frontend complexity for white-label/operator workflows before a
  real operator requirement exists.
- Do not collapse `packages/ssot`, `packages/bet-index`, or `apps/keeper` only
  to reduce package count.
- Do not expose raw RPC, viem, or server errors as product copy.
- Do not treat chain-derived truth as optional decoration; receipts and audit
  surfaces must remain verifiable.
