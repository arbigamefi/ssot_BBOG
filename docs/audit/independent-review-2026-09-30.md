# Independent review of the capital-continuity remediation

Date: 2026-09-30 (Asia/Shanghai). Original review verdict: **REWORK before candidate freeze.**
The remediation record below is separate from this original evidence.
Current scoped result: **R1–R4 remediation verified locally.** Candidate freeze and external audit
remain pending the remaining candidate gates.

This is an independent AI-assisted engineering review of the current local patch, using new reviewers
who did not implement it, followed by primary-agent verification. It is not an external audit opinion,
a release approval, or completion of the earlier native Codex Security scan. The product source was
held unchanged during the original review. Subsequent remediation is recorded separately below.
No commits, pushes, deployments or production operations were made.

## Reviewed identity and accepted requirements

- Branch: `codex/review-remediation`; HEAD: `cfbe1184b1e4d4162d3d11d36867798344be95af`.
- Uncommitted input manifest: 1,008 files; SHA-256
  `5595ad780bbc1daf80084d3a64f5b3396f283ec20fa17096597fddd6d54be89b`.
- `src/core/Bank.sol` SHA-256:
  `df80c4cbbb43d8d607850a53e3a4904d369245a3c6087670752ba348fe0d8e82`.
- Local evidence directory: `/tmp/agf-independent-review-20260930` (`identity.json`, `inputs.json`,
  `patch.diff`, independent scripts and logs). The primary agent rechecked every input hash: no drift.
- Preserve the owner's accepted economics: only exiting risk/recovery is frozen; staying capital is
  released within settlement; new deposits buy remaining active risk at full book NAV; old unresolved
  holds do not gate later exits; LP actions impose no scheduled betting pause.
- The explicit 128 active-risk-hold limit is a capacity constraint per pool, not a newly discovered
  undeclared defect. Its workload and target-network suitability still require acceptance.

## R1 — P1: Amount precision is not fully authenticated

Source-confirmed gap; full signed/live-governance import reproduction remains incomplete.

`script/release/validate_frontend_artifacts.py:130-153` accepts manifest pool decimals by comparing them
with `snapshot.poolAssetDecimals_*` and, optionally, `poolBankDecimals_*`. However,
`ReleaseDigestV16.s.sol:197-222` and `VerifyReleaseV16.s.sol:187-212` authenticate `poolLpDecimals_*`,
not those asset/bank metadata fields. The validator never equates the consumed precision to that
signed field. `V16Snapshot.sol:125-141` checks Bank code, asset, router and risk settings but does not
compare the supplied metadata decimals with Bank/token decimals.

Consequently, agreement between snapshot and manifest is not sufficient authentication of the amount
scale. In a release directory whose unsigned metadata can be altered, coordinated changes to those
fields and vector stake units are not bound by the original signature. The Earn page uses the imported
precision to parse the amount (`pageClient.tsx:79,316`); a 6-to-9 discrepancy makes an input of one mean
1,000 actual tokens, if the user has sufficient balance and approves the transaction. This is a
source-derived consequence, not a demonstrated live user transaction or proof of key/signature compromise.
The separately digest-pinned CI archive requires tampering to pass its approved archive digest too;
this concern applies to the signature-based importer trust boundary, not a demonstrated bypass of that
archive digest.

Repair: use one authenticated decimal source, enforce token/Bank/signed LP precision agreement, and
add an original-valid-release control plus coordinated metadata rejection before active-file writes.
Do not retain several unbound decimal aliases in this prelaunch project.

## R2 — P2: Bounded payable rescans can miss an in-window reorg permanently

Confirmed by an executable test of the actual `createPayableClaimer`; independently rerun by the
primary agent. Locations: `frontend/apps/keeper/src/payables.ts:92-100`.

With `chunkSize=10`, `maxChunks=1`, origin 1 and head 100, finish initial discovery. At head 101 the
first overlap page is `[77,86]`. Replace block 85 with a payable event: a 16-block reorg, within the
24-block overlap. Advance head by nine blocks per pass while the bounded cursor finishes its cycle.
It later rewinds from the newer head, so block 85 is no longer revisited. After stopping at head 326
and running another 100 passes, the actual result is:

```text
caughtUp=true, pending=0, debt=5, claimCalls=0
```

The player retains the on-chain debt and can claim directly; keeper recovery is silently incomplete
until a full replay or another event nominates that player. This is not a theft finding and is not
claimed to occur with every budget. The same cursor pattern in other scanners warrants review, but
this dynamic evidence directly exercises only player-payable discovery.

