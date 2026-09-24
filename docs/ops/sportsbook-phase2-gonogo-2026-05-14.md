> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# Sportsbook Phase 2 Go/No-Go Packet - 2026-05-14

## Decision

**Decision: NO-GO for limited mainnet sportsbook canary.**

The v1.3 contracts and Base Sepolia rails are ready for production review, but the project does not
yet have the off-chain controls required for a public-money sportsbook launch.

This packet is the current Phase 2 gate. It should be updated, not bypassed, before any mainnet or
public sportsbook risk-in is enabled.

## Scope

Phase 2 means a limited mainnet canary for the SportsHub MVP only:

- one chain;
- one asset;
- one independent `PoolDomain.Sports` Bank;
- pre-match fixed-odds singles only;
- low operator-supervised limits;
- no live betting, parlays, player props, futures, or shared casino/sports bankroll;
- no public sportsbook frontend until compliance and access controls are approved.

## Completed Evidence

### Contract and CI evidence

- PR #13 merged into `master`: `8971eb9ed4a111cfd79d50cadeb9155e95d144e0`
- PR #13 CI: two `test` checks passed.
- PR #15 merged into `master`: `3f2be8075b326c4cb4356f6ac330a14a521d0006`
- PR #15 CI: two `test` checks passed.
- Local focused validation for GameHub canary tooling:
  - `forge build`
  - `forge test --match-path 'test/unit/GameHub*.t.sol' -vv`
  - `forge test --match-path 'test/unit/ChainlinkAdapter.t.sol' -vv`
  - `forge test --match-path 'test/unit/VRFFee*.t.sol' -vv`
  - `make sports-dry-run-v13`
  - `REQUEST_GAS_PRICE_WEI=100000000 ENV_FILE=.env.v13-sports.local make sports-testnet-preflight-v13`
  - `STRICT=1 SNAPSHOT_PATH=deployments/latest-v13.json make release-check-v13`

### Base Sepolia deployment evidence

- Chain ID: `84532`
- Deployment block: `41462034`
- Release digest: `0x7ad0f2cb1a996251325c00441b125ca5276c5bf70f011577222ce588cae1349f`
- GameHub: `0x99c8c8B55803A566561b58188027fb9E46ACa215`
- SportsHub: `0x2DB4Ba326C2C3e5830b0da10F0C52B4097f9fa4b`
- Casino Bank: `0x3aADa481F979E5DFabd2Cd252A76feA2aD05e346`
- Sports Bank: `0x3686664d8D92FEAb8C4c9Ac0baaEb07c8BDDbc85`

### SportsHub Phase 1 evidence

Documented in `docs/deploy/base-sepolia-v13-sports-rehearsal-2026-05-13.md`.

Covered:

- funded Sports Bank rehearsal;
- fixed-odds ticket placement;
- result proposal, finality, and settlement;
- direct market void;
- batch `refundTickets` and `voidTickets`;
- challenge, arbitration to `VoidMarket`, and batch debt-out;
- dedicated testnet odds signer, result reporter, challenger, and arbitrator;
- GOV removed from odds signer and result reporter roles;
- final Sports Bank reserved exposure returned to zero;
- `ENV_FILE=.env.sports-roles.local make sports-phase1-closeout-v13` passed.

### Football MVP product canary evidence

Documented in `docs/deploy/worldcup-football-mvp-canary-2026.md`.

Covered:

- one pre-match football 1X2 market shaped as Mexico vs South Africa;
- 0-based outcome mapping: `0=Mexico`, `1=Draw`, `2=South Africa`;
- two signed fixed-odds tickets on Base Sepolia market `4`;
- result proposal with `resultSourceHash` and `evidenceHash`;
- finality wait, result finalization, and batch settlement;
- final `marketReserved(4) = 0`, `poolEventReserved(2, 2026061101) = 0`, and Sports Bank
  `totalReserved() = 0`.

This proves the narrow football product loop on public testnet. It does not approve a production data
provider, production evidence store, jurisdiction policy, or public-money limits.

### GameHub/Casino canary evidence

Documented in `docs/deploy/base-sepolia-v13-gamehub-canary-2026-05-14.md`.

Covered:

- adapter `requestGasPriceWei` configured to `100000000`;
- ERC20 approval;
- `GameHub.placeBet` for Dice;
- `VRFHub` request creation;
- Chainlink callback into `RandomReady`;
- permissionless `finalize`;
- `SettlementRouter`/`Bank` settlement and reserve release;
- final Casino Bank reserved exposure returned to zero.

### Production-control draft evidence

- Provider/evidence policy draft:
  `docs/ops/sportsbook-provider-evidence-policy.md`
- Candidate The Odds API ingestion path:
  `docs/ops/sportsbook-provider-the-odds-api.md`
- Deterministic provider odds fixture gate:
  `make sports-provider-odds-v13`
- Deterministic provider result evidence fixture gate:
  `make sports-provider-evidence-v13`
- Provider-driven football E2E rehearsal:
  `ENV_FILE=.env ROLE_ENV_FILE=.env.sports-roles.local make sports-provider-e2e-v13`
- Frontend access policy draft:
  `docs/ops/sportsbook-frontend-access.md`
- Example frontend access approval memo:
  `docs/ops/templates/sportsbook-frontend-access.example.json`
- Example pre-match moneyline rulebook template:
  `docs/ops/templates/sportsbook-rulebook.pre-match-moneyline.example.json`
