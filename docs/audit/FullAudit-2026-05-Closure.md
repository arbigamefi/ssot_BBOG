# FullAudit 2026-05 Closure

> **Historical baseline notice (2026-05-13)**: this closure documents fixes against the pre-v1.3 Hub
> codebase. References to `Hub` / `InvariantsAdapter` are retained as historical closure evidence.
> Current casino lifecycle code lives in `src/core/GameHub.sol` and settles through
> `src/core/SettlementRouter.sol`.

Date: 2026-05-12

Source report: `docs/audit/FullAudit-2026-05.md`

Scope: closure for the five main findings SEV-01 through SEV-05, plus Slither High/Medium triage after fixes.

## Executive Status

The immediate release blockers from `FullAudit-2026-05.md` are closed in the current working tree:

- SEV-01: fixed
- SEV-02: fixed
- SEV-03: fixed
- SEV-04: fixed
- SEV-05: fixed

Supporting proof:

- Focused security regression suite: `test/unit/SecurityFixes.t.sol`
- Stateful system diff model updated for changed semantics: `test/diff/StatefulSystemDiff.t.sol`
- Slither High/Medium detector triage: `docs/audit/slither-triage-2026-05.md`
- SSOT/deploy docs updated where public semantics changed.

## v1.3 SportsHub Addendum (2026-05-21)

The source report still contains the historical `[NEW-H1] SportsHub: Challenged state can freeze tickets`
finding. That finding is closed in the current v1.3 codebase.

Current closure evidence:

- `src/core/SportsHub.sol::voidMarket` now allows governance to void a `Challenged` market after
  `resultChallengeTimeoutSeconds` has elapsed, while still blocking early void attempts with
  `ResultChallengePending`.
- `test/unit/SportsHubSettlement.t.sol::test_challengedMarketCanBeVoidedAfterTimeoutAndRefunded`
  proves the timeout escape and ticket refund path.
- `test/unit/SportsHubResult.t.sol::test_challengeResult_blocksFinalizationAndCanBeVoided`
  proves the challenge blocks normal finalization until the timeout escape path is available.
- `FOUNDRY_PROFILE=pr forge test -vv` on 2026-05-21 passed with `121 passed; 0 failed; 1 skipped`.

This closes the old P0 liveness blocker for contract review. It does not by itself approve public
SportsHub risk-in on mainnet; `docs/deploy/base-mainnet-v13-readiness.md` still requires a separate
Sports Phase 2 GO packet and approved mainnet risk/role values before public sportsbook entrypoints
can be opened.

## v1.3 GameHub Liveness Addendum (2026-05-21)

The independent 2026-05-21 full-audit pass found one additional Medium liveness issue:
`registerGame` allowed governance to overwrite an active `gameId`. If this happened after a bet
entered `RandomReady`, `finalize` could resolve old params through a new module and permanently
strand the bet if the new module reverted or returned an amount above the old reserved cap.

Current closure evidence:

- `src/core/GameHub.sol::registerGame` now rejects any attempt to overwrite an existing `gameId`.
  Module upgrades must use a new game id or a separately audited migration path.
- `src/core/GameHub.sol::finalize` now wraps `IGameModule.resolve` in `try/catch` and routes
  resolve reverts, over-refunds, and over-payouts into a full-stake `Refunded` terminal path.
- `test/unit/SecurityFixes.t.sol::test_registerGameRejectsOverwrite` covers the governance overwrite
  guard.
- `test/unit/SecurityFixes.t.sol::test_revertingModuleResolveFallsBackToFullRefund` covers module
  resolve revert liveness.
- `test/unit/SecurityFixes.t.sol::test_overPayoutModuleFallsBackToFullRefund` covers impossible
  payout liveness.
- `FOUNDRY_PROFILE=pr forge test -vv` on 2026-05-21 passed with `124 passed; 0 failed; 1 skipped`.

This closes the open Medium contract-code finding from `docs/audit/FullAudit-2026-05-21.md`.
It does not approve Base mainnet deployment by itself; `docs/deploy/base-mainnet-v13-readiness.md`
still remains the project-level go/no-go source.

## Low-Severity Follow-Up

| Finding | Resolution | Status |
| --- | --- | --- |
| SEV-L1 | Accepted/tracked. Reverting `receive()` cannot prevent forced ETH via `selfdestruct`, and a generic VRFHub sweep would conflict with the no-oracle-fee-backdoor rule unless a separate adapter-mode credit accounting change is introduced. Z1 remains a handler-path invariant, with unsolicited ETH treated as out-of-model dust. | Deferred |
| SEV-L2 | `ReferralRegistry._bind` now reverts on duplicate first-touch attempts instead of silently returning. | Closed |
| SEV-L3 | Referral cycle scan depth increased from 32 to 64 hops. Hub skyline/upline traversal remains capped at 6 with duplicate filtering. | Closed |
| SEV-L4 | Hub skyline encoding no longer uses 32-byte `mstore` writes for 22-byte segments; it writes packed bytes directly without tail overwrite. Stateful diff model was updated to match. | Closed |
| SEV-L5 | Removed the unreachable `denom == 0` branch from `Bank._holdbackReleasable`. | Closed |
| SEV-L6 | `VRFHub.detach` now deletes request storage after ownership validation, while preserving event data for active detaches and preserving fulfilled-event data via cached locals. | Closed |
| SEV-L7 | Closed with SEV-L2: duplicate `Hub.bindReferrer` now reverts through the registry and cannot emit a false success event. | Closed |
| SEV-L8 | Added additive `BetReserveReleased` event on reserve release, emitted from Bank settlement/refund paths without changing the existing `BetRefunded` ABI. | Closed |