Repair: make partial overlap cycles preserve their canonical/reorg coverage as the head moves, or
anchor completed discovery to finality/hashes. Retain a regression with a replacement behind the
in-progress cursor and require eventual payment or an explicit unhealthy state.

## R3 — P2: Claim transport failures are treated as benign token refusals

Confirmed with the actual payable claimer and health reporter. Locations:
`payables.ts:136-139`, `health.ts:290-299`.

When discovery and debt reads succeed but the claim callback throws an RPC send failure, the catch
records only informational `error` and backs off. Health degrades only on `readError` or incomplete
discovery. The executed result reports `status=running`; the next backoff pass also erases the error
text while debt remains outstanding. Retry delays can grow to six hours.

Repair: distinguish expected refused transfers narrowly from transport/funding/transaction delivery
failures. Keep actionable failure state through backoff and clear it only after reconciliation.

## R4 — P2: The real-import rejection test does not isolate route authentication

Confirmed by running a no-change control without modifying the repository.
`test/ops/test_manifest_authentication.py:109` supplies an ABI index without `contracts` and does not
supply the referenced ABI inventory. Strict validation therefore fails before execution-address
validation. The test only checks generic rejection and unchanged active files.

The primary agent removed the `gameHub` alteration in memory and reran this exact test: it still
passed. Thus the previous report's importer test demonstrates rejection of an invalid bundle, not
that route tampering caused rejection. The separate direct-validator address tests retain their
narrower value.

Repair: provide a fully valid control that completes import, then mutate only one authenticated field,
assert the specific failure stage and verify active files are unchanged. Do not count malformed fixture
rejection as an authentication regression.

## Independent checks and limits

- Core reviewer ran Bank async 55/55 and capital-continuity 2/2 checks. Independent Anvil sequences
  covered six scenarios, 289 state checks, 66 holds and 64 batches, including deep loss and full-exit
  replacement capital. No additional core money-ownership defect was confirmed. The owned node was
  stopped after the review. These sequences exercise the real Bank with an authorized local Router
  caller, not a complete GameHub/VRF deployment.
- The primary agent separately enumerated 944,784 small-integer split/terminal-cost combinations:
  active solvency, the active charge `floor(activeUnits * cost / originalReserve)`, and the batch equity
  ceiling held. This finite arithmetic check is not a full state-machine or economic proof.
- Consumer reviewer: 120 targeted existing tests passed; two new counterexamples reproduced R2/R3.
  Those counterexamples intentionally assert bad behavior and remain temporary review evidence,
  not passing safety regressions to merge into CI.
- Relevant release/packaging tests: 12 passed in the release review. R4's no-change control also passed,
  which demonstrates the missing test discrimination.
- No fresh full 51-mutant run, PostgreSQL integration, production browser build, external network fork,
  external audit or deployment acceptance was performed in this review.
- The connected-wallet test covers one fixed account and local chain. Real account/chain changes,
  delayed wallet prompts and reorgs within a multi-read snapshot remain coverage gaps, not confirmed
  unauthorized-transaction findings.
- The release reviewer was interrupted by a platform safety check. Its signed-fixture preparation
  completed, but a full valid-signature/live-governance original-versus-modified import did not.
  R1 is explicitly limited to independently checked source logic; release review completeness is not claimed.

## Original follow-up

Keep ADR-0035's accepted capital rule. Fix R1–R4 in a separate implementation pass, convert the
counterexamples to expected-safe assertions, then have the reviewers verify the corrections against a
new input identity. Complete current-source release success/failure controls, wallet context tests and
candidate gates before freezing the audit commit. An external independent security audit should then
review that exact candidate; production deployment and capital admission remain separate decisions.

## Remediation — 2026-09-30

Implementation and verification are against the same branch and HEAD with a new local patch. The Bank
source hash above is unchanged. The accepted economic rule, contract storage and user authority were
not changed during this remediation.

Verification inputs: `/tmp/agf-independent-review-20260930/remediation-inputs.json`, 1,008 files,
SHA-256 `1397808110ef1eef23dbd03420e7f34f7155bf46464810d497fc53073ce7a26f`. The two audit reports are
excluded from this manifest so evidence can be appended without changing the tested code identity.

### Corrections

- **R1:** `poolLpDecimals_i` is the sole precision source for the producer, manifest, vectors and strict
  validator. The unsigned `poolAssetDecimals_i` / `poolBankDecimals_i` aliases are no longer generated
  and are rejected. Both digest implementations bind `poolAssetSymbol_i`. Live verification compares
  the full signed integer with Bank and asset decimals; it does not truncate to `uint8`.