- Example result evidence bundle template:
  `docs/ops/templates/sportsbook-result-evidence.example.json`
- Key custody/role control policy:
  `docs/ops/sportsbook-key-custody-roles.md`
- Example key custody/role memo:
  `docs/ops/templates/sportsbook-role-custody.example.json`
- Bankroll/risk cap sizing policy:
  `docs/ops/sportsbook-bankroll-risk-caps.md`
- Example bankroll/risk cap memo:
  `docs/ops/templates/sportsbook-bankroll-risk-caps.example.json`
- Monitoring/keeper coverage policy:
  `docs/ops/sportsbook-ops-coverage.md`
- Example monitoring/keeper coverage memo:
  `docs/ops/templates/sportsbook-ops-coverage.example.json`

These documents and gates define the reproducibility standard for `rulebookHash`, odds snapshots,
`resultSourceHash`, `evidenceHash`, `challengeReasonHash`, and `arbitrationDecisionHash`, plus a first
concrete The Odds API odds/score ingestion path and provider-driven local E2E rehearsal. They do not
approve a provider or evidence-storage vendor. They also define role-custody, bankroll/risk-cap, and
monitoring/keeper memo shapes and the frontend-access approval shape, but do not approve production
keys, production bankroll, operator coverage, or public sportsbook frontend access.

### Frontend product-surface evidence

Documented in `docs/strategy/sportsbook-production-roadmap.md`.

Current player-facing sportsbook work covers:

- public market lobby with open/live/today/upcoming/settled scanning;
- market detail with provider odds, outcome selection, and a one-button player bet slip;
- immediate ticket tracker after placement so a new ticket does not depend on index backfill;
- portfolio ticket receipt with selected outcome, final winner, stake, return, net result, lifecycle,
  and advanced proof hashes behind a drawer;
- normal player pages no longer route primary CTAs to `/ops/sportsbook`.

This improves player readiness, but it does not approve public risk-in. The frontend still depends on
the jurisdiction/access, provider/evidence, bankroll/risk, keeper, and mainnet artifact gates below.

## Open No-Go Items

| Gate | Status | Required before GO |
|---|---:|---|
| Managed key custody | NO-GO | Approve a `sportsbook.role-custody.v1` memo for odds signer, result reporter, challenger, arbitrator, keeper, and governance keys; it must pass `REQUIRE_APPROVED=1 make sports-role-custody-check-v13`. |
| Provider and evidence policy | NO-GO | Approve a `sportsbook.provider-evidence-approval.v1` memo for provider choice, fallback rules, evidence storage, and rulebook/result procedures; it must pass `REQUIRE_APPROVED=1 make sports-provider-policy-check-v13`. |
| Jurisdiction and frontend access | NO-GO | Approve a `sportsbook.frontend-access.v1` memo for jurisdictions, restricted regions, age policy, KYC/sanctions posture, responsible-gaming controls, and frontend gating; it must pass `REQUIRE_APPROVED=1 make sports-frontend-access-check-v13`. |
| Bankroll sizing | NO-GO | Approve a `sportsbook.bankroll-risk-caps.v1` memo with initial bankroll, loss tolerance, max reserved exposure, and manual supervision limits in raw asset units. |
| Final risk caps | NO-GO | Mainnet `SPORTS_MAX_*` values must match the approved bankroll memo and pass `REQUIRE_APPROVED=1 make sports-bankroll-caps-check-v13`. |
| Monitoring and alerts | NO-GO | Approve a `sportsbook.ops-coverage.v1` memo proving Sports G1-G7 alerts route to named operators with escalation coverage during market windows. |
| Keeper/debt-out operations | NO-GO | The approved ops coverage memo must prove keeper access to `finalizeResult`, `settleTickets`, `refundTickets`, and `voidTickets`, plus retry/shrink rehearsal evidence. |
| Mainnet release artifacts | NO-GO | Fresh mainnet deployment, verification, release digest, frontend manifest, golden vectors, ABI export, strict release check, fork tests, and release package must exist. |
| Fresh canary after final params | NO-GO | After role, provider, and risk-cap changes, run a new minimal canary and record tx hashes/readbacks. |

## Minimum GO Criteria

To change this packet from NO-GO to GO, add the concrete approval records or links for:

1. Managed key custody approval.
2. Approved provider/evidence memo.
3. Evidence storage location and operator procedure from that memo.
4. Approved jurisdiction and frontend-access memo.
5. Bankroll sizing memo.
6. Final Sports risk caps in raw asset units.
7. Monitoring/alert routing ownership.
8. Keeper/debt-out runbook rehearsal.
9. Fresh mainnet or staging release artifacts generated from the target commit.
10. Fresh canary after final role, provider, and risk-cap configuration.

## If GO Is Later Approved

The first Phase 2 canary should be deliberately narrow:

- deploy only one Sports pool;
- keep `maxStake`, `maxPayout`, market reserved, outcome reserved, and event reserved caps below the
  approved manual-supervision loss tolerance;
- open only one or a few pre-match singles with published rulebook hashes;
- require active operator monitoring from market creation through terminal debt-out;
- freeze new market creation if finality, challenge resolution, or debt-out terminalization falls behind;
- keep public frontend Sports risk-in disabled unless jurisdiction status and access policy are known.

## Current Operator Conclusion

The correct next action is not mainnet deployment. The correct next action is to fill the open
approval records above, then rerun the Phase 2 readiness gate and a fresh canary with final
production parameters.
