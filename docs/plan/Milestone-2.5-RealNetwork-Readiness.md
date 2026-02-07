# Milestone 2.5 — Real-network readiness (fork + deploy)

This milestone moves SSOT from **local proof-correct** to **real-network reproducible**:
- fork tests that validate against real Chainlink VRF v2.5 Wrapper addresses
- deterministic deployment scripts
- explicit parameter policy and operational runbooks
- release-grade artifacts (snapshot + verify + digest/signature lock)

## Why this milestone exists
Until this point, correctness is proven in a controlled environment (mocks + proof gates). For production, we need:
- **reproducible deployment artifacts**
- **real chain integration validation** (forked execution)
- **parameterization that can be audited**
- **tamper-evident config lock** for releases

## Deliverables
### D1 — Fork tests (`test/fork/*`)
- Add fork tests that:
  - auto-skip if `FORK_RPC_URL` is unset
  - deploy the adapter + VRFHub + Hub stack and submit a real wrapper request
  - assert requestId issuance and expected accounting fields

### D2 — Deployment scripts (`script/*`)
- Add a deterministic deployment script that:
  - enforces `deployer == GOV`
  - deploys `ChainlinkV2PlusWrapperAdapter`, `VRFHub`, `BankRegistry`, referral components, `Hub`
  - deploys and registers N banks via `NUM_ASSETS` + `ASSET_i`
  - registers the canonical modules (Dice/Coin/Roulette/Keno)
  - prints the full address set

### D3 — Parameter policy (`docs/deploy/*`)
- Add a deploy runbook that:
  - documents all env vars and defaults
  - provides network examples
  - provides a preflight/postflight checklist

### D4 — Dependency determinism
- Add pinned-dependency install script used by CI and local (`script/ci/install_deps.sh`)
- Record pinned versions (`deps.lock`)

### D5 — Release lock (digest + signature)
- Generate a deterministic digest derived from the snapshot fields (format-independent)
- Sign the digest with governance (recommended) to make the deployment tamper-evident
- Provide offline verification and CI-friendly strict gating on tag/release workflows

## Acceptance criteria
- `FOUNDRY_PROFILE=pr forge test --match-path "test/unit/*"` passes
- `FOUNDRY_PROFILE=pr forge test --match-path "test/diff/*"` passes
- `FOUNDRY_PROFILE=pr forge test --match-path "test/invariants/*"` passes
- `forge test --match-path "test/fork/*"`:
  - passes when RPC env vars are set
  - is skipped (no failures) when RPC env vars are not set
- Deployment runbook + script successfully produce a reproducible address/config set for at least 1 target network
- `make release-digest` produces `deployments/release-*.json` for a snapshot
- `make release-verify` succeeds offline
- `STRICT=1 make release-check` passes in tag/release CI when artifacts are present