- **R2:** payable discovery now advances monotonically through finalized blocks. Follow-up independent
  tests confirmed the same defect in historical-pocket discovery and provider cash-flow indexing;
  those two scanners use finalized progress too. Pocket state is read at the finalized block, so a
  terminal pocket is safe to remove. Ledger progress has its own finalized cursor and starts at the
  release origin, without adopting a GameHub cursor. Bounded work, restart recovery and retryable
  failed pages remain supported. The obsolete overlap mode was removed; no migration path was added.
- **R3:** per-player actionable errors survive backoff and other players' successes. Only a decoded
  `SafeERC20FailedOperation` for the configured asset during simulation is an expected refusal.
  Unknown reverts, read, funding, send and receipt failures remain actionable until reconciliation.
- **R4:** the malformed importer fixture was replaced by a complete local deployment, real generated
  release artifacts, signature verification and live governance checks. Each rejection case first
  imports a valid bundle. It then checks the rejecting stage, exact static/underlying verifier reason,
  unchanged active files and staging cleanup. The single-route control also proves that snapshot and
  signed release bytes did not change. CI installs Node and pinned contract libraries before running
  this required integration.

Finality is an explicit tradeoff: new payable discovery, pocket alerts and indexed provider cash flows
can lag the latest head. Missing or regressing finality fails the affected scan. Finalized coverage is
not a promise of coverage through the latest block. Known payable debts are still read at the latest
numbered block, and successful/zero observations stay tracked until finalized zero. Betting, batch
activation and direct user claims do not wait for these scanners.

### Evidence and limits

- **24/24 deployment/governance tests passed** on the final source, including independent Bank/asset
  precision mismatch, non-truncating integer comparison and digest-bound metadata checks. Log:
  `/tmp/agf-independent-review-20260930/remediation-deployment.log`.
- An independent rerun of the complete operations suite passed **67/67**, including seven manifest
  authentication/import tests. It exercised the real importer, actual digest/signature verification,
  accepted and pending local governance states, exact rejection causes, unchanged active files and
  staging cleanup. Log: `/tmp/agf-independent-review-20260930/remediation-ops.log`.
- R4 discrimination was independently checked by removing only the route alteration in memory.
  The unchanged valid bundle imported successfully (exit 0), and the rejection assertion failed with
  `AssertionError: 0 == 0`, as required. No repository test was changed. This is an intentional
  negative control, not a failing product regression; it closes the original test's false-positive gap.
  Log: `/tmp/agf-independent-review-20260930/remediation-r4-negative-control.log`.
- Primary-agent run: **206/206 keeper tests passed**, with TypeScript, ESLint and formatting checks.
  New safety assertions reproduce the old payable failure and the pocket/ledger omissions on reviewed
  old source; the patched source passes. The reorg tests keep the replacement above the finalized
  block until it becomes canonical, rather than modelling a reorg of finalized history.
- Independent PostgreSQL run: **21/21 existing PostgreSQL tests passed** across recovery, financial
  aggregates and house-edge storage. Ten memory-backend variants were deliberately filtered and are
  not counted as PostgreSQL passes. An owned loopback-only container used the already available
  `postgres:16-alpine` image, temporary schemas and tmpfs storage; schemas and container were cleaned.
  Evidence: `/tmp/agf-all-pg-1c98da404f57`. This verifies persistent storage, range replacement and
  financial aggregation. The finalized keeper loop with PostgreSQL has not been tested end to end;
  its runtime composition tests use the memory store.
- Release controls use only owned loopback Anvil nodes and a public local fixture key.
  `SafeConfigMockV16` verifies configuration with actual Governable contracts; it does not establish
  real Safe quorum signing, signer custody or network availability.
- No fresh full 51-mutant run, wallet account/chain-change scenarios,
  target-network acceptance, audit freeze or external audit has been performed in this remediation.
  Complete the remaining local candidate gates, then freeze a clean commit for external audit.
  Target-network acceptance and outside-capital admission remain separate release decisions.

The release patch and keeper patch were each reviewed by an agent who did not implement that area.
The four findings are closed for this local patch on the evidence above; this is a scoped remediation
result, not a claim that the project is defect-free or ready to accept outside LP capital.
After verification, both the independent checker and primary agent rechecked all 1,008 input hashes:
no drift. The actual embedded-release files were byte-identical, and owned test nodes and fixture
directories were cleaned. Receipt: `/tmp/agf-independent-review-20260930/remediation-ops-verification.json`.

