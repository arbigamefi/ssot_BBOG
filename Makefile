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

casino-seed-bank-v14:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/ops/SeedCasinoBankV14.s.sol:SeedCasinoBankV14 --rpc-url $$RPC_URL --broadcast -vvv

# Dry run first (no --broadcast); SNAPSHOT_PATH must name the target chain's
# snapshot, since deployments/latest-v14.json points at Base Sepolia.
casino-set-min-turnover-dryrun-v14:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/ops/SetBankMinTurnoverV14.s.sol:SetBankMinTurnoverV14 --rpc-url $$RPC_URL -vvv

casino-set-min-turnover-v14:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/ops/SetBankMinTurnoverV14.s.sol:SetBankMinTurnoverV14 --rpc-url $$RPC_URL --broadcast -vvv

casino-add-pool-v13:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/ops/AddCasinoPoolV13.s.sol:AddCasinoPoolV13 --rpc-url $$RPC_URL --broadcast -vvv

casino-add-pool-apply-v13:
	$(PYTHON) script/release/apply_pool_add_v13.py

verify: verify-v15
verify-helpers: verify-helpers-v15
verify-v15:
	@$(MAKE) check-deps
	@$(MAKE) verify-helpers-v15
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build src
	bash deployments/verify-latest-v15.sh

casino-add-pool-verify-helpers: verify-helpers-v15
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


# The only fresh deployment/release line. Historical artifacts stay read-only until retirement.
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

# Old release aliases fail explicitly, including callers copied from historical runbooks.
.PHONY: deploy-v13 deploy-v14 release-v13 release-v14 verify-v13 verify-v14
deploy-v13 deploy-v14 release-v13 release-v14 verify-v13 verify-v14 sports-dry-run-v13:
	@echo "Retired release entrypoint. Use v1.5 targets and a chain-specific deployment packet."
	@exit 1

# Create an "audit handoff" bundle: code + docs + pinned deps metadata + release artifacts + verify helpers.
# The output is placed under dist/ as a .tar.gz.
audit-package:
	bash script/release/package_audit.sh
