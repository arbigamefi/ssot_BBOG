# Runbook: Tests, Proof Gates, and Repro

Tests provide evidence for the exact code, configuration and scenarios exercised; a green suite is
not a blanket security claim.

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** The
[LP and callback implementation plan](design/lp-accounting-and-callback-implementation.md) owns the
new invariants, test replacement/deletion mapping and execution order. Existing queue/recovery or
adapter results do not validate NFT deposits/tree withdrawals or the direct wrapper callback. The commands
below are entrypoints, not a claim that the new tests have been written or run.

## Dependencies (pinned)

This repo pins its Foundry dependencies via `script/ci/install_deps.sh`: each library is installed at the commit
recorded in `deps.lock` (the tag there is for humans), and the install is refused unless the compiled subtree has
the recorded content digest (`*_SUBTREE`, `*_SHA256`; the digest command is in the `deps.lock` comment).

```bash
bash script/ci/install_deps.sh
```

## Compiler identity

All first-party Solidity under `src/`, `script/` and `test/` uses exact `pragma solidity 0.8.37;`.
`foundry.toml` and `deps.lock` select Solidity 0.8.37, Cancun, viaIR and optimizer 500; PR, nightly
and release profiles only vary test coverage. The pragma pin rejects a different compiler selected
by a local `--use` or compiler environment override. It does not freeze optimizer or EVM overrides;
record the effective settings for a release run.

`lib/` and `src/vendor/` retain upstream source, including their original version ranges. Only
transitive dependency sources imported by this project are part of its compilation; compiling every
upstream example or upstream test is not a repository release requirement. Verify the Azuro source
manifest unchanged and check the resulting compiler metadata, not just the pragma text.

For a fresh full project compilation, after checking local overrides:

```bash
FOUNDRY_PROFILE=default forge build --force --sizes
```

This rebuilds project contracts, scripts and tests with their imported dependencies. It neither runs
tests nor broadcasts transactions. Source/pragma edits change metadata and deployed-code identities,
including creation code embedded in factories, even when the compiler and business logic are unchanged.
Regenerate deployment snapshots, verification input and signed release artifacts from the new build;
never use a prior source manifest as proof of the changed tree. The normal verification helper selects
the `default` compilation profile and reads compiler settings from this checkout.

## Local quick run

```bash
make deps
make test
```

## Suite breakdown

- **Unit tests:** `test/unit/*`
- **Differential tests:** `test/diff/*`
  - `Diff*.t.sol`: module boundary reference diffs
  - `StatefulSystemDiff.t.sol`: one router-backed accounting and native refund-credit reference
    model using the direct wrapper consumer. There is no adapter-mode fixture.
  - NFT authority, solvency, pending principal, payment and rounding witnesses use the current
    economic expectations. Detailed replacement mapping is in the implementation plan.
- **Invariant suite:** `test/invariants/*`
  - `SettlementRouterInvariants.t.sol`: router authority, owner-hub terminality, and pool reserve isolation
  - `SportsHubInvariants.t.sol`: sports exposure, router position matching, and debt-out liveness
- **Fork tests (optional):** `test/fork/*`
  - Auto-skip when `FORK_RPC_URL` is not set
  - `NftDirectWrapperFork.t.sol` exercises the direct consumer, real wrapper/USDC and same-seed retry.
    `NftCallbackGasQualificationFork.t.sol` is the separately configured gas matrix. A request-only
    test does not prove callback gas or pre-inclusion ordering protection.

Run individually:

```bash
forge test --match-path "test/unit/*" -vvv
forge test --match-path "test/diff/*" -vvv
forge test --match-path "test/invariants/*" -vvv
forge test --match-path "test/fork/*" -vvv
```

## PR vs Nightly profiles

Foundry profiles are defined in `foundry.toml`:

- `FOUNDRY_PROFILE=pr` : faster PR gate
- `FOUNDRY_PROFILE=nightly` : higher coverage

Examples:

```bash
FOUNDRY_PROFILE=pr forge test --match-path "test/invariants/*" -vvv
FOUNDRY_PROFILE=nightly forge test --match-path "test/diff/*" -vvv
```

## Fork test usage

Fork tests are designed to be safe for local development: they skip when no RPC URL is provided.

Environment variables:

- `FORK_RPC_URL` (required)
- `FORK_VRF_WRAPPER` (required)
- `FORK_BLOCK_NUMBER` (optional)
- `FORK_EXPECT_CHAIN_ID` (optional)

Example (use the selected candidate's verified chain and wrapper):

```bash
export FORK_RPC_URL=...
export FORK_VRF_WRAPPER=...
export FORK_EXPECT_CHAIN_ID=...

forge test --match-path "test/fork/*" -vvv
```

## Re-running a failing fuzz case

Foundry prints a seed/counterexample. To re-run the most recent failing test:

```bash
forge test --rerun -vvv
```

For a single current test, use its path reported by the failure:

```bash
forge test --match-path '<current-test-file>' --rerun -vvv
```

Do not retain a second adapter or synthetic non-wrapper production path to keep an obsolete test
fixture passing.

## Local integration evidence

The implementation plan requires Bank/Vault conservation, new NFT creation, fixed 24-hour locks, partial-success relocks, transfer deadlines, percentage rounding, K=0 all-exit, empty-root profits, old-prefix/whole-tree allocation and original-seed retry. Stage 0 must measure the 40-level tree and full callback/failure paths before accepting a round limit; prior 100-round tests do not establish it. Run direct-wrapper success and failure paths through SDK, keeper and the durable index;
same-transaction terminal events, subscription disorder and HTTP replay must converge without a
duplicate payment. Reuse the existing WS, queue, PostgreSQL, receipt and browser test infrastructure. Cash-ledger tests distinguish NFT Transfer from paid-in assets and preserve owner-at-event attribution; do not infer a recipient's acquisition cost.

The real database suite requires `KEEPER_TEST_POSTGRES_URL`; the NFT SDK Anvil suite requires
`BANK_ANVIL_RPC`. The following scripts create and clean up their own loopback test instances:

```bash
bash script/ci/bank_sdk_integration.sh
bash script/ci/keeper_integration.sh
bash script/ci/bank_wallet_e2e.sh
```

Use their separate default ports when running in parallel. The wallet runner temporarily writes its
own embedded fixture and restores the original bytes; do not edit that file during the run.
The SDK path is `liquidityVault.anvil.test.ts`; keeper integration also uses disposable PostgreSQL.
A package command without these environment variables skips external-process tests and is not
database/Anvil acceptance. Release evidence lists actual runs and skipped tests separately.
Normal callback settlement sends
no keeper finalize transaction; exceptional retry and eligible timeout refunds are covered separately.
Pre-fulfillment ordering and complete gas admission remain external-LP gates.

## Linting (optional)

This repo disables automatic lint-on-build to keep deploy/verify logs clean.
If you want to run Foundry lints explicitly:

```bash
make lint
```