## Subsequent candidate gates — 2026-09-30

This continues the local review on the same uncommitted branch. It is not a frozen commit,
external-auditor acceptance, deployment, or completion of the historical native Security scan.
Evidence for this phase is under `/tmp/agf-candidate-gates-20260930`.

### Wallet findings and corrections

The production-browser exercise found three concrete consumer defects:

1. **A pending flow retained its old signing context.** An approval could finish after the account
   changed and allow the old SDK flow to request a subsequent deposit. SDK writes now check a host
   signing-context guard immediately before each wallet request, including approvals and the
   no-simulation path. Account, actual connected chain, release or signing-client changes revoke
   the captured context. The existing per-operation guard remains in place. Pre-request rejection
   records `WALLET_CONTEXT_CHANGED` with `transactionSubmitted: false`; an already submitted
   transaction continues to be tracked. A wallet prompt already issued cannot be recalled.
2. **Post-receipt Bank reads reused a cached block height.** The browser saw a successful on-chain
   request for 40 shares but retained a pre-request zero-queue snapshot, disabling cancellation.
   Live `getSnapshot` and `getPosition` now bypass the block-number cache. Explicit historical
   block selection is unchanged, and each snapshot's reads remain pinned to one selected block.
3. **An unsupported wallet network was mistaken for the configured chain.** Wagmi's configured
   `useChainId()` remained 84532 while the connected wallet reported 8453. The SDK gate, release
   wrapper and wallet-header correction action now use `useAccount().chainId`. Browsing the chosen
   release remains possible while writes are disabled for a mismatched wallet.

New assertions failed on the pre-fix behavior and passed after correction. The original SDK and
Provider source identities match the preceding remediation manifest; reconstructed controls were
kept outside the repository. See `wallet/source-identities.json` and the separate red/green logs.
One old-Provider control fails because the new guard method is absent; that interface-shape failure
is not counted as stale-write evidence. The three SDK false-success controls, unsupported-chain
readiness controls, cached-height 42-versus-43 control and missing-header-correction control supply
the behavioral evidence.
The signing-context switch-away/back assertions cover contexts observed by React; they do not claim
coverage of arbitrary raw provider events coalesced before an application update.

The final production standalone build passed the local wallet scenario, then passed again after
resetting only its owned Anvil fixture with unchanged test/product input hashes. It interrupted an
approval response with account changes and with an unsupported chain, asserted no stale deposit,
used the actual header network-correction action, then deposited 100 LOCAL, requested/cancelled
40 shares, re-requested, activated, reloaded and claimed 40 LOCAL. Final on-chain values were
**940 LOCAL in the wallet, 60 shares and zero `exitPayable`**. The approval may already have mined;
the assertion is that no stale follow-up deposit was sent. Evidence:
`wallet/agf-wallet-final-production-e2e.log` and `wallet/final-gate-inputs.json`.

The primary reviewer also inspected the rendered Chinese LOCAL Earn page in the in-app browser,
checked the reserve/withdrawal controls without connecting a wallet, captured a nonblank screenshot,
and observed no browser warnings or errors. This manual read-only check is supplementary; the
automated fixture supplies the transaction and cash assertions. Owned fixture processes were stopped
and the actual embedded-release source was restored before the default production build.

An independent agent reviewed the signing guard, cache correction and actual-wallet-chain fix.
Primary-agent final runs passed **227 SDK unit tests**, **682 Web tests**, all workspace lint and
type checks, plus **5 actual Bank/SDK Anvil integrations**. The latter used the canonical Bank/mocks
built before mutation began, with artifact hashes recorded in `sdk-integration-artifacts.json`;
mutant build output is isolated. The five default-skipped Anvil cases are not counted as unit passes.
The workspace run also passed **206 keeper**, **89 bet-index** (including the 21 PostgreSQL cases
on an owned temporary database), and **23 UI** tests. Storybook built successfully.

### Production and full mutation gate evidence

The default production build, all **11 route bundle budgets**, and **30 production browser tests**
passed separately from the configured local-wallet fixture. The 30 tests include 10 route/wallet
smoke cases, 10 accessibility cases (nine routes plus the first-visit gate), and 10 mobile wallet
handoff cases. Route accessibility checks now require
the actual main heading and absence of first-visit/error overlays before axe; the first-visit gate
has its own independent accessibility case. Read-only routes with no embedded release do not prove
configured casino-room or wallet behavior. The production build ID was
`Nbxnqt4pnCun5jDdXq0H0`; `production-artifact.json` records its build/manifest and embedded-source
hashes, verified unchanged through budget and browser execution. Primary-agent manual inspection
also confirmed the nonblank Chinese homepage and functioning wallet selector with no warning/error
logs. The owned standalone server was stopped afterward. Logs: `production-build.log`,
`bundle-budget.log`, `production-e2e.log` and `storybook.log`.

