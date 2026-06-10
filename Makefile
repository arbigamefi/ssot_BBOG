# Default profile for tests is `pr` to keep CI fast.
# Deploy/verify should use the `default` compilation profile unless overridden.
FOUNDRY_PROFILE ?= pr
DEPLOY_PROFILE ?= default
VERIFY_PROFILE ?= default
FRONTEND_DIR ?= frontend
PYTHON ?= python

.PHONY: deps check-deps check test pr nightly fork deploy deploy-v14 casino-seed-bank-v14 casino-add-pool-v13 casino-add-pool-apply-v13 casino-add-pool-verify-v13 keno-upgrade-v13 keno-upgrade-apply-v13 verify verify-v14 verify-v13 verify-helpers verify-helpers-v14 verify-helpers-v13 sports-dry-run-v13 sports-lifecycle-dry-run sports-phase0-readiness sports-testnet-preflight-v13 sports-mainnet-preflight-v13 casino-mainnet-preflight-v13 casino-mainnet-gonogo-v13 sports-roles-v13 sports-canary-v13 sports-football-canary-v13 sports-provider-evidence-v13 sports-provider-odds-v13 sports-provider-e2e-v13 sports-provider-policy-check-v13 sports-frontend-access-check-v13 casino-frontend-access-check-v13 casino-web-env-check-v13 casino-mainnet-frontend-readiness-v13 casino-bank-decimals-check-v14 bank-live-shape-smoke-v14 gamehub-canary-v13 sports-phase1-closeout-v13 sports-phase2-gonogo-v13 sports-bankroll-caps-check-v13 sports-role-custody-check-v13 sports-ops-coverage-check-v13 release release-v14 release-v13 release-digest release-digest-v14 release-digest-v13 release-verify release-verify-v14 release-verify-v13 release-check release-check-v14 release-check-v13 release-notes release-notes-v14 release-notes-v13 release-package release-package-v14 release-package-v13 release-artifacts-tracked-v13 audit-package lint release-frontend-manifest release-frontend-manifest-v14 release-frontend-manifest-v13 release-golden-vectors release-golden-vectors-v14 release-golden-vectors-v13 release-abis release-abis-v14 release-abis-v13 frontend-install frontend-dev frontend-build frontend-lint frontend-typecheck frontend-test frontend-test-strict frontend-storybook frontend-storybook-build frontend-release-check frontend-check

deps:
	bash script/ci/install_deps.sh

check-deps:
	bash script/ci/check_deps.sh

.PHONY: bank-abi-drift-check
bank-abi-drift-check:
	$(PYTHON) script/ci/check_bank_abi_drift.py

bank-live-shape-smoke-v14:
	$(PYTHON) script/ci/v14_bank_live_shape_smoke.py

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
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge test -vvv

pr:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --match-path "test/unit/*" -vvv
	FOUNDRY_PROFILE=pr forge test --match-path "test/diff/*" -vvv
	FOUNDRY_PROFILE=pr forge test --match-path "test/invariants/*" -vvv
	FOUNDRY_PROFILE=pr forge test --match-path "test/fork/*" -vvv

nightly:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=nightly forge test --match-path "test/unit/*" -vvv
	FOUNDRY_PROFILE=nightly forge test --match-path "test/diff/*" -vvv
	FOUNDRY_PROFILE=nightly forge test --match-path "test/invariants/*" -vvv
	FOUNDRY_PROFILE=nightly forge test --match-path "test/fork/*" -vvv

fork:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge test --match-path "test/fork/*" -vvv

deploy: deploy-v14

deploy-v14:
	@$(MAKE) check-deps
	# Fresh deployments must not reuse stale broadcaster nonce/address state.
	CLEAN_BROADCAST=1 bash script/ci/clean_foundry.sh
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/DeployV14.s.sol:DeployV14 --rpc-url $$RPC_URL --broadcast -vvv

casino-seed-bank-v14:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/ops/SeedCasinoBankV14.s.sol:SeedCasinoBankV14 --rpc-url $$RPC_URL --broadcast -vvv

