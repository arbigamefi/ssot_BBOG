# Milestone 3.1 — SportsHub Production Readiness

## Purpose

This document defines the go/no-go gates for deploying the SportsHub MVP from
`Milestone-3.1-SportsHub-MVP.md`.

The MVP contract track proves pre-match fixed-odds singles on top of:

- independent `PoolDomain.Sports` bankrolls;
- `SettlementRouter`-only hold/settle/refund;
- signed odds snapshots;
- on-chain `SportsRiskEngine` caps;
- result reporter quorum, challenge window, and arbitration evidence;
- batch debt-out helpers for keeper/frontend terminalization.

This is not approval to launch live betting, parlays, player props, futures, shared casino/sports
bankrolls, or unlicensed regulated-market sportsbook operations.

## Current Status

As of `master` through PR #7, with the next readiness package accumulating locally on
`codex/sports-readiness-phase-local`:

- Contract implementation for the SportsHub MVP scope is complete.
- Unit, invariant, build, release-check, and PR CI gates passed on PR #6.
- The v1.3 Casino+Sports local deployment/release-artifact path is covered by `make sports-dry-run-v13`.
- The complete mock event lifecycle is covered by `make sports-lifecycle-dry-run`.
- The combined local Phase 0 gate is `make sports-phase0-readiness`.
- Ops metrics, alerts, and sportsbook runbook exist for odds signer health, result finality, disputes,
  direct void reasons, exposure caps, and batch debt-out.
- Base Sepolia Phase 1 rehearsal now covers v1.3 deployment/release, funded canary placement,
  finality settlement, direct void plus batch debt-out, result challenge/arbitration void plus batch
  debt-out, and dedicated non-GOV testnet Sports signer/reporter/challenger/arbitrator roles.
- Phase 1 is closed for the Base Sepolia testnet rehearsal. The remaining work is production/public
  launch readiness: managed key custody, operational staffing, provider policy, evidence storage, and
  compliance gating.

## Go/No-Go Gates

### 1. Contract proof gates

Required before any public-money deployment:

- `FOUNDRY_PROFILE=pr forge test -vv`
- `FOUNDRY_PROFILE=default forge build`
- `FOUNDRY_PROFILE=pr forge test --match-path test/invariants/SportsHubInvariants.t.sol -vv`
- `FOUNDRY_PROFILE=pr forge test --match-path test/invariants/SettlementRouterInvariants.t.sol -vv`
- `git diff --check`
- `make release-check-v13` after a v1.3 deployment snapshot and release artifacts exist.

No-go conditions:

- any failing SportsHub settlement, result, or invariant test;
- any untriaged router/Bank accounting regression;
- any release artifact mismatch between snapshot, digest, frontend manifest, golden vectors, and ABI
  index.

### 2. Deployment topology

The production topology must be:

```text
PoolRegistry
    |
    | poolId -> Bank(asset, Sports domain)
    v
SettlementRouter
    |
    +-- SportsHub -> SportsRiskEngine
```

Required checks:

- Sports pool is registered with `PoolDomain.Sports`.
- Sports pool uses an independent Bank; no shared casino/sports bankroll in the MVP.
- Every Bank's `settlementRouter()` equals the deployed `SettlementRouter`.
- `PoolRegistry` allowlists `SportsHub` only for Sports pools.
- `SportsHub` cannot open positions directly against Bank.
- v1.3 snapshot includes `sportsHub`, `sportsRiskEngine`, Sports pool rows, Sports caps, signer set
  hash, reporter set hash, and reporter threshold.

No-go conditions:

- a Sports pool is missing from the v1.3 snapshot;
- `SportsHub` is allowlisted for Casino pools or `GameHub` is allowlisted for Sports pools;
- any release artifact omits SportsHub or SportsRiskEngine addresses.

### 3. Odds, result, and risk policy

Required before opening a market:

- A written rulebook hash policy for every supported market type.
- Governance-published `SPORTS_ODDS_SIGNER_SET_HASH`.
- Governance-published `SPORTS_RESULT_REPORTER_SET_HASH`.
- `SPORTS_RESULT_REPORTER_THRESHOLD` set to the approved quorum policy.
- Enough result reporters allowlisted to satisfy the threshold with operational redundancy.
- At least one authorized result challenger and one authorized result arbitrator.
- Risk caps set in raw token units for each Sports pool asset:
  - max stake;
  - max payout;
  - max market reserved;
  - max outcome reserved;
  - max pool/event reserved.
