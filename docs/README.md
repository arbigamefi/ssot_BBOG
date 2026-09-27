# Documentation Index

## Start with your question

ArbiGameFi is building a single-brand wallet-native casino and sportsbook.
External materials are organized by the decision a reader needs to make.

| Document                                                               | Main reader and purpose                                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Project brief](ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md)                   | First-time readers: understand the project and choose a relevant next step. Complete Chinese and English introductions. |
| [Project and business whitepaper](WHITEPAPER.product.zh-CN.md)         | Strategic, channel and professional capital partners: assess the market, operating and cooperation case.                |
| [Technical whitepaper](WHITEPAPER.zh-CN.md)                            | Researchers, technical diligence and integration teams: assess mechanisms and trust assumptions, then inspect evidence. |
| [Product roadmap](roadmap.md)                                          | Users and partners following intended capability and product direction.                                                 |
| [Release facts](release/STATUS-v1.5.zh-CN.md)                          | Readers checking dated implementation, deployment, availability and acceptance.                                         |
| [Repository retrospective](audit/RepositoryReview-2026-09-25.zh-CN.md) | Readers investigating findings, impact and rework in a bounded review.                                                  |

A next-version mechanism is not a current participation term. Players need
product rules and help; LPs need specific pool terms and risk disclosures;
channel partners need attribution and compensation terms. They do not all need
the same whitepaper, and LP participation is not project equity investment.

## Internal project direction

- [Project master plan](strategy/project-master-plan.zh-CN.md): audience, product thesis, decisions, resource focus and hypotheses to validate.
- [Economic design](strategy/economic-design.md): selected next-version allocation, alternatives, calibration and migration boundaries.
- [GTM execution plan](strategy/go-to-market.md): work packages, demand research and operating decisions.
- [Writing and publishing standard](WHITEPAPER-PUBLISHING-STANDARD.zh-CN.md): reader-specific scope, claims, evidence and editorial review.

These internal planning documents guide execution. They are distinct from the
external cooperation case, mechanism explanation and release evidence.

## v1.5 implementation and deployment evidence

- [Implementation record](deploy/v15/implementation-status.zh-CN.md) — execution history and evidence
- [Supported deployment workflow](deploy/v15-release.md)
- [Release process](release/README.md)

## Closeout

- `docs/closeout/README.md` — historical Milestone 4 handoff; not current deployment instructions

## Strategy

- [Fullstack product architecture commitment](strategy/fullstack-product-architecture.md) — product positioning and complexity boundaries that guide the whitepapers and implementation: protocol-grade settlement kernel, lean B2C casino/sportsbook product, optional future infrastructure

## Release materials

- [v1.5 release process](release/README.md)
- [Release acceptance checklist](release/checklist.md)
- [Current deployment evidence and pending closeout](deploy/v15/implementation-status.zh-CN.md)

The master plan sets project choices; constitutions and ADRs record technical
constraints and decisions. Code, tests, release artifacts and reviews provide
implementation evidence. External documents explain the relevant project logic
to their intended readers. Keep these roles distinct.

## Constitution & invariants

- `docs/constitution/SSOT.v1.6.md` — house-edge allocation for the next casino release unit (fixed 50% LP share, operator-funded L0–L2 referrals); implemented in source, not deployed; see [ADR-0032](adr/0032-fixed-lp-share-operator-funded-referrals.md)
- `docs/constitution/ExecutableSSOT.v1.6.md` — invariants for the v1.6 allocation, with the tests that check each one
- `docs/constitution/SSOT.v1.3.md` — draft normative protocol constitution for SettlementRouter + vertical hubs
- `docs/constitution/ExecutableSSOT.v1.3.md` — draft executable invariant spec for router/pool isolation
- `docs/constitution/SSOT.v1.2.md` — normative protocol constitution (MUST / MUST NOT)
- `docs/constitution/ExecutableSSOT.v1.2.md` — executable invariant spec (v1.1 + v1.2 additions)
- (Historical) `docs/constitution/SSOT.v1.1.md`
- (Historical) `docs/constitution/ExecutableSSOT.v1.1.md`
- (Historical) `docs/constitution/SSOT.v1.0.md`
- (Historical) `docs/constitution/ExecutableSSOT.v1.0.md`

## Architecture & decisions

- `docs/architecture/overview.md` — module boundaries, data flows, dependency direction
- `docs/adr/README.md` — ADR index + templates (why the system is designed this way)

## Design system

- `docs/design/README.md` — lean frontend design and UX reference index
- `docs/design/north-star.md` — short frontend product and visual orientation
- `docs/design/frontend-rewrite-blueprint.md` — current frontend architecture snapshot and cutover reference
- `docs/design/frontend-implementation-roadmap.md` — active frontend closeout priority order
- `docs/design/frontend-kill-list.md` — concise cleanup inventory for route, shell, token, and prototype residues
- `docs/frontend/INDEX.md` — launch-relevant frontend engineering reference index

## Research

- `docs/research/sportsbook-architecture-2026-05.md` — industry comparison and recommended architecture for extending the current casino SSOT into sportsbook verticals

## Audit & assurance

- `docs/audit/threat-model.md` — assets, assumptions, threats, mitigations
- `docs/audit/invariants-map.md` — mapping: SSOT clause -> code points -> tests
- `docs/closeout/casino-expansion-v13-2026-05-13.md` — local closeout for legacy cleanup + casino module expansion

## Project management

- `docs/plan/README.md` — implementation-grade action plans (PR-sized work breakdowns)
- `docs/plan/Milestone-3.1-SportsHub-MVP.md` — sportsbook MVP implementation plan on top of SettlementRouter
- `docs/migration/refactored-mapping.md` — mapping of refactored features to the current frontend design

## Games

- `docs/games/roulette.md` — roulette module rules + parameter encoding
- `docs/games/keno.md` — keno module rules + parameter encoding
- `docs/games/plinko.md` — plinko module rules + parameter encoding
- `docs/games/sicbo.md` — sic bo module rules + parameter encoding
- `docs/games/slots.md` — slots module rules + parameter encoding
- `docs/games/baccarat.md` — baccarat module rules + parameter encoding

## Runbooks

- [Testing & proof gates](runbooks/testing.md)
- [Frontend artifacts](frontend/README.md)

## Ops

- [Monitoring metrics inventory](ops/metrics.md)
- [Alert rules inventory](ops/alerts.md)
- [Incident + postmortem templates](ops/incident-templates.md)
- Runbooks:
  - [VRF + refundCredit (v1.2)](ops/runbooks/vrf-refundcredit.md)
  - [Bank solvency / reserve anomalies](ops/runbooks/bank-solvency.md)
  - [Pause + config drift + governance safety](ops/runbooks/pause-config-drift.md)
  - [Game finalization stalls / diff anomalies](ops/runbooks/game-finalization-diffs.md)