## Finding Closure Table

| Finding | Original issue | Resolution | Regression proof | Status |
| --- | --- | --- | --- | --- |
| SEV-01 | First LP ERC4626-style inflation attack via dust deposit plus direct donation | `Bank` now uses virtual asset/share reserves for conversions and rejects zero-share deposits | `test_firstLpInflationAttackNoLongerProfitable` | Closed |
| SEV-02 | Referral config could over-allocate XP because `levelBps` sum was not bounded | `Hub` validates referral config at construction and creation; `DefaultReferralEngine` also clamps split output defensively | `test_referralConfigRejectsOverBudgetLevels`, `test_initialReferralConfigRejectsOverBudgetLevels` | Closed |
| SEV-03 | New holdback awards reset vesting and delayed previous unreleased holdback | `Bank` now uses a non-extending aggregate vesting schedule; a new award cannot extend an active `holdbackVestingEnd` | `test_newHoldbackAwardDoesNotDelayExistingVesting` | Closed |
| SEV-04 | `maxAffiliateDeltaBps == 0` allowed affiliate HE up to 100% and player `maxHouseEdgeBps == 0` meant max | `0` now means default HE cap; docs and model updated to `0 => defaultHouseEdgeBps` | `test_zeroMaxAffiliateDeltaMeansDefaultOnly` | Closed |
| SEV-05 | Buggy module returning `refundAmount > stake` could permanently strand a bet in `RandomReady` | `Hub.finalize` falls back to a full stake refund and terminal `Refunded` state for invalid over-refund | `test_badModuleRefundTooLargeFallsBackToFullRefund` | Closed |

## Semantic Changes

### Bank Share Accounting

`Bank` share conversion now includes virtual reserves:

- `assets * (totalSupply + virtualOffset) / (totalAssets + virtualOffset)`
- `shares * (totalAssets + virtualOffset) / (totalSupply + virtualOffset)`

This preserves a 1:1 initial price while making direct donations accrue to existing LP economics instead of letting a dust depositor dilute later LPs to zero shares.

### House Edge Defaults

`maxHouseEdgeBps == 0` no longer means `MAX_HOUSE_EDGE`. It now means `defaultHouseEdgeBps`.

This affects:

- `Hub.placeBet`
- `Hub.setAffiliateHouseEdge`
- `SSOT.v1.0`
- `SSOT.v1.1`
- `docs/deploy/params.md`
- stateful diff model expectations

### Holdback Vesting

Holdback remains an aggregate bucket, but the vesting schedule is now non-extending:

- Existing releasable holdback is synced before adding a new holdback award.
- If unreleased holdback remains under an active schedule, a new award does not push out the existing `holdbackVestingEnd`.
- If no unreleased holdback remains, the new award starts a fresh schedule.

This avoids the rolling-reset delay identified in SEV-03. It is payee-favorable because a new award can vest on the current active aggregate schedule rather than always starting a fresh tranche. A per-award tranche ledger would be more precise but higher complexity and storage cost.

## Verification Run

Commands run after fixes:

```text
FOUNDRY_PROFILE=pr forge test --match-path test/unit/SecurityFixes.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/diff/StatefulSystemDiff.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/diff/StatefulSystemDiffAdapter.t.sol -vv
FOUNDRY_PROFILE=pr forge test --match-path test/invariants/InvariantsAdapter.t.sol -vv
FOUNDRY_PROFILE=pr forge test -vv
git diff --check
~/.local/bin/slither . --filter-paths "test/|src/mocks/|lib/" --json /tmp/arbigamefi_slither_after_low.json
```

Results:

- `SecurityFixes`: 9 passed, 0 failed
- `StatefulSystemDiff`: 1 passed, 0 failed
- `StatefulSystemDiffAdapter`: 2 passed, 0 failed
- `InvariantsAdapter`: 1 passed, 0 failed
- Full Foundry suite: 44 passed, 0 failed, 1 fork skipped
- `git diff --check`: passed
- Slither: 86 total detector results; remaining High/Medium rows are triaged in `docs/audit/slither-triage-2026-05.md`

## Remaining Non-Blocking Work

These are not blockers for the five primary findings, but remain worthwhile follow-ups:

- Decide whether SEV-L1 should get an adapter-mode-only dust sweep with explicit accounting, or remain accepted as forced-ETH dust.
- Consider adding CI jobs for Slither baseline enforcement once the current detector set is intentionally suppressed or baselined.
- Consider per-award holdback tranches in a future storage-layout-breaking release if exact tranche-level vesting is preferred over the current non-extending aggregate policy.

## Release Recommendation

Do not deploy the old Bank/Hub semantics. With this patch set, the P0/P1 findings and SEV-03 economic-delay finding are closed by focused regression tests and full suite verification.
