# ArbiGameFi Frontend North Star — Entry Index

| Owner | Frontend Lead |
| Status | Draft v2 — index form, pending Gate A sign-off |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md` |
| Supersedes | the v1 monolithic North Star (re-distributed across the numbered SSOT docs below) |

This document used to be the monolithic frontend SSOT. The clean-room
rewrite distributed its content across the 18 numbered documents listed
below. Read those, not this file. This page exists so that links to
`north-star.md` still land in a useful place.

## TL;DR (three sentences)

1. ArbiGameFi is an institutional-grade dApp; restraint beats novelty
   ([`00-charter.md §3`](./00-charter.md)).
2. There is one design-token source, one app shell, one brand color, one
   game framework, and one route taxonomy
   ([ADR-0001](./adr/0001-no-per-game-color-family.md),
   [ADR-0003](./adr/0003-single-design-token-source.md)).
3. Production and prototypes are physically separated; nothing exploratory
   ships to `arbigamefi.com`
   ([ADR-0002](./adr/0002-prototype-routes-out-of-production-app-router.md)).

## Read In Order

### Layer 0 — Charter

- [`00-charter.md`](./00-charter.md) — Mission, non-goals, Non-Negotiables, decision rights

### Layer 1 — Identity & Vision

- [`01-brand.md`](./01-brand.md)
- [`02-voice-and-copy.md`](./02-voice-and-copy.md)
- [`03-information-architecture.md`](./03-information-architecture.md)
- [`04-page-blueprints.md`](./04-page-blueprints.md)

### Layer 2 — System

- [`10-design-tokens.md`](./10-design-tokens.md)
- [`11-component-library.md`](./11-component-library.md)
- [`12-motion.md`](./12-motion.md)
- [`13-web3-ux.md`](./13-web3-ux.md)
- [`14-data-and-state.md`](./14-data-and-state.md)
- [`15-forms.md`](./15-forms.md)
- [`16-mobile.md`](./16-mobile.md)

### Layer 3 — Engineering Quality

- [`../frontend/20-accessibility.md`](../frontend/20-accessibility.md)
- [`../frontend/21-i18n.md`](../frontend/21-i18n.md)
- [`../frontend/22-performance.md`](../frontend/22-performance.md)
- [`../frontend/23-security.md`](../frontend/23-security.md)
- [`../frontend/24-testing.md`](../frontend/24-testing.md)
- [`../frontend/25-observability.md`](../frontend/25-observability.md)

### Layer 4 — Governance & Workflow

- [`../frontend/30-build-and-release.md`](../frontend/30-build-and-release.md)
- [`../frontend/31-governance.md`](../frontend/31-governance.md)
- [`../frontend/32-ai-pairing.md`](../frontend/32-ai-pairing.md) + [`../../frontend/CLAUDE.md`](../../frontend/CLAUDE.md)

### Decision Records

- [`adr/README.md`](./adr/README.md)

## Where Did The v1 Content Go?

The v1 North Star (441 lines, dated 2026-05-14) discussed eight topics:
findings, product direction, token rules, route taxonomy, shell model,
casino architecture, migration phases, and PR sizing.

| v1 section                                                            | Now lives in                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| §1 Findings                                                           | Audit summary in `00-charter.md §1` + ADR 0001–0003 context             |
| §2 Product Direction                                                  | `00-charter.md §3` + `01-brand.md §1`                                   |
| §3 Token Rules (colors, radius, elevation, typography, motion, icons) | `10-design-tokens.md` + `12-motion.md`                                  |
| §4 Route Taxonomy                                                     | `03-information-architecture.md §3`                                     |
| §5 Shell Model                                                        | `11-component-library.md §4.1`                                          |
| §6 Casino Game Architecture                                           | `04-page-blueprints.md §3` + `frontend-rewrite-blueprint.md §9`         |
| §7 Migration Plan (Phases 0–3)                                        | `frontend-rewrite-blueprint.md §15`                                     |
| §8 PR Sizing                                                          | `frontend-rewrite-blueprint.md §13` + `../frontend/31-governance.md §6` |
| §9 Definition of Done                                                 | `../frontend/31-governance.md §5`                                       |

The v1 file is preserved in git history for reference. Do not edit this
index to reintroduce the v1 content; update the underlying SSOT docs
instead.

## Companion Execution Playbook

[`frontend-rewrite-blueprint.md`](./frontend-rewrite-blueprint.md) —
clean-room rewrite delivery order, target directory layout, deletion
ledger, and cutover plan.

[`frontend-implementation-roadmap.md`](./frontend-implementation-roadmap.md) —
lean closeout priorities, keep/collapse decisions, and local verification
order.

[`frontend-kill-list.md`](./frontend-kill-list.md) — physical keep /
rewrite / delete inventory for Phase 1+.

## Companion Engineering SSOT

[`../frontend/INDEX.md`](../frontend/INDEX.md) — engineering-quality
documents (a11y, i18n, perf, security, testing, observability, build,
governance, AI pairing).