- Odds service signs snapshots with the current `riskHash` for the target pool.

No-go conditions:

- threshold greater than the number of available/operational reporters;
- stale odds service using an old signer set hash or risk hash;
- risk caps copied across assets with different decimals without raw-unit conversion;
- missing incident/evidence storage for result source hashes, result evidence hashes, or void reason hashes.

### 4. Operations and monitoring

Required before public launch:

- Dashboard covers `docs/ops/metrics.md` Sports metrics G1 through G7.
- Alerts from `docs/ops/alerts.md` Sports rules are routed to an operator.
- `docs/ops/runbooks/sportsbook-ops.md` is rehearsed for:
  - odds signer failure;
  - bad or delayed result;
  - challenge arbitration;
  - direct market void with non-zero reason hash;
  - exposure cap pressure;
  - batch debt-out retry.
- Keeper process can call `finalizeResult`, `settleTickets`, `refundTickets`, and `voidTickets`.
- Users can still self-terminalize eligible tickets with single-ticket functions.

No-go conditions:

- no operator owns result-finality alerts;
- keeper cannot terminalize tickets in batches;
- direct voids do not map to incident records;
- no process exists to shrink a failed atomic batch and retry smaller batches.

### 5. Product and compliance boundary

Required before mainnet:

- Legal/compliance decision on target jurisdictions, age policy, restricted regions, and required
  licensing or registration model.
- Terms and rulebook published for each supported sport/market type.
- Data-provider policy documented, including fallback when providers disagree.
- Explicit decision on whether frontend access requires KYC/geofencing for target jurisdictions.
- Bankroll sizing approved for initial limits and worst-case reserved exposure.

No-go conditions:

- positioning the product as a regulated sportsbook without the required approvals;
- using "pure on-chain" as a substitute for oracle, rulebook, and compliance policy;
- launching broad markets before the narrow pre-match singles scope has production evidence.

## Launch Phases

### Phase 0 — Dry run

- Deploy to a local or ephemeral test chain.
- Generate v1.3 release artifacts.
- Run `make release-check-v13`.
- Run the combined deterministic local gate: `make sports-phase0-readiness`.
  This wraps the v1.3 Casino+Sports artifact dry run and the complete mock event lifecycle.

### Phase 1 — Testnet rehearsal

- Fill a public-testnet v1.3 Sports env file from `docs/deploy/*-v13-sports.env.example`.
- Run `ENV_FILE=<filled-env> make sports-testnet-preflight-v13`.
- Deploy v1.3 to a public testnet with one Casino pool and one Sports pool.
- Verify explorer metadata.
- Publish release digest and frontend manifest.
- Run canary tickets with realistic odds snapshots and result quorum signatures.
- Rotate away from single-GOV bootstrap roles to dedicated testnet odds signer, result reporter,
  result challenger, and result arbitrator keys.
- Rehearse each sportsbook incident playbook, including direct void, batch debt-out, and challenged
  result arbitration.

### Phase 2 — Limited mainnet canary

- Start with one asset, one Sports pool, low limits, and a small market set.
- Keep max stake/payout below the bankroll amount that operators can manually supervise.
- Require active monitoring during market lock/result/finality windows.
- Freeze new market creation if result-finality or debt-out terminalization falls behind.

### Phase 3 — Expansion

Only expand after canary evidence supports it:

- higher limits;
- more events and market types;
- multiple assets or regions;
- automated provider redundancy;
- third-party frontend integrations.

Live betting, parlays, player props, futures/outrights, and prediction-market outcome tokens remain
separate future milestones.

## Evidence Package

Before promoting a deployment to public launch, collect:

- target commit and PR list;
- CI links and local validation logs;
- `deployments/latest-v13.json`;
- `deployments/release-latest-v13.json`;
- `deployments/frontend-manifest-latest-v13.json`;
- `deployments/golden-vectors-latest-v13.json`;
- `deployments/abis-v13/index.json`;
- explorer verification links;
- initial Sports risk caps and bankroll memo;
- odds signer set, result reporter set, challenger, and arbitrator approval records;
- dry-run/testnet incident rehearsal notes.

## Local Dry-Run Evidence

2026-05-13 local dry run on the Sports readiness branch used a temporary detached worktree and a
deterministic two-pool v1.3 configuration:

