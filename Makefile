# Default profile for tests is `pr` to keep CI fast.
# Deploy/verify should use the `default` compilation profile unless overridden.
FOUNDRY_PROFILE ?= pr
DEPLOY_PROFILE ?= default
VERIFY_PROFILE ?= default
FRONTEND_DIR ?= frontend
PYTHON ?= python

.PHONY: deps check-deps check test pr nightly fork deploy verify verify-helpers release release-digest release-verify release-check release-notes release-frontend-manifest release-golden-vectors release-abis release-package audit-package frontend-check

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
	pnpm -C $(FRONTEND_DIR) test:strict

frontend-storybook:
	pnpm -C $(FRONTEND_DIR) storybook

frontend-storybook-build:
	pnpm -C $(FRONTEND_DIR) storybook:build

frontend-release-check:
	pnpm -C $(FRONTEND_DIR) check:release

frontend-check:
	pnpm -C $(FRONTEND_DIR) lint
	pnpm -C $(FRONTEND_DIR) typecheck
	pnpm -C $(FRONTEND_DIR) test:strict
	pnpm -C $(FRONTEND_DIR) build

# Default test entrypoint. Uses FOUNDRY_PROFILE (default: pr).
# Example: FOUNDRY_PROFILE=nightly make test

test:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge test --threads 1 -vvv

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

deploy: deploy-v15

deploy-v15:
	@$(MAKE) check-deps
	# Retain broadcast traces; a failed broadcast must be inspected and resumed, not erased.
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/DeployV15.s.sol:DeployV15 --rpc-url "$$RPC_URL" --account "$${DEPLOY_ACCOUNT:?Set the approved Foundry keystore account}" --broadcast --slow -vvv

verify: verify-v15
verify-helpers: verify-helpers-v15
verify-v15:
	@$(MAKE) check-deps
	@$(MAKE) verify-helpers-v15
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build src
	bash deployments/verify-latest-v15.sh

verify-helpers-v15:
	@test -n "$$SNAPSHOT_PATH" || { echo "Set SNAPSHOT_PATH to the chain-specific v1.5 snapshot"; exit 1; }
	$(PYTHON) script/tools/gen_verify_helpers.py "$$SNAPSHOT_PATH"

sports-dry-run-v15:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --threads 1 --match-path test/unit/DeploymentV15.t.sol --match-test testSports -vv

sports-lifecycle-dry-run:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --match-path test/unit/SportsHubLifecycle.t.sol -vv

sports-phase0-readiness:
	@$(MAKE) sports-dry-run-v15
	@$(MAKE) sports-lifecycle-dry-run

# --- Release artifacts (digest + signature) ---
# 1) After a successful deploy that produced deployments/latest-v15.json:
#      make release-digest
# 2) Verify locally:
#      make release-verify
# 3) In CI for tag/release builds, enforce presence:
#      STRICT=1 make release-check


# The only supported deployment/release line.
.PHONY: deploy-v15 deploy-dryrun verify-v15 verify-helpers-v15 sports-dry-run-v15 release-v15 release-governance-check safe-acceptance-v15

deploy-dryrun:
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/DeployV15.s.sol:DeployV15 --rpc-url "$$RPC_URL" -vvv

safe-acceptance-v15:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/PrepareSafeAcceptanceV15.s.sol:PrepareSafeAcceptanceV15 --rpc-url "$$RPC_URL" -vvv

release-governance-check:
	@test -n "$$SNAPSHOT_PATH" -a -n "$$RPC_URL" || { echo "Set chain-specific SNAPSHOT_PATH and RPC_URL"; exit 1; }
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/VerifyGovernanceV15.s.sol:VerifyGovernanceV15 --rpc-url "$$RPC_URL" -vvv

release: release-v15
release-v15:
	@$(MAKE) release-governance-check
	@$(MAKE) release-digest
	@$(MAKE) release-notes
	@$(MAKE) release-frontend-manifest
	@$(MAKE) release-golden-vectors
	@$(MAKE) release-abis
	@$(MAKE) release-verify
	@$(MAKE) release-package

release-digest:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/ReleaseDigestV15.s.sol:ReleaseDigestV15 --account "$${RELEASE_ACCOUNT:?Set the approved release signer keystore account}" -vvv

release-verify:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/VerifyReleaseV15.s.sol:VerifyReleaseV15 -vvv

release-check:
	PYTHON="$(PYTHON)" bash script/release/check_release.sh

release-notes:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/GenerateReleaseNotesV15.s.sol:GenerateReleaseNotesV15 -vvv

release-frontend-manifest:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/GenerateFrontendManifestV15.s.sol:GenerateFrontendManifestV15 -vvv

release-golden-vectors:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge script script/release/GenerateGoldenVectorsV15.s.sol:GenerateGoldenVectorsV15 -vvv

release-abis:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build src
	$(PYTHON) script/release/export_frontend_abis.py --manifest deployments/frontend-manifest-latest-v15.json --dest deployments/abis-v15 --tag-suffix=-v15

release-package:
	PYTHON="$(PYTHON)" bash script/release/package_release.sh

# Create an "audit handoff" bundle: code + docs + pinned deps metadata + release artifacts + verify helpers.
# The output is placed under dist/ as a .tar.gz.
audit-package:
	bash script/release/package_audit.sh
