# Release process

This repository is designed to be **auditable by construction**. A production release is defined by
**immutable deployment artifacts**, not by a git tag alone.

For an outward-facing summary built from the current canonical deployment artifacts, see:

- [`ARBIGAMEFI-RELEASE-PACK.zh-CN.md`](ARBIGAMEFI-RELEASE-PACK.zh-CN.md) — partner / LP / auditor-facing release pack
- [`ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md`](ARBIGAMEFI-EXPLORER-LINKS.zh-CN.md) — direct explorer entrypoints for the current deployment
- [`ARBIGAMEFI-LP-ONBOARDING.zh-CN.md`](ARBIGAMEFI-LP-ONBOARDING.zh-CN.md) — LP-facing note for reading NAV, reserve, and optional outflow semantics

## Definition of a release

A release is the tuple:

1. **Deployment snapshot**: a JSON snapshot capturing addresses + key parameters.
2. **Release lock**: a deterministic digest derived from the snapshot plus an ECDSA signature.
3. **Release notes**: a human-readable Markdown file that explicitly includes the digest.

4. **Frontend manifest**: a machine-readable JSON manifest for the frontend (no inference).
5. **Golden vectors**: canonical bytes vectors used to prove frontend encoding correctness.

This ensures a third party can:
- reproduce the canonical digest from the snapshot,
- verify the signature offline,
- verify deployed bytecode on-chain,
- and confirm the release notes match the locked parameters.

## Artifact layout

The `deployments/` directory is treated as a release artifact store:

- `deployments/latest.json` — latest deployment snapshot (overwritten on each deploy)
- `deployments/snapshots/deploy-<chainId>-<block>.json` — immutable snapshot copy
- `deployments/release-latest.json` — latest release lock (digest + signature)
- `deployments/release/release-<chainId>-<block>.json` — immutable release lock copy
- `deployments/release-notes-latest.md` — latest release notes
- `deployments/frontend-manifest-latest.json` — latest frontend manifest (required)
- `deployments/golden-vectors-latest.json` — latest golden vectors (required)
- `deployments/release/release-notes-<chainId>-<block>.md` — immutable release notes copy
- `deployments/release/frontend-manifest-<chainId>-<block>.json` — immutable frontend manifest copy
- `deployments/release/golden-vectors-<chainId>-<block>.json` — immutable golden vectors copy
- `deployments/verify-latest.sh` — latest explorer verification helper
- `deployments/verify/verify-<chainId>-<block>.sh` — immutable verification helper

## The 4 commands you run for a production release

After deploying and producing `deployments/latest.json`:

```bash
make release-digest        # creates deployments/release-*.json + release-latest.json
make release-notes         # creates deployments/release-notes-*.md + release-notes-latest.md
make release-frontend-manifest # creates deployments/frontend-manifest-*.json + frontend-manifest-latest.json
make release-golden-vectors    # creates deployments/golden-vectors-*.json + golden-vectors-latest.json
make release-verify        # offline verification (digest + signature)
STRICT=1 make release-check # enforces (snapshot + lock + notes + manifest + vectors) and checks notes contain digest
```

Optionally, package the artifacts into a single archive:

```bash
make release-package
```

For third-party audits, you can also build an **audit handoff bundle** that includes:
code + docs + pinned dependency metadata + release artifacts + verify helpers.

```bash
make audit-package
```

## Tagging and GitHub Releases

Recommended flow:

1. Make sure `CHANGELOG.md` includes an entry for the version (even if short).
2. Run the release commands above.
3. Create a git tag `vX.Y.Z` for the commit you want to ship.
4. Create a GitHub release using the content from `deployments/release-notes-latest.md`.
5. Attach `dist/ssot-<tag>-<digestPrefix>.tar.gz` (from `make release-package`).

> The CI `Release Gate` workflow enforces `STRICT=1 make release-check` **and** fork tests on tags that start with `v`.

## Fork tests as a release gate

On release tags (`v*`), CI also runs `test/fork/*` against the **deployed chain** described by `deployments/latest.json`.
The gate:
- reads `chainId` and `vrfWrapper` from `deployments/latest.json`
- selects the matching fork RPC URL from repository secrets
- runs `forge test --match-path "test/fork/*"` with `FORK_REQUIRED=1` (so skipping is not allowed)

Required repository secrets (set only the one(s) you release to):
- `FORK_RPC_URL_BASE` (chainId 8453)
- `FORK_RPC_URL_BASE_SEPOLIA` (chainId 84532)
- `FORK_RPC_URL_ARBITRUM_ONE` (chainId 42161)
- `FORK_RPC_URL_ARBITRUM_SEPOLIA` (chainId 421614)

If the correct secret is missing for the release chainId, the release gate fails.

For local runs, you can still do:

```bash
FORK_RPC_URL=... FORK_VRF_WRAPPER=... make fork
```

## Verify (offline + on-chain)

Offline (no RPC required):

```bash
make release-verify
```

On-chain explorer verification (requires `ETHERSCAN_API_KEY` and RPC for deployment):

```bash
make verify
```

See also:
- `docs/release/checklist.md` — step-by-step release checklist
- `docs/deploy/release-artifacts.md` — how the digest is computed and why
