# Default profile for tests is `pr` to keep CI fast.
# Deploy/verify should use the `default` compilation profile unless overridden.
FOUNDRY_PROFILE ?= pr
DEPLOY_PROFILE ?= default
VERIFY_PROFILE ?= default
FRONTEND_DIR ?= frontend

.PHONY: deps check-deps check test pr nightly fork deploy verify verify-helpers sports-dry-run-v13 sports-lifecycle-dry-run sports-phase0-readiness release release-v13 release-digest release-digest-v13 release-verify release-verify-v13 release-check release-check-v13 release-notes release-notes-v13 release-package release-package-v13 audit-package lint release-frontend-manifest release-frontend-manifest-v13 release-golden-vectors release-golden-vectors-v13 release-abis release-abis-v13 frontend-install frontend-dev frontend-build frontend-lint frontend-typecheck frontend-test frontend-test-strict frontend-storybook frontend-storybook-build frontend-release-check frontend-check

deps:
	bash script/ci/install_deps.sh

check-deps:
	bash script/ci/check_deps.sh

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

deploy:
	@$(MAKE) check-deps
	# Clean build/cache artifacts before broadcast.
	# If you ever hit Foundry broadcaster decode errors, rerun with CLEAN_BROADCAST=1.
	bash script/ci/clean_foundry.sh
	FOUNDRY_PROFILE=$(DEPLOY_PROFILE) forge script script/Deploy.s.sol:Deploy --rpc-url $$RPC_URL --broadcast -vvv

verify:
	@$(MAKE) check-deps
	@$(MAKE) verify-helpers
	# Verification can be sensitive to stale build artifacts across Foundry versions.
	# Preserve broadcast traces but recompile from scratch.
	CLEAN_BROADCAST=0 bash script/ci/clean_foundry.sh
	# Precompile once to populate Foundry compiler caches (reduces noisy cache warnings).
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build > /dev/null
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) bash deployments/verify-latest.sh

# Regenerate verify helper scripts from an existing deployments/latest.json.
# Useful when you deployed with an older helper, or after upgrading Foundry/Etherscan endpoints.

lint:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge lint

verify-helpers:
	@if [ ! -f deployments/latest.json ]; then \
		echo "deployments/latest.json not found; skipping verify helper regeneration"; \
		exit 0; \
	fi
	python3 script/tools/gen_verify_helpers.py deployments/latest.json

sports-dry-run-v13:
	bash script/ci/v13_sports_dry_run.sh

sports-lifecycle-dry-run:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=pr forge test --match-path test/unit/SportsHubLifecycle.t.sol -vv

sports-phase0-readiness:
	@$(MAKE) sports-dry-run-v13
	@$(MAKE) sports-lifecycle-dry-run

# --- Release artifacts (digest + signature) ---
# 1) After a successful deploy that produced deployments/latest.json:
#      make release-digest
# 2) Verify locally:
#      make release-verify
# 3) In CI for tag/release builds, enforce presence:
#      STRICT=1 make release-check


# Full release workflow (digest + notes + frontend artifacts + verify + package).
release: release-digest release-notes release-frontend-manifest release-golden-vectors release-abis release-verify release-package
release-v13: release-digest-v13 release-notes-v13 release-frontend-manifest-v13 release-golden-vectors-v13 release-abis-v13 release-verify-v13 release-package-v13

release-digest:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/ReleaseDigest.s.sol:ReleaseDigest -vvv

release-digest-v13:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/ReleaseDigestV13.s.sol:ReleaseDigestV13 -vvv

release-verify:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/VerifyRelease.s.sol:VerifyRelease -vvv

release-verify-v13:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/VerifyReleaseV13.s.sol:VerifyReleaseV13 -vvv

release-check:
	@$(MAKE) check-deps
	bash script/release/check_release.sh