casino-add-pool-v13:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/ops/AddCasinoPoolV13.s.sol:AddCasinoPoolV13 --rpc-url $$RPC_URL --broadcast -vvv

casino-add-pool-apply-v13:
	$(PYTHON) script/release/apply_pool_add_v13.py

casino-add-pool-verify-v13:
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) bash deployments/verify-pool-add-latest-v13.sh

keno-upgrade-v13:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/ops/KenoModuleUpgradeV13.s.sol:KenoModuleUpgradeV13 --rpc-url $$RPC_URL --broadcast -vvv

keno-upgrade-apply-v13:
	$(PYTHON) script/release/apply_keno_upgrade_v13.py

verify: verify-v14

verify-v14:
	@$(MAKE) check-deps
	@$(MAKE) verify-helpers-v14
	# Verification can be sensitive to stale build artifacts across Foundry versions.
	# Preserve broadcast traces but recompile from scratch.
	CLEAN_BROADCAST=0 bash script/ci/clean_foundry.sh
	# Precompile contract artifacts only. Full builds pull in legacy scripts/tests
	# and are unnecessary for source verification helpers.
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build src
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) bash deployments/verify-latest-v14.sh

verify-v13:
	@$(MAKE) check-deps
	bash script/ci/v13_release_source_guard.sh
	@$(MAKE) verify-helpers-v13
	# Verification can be sensitive to stale build artifacts across Foundry versions.
	# Preserve broadcast traces but recompile from scratch.
	CLEAN_BROADCAST=0 bash script/ci/clean_foundry.sh
	# Precompile once to populate Foundry compiler caches (reduces noisy cache warnings).
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build > /dev/null
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) bash deployments/verify-latest-v13.sh

# Regenerate verify helper scripts from an existing deployments/latest-v13.json.
# Useful when you deployed with an older helper, or after upgrading Foundry/Etherscan endpoints.

lint:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge lint

verify-helpers: verify-helpers-v14

verify-helpers-v14:
	@if [ ! -f deployments/latest-v14.json ]; then \
		echo "deployments/latest-v14.json not found; skipping verify helper regeneration"; \
		exit 0; \
	fi
	$(PYTHON) script/tools/gen_verify_helpers.py deployments/latest-v14.json

verify-helpers-v13:
	@bash script/ci/v13_release_source_guard.sh
	@if [ ! -f deployments/latest-v13.json ]; then \
		echo "deployments/latest-v13.json not found; skipping verify helper regeneration"; \
		exit 0; \
	fi
	$(PYTHON) script/tools/gen_verify_helpers.py deployments/latest-v13.json

sports-dry-run-v13:
	bash script/ci/v13_sports_dry_run.sh

sports-lifecycle-dry-run:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --match-path test/unit/SportsHubLifecycle.t.sol -vv

sports-phase0-readiness:
	@$(MAKE) sports-dry-run-v13
	@$(MAKE) sports-lifecycle-dry-run

sports-testnet-preflight-v13:
	bash script/ci/v13_sports_testnet_preflight.sh $(ENV_FILE)

sports-mainnet-preflight-v13:
	V13_SPORTS_PREFLIGHT_TARGET=mainnet bash script/ci/v13_sports_testnet_preflight.sh $(ENV_FILE)

casino-mainnet-preflight-v13:
	V13_SPORTS_PREFLIGHT_TARGET=mainnet V13_REQUIRE_SPORTS_POOL=false bash script/ci/v13_sports_testnet_preflight.sh $(ENV_FILE)

casino-mainnet-gonogo-v13:
	bash script/ci/v13_casino_mainnet_gonogo.sh

sports-roles-v13:
	bash script/ci/v13_sports_roles.sh $(ENV_FILE)

sports-canary-v13:
	bash script/ci/v13_sports_canary.sh $(ENV_FILE)

sports-football-canary-v13:
	bash script/ci/v13_worldcup_football_canary.sh $(ENV_FILE)

sports-provider-evidence-v13:
	bash script/ci/v13_sports_provider_evidence_check.sh

sports-provider-odds-v13:
	bash script/ci/v13_sports_provider_odds_check.sh

sports-provider-e2e-v13:
	bash script/ci/v13_sports_provider_e2e_check.sh $(ENV_FILE)

