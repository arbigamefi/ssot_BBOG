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

As of the current `codex/sportsbook-architecture-research` branch:

- PR-3.1.1 is implemented as a local checkpoint with shared SportsHub types, `ISportsHub`,
  `ISportsRiskEngine`, and this milestone plan.
- PR-3.1.2 has an initial `SportsHub` contract covering constructor wiring, Sports pool enforcement,
  market creation, open/suspend/resume/lock/void transitions, version bumps, and risk-in prechecks for
  non-open, suspended, locked, and expired-odds ticket attempts.
- PR-3.1.3 has router-backed fixed-odds ticket placement: per-ticket signed odds acceptance hashes,
  allowlisted odds signers, replay rejection, `SportsRiskEngine` decision calls, ticket records, router
  positions, Bank reserve accounting, and market/outcome/event exposure increments.
- PR-3.1.4 has an initial concrete `SportsRiskEngine` with configurable global caps, deterministic
  `riskHash`, fixed-odds payout calculation, stale odds/state checks, and market/outcome/event exposure
  cap enforcement.
- PR-3.1.5 has allowlisted result reporters, public result proposal, explicit challenge delay,
  challenged-result blocking, result finalization, and challenged-market void coverage.
- PR-3.1.6 has initial router-backed debt-out for resolved winners/losers and void/refund flows, with
  market/outcome/event exposure release and Bank position terminalization coverage.
- SportsHub-specific invariants now cover exposure sums against held tickets, Bank reserve alignment,
  router position ownership/pool binding, ticket/position terminal-state alignment, and no early debt-out
  before Resolved/Voided market states.
- Deployment and release wiring remain out of this milestone slice.

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
  - per-event aggregate cap.
- Add independent unit tests for cap behavior.

Acceptance:

- Risk checks run before `SettlementRouter.openPosition`.
- Cap failures do not change exposure accounting.
- UI-only risk checks are not part of the trusted path.

### PR-3.1.5 — Result proposal and finality

Deliverables:

- Implement allowlisted result reporters.
- Implement result proposal, challenge, finalize, and emergency void.
- Bind result payload to market id, event id, rulebook hash, reporter set hash, proposer, and finality time.

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
