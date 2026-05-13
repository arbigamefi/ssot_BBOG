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
- Example pre-match moneyline rulebook template:
  `docs/ops/templates/sportsbook-rulebook.pre-match-moneyline.example.json`
- Example result evidence bundle template:
  `docs/ops/templates/sportsbook-result-evidence.example.json`

These documents define the reproducibility standard for `rulebookHash`, `resultSourceHash`,
`evidenceHash`, `challengeReasonHash`, and `arbitrationDecisionHash`. They do not approve a provider
or evidence-storage vendor.

## Open No-Go Items

| Gate | Status | Required before GO |
|---|---:|---|
| Managed key custody | NO-GO | Odds signer, result reporter, challenger, arbitrator, and governance keys must have approved custody, operator ownership, rotation procedure, and rollback plan. |
| Provider and evidence policy | NO-GO | Approve the provider choice, fallback rules, evidence storage location, and the draft rulebook/result evidence procedure in `docs/ops/sportsbook-provider-evidence-policy.md`. |
| Jurisdiction and frontend access | NO-GO | Legal/compliance must approve jurisdictions, restricted regions, age policy, KYC/sanctions posture, responsible-gaming controls, and frontend gating. |
| Bankroll sizing | NO-GO | Initial bankroll, loss tolerance, max reserved exposure, and manual supervision limits must be approved in raw asset units. |
| Final risk caps | NO-GO | Mainnet `SPORTS_MAX_*` values must be set from the bankroll memo, not copied from testnet. |
| Monitoring and alerts | NO-GO | Sports metrics G1-G7 and related alerts must be routed to named operators with escalation coverage during market windows. |
| Keeper/debt-out operations | NO-GO | Keeper process must be able to call `finalizeResult`, `settleTickets`, `refundTickets`, and `voidTickets`, with retry/shrink procedure for failed batches. |
| Mainnet release artifacts | NO-GO | Fresh mainnet deployment, verification, release digest, frontend manifest, golden vectors, ABI export, strict release check, fork tests, and release package must exist. |
| Fresh canary after final params | NO-GO | After role, provider, and risk-cap changes, run a new minimal canary and record tx hashes/readbacks. |

## Minimum GO Criteria

To change this packet from NO-GO to GO, add the concrete approval records or links for:

1. Managed key custody approval.
2. Provider contract or integration decision.
3. Evidence storage location and operator procedure.
4. Jurisdiction and frontend access decision.
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