The full run completed with **51/51 mutants killed, zero survivors and zero execution errors**.
Its unmodified baseline passed **226 tests across all 13 requested paths**. The runner records
script inputs as well as contracts/tests, isolates artifacts,
uses a fixed fuzz seed, and restores source bytes. Setup/compiler/tool failures are errors rather
than kills, with four classification regressions. M20's old storage-field mutation was a no-op after
the recovery view became derived; it now changes the live view-based decision for the same later-exit
guarantee; four direct later-exit tests caught it. All 104 recorded mutation inputs were restored
byte-for-byte. The primary reviewer independently reclassified every log and checked each current
input hash. The run took 3,887 seconds including its initial baseline; the fixed seed was `0x160035`.
Evidence: `mutations/baseline-path-verification.json`, `mutations/M01.log` through `M51.log`, and
`mutations/summary.json` (SHA-256
`b8616caa235ca644d872361c87d886bb4ada05431b54d5aea17b859b695f0872`).
These are authored behavioral mutants, not a count of independently exploitable vulnerabilities.
In particular, removing M44's explicit combined-cost guard can still revert on checked subtraction
later: both actual failures compare panic `0x11` with the expected `ReservedTooSmall`. Its
guard/error-contract test does not demonstrate that the mutation permits loss.

### Final local disposition

All local candidate gates described in this continuation passed. The 752 frontend input hashes,
production build identity and canonical SDK Bank/mock artifacts were independently rechecked without
drift. `candidate-inputs.json` records 1,012 current source/config/test inputs, excluding only these
two evolving audit documents; its SHA-256 is
`1265fe03a1e3cfdeaa25727870513a0ad204937de2f280dc3463662397e9c79e`.
`candidate-verification.json` records the primary reviewer's final checks. Bank's unchanged hash is
`df80c4cbbb43d8d607850a53e3a4904d369245a3c6087670752ba348fe0d8e82`.

After the gates, one declaration-only correction changed `deps.lock` from Solc 0.8.20 to 0.8.24:
`foundry.toml` and the actual compiler/artifacts were already 0.8.24. The receipt records both old
and final hashes; this is the sole difference from the restored 104-input mutation manifest. No
compiler configuration or bytecode was changed. The gate input is not retroactively relabelled.
`dependency-content-identity.json` also matches all 26 canonical Bank/mock metadata source hashes
to current files and records 1,392 installed-library Solidity file hashes. This binds local content,
not independent upstream tag authenticity. An optional dependency-directory Git probe resolved the
parent repository and is explicitly not used as dependency-version evidence.

The source remains uncommitted on `codex/review-remediation` at base HEAD
`cfbe1184b1e4d4162d3d11d36867798344be95af`. Freeze the complete reviewed commit before generating
the source audit bundle or requesting external-auditor acceptance. Target-network deployment,
real-wallet/Safe operation, keeper-with-PostgreSQL end-to-end acceptance, and external audit remain
outside this local evidence. No push, deployment or production-data operation occurred.

### Committed candidate and freeze — 2026-09-30

Following the Owner's explicit commit instruction, the complete implementation was committed as
`0120367068a0b0d0921255a47010c4d55b76dbc5`, tree
`d5f1807fad7bdb089a208e818255eff757e70a1a`, on `codex/review-remediation`.
All 1,012 gate inputs and both reports were rechecked immediately before staging. The normal commit
hook formatted only the ABI index's trailing comma and function layout. The original hook snapshot
matches the recorded gate hash; formatting it with repository Prettier reproduces the committed
bytes exactly, and all 19 actual ABI exports load. Every other gate input is unchanged.
`committed-candidate-verification.json` records this binding without rewriting the gate manifest.

The renewed [audit scope](v1.6-audit-scope.md) identifies all implementation subtrees and remaining
acceptance. Later freeze-document commits leave these implementation inputs unchanged. The source
bundle identifies its own complete commit/tree, while raw gate logs and receipts remain separate
evidence. Earlier uncommitted observations above retain their original time and scope. This local
source freeze is not external-auditor acceptance, a production release or native scan completion.