- pool `1`: Casino, dummy asset `0x0000000000000000000000000000000000000101`;
- pool `2`: Sports, same dummy asset but independent Bank;
- dummy VRF wrapper `0x00000000000000000000000000000000000000ff`;
- dummy odds signer set hash `0x1111111111111111111111111111111111111111111111111111111111111111`;
- dummy result reporter set hash `0x2222222222222222222222222222222222222222222222222222222222222222`;
- reporter threshold `1`;
- Sports caps: `100000000` max stake, `1000000000` max payout, `5000000000` max market reserved,
  `3000000000` max outcome reserved, `8000000000` max event reserved.

Commands that passed:

```bash
make sports-dry-run-v13
```

Observed generated evidence:

- `architectureVersion`: `v1.3-router-pools`;
- `chainId`: `31337`;
- `numPools`: `2`;
- Sports pool risk hash: `0xe84b2cf9c81ec8c4b453c3e5e285ea1c103a1b9ca6774393ed306ff18fe17dd3`;
- release digest: `0x5c5c655334c8f066c1a158d01137809241de150504bedeba8a3d09111da04c75`;
- frontend manifest schema version: `2`;
- ABI export wrote `14` ABI files.

This proves the local v1.3 Casino+Sports artifact-generation path. It does not prove real ERC20
metadata, real VRF wrapper behavior, explorer verification, funded bankroll behavior, provider
redundancy, or public-network transaction inclusion. Those remain Phase 1 testnet rehearsal gates.

## Base Sepolia Phase 1 Evidence

2026-05-13 Base Sepolia rehearsal is recorded in
`docs/deploy/base-sepolia-v13-sports-rehearsal-2026-05-13.md` and covers:

- v1.3 Casino+Sports deployment with one Casino pool and one independent Sports pool;
- strict release artifact generation/check and Basescan source verification;
- funded Casino and Sports Banks;
- Sports canary placement, result finality, and ticket settlement;
- direct market void with `refundTickets` and `voidTickets` debt-out;
- challenged result arbitration to `VoidMarket` with `refundTickets` and `voidTickets` debt-out;
- dedicated testnet odds signer, result reporter, result challenger, and result arbitrator role
  rotation;
- role-separated challenge/arbitration canary with GOV removed from odds signer and result reporter
  mappings;
- closeout gate `make sports-phase1-closeout-v13`.

The rehearsal proves public-testnet transaction inclusion and accounting terminalization for the MVP
paths, plus testnet-level operational role separation. It still uses generated local testnet role keys
and GOV as the canary player/market operator, so it does not prove managed production key custody,
external provider reliability, or public frontend controls.

The remaining production controls are tracked in `docs/ops/sportsbook-production-controls.md`.

## Local Lifecycle Evidence

2026-05-13 local lifecycle dry run used `test/unit/SportsHubLifecycle.t.sol` and passed:

```bash
make sports-lifecycle-dry-run
```

The smoke path covers:

- create/open a resolved market;
- place one winning and one losing fixed-odds ticket;
- lock the market, propose a result, wait through finality, and finalize;
- batch-settle winner and loser through `settleTickets`;
- assert Bank/router/SportsHub exposure returns to zero;
- create/open a separate market;
- place two tickets, direct-void the market with a non-zero reason hash, then terminalize one ticket
  through `refundTickets` and one through `voidTickets`;
- assert refunded/voided ticket states, refunded router positions, final player balance, and cleared
  market/event/pool-event exposure.

This is still a local mock lifecycle. It does not prove provider data quality, real operator timing,
chain inclusion, frontend signer integration, or jurisdiction controls.

## Combined Phase 0 Gate

The combined local Phase 0 readiness gate is:

```bash
make sports-phase0-readiness
```

It runs:

- `make sports-dry-run-v13`;
- `make sports-lifecycle-dry-run`.

Passing this gate is required before moving from local readiness work to public testnet rehearsal.

## Public Testnet Evidence

2026-05-13 Base Sepolia v1.3 Casino+Sports rehearsal evidence:

- `docs/deploy/base-sepolia-v13-sports-rehearsal-2026-05-13.md`

This proves public testnet deployment, explorer verification, release artifact generation, strict
release checking, basic on-chain topology checks, controlled testnet Bank funding, and one funded
canary Sports ticket through placement, result proposal, finality, finalization, and settlement. The
same deployment also rehearsed a direct market void followed by batch `refundTickets` and
`voidTickets` debt-out, with SportsHub exposure, router positions, and Sports Bank reserved liability
returning to zero on Base Sepolia block `41447214`.

Result challenge rehearsal remains Phase 1 work.
