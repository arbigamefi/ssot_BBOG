# Release artifacts (digest + signature)

This repo produces two kinds of deployment artifacts:

1) **Snapshot JSON** (human/audit)
- `deployments/snapshots/deploy-<chainid>-<block>.json` (preferred, immutable)
- `deployments/deploy-<chainid>-<block>.json` (legacy, kept for backwards compatibility)
- `deployments/latest.json` (overwritten; points to latest snapshot)

2) **Release lock** (machine-checkable)
- `deployments/release/release-<chainid>-<block>.json` (preferred, immutable)
- `deployments/release-<chainid>-<block>.json` (legacy)
- `deployments/release-latest.json` (overwritten)

3) **Release notes** (human-readable, must include the digest)
- `deployments/release/release-notes-<chainid>-<block>.md`
- `deployments/release-notes-latest.md`

The release lock is a deterministic digest computed from parsed snapshot fields (schema `SSOT_RELEASE_DIGEST_V1`) plus an ECDSA signature. This makes the deployment configuration **tamper-evident** without depending on JSON key ordering or whitespace.

## Generate
After deployment:

```bash
make release-digest
```

Then generate notes (include a tag name if you want it in the title):

```bash
TAG_NAME=vX.Y.Z make release-notes
```

By default the signer key is:
- `SIGNER_PRIVATE_KEY` (if set), otherwise
- `PRIVATE_KEY`

If `GOV` is set, the script enforces `signer == GOV`.

## Verify (offline)

```bash
make release-verify
```

## Release gating
For tag/release pipelines enforce presence:

```bash
STRICT=1 make release-check
```

In strict mode the check enforces:
- snapshot exists
- release lock exists and signature validates
- release notes exist and reference the digest

For normal PR CI, `release-check` is non-blocking if no deployment artifacts are present.

## Files
- Generator: `script/release/ReleaseDigest.s.sol`
- Verifier: `script/release/VerifyRelease.s.sol`
- Wrapper: `script/release/check_release.sh`
- Notes generator: `script/release/GenerateReleaseNotes.s.sol`
- Packager: `script/release/package_release.sh`
- ADR: `docs/adr/0024-release-artifacts-digest-signature.md`
