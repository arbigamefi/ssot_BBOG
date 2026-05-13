# Sportsbook Production Controls

This document closes the v1.3 SportsHub Phase 1 testnet rehearsal and defines what still blocks any
mainnet or public sportsbook launch.

Phase 1 proves that the on-chain MVP rails work on Base Sepolia. It does not approve a regulated
real-money sportsbook launch.

## Phase 1 Closeout

Phase 1 is closed only when all of the following are true:

- v1.3 Casino+Sports deployment snapshot and release artifacts exist and pass strict release checks;
- Base Sepolia Sports pool has funded bankroll rehearsal evidence;
- Sports canary covers placement, result finality, settlement, direct void, batch refund/void, result
  challenge, and arbitration to `VoidMarket`;
- dedicated testnet odds signer, result reporter, result challenger, and result arbitrator are
  allowlisted;
- GOV is removed from the odds signer and result reporter mappings after bootstrap;
- all rehearsed tickets are terminalized and Sports Bank reserved is zero;
- `docs/deploy/base-sepolia-v13-sports-rehearsal-2026-05-13.md` records transaction hashes and
  chain readbacks;
- `make sports-phase1-closeout-v13 ENV_FILE=.env.sports-roles.local` passes.

## Managed Key Custody

The generated Base Sepolia role keys are acceptable only for testnet rehearsal.

The repo-side custody record shape is defined in
[`sportsbook-key-custody-roles.md`](sportsbook-key-custody-roles.md). The approval memo should be
based on `docs/ops/templates/sportsbook-role-custody.example.json` and checked with
`make sports-role-custody-check-v13`.

Before any public-money deployment:

- odds signer keys must live in an approved signer service, HSM, MPC wallet, or similarly managed
  custody environment;
- result reporter, challenger, and arbitrator keys must be separated by operator responsibility;
- emergency governance keys must not be reused as routine odds/reporting keys;
- every signer-set or reporter-set change must have an approval record, effective block/window,
  expected set hash, transaction hashes, and rollback plan;
- operators must run a canary after every signer-set, reporter-set, threshold, or risk-hash change.

No-go:

- a locally generated `.env` key is used for production odds, result reporting, challenge, or
  arbitration;
- GOV remains the routine odds signer or result reporter;
- signer-set hashes are changed without matching off-chain signer configuration and canary evidence.

## Provider And Evidence Policy

Sports outcomes are real-world facts. On-chain custody and settlement do not remove the need for
provider policy.

The repo-side evidence shape is defined in
[`sportsbook-provider-evidence-policy.md`](sportsbook-provider-evidence-policy.md), with example
rulebook and result evidence bundles under `docs/ops/templates/`. That policy is a required input to
production review, not a provider approval by itself.

Before any public market:

- each market type must have a published rulebook hash and a human-readable rulebook;
- every result must map to a source bundle hash and an evidence bundle hash;
- provider disagreement, postponement, cancellation, abandoned games, and stat correction handling
  must be documented before the market type is opened;
- the incident record must preserve source URLs, raw provider payloads, reporter observations,
  challenge reason hash, arbitration decision hash, and terminalization txs;
- result reporters must use the `hashResultPayload(...)` digest from the deployed `SportsHub` and the
  current `resultReporterSetHash`.

No-go:

- a result is proposed without reproducible source and evidence hashes;
- a disputed result is finalized without waiting through the challenge window;
- a challenged result is resolved without a non-zero arbitration decision hash;
- a market type is opened before cancellation/void/postponement handling is defined.

## Bankroll And Risk Caps

Sports caps must be derived from approved bankroll and loss tolerance in raw asset units. Testnet caps
must not be copied into production.

The repo-side sizing policy and validator are defined in
[`sportsbook-bankroll-risk-caps.md`](sportsbook-bankroll-risk-caps.md). The approval memo should be
based on `docs/ops/templates/sportsbook-bankroll-risk-caps.example.json` and checked with
`make sports-bankroll-caps-check-v13`.

Before any public-money Sports market:

- the Sports Bank must be funded with the approved initial bankroll;
- `manualLossToleranceRaw` must be less than or equal to the funded bankroll;
- `maxEventReservedRaw` must be less than or equal to `manualLossToleranceRaw`;
- max stake, max payout, outcome, market, and event caps must be recorded in raw asset units;
- deploy env `SPORTS_MAX_*` values must match the approved memo;
- odds snapshots must be rotated after any cap change because the risk hash changes.

No-go:

- the memo is missing or still marked `draft`;
- cap values are copied from Base Sepolia without an asset-decimal memo;
- `maxEventReservedRaw` exceeds manual loss tolerance;
- `manualLossToleranceRaw` exceeds funded bankroll;
- deploy env values do not match the approved memo.

## Public Frontend Controls

The current repo has no approved public sportsbook frontend launch. Any public entrypoint must be
treated as a separate go/no-go decision.

Before enabling a public sportsbook frontend:

- legal/compliance must approve target jurisdictions, restricted jurisdictions, age policy, KYC policy,
  sanctions policy, and responsible-gaming controls;
- the frontend must have an explicit sportsbook enablement flag, defaulting off for unsupported
  jurisdictions;
- the frontend must block or hide sportsbook risk-in flows when jurisdiction status is unknown or
  restricted;
- terms, risk disclaimer, privacy policy, and market rulebooks must be linked from the sportsbook flow;
- public canary limits must be low enough for manual supervision and explicit bankroll loss tolerance.

No-go:

- "pure on-chain" is used as a substitute for jurisdiction, age, KYC, or sanctions controls;
- the frontend exposes public sportsbook risk-in before legal/compliance approval;
- a public UI lets users place Sports tickets while provider evidence, rulebook, or role status is
  unknown.

## Launch Decision

Phase 1 closeout means the testnet rails are ready for review. It does not mean mainnet is ready.

The next production gate is a documented go/no-go packet containing:

- managed key custody approval;
- provider contract or integration decision;
- evidence storage location and operator procedure;
- jurisdiction and frontend access decision;
- bankroll sizing memo;
- final risk caps in raw asset units;
- fresh canary after any role, provider, or risk parameter change.

Current Phase 2 packet:
[`sportsbook-phase2-gonogo-2026-05-14.md`](sportsbook-phase2-gonogo-2026-05-14.md). The
current decision is **NO-GO** until the packet records approvals for every open production gate.
