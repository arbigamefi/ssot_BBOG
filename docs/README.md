# Documentation Index

## Project design and direction

ArbiGameFi is designed as a single-brand B2C casino/sportsbook product backed by
a protocol-grade settlement kernel. The whitepapers define the project’s goals,
design principles, mechanisms and choices; the roadmap turns them into phases
of implementation. Source code and release evidence show progress against that
design. They do not replace it.

| Document                                                                              | Use it to understand                                                                                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Project brief](ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md)                                  | The project’s purpose, audience, value and direction in a short introduction.                       |
| [Product and business whitepaper](WHITEPAPER.product.zh-CN.md)                        | User value, product experience, economic design and the choices that should guide implementation.   |
| [Technical whitepaper](WHITEPAPER.zh-CN.md)                                           | Architecture, funds and authority boundaries, invariants, technical choices and intended evolution. |
| [Project roadmap](roadmap.md)                                                         | The implementation sequence, dependencies, decisions and acceptance conditions for each phase.      |
| [Release facts and evidence](release/STATUS-v1.5.zh-CN.md)                            | Dated implementation, deployment, availability and acceptance facts for the v1.5 release.           |
| [Repository retrospective](audit/RepositoryReview-2026-09-25.zh-CN.md)                | Findings, impact, validation and rework within that review’s scope and date.                        |
| [Whitepaper writing and publishing standard](WHITEPAPER-PUBLISHING-STANDARD.zh-CN.md) | The roles of these documents, design-state labels and editorial conventions.                        |

New economic or governance proposals may appear as **design drafts** or
**open decisions**. Their inclusion does not establish approval, deployment or
public availability. Read the facts table for release status and the retrospective
for review evidence; the whitepapers do not repeat those reports.

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

Design documents guide what should be built. Constitutions and ADRs record
constraints and decisions; code, tests, release artifacts and reviews provide
implementation evidence. Keep those roles distinct when updating the documentation.

## Constitution & invariants

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
