# Milestone 3.1 — SportsHub MVP

## Purpose

Implement the first sportsbook vertical on top of the v1.3 settlement substrate.

The goal is not to clone a full sportsbook in one release. The goal is to prove a production-shaped
on-chain sportsbook kernel: independent bankroll, auditable market lifecycle, signed odds, first-class
risk caps, explicit result finality, and router-only settlement.

## Scope

In scope:

- independent sports pool;
- pre-match fixed-odds singles;
- allowlisted market creation;
- signed odds snapshots;
- `SportsRiskEngine`;
- result proposal, challenge delay, finality, and void path;
- router-backed hold/settle/refund;
- SportsHub-specific invariants and differential accounting checks;
- deployment and release artifacts for a sports pool.

Out of scope:

- live betting;
- parlays and same-game parlays;
- player props;
- futures/outrights;
- prediction-market outcome tokens;
- shared casino/sports bankroll;
- production provider oracle integration beyond an allowlisted reporter quorum.

## Contract graph

```text
PoolRegistry
    |
    | poolId -> Bank(asset, Sports domain)
    v
SettlementRouter
    |
    +-- SportsHub -> SportsRiskEngine
                 \-> Odds signer set
                 \-> Result reporter quorum
```

## Product constraints

- Sports MVP uses a `PoolDomain.Sports` pool, not the casino pool.
- SportsHub never calls Bank directly.
- Tickets are single-leg fixed-odds positions bound to a market, outcome, odds snapshot, and rulebook hash.
- Odds snapshots must include market id, market version, outcome id, odds, max stake, max payout, expiry, nonce, and risk hash.
- Result finality is explicit: result proposal first, then challenge window, then finalization.
- Suspended markets block new ticket acceptance but do not block eligible settlement/refund.

## PR sequence

## Current implementation status

As of `master` through PR #6:

- PR-3.1.1 is implemented as a local checkpoint with shared SportsHub types, `ISportsHub`,
  `ISportsRiskEngine`, and this milestone plan.
- PR-3.1.2 has an initial `SportsHub` contract covering constructor wiring, Sports pool enforcement,
  market creation, open/suspend/resume/lock/void transitions, version bumps, and risk-in prechecks for
  non-open, suspended, locked, and expired-odds ticket attempts.
- PR-3.1.3 has router-backed fixed-odds ticket placement: per-ticket signed odds acceptance hashes,
  allowlisted odds signers, replay rejection, `SportsRiskEngine` decision calls, ticket records, router
  positions, Bank reserve accounting, and market/outcome/event exposure increments.
- PR-3.1.4 has a concrete `SportsRiskEngine` with configurable default caps plus per-Sports-pool
  overrides, pool-aware deterministic `riskHash`, fixed-odds payout calculation, stale odds/state checks,
  and market/outcome/pool-event exposure cap enforcement.
- PR-3.1.5 has allowlisted result reporters, public result proposal, explicit challenge delay,
  challenged-result blocking, result finalization, and challenged-market void coverage.
- PR-3.1.6 has initial router-backed debt-out for resolved winners/losers and void/refund flows, with
  market/outcome/event exposure release and Bank position terminalization coverage.
- SportsHub-specific invariants now cover exposure sums against held tickets, Bank reserve alignment,
  router position ownership/pool binding, ticket/position terminal-state alignment, and no early debt-out
  before Resolved/Voided market states.
- PR-3.1.7 now has initial deployment and release wiring: `DeployV13` conditionally deploys
  `SportsRiskEngine` + `SportsHub` for Sports pools, allowlists SportsHub for Sports pool ids, writes
  Sports addresses/risk/oracle metadata into v1.3 snapshots, includes Sports fields in release digests,
  exposes Sports fields in the v1.3 frontend manifest, and exports Sports ABIs.
- PR-3.1.7 also has an initial SportsHub ops runbook, plus Sports monitoring metrics, alert rules, and
  incident-template hooks for odds signer health, result reporter finality, and exposure-cap incidents.
- PR-3.1.8 adds a configurable result reporter threshold and EIP-712 reporter signature quorum for
  result proposals, while keeping the threshold-1 MVP call path available.
- PR-3.1.9 adds authorized result challenger/arbitrator roles, challenge evidence, arbitration decision
  evidence, explicit uphold/reopen/void outcomes, and a closed finality challenge window.
- PR-3.1.10 requires direct market voids to include a non-zero reason hash and emits `MarketVoided`
  for incident linkage and monitoring.
- PR-3.1.11 adds batch debt-out helpers for keeper/frontend terminalization while preserving single-ticket
  settlement/refund/void semantics and per-ticket events.

The SportsHub MVP contract track is now functionally closed for pre-match fixed-odds singles. Mainnet
readiness still depends on the production gates in
`docs/plan/Milestone-3.1-SportsHub-Readiness.md`, including oracle policy, risk caps, release artifacts,
ops monitoring, and jurisdiction/compliance review.

### PR-3.1.1 — Interfaces and milestone plan

Deliverables:

- Add SportsHub market/ticket/result types to `SSOTTypes`.
- Add `ISportsHub`.
- Add `ISportsRiskEngine`.
- Add this milestone plan.

Acceptance:

- `forge build` passes.
- Interfaces encode the MVP scope and do not introduce Bank custody access.

### PR-3.1.2 — Market lifecycle

Deliverables:

- Implement `SportsHub` constructor and immutable dependencies.
- Implement market creation/open/lock/suspend/void.
- Enforce `PoolDomain.Sports`.
- Store market state and rulebook hash.

Acceptance:

- Tickets cannot be placed in Draft, Locked, Suspended, ResultProposed, Challenged, Resolved, or Voided states.
- Market lifecycle transitions match ADR-0029.
- Market lock/start prevents risk-in.

### PR-3.1.3 — Odds snapshots and ticket placement

Deliverables:

- Implement signed odds snapshot verification.
- Implement fixed-odds payout/reserve calculation.
- Implement router-backed ticket placement.
- Track market, outcome, and event reserved exposure.

Acceptance:

- Expired odds are rejected.
- Replayed or mismatched odds are rejected.
- Ticket placement opens exactly one router position.
- No ticket can be accepted after market lock.

### PR-3.1.4 — SportsRiskEngine

Deliverables:

- Implement configurable caps:
  - max stake per ticket;
  - max payout per ticket;
  - per-market exposure cap;
  - per-outcome exposure cap;
  - per-pool/event aggregate cap.
- Add independent unit tests for cap behavior.

Acceptance:

- Risk checks run before `SettlementRouter.openPosition`.
- Cap failures do not change exposure accounting.
- UI-only risk checks are not part of the trusted path.

### PR-3.1.5 — Result proposal and finality

Deliverables:

- Implement allowlisted result reporters.
- Implement result proposal, challenge, finalize, and emergency void.
- Bind result payload to market id, event id, pool id, market version, rulebook hash, reporter set hash,
  result source hash, evidence hash, and observed timestamp; store proposer and finality time.

Acceptance:

- A result cannot settle before finality.
- Challenged results cannot finalize without the configured resolution path.
- Final result is unique per market.
- Voided tickets refund through router.

### PR-3.1.6 — Settlement and invariants

Deliverables:

- Implement winning-ticket settlement.
- Implement losing-ticket settlement with zero payout.
- Implement refund/void flows through router.
- Add SportsHub invariant handler.
- Add system-level diff coverage for sports positions.

Acceptance:

- Sports tickets cannot settle/refund twice.
- SportsHub cannot settle positions owned by another hub.
- Router/Bank accounting remains per-pool.
- Suspended/voided markets preserve debt-out liveness.

### PR-3.1.7 — Deployment, release, and ops

Deliverables:

- Extend deploy script with a sports pool and SportsHub.
- Extend frontend artifacts with sports pool and SportsHub addresses.
- Add release digest checks for sports artifacts.
- Add ops runbook for odds signer health, result reporter finality, and exposure caps.

Acceptance:

- Local deployment produces a complete GameHub + SportsHub topology.
- Release artifacts include sports pool id, Bank, SportsHub, risk engine, signer set hash, and reporter set hash.
- Operator docs define what to do when odds signing, result finality, or exposure caps fail.

### PR-3.1.8 — Result reporter quorum

Deliverables:

- Add a configurable `resultReporterThreshold`.
- Require result proposals to meet threshold with the proposer plus unique reporter signatures.
- Store reporter threshold/count in the result record and release artifacts.

Acceptance:

- Threshold `1` preserves the MVP reporter flow.
- Threshold `2+` rejects missing, unauthorized, or duplicate reporter signatures.
- Result ops docs explain how to verify quorum evidence.

### PR-3.1.9 — Result dispute arbitration

Deliverables:

- Add authorized result challenger and arbitrator roles.
- Persist challenge reason, challenger, challenged timestamp, arbitration decision hash, arbitrator, and decision timestamp.
- Resolve challenged results through explicit `UpholdResult`, `ReopenResult`, or `VoidMarket` decisions.
- Require challenged-market voids to go through the auditable arbitration path.

Acceptance:

- Unauthorized addresses cannot force a market into `Challenged`.
- Challenges cannot be opened after the result finality window closes.
- An upheld challenge finalizes the original result without changing the winner.
- A reopened challenge returns the market to `Locked` so reporters must submit a fresh quorum-bound result.
- A void decision enables refunds and emits public arbitration evidence.

### PR-3.1.10 — Void reason evidence

Deliverables:

- Require direct market voids to include a non-zero `reasonHash`.
- Emit a dedicated `MarketVoided` event in addition to the state transition.
- Document direct void incident handling and monitoring.

Acceptance:

- Direct voids without a reason hash revert.
- Challenged-result voids still use the arbitration decision hash path.
- Operators can tie every voided market to an incident or rulebook evidence record.

### PR-3.1.11 — Batch debt-out helpers

Deliverables:

- Add `settleTickets`, `refundTickets`, and `voidTickets` batch wrappers.
- Keep single-ticket semantics and per-ticket events unchanged.
- Document keeper retry behavior for atomic batches.

Acceptance:

- Batch settle handles winning and losing tickets while releasing exposure.
- Batch refund/void terminalizes tickets in voided markets through the router.
- A bad ticket in a batch reverts the whole batch without partial terminalization.

## Recommended validation commands

```bash
forge build
FOUNDRY_PROFILE=pr forge test --match-path test/unit/SportsHub*.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/invariants/SportsHubInvariants.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/invariants/SettlementRouterInvariants.t.sol -vv
FOUNDRY_PROFILE=pr forge test -vv
git diff --check
```

## Risk controls

- Do not add live betting before pre-match odds and result finality are proven.
- Do not share casino and sports bankrolls in the MVP.
- Do not make result reporters able to move funds directly.
- Do not make governance able to settle arbitrary tickets.
- Do not treat oracle, risk, indexing, or compliance as frontend-only concerns.

## Links

- ADR: `docs/adr/0029-settlement-router-vertical-hubs.md`
- Research: `docs/research/sportsbook-architecture-2026-05.md`
- Constitution: `docs/constitution/SSOT.v1.3.md`