sports-provider-policy-check-v13:
	bash script/ci/v13_sports_provider_policy_check.sh $(PROVIDER_POLICY_FILE)

sports-frontend-access-check-v13:
	bash script/ci/v13_sports_frontend_access_check.sh $(FRONTEND_ACCESS_FILE)

casino-frontend-access-check-v13:
	bash script/ci/v13_casino_frontend_access_check.sh $(FRONTEND_ACCESS_FILE)

casino-web-env-check-v13:
	bash script/ci/v13_casino_web_env_check.sh $(ENV_FILE)

casino-mainnet-frontend-readiness-v13:
	bash script/ci/v13_casino_mainnet_frontend_readiness.sh $(ENV_FILE)

casino-bank-decimals-check-v14:
	bash script/ci/v14_bank_decimals_check.sh $(SNAPSHOT_PATH)

gamehub-canary-v13:
	bash script/ci/v13_gamehub_canary.sh $(ENV_FILE)

sports-phase1-closeout-v13:
	bash script/ci/v13_sports_phase1_closeout.sh $(ENV_FILE)

sports-phase2-gonogo-v13:
	bash script/ci/v13_phase2_gonogo.sh $(PHASE2_PACKET)

sports-bankroll-caps-check-v13:
	bash script/ci/v13_sports_bankroll_caps_check.sh $(BANKROLL_CAPS_FILE)

sports-role-custody-check-v13:
	bash script/ci/v13_sports_role_custody_check.sh $(ROLE_CUSTODY_FILE)

sports-ops-coverage-check-v13:
	bash script/ci/v13_sports_ops_coverage_check.sh $(OPS_COVERAGE_FILE)

# --- Release artifacts (digest + signature) ---
# 1) After a successful deploy that produced deployments/latest-v13.json:
#      make release-digest
# 2) Verify locally:
#      make release-verify
# 3) In CI for tag/release builds, enforce presence:
#      STRICT=1 make release-check


# Full release workflow (digest + notes + frontend artifacts + verify + package).
# Current source is V14. Keep V13 targets explicit and guarded so V14 Bank
# bytecode/ABI cannot be published under V13 artifact names.
release: release-v14
release-v14: release-digest-v14 release-notes-v14 release-frontend-manifest-v14 release-golden-vectors-v14 release-abis-v14 release-verify-v14 release-package-v14
release-v13: release-digest-v13 release-notes-v13 release-frontend-manifest-v13 release-golden-vectors-v13 release-abis-v13 release-verify-v13 release-package-v13

release-digest: release-digest-v14

release-digest-v14:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/ReleaseDigestV14.s.sol:ReleaseDigestV14 -vvv

release-digest-v13:
	@$(MAKE) check-deps
	bash script/ci/v13_release_source_guard.sh
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/ReleaseDigestV13.s.sol:ReleaseDigestV13 -vvv

release-verify: release-verify-v14

release-verify-v14:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/VerifyReleaseV14.s.sol:VerifyReleaseV14 -vvv

release-verify-v13:
	@$(MAKE) check-deps
	bash script/ci/v13_release_source_guard.sh
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/VerifyReleaseV13.s.sol:VerifyReleaseV13 -vvv

release-check: release-check-v14

release-check-v14:
	@$(MAKE) check-deps
	PYTHON="$(PYTHON)" \
	RELEASE_PATH=deployments/release-latest-v14.json \
	SNAPSHOT_PATH=deployments/latest-v14.json \
	NOTES_PATH=deployments/release-notes-latest-v14.md \
	FRONTEND_MANIFEST_PATH=deployments/frontend-manifest-latest-v14.json \
	GOLDEN_VECTORS_PATH=deployments/golden-vectors-latest-v14.json \
	ABI_INDEX_PATH=deployments/abis-v14/index.json \
	RELEASE_TAG_SUFFIX=-v14 \
	VERIFY_SCRIPT=script/release/VerifyReleaseV14.s.sol:VerifyReleaseV14 \
	bash script/release/check_release.sh
	$(PYTHON) script/ci/v14_bank_live_shape_smoke.py

