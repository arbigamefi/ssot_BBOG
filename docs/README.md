# Documentation Index

## Closeout

- `docs/closeout/README.md` — one-page institutional handoff (proof + release + ops)

## Release materials

- `docs/release/ARBIGAMEFI-RELEASE-PACK.zh-CN.md` — outward-facing release pack for partners, LPs, auditors, and technical integrators
- `docs/release/ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md` — direct block explorer entrypoints for the current deployment snapshot
- `docs/release/ARBIGAMEFI-LP-ONBOARDING.zh-CN.md` — LP-facing onboarding note for bankroll semantics and withdrawal constraints
- `docs/release/ARBIGAMEFI-MAINNET-RELEASE-TEMPLATE.zh-CN.md` — mainnet-facing release template derived from canonical artifacts
- `docs/release/ARBIGAMEFI-RELEASE-HISTORY.zh-CN.md` — append-only release ledger mapped to immutable deployment artifacts
- `docs/release/README.md` — release process and artifact model
- `docs/release/checklist.md` — release Definition of Done and operator checklist

## Whitepaper

- `docs/WHITEPAPER.zh-CN.md` — formal Chinese technical whitepaper derived from the current contract implementation
- `docs/WHITEPAPER.product.zh-CN.md` — product and business whitepaper grounded in the current protocol capabilities
- `docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md` — short outward-facing executive brief for partners, investors, and contributors
- `docs/WHITEPAPER-PUBLISHING-STANDARD.zh-CN.md` — publishing standard for naming, versioning, and scope separation across the whitepaper set


This repository is designed to be **auditable by construction**. The documentation is part of the SSOT.

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

## Research

- `docs/research/sportsbook-architecture-2026-05.md` — industry comparison and recommended architecture for extending the current casino SSOT into sportsbook verticals

## Audit & assurance

- `docs/audit/threat-model.md` — assets, assumptions, threats, mitigations
- `docs/audit/invariants-map.md` — mapping: SSOT clause -> code points -> tests

## Project management

- `docs/roadmap.md` — roadmap, milestones, acceptance criteria
- `docs/plan/README.md` — implementation-grade action plans (PR-sized work breakdowns)
- `docs/plan/Milestone-3.1-SportsHub-MVP.md` — sportsbook MVP implementation plan on top of SettlementRouter
- `docs/migration/refactored-mapping.md` — mapping of refactored features to the clean-room design

## Games

- `docs/games/roulette.md` — roulette module rules + parameter encoding
- `docs/games/keno.md` — keno module rules + parameter encoding
- `docs/games/slots.md` — slots module rules + parameter encoding

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
