# Fullstack Product Architecture Commitment

| Owner | Product + Protocol Lead |
| Status | Active |
| Last Updated | 2026-09-26 |
| Depends on | `docs/constitution/SSOT.v1.3.md`, `docs/architecture/overview.md`, `docs/adr/0029-settlement-router-vertical-hubs.md`, `docs/design/frontend-implementation-roadmap.md` |
| Supersedes | Chat-only frontend-vs-contract architecture debate |

## 1. Decision

ArbiGameFi is a B2C casino and sportsbook product built on a protocol-grade
settlement kernel.

This means:

1. The contract layer keeps institutional discipline because it custodies funds,
   enforces settlement, and defines LP risk.
2. The first product motion is a single-brand B2C casino/sportsbook for players,
   LPs, referrers, and operators of this deployment.
3. The protocol remains extensible through `SettlementRouter` and vertical hubs,
   but the frontend must not optimize for unvalidated white-label or third-party
   operator workflows.

The short version:

> Protocol-grade contracts; lean B2C product; optional future infrastructure.

## 2. Why This Is The Right Boundary

The current contract architecture is not a simple casino UI backend:

```text
PoolRegistry / Bank
        |
SettlementRouter
        |
        +-- GameHub   -> VRFHub -> pure casino modules
        +-- SportsHub -> odds/result evidence -> SportsRiskEngine
        +-- FutureHub -> only when a real vertical exists
```

That architecture is justified because bankroll accounting, pool isolation,
owner-hub settlement, VRF liveness, and sports result handling are hard money
surfaces.

The frontend is different. Its first job is not to prove that the organization
has a perfect design bureaucracy. Its first job is to convert real users:

```text
Visitor -> Connect wallet -> Place bet -> See result -> Return or deposit LP capital
```

Any frontend complexity that does not improve this funnel, protect funds, satisfy
launch requirements, or support operations is suspect.

## 3. Complexity Budget By Layer

| Layer                                      | Complexity budget | Reason                                                                                           |
| ------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| `Bank`, `PoolRegistry`, `SettlementRouter` | High              | Funds, solvency, LP accounting, and pool isolation are fatal-risk surfaces.                      |
| `GameHub`, `VRFHub`, game modules          | High              | Randomness, payout bounds, and debt-out liveness must remain auditable.                          |
| `SportsHub`, result evidence, risk caps    | High              | Real-world outcomes create oracle, challenge, void, and exposure risk.                           |
| `@ssot/ssot` release/SDK/encoding          | Medium-high       | Frontend and keeper must consume contract truth without guessing.                                |
| Keeper                                     | Medium            | Auto-finalization is critical UX, but failure is recoverable because finalize is permissionless. |
| Durable bet index                          | Medium            | Needed for product feeds and portfolio cold starts, but chain remains truth.                     |
| Web UI                                     | Lean              | It should be polished, localized, and tested, but not over-governed.                             |
| Growth, affiliate, campaigns               | Experimental      | This area should move fast and be measured by conversion, not document density.                  |

## 4. Product Priority

The [project master plan](project-master-plan.zh-CN.md) now owns audience,
commercial focus and resource sequencing. This document continues to define
product/architecture boundaries; it does not create a second operating plan.

Two principal implementation streams run together: the complete casino player
and settlement experience, and economics/capital accounting. Misleading current
LP metrics are corrected before new economic rights are promoted. The selected
next-version casino design allocates actual payout deductions with explicit LP
retention; calibration and migration belong in the
[economic design](economic-design.md).

Sportsbook remains a committed product direction. Its research, fixed-odds
rulebook and independent risk design can proceed in parallel; public operation
requires its own evidence and capital. Growth materials and demand validation
support these streams, and broad acquisition follows a working usage and
operating loop. White-label/operator products require demonstrated demand.

## 5. Frontend Architecture Consequences

Keep these boundaries:

- `frontend/packages/ssot`: contract-facing release, SDK, encoding, and indexer
  boundary.
- `frontend/apps/keeper`: off-chain automatic settlement runtime.
- `frontend/packages/bet-index`: durable Postgres read-model shared by web and
  keeper.
- `next-intl`: multilingual launch requirement.
- security, testing, release, and keeper docs: launch requirements.

Do not keep or add complexity only because it looks institutional:

- no new Gate ceremony for frontend work;
- no large frontend SSOT document set unless it prevents a real launch risk;
- no white-label frontend architecture before a real operator/customer exists;
- no subgraph for MVP indexing;
- no moving keeper into the browser app for cosmetic package-count reduction.

## 6. Contract Architecture Consequences

Keep these rules:

- Bank owns funds and accounting.
- Router owns settlement authority.
- Vertical hubs own domain lifecycle.
- Casino games remain pure RNG modules.
- Sportsbook result/odds logic stays outside casino modules.
- Permissionless debt-out paths remain more important than UX shortcuts.

Do not move complex settlement into VRF callbacks. `fulfillRandomWords` must
remain lightweight and must not threaten liveness.

## 7. Documentation Consequences

Docs should have different density by layer:

| Doc family                                                   | Keep density | Reason                                                    |
| ------------------------------------------------------------ | ------------ | --------------------------------------------------------- |
| Contract constitution, audits, invariants, release artifacts | High         | These are assurance and operating assets.                 |
| Sportsbook oracle/risk/runbook docs                          | High         | Sports settlement needs evidence and incident discipline. |
| Keeper and durable index docs                                | Medium       | Operational handoff matters.                              |
| Frontend design/process docs                                 | Low-medium   | Keep only what enforces launch quality.                   |
| Growth/campaign docs                                         | Low          | Experiments should be measured by funnel data.            |

## 8. Planning And External Materials

The [master plan](project-master-plan.zh-CN.md) records product choices and the
[GTM plan](go-to-market.md) assigns work packages. The public
[roadmap](../roadmap.md) explains capability and user value without exposing
engineering work queues as the product narrative.

External materials have distinct readers: the business whitepaper supports
resource/cooperation decisions, the technical whitepaper supports mechanism and
trust assessment, and the brief introduces the project and routes readers.
Detailed UX, candidate models, calibration inputs and PR-sized tasks remain in
the relevant internal design files. The architecture still guides implementation;
whitepapers do not become release audits or universal instruction manuals.

## 9. Non-Goals For The Next Phase

- No white-label operator portal.
- No third-party operator registration workflow.
- No new protocol token/governance promise.
- No subgraph.
- No frontend package collapse that breaks real runtime boundaries.
- No new casino games until current casino UX and result receipts are stable.

## 10. Acceptance Criteria

- Product whitepaper no longer positions the current GTM as a generic operator
  platform.
- Frontend roadmap points to this document when deciding whether to keep or
  remove complexity.
- Any new frontend complexity names the user, LP, operator, or launch risk it
  directly serves.
- Any new contract complexity names the invariant or settlement risk it protects.