release-check-v13:
	@$(MAKE) check-deps
	bash script/ci/v13_release_source_guard.sh
	PYTHON="$(PYTHON)" bash script/release/check_release.sh

release-artifacts-tracked-v13:
	bash script/ci/v13_release_source_guard.sh
	bash script/ci/v13_release_artifacts_tracked_check.sh

# Generate human-friendly release notes that include the release digest.
release-notes: release-notes-v14

release-notes-v14:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/GenerateReleaseNotesV14.s.sol:GenerateReleaseNotesV14 -vvv

release-notes-v13:
	@$(MAKE) check-deps
	bash script/ci/v13_release_source_guard.sh
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/GenerateReleaseNotesV13.s.sol:GenerateReleaseNotesV13 -vvv

# Create a distributable archive containing the snapshot + release lock + notes (+ verify helper if present).

# Generate a frontend-ready manifest that requires zero inference from the UI.
release-frontend-manifest: release-frontend-manifest-v14

release-frontend-manifest-v14:
	FOUNDRY_PROFILE=default forge script script/release/GenerateFrontendManifestV14.s.sol:GenerateFrontendManifestV14 -vvv

release-frontend-manifest-v13:
	bash script/ci/v13_release_source_guard.sh
	FOUNDRY_PROFILE=default forge script script/release/GenerateFrontendManifestV13.s.sol:GenerateFrontendManifestV13 -vvv

# Generate golden (exact-hex) vectors for frontend encoding tests.
release-golden-vectors: release-golden-vectors-v14

release-golden-vectors-v14:
	FOUNDRY_PROFILE=default forge script script/release/GenerateGoldenVectorsV14.s.sol:GenerateGoldenVectorsV14 -vvv

release-golden-vectors-v13:
	bash script/ci/v13_release_source_guard.sh
	FOUNDRY_PROFILE=default forge script script/release/GenerateGoldenVectorsV13.s.sol:GenerateGoldenVectorsV13 -vvv

release-abis: release-abis-v14

release-abis-v14:
	@$(MAKE) check-deps
	# ABIs are derived from contract artifacts only. Building all scripts/tests can
	# pull in legacy release surfaces and is unnecessary for frontend ABI export.
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build src
	$(PYTHON) script/release/export_frontend_abis.py --manifest deployments/frontend-manifest-latest-v14.json --dest deployments/abis-v14 --tag-suffix=-v14

release-abis-v13:
	@$(MAKE) check-deps
	bash script/ci/v13_release_source_guard.sh
	# ABIs are derived from Foundry artifacts; build once to ensure out/ exists.
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build > /dev/null
	$(PYTHON) script/release/export_frontend_abis.py

release-package: release-package-v14

release-package-v14:
	PYTHON="$(PYTHON)" \
	RELEASE_PATH=deployments/release-latest-v14.json \
	SNAPSHOT_PATH=deployments/latest-v14.json \
	NOTES_PATH=deployments/release-notes-latest-v14.md \
	FRONTEND_MANIFEST_PATH=deployments/frontend-manifest-latest-v14.json \
	GOLDEN_VECTORS_PATH=deployments/golden-vectors-latest-v14.json \
	ABIS_DIR=deployments/abis-v14 \
	ABIS_INDEX_PATH=deployments/abis-v14/index.json \
	RELEASE_TAG_SUFFIX=-v14 \
	SNAPSHOT_LATEST_NAME=latest-v14.json \
	RELEASE_LATEST_NAME=release-latest-v14.json \
	NOTES_LATEST_NAME=release-notes-latest-v14.md \
	FRONTEND_MANIFEST_LATEST_NAME=frontend-manifest-latest-v14.json \
	GOLDEN_VECTORS_LATEST_NAME=golden-vectors-latest-v14.json \
	bash script/release/package_release.sh

release-package-v13:
	bash script/ci/v13_release_source_guard.sh
	PYTHON="$(PYTHON)" bash script/release/package_release.sh

# Create an "audit handoff" bundle: code + docs + pinned deps metadata + release artifacts + verify helpers.
# The output is placed under dist/ as a .tar.gz.
audit-package:
	bash script/release/package_audit.sh
