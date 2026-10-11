# Default profile for tests is `pr` to keep CI fast.
# Deploy/verify should use the `default` compilation profile unless overridden.
FOUNDRY_PROFILE ?= pr
DEPLOY_PROFILE ?= default
VERIFY_PROFILE ?= default
FRONTEND_DIR ?= frontend
PYTHON ?= python

.PHONY: deps check-deps check test pr nightly fork deploy verify verify-helpers release release-verify release-check release-notes release-frontend-manifest release-golden-vectors release-abis release-package audit-package frontend-check

deps:
	bash script/ci/install_deps.sh

check-deps:
	bash script/ci/check_deps.sh

.PHONY: bank-abi-drift-check
bank-abi-drift-check:
	$(PYTHON) script/ci/check_bank_abi_drift.py

check: test frontend-check

# Frontend monorepo lives under frontend/ but is operated from the repo root.
frontend-install:
	pnpm -C $(FRONTEND_DIR) install

frontend-dev:
	pnpm -C $(FRONTEND_DIR) dev

frontend-build:
	pnpm -C $(FRONTEND_DIR) build

frontend-lint:
	pnpm -C $(FRONTEND_DIR) lint

frontend-typecheck:
	pnpm -C $(FRONTEND_DIR) typecheck

frontend-test:
	pnpm -C $(FRONTEND_DIR) test

frontend-test-strict:
	pnpm -C $(FRONTEND_DIR) test

frontend-storybook:
	pnpm -C $(FRONTEND_DIR) storybook

frontend-storybook-build:
	pnpm -C $(FRONTEND_DIR) storybook:build

frontend-release-check:
	pnpm -C $(FRONTEND_DIR) check:release

frontend-check:
	pnpm -C $(FRONTEND_DIR) lint
	pnpm -C $(FRONTEND_DIR) typecheck
	pnpm -C $(FRONTEND_DIR) test
	pnpm -C $(FRONTEND_DIR) build

# Default test entrypoint. Uses FOUNDRY_PROFILE (default: pr).
# Example: FOUNDRY_PROFILE=nightly make test

test:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge test --threads 1 -vvv

# Freeze gate for the tree equivalence and differential suites at 4,096 fuzz runs (ADR-0034 amendment
# 2026-10-07): RANGE_SUM, UNUSED_SUFFIX, the k > 0 settlement equivalence and the chained Vault differential.
TREE_EQUIVALENCE_SUITES = test/unit/{AzuroRangeSumEquivalence,AzuroUnusedSuffixEquivalence,AzuroTreeProperties,LiquidityVaultAllocation,LiquidityVaultChainedDifferential}.t.sol

.PHONY: tree-equivalence-release
tree-equivalence-release:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=release forge test --match-path "$(TREE_EQUIVALENCE_SUITES)" -vv

.PHONY: test-casino-admission
# Gates with transaction-level gas accounting run isolated (foundry.toml keeps isolate off). The toolchain test first
# pins how the Foundry release in deps.lock reports an isolated call.
test-casino-admission:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge test --isolate --match-path test/toolchain/IsolatedGasAccounting.t.sol -vv
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge test --isolate --match-path test/unit/GameHubE2E.t.sol --match-test admission -vv

pr:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --threads 1 --match-path "test/unit/*" -vvv
	FOUNDRY_PROFILE=pr forge test --match-path "test/diff/*" -vvv
	FOUNDRY_PROFILE=pr forge test --match-path "test/invariants/*" -vvv
	FOUNDRY_PROFILE=pr forge test --match-path "test/fork/*" -vvv

nightly:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=nightly forge test --threads 1 --match-path "test/unit/*" -vvv
	FOUNDRY_PROFILE=nightly forge test --match-path "test/diff/*" -vvv
	FOUNDRY_PROFILE=nightly forge test --match-path "test/invariants/*" -vvv
	FOUNDRY_PROFILE=nightly forge test --match-path "test/fork/*" -vvv

fork:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge test --match-path "test/fork/*" -vvv

deploy: deploy-v16