release-check-v13:
	@$(MAKE) check-deps
	RELEASE_PATH=deployments/release-latest-v13.json SNAPSHOT_PATH=deployments/latest-v13.json NOTES_PATH=deployments/release-notes-latest-v13.md FRONTEND_MANIFEST_PATH=deployments/frontend-manifest-latest-v13.json GOLDEN_VECTORS_PATH=deployments/golden-vectors-latest-v13.json ABI_INDEX_PATH=deployments/abis-v13/index.json FRONTEND_SCHEMA=2 RELEASE_TAG_SUFFIX=-v13 VERIFY_SCRIPT=script/release/VerifyReleaseV13.s.sol:VerifyReleaseV13 bash script/release/check_release.sh

# Generate human-friendly release notes that include the release digest.
release-notes:
	@$(MAKE) check-deps
	FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/GenerateReleaseNotes.s.sol:GenerateReleaseNotes -vvv

release-notes-v13:
	@$(MAKE) check-deps
	RELEASE_PATH=deployments/release-latest-v13.json SNAPSHOT_PATH=deployments/latest-v13.json FOUNDRY_PROFILE=$(FOUNDRY_PROFILE) forge script script/release/GenerateReleaseNotesV13.s.sol:GenerateReleaseNotesV13 -vvv

# Create a distributable archive containing the snapshot + release lock + notes (+ verify helper if present).

# Generate a frontend-ready manifest that requires zero inference from the UI.
release-frontend-manifest:
	FOUNDRY_PROFILE=default forge script script/release/GenerateFrontendManifest.s.sol:GenerateFrontendManifest -vvv

release-frontend-manifest-v13:
	FOUNDRY_PROFILE=default forge script script/release/GenerateFrontendManifestV13.s.sol:GenerateFrontendManifestV13 -vvv

# Generate golden (exact-hex) vectors for frontend encoding tests.
release-golden-vectors:
	FOUNDRY_PROFILE=default forge script script/release/GenerateGoldenVectors.s.sol:GenerateGoldenVectors -vvv

release-golden-vectors-v13:
	FOUNDRY_PROFILE=default forge script script/release/GenerateGoldenVectorsV13.s.sol:GenerateGoldenVectorsV13 -vvv

release-abis:
	@$(MAKE) check-deps
	# ABIs are derived from Foundry artifacts; build once to ensure out/ exists.
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build > /dev/null
	python3 script/release/export_frontend_abis.py

release-abis-v13:
	@$(MAKE) check-deps
	# ABIs are derived from Foundry artifacts; build once to ensure out/ exists.
	FOUNDRY_PROFILE=$(VERIFY_PROFILE) forge build > /dev/null
	python3 script/release/export_frontend_abis.py --manifest deployments/frontend-manifest-latest-v13.json --dest deployments/abis-v13 --schema 2 --tag-suffix=-v13

release-package:
	bash script/release/package_release.sh

release-package-v13:
	RELEASE_PATH=deployments/release-latest-v13.json SNAPSHOT_PATH=deployments/latest-v13.json NOTES_PATH=deployments/release-notes-latest-v13.md FRONTEND_MANIFEST_PATH=deployments/frontend-manifest-latest-v13.json GOLDEN_VECTORS_PATH=deployments/golden-vectors-latest-v13.json ABIS_DIR=deployments/abis-v13 ABIS_INDEX_PATH=deployments/abis-v13/index.json RELEASE_TAG_SUFFIX=-v13 SNAPSHOT_LATEST_NAME=latest-v13.json RELEASE_LATEST_NAME=release-latest-v13.json NOTES_LATEST_NAME=release-notes-latest-v13.md FRONTEND_MANIFEST_LATEST_NAME=frontend-manifest-latest-v13.json GOLDEN_VECTORS_LATEST_NAME=golden-vectors-latest-v13.json bash script/release/package_release.sh

# Create an "audit handoff" bundle: code + docs + pinned deps metadata + release artifacts + verify helpers.
# The output is placed under dist/ as a .tar.gz.
audit-package:
	bash script/release/package_audit.sh
