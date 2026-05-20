# Frontend North Star — Lean Product Reference

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `frontend-implementation-roadmap.md` |
| Supersedes | monolithic North Star and rewrite index |

This file is now a short orientation page. It should not grow back into a
monolithic design constitution.

## North Star

ArbiGameFi frontend exists to make a protocol-grade casino/sportsbook usable by
real players, LPs, referrers, and operators of this deployment.

The product should feel:

- non-custodial;
- verifiable;
- fast enough to play without reading a manual;
- restrained and institution-grade without becoming process-heavy;
- localized from the start.

## Product Rules

1. The primary casino path is `choose -> stake -> placeBet -> wait -> result`.
2. Normal casino settlement should be automatic through keeper; manual settle is
   a fallback.
3. Result receipts show chain-derived facts: bet id, request id, payout, random
   hash, and settlement transaction.
4. Sportsbook uses fixed odds, signed snapshots, result evidence, and explicit
   challenge/void semantics.
5. LP and portfolio pages explain bankroll, reserves, liabilities, and history
   without leaking unnecessary contract internals into the primary betting flow.

## Visual Rules

- One design-token source.
- No per-game brand color family.
- No product UI hard-coded hex literals.
- No decorative external asset URLs.
- No prototype routes in production.
- No raw RPC, viem, ABI, or server errors as user-facing copy.

Detailed token and component references remain in:

- [`10-design-tokens.md`](./10-design-tokens.md)
- [`11-component-library.md`](./11-component-library.md)
- [`13-web3-ux.md`](./13-web3-ux.md)
- [`15-forms.md`](./15-forms.md)

## Execution References

- Strategy:
  [`../strategy/fullstack-product-architecture.md`](../strategy/fullstack-product-architecture.md)
- Roadmap:
  [`frontend-implementation-roadmap.md`](./frontend-implementation-roadmap.md)
- Architecture:
  [`frontend-rewrite-blueprint.md`](./frontend-rewrite-blueprint.md)
- Casino round UX:
  [`casino-placebet-ux.md`](./casino-placebet-ux.md)
- Engineering launch docs:
  [`../frontend/INDEX.md`](../frontend/INDEX.md)

## Do Not Do

- Do not use this page as a gate checklist.
- Do not add white-label/operator UI requirements before a real requirement
  exists.
- Do not block P0 runtime fixes on brand, motion, or governance docs.
- Do not collapse shared runtime packages for cosmetic simplicity.
- Do not move complex settlement into VRF callbacks.