deploy-v16:
	@$(MAKE) check-deps
	# Retain broadcast traces; a failed broadcast must be inspected and resumed, not erased.
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/DeployV16.s.sol:DeployV16 --rpc-url "$$RPC_URL" --account "$${DEPLOY_ACCOUNT:?Set the approved Foundry keystore account}" --broadcast --slow -vvv
	$(PYTHON) script/tools/gen_verify_helpers.py deployments/latest-v16.json

verify: verify-v16
verify-helpers: verify-helpers-v16
verify-v16:
	@$(MAKE) check-deps
	@$(MAKE) verify-helpers-v16
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build src
	bash deployments/verify-latest-v16.sh

verify-helpers-v16:
	@test -n "$$SNAPSHOT_PATH" || { echo "Set SNAPSHOT_PATH to the chain-specific v1.6 snapshot"; exit 1; }
	$(PYTHON) script/tools/gen_verify_helpers.py "$$SNAPSHOT_PATH"

sports-dry-run-v16:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --threads 1 --match-path test/unit/DeploymentV16.t.sol --match-test testSports -vv

sports-lifecycle-dry-run:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --match-path test/unit/SportsHubLifecycle.t.sol -vv

sports-phase0-readiness:
	@$(MAKE) sports-dry-run-v16
	@$(MAKE) sports-lifecycle-dry-run

# --- Release artifacts (digest + signature) ---
# 1) After a successful deploy that produced deployments/latest-v16.json, sign and package it (the only signing path):
#      make release-v16    (script/release/release_v16.sh; its header lists the inputs)
# 2) Verify locally:
#      make release-verify
# 3) In CI for tag/release builds, enforce presence:
#      STRICT=1 make release-check


# The only supported deployment/release line.
.PHONY: deploy-v16 deploy-dryrun verify-v16 verify-helpers-v16 sports-dry-run-v16 release-v16 release-governance-check release-domain-check safe-acceptance-v16

deploy-dryrun:
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/DeployV16.s.sol:DeployV16 --rpc-url "$$RPC_URL" -vvv

safe-acceptance-v16:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/PrepareSafeAcceptanceV16.s.sol:PrepareSafeAcceptanceV16 --rpc-url "$$RPC_URL" -vvv

release-governance-check:
	@test -n "$$SNAPSHOT_PATH" -a -n "$$RPC_URL" || { echo "Set chain-specific SNAPSHOT_PATH and RPC_URL"; exit 1; }
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) $(PYTHON) script/release/verify_governance.py

release: release-v16
# Runs the targets below in order and signs in between, once: the keystore password must unlock RELEASE_SIGNER first,
# and a valid signature over the same snapshot is kept on a rerun.
release-v16:
	bash script/release/release_v16.sh

# Fails before anything is signed when the snapshot lies outside its chain's accepted first-callback domain:
# snapshot checks, the deployed core runtimes and wiring against the certified build (fork of RPC_URL), then the
# live token and VRF provider at one frozen block.
release-domain-check:
	@test -n "$$SNAPSHOT_PATH" -a -n "$$RPC_URL" || { echo "Set chain-specific SNAPSHOT_PATH and RPC_URL"; exit 1; }
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/VerifyCallbackDomainV16.s.sol:VerifyCallbackDomainV16 -vvv
	$(PYTHON) script/release/verify_callback_provider.py

release-verify:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/VerifyReleaseV16.s.sol:VerifyReleaseV16 -vvv
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/VerifyCallbackDomainV16.s.sol:VerifyCallbackDomainV16 -vvv

release-check:
	PYTHON="$(PYTHON)" bash script/release/check_release.sh

release-notes:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/GenerateReleaseNotesV16.s.sol:GenerateReleaseNotesV16 -vvv

release-frontend-manifest:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/GenerateFrontendManifestV16.s.sol:GenerateFrontendManifestV16 -vvv

release-golden-vectors:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/GenerateGoldenVectorsV16.s.sol:GenerateGoldenVectorsV16 -vvv

release-abis:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build src
	$(PYTHON) script/release/export_frontend_abis.py --manifest deployments/frontend-manifest-latest-v16.json --dest deployments/abis-v16

release-package:
	PYTHON="$(PYTHON)" bash script/release/package_release.sh

# Create a complete source audit bundle from a clean commit, before deployment.
# The output is placed under dist/ as a .tar.gz.
audit-package:
	bash script/release/package_audit.sh
