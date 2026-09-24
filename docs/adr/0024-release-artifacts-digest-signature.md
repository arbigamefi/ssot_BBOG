> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# ADR-0024: Release artifact digest + signature (deployment lock)

## Status

Accepted (Milestone 2.5+)

Operational note (V14): legacy unversioned "latest" aliases are retired. Current
release workflows publish and consume versioned artifacts such as
`deployments/latest-v14.json`, `deployments/release-latest-v14.json`, and
`deployments/abis-v14/`.

## Context

SSOT already generates:

- A deployment snapshot JSON (`deployments/deploy-<chainid>-<block>.json`, with the current release line copied to a versioned alias such as `deployments/latest-v14.json`)
- A deterministic verification helper (`deployments/verify-<chainid>-<block>.sh`, with the current release line copied to a versioned alias such as `deployments/verify-latest-v14.sh`)

These are strong audit artifacts, but JSON is not inherently canonical (key ordering / whitespace / editor rewrites can change bytes while preserving meaning). For a production release process, we also want a deterministic **machine-checkable lock** that:

- is independent of JSON formatting,
- is easy to verify offline,
- can be signed by governance to make tampering evident.

## Decision

We introduce a **Release Digest** computed from parsed snapshot fields in a fixed schema, and an ECDSA signature over that digest:

- Digest schema: `SSOT_RELEASE_DIGEST_V1`
- Digest: `keccak256(abi.encode(schemaHash, <snapshot fields> ...))`
- Signature: `(v,r,s) = sign(digest)` where the signer is the governance key (recommended) or an explicit signer key.

The release artifact is written as:

- `deployments/release-<chainid>-<block>.json` and a versioned latest alias such as `deployments/release-latest-v14.json`

Verification is offline and deterministic:

- Recompute digest from the snapshot fields using the same schema.
- Validate digest matches the release artifact.
- Validate `ecrecover(digest, v,r,s) == signer`.

## Consequences

- A deployment is considered "release-ready" only if the snapshot + release artifact verify.
- This produces a tamper-evident chain of custody for configuration and constructor arguments.
- CI can enforce strict presence for tag/release workflows while remaining non-blocking for normal PRs (where no deployment artifacts exist).

## Implementation

- Generator: `script/release/ReleaseDigest.s.sol`
- Verifier: `script/release/VerifyRelease.s.sol`
- CI-friendly wrapper: `script/release/check_release.sh` (STRICT=1 enforces presence)
- Make targets:
  - `make release-digest`
  - `make release-verify`
  - `STRICT=1 make release-check`
