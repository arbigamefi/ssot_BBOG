# Release checklist (tag + artifacts + notes)

This checklist is the **Definition of Done** for a production release.

## 0. Preconditions

- [ ] Target commit is finalized (no extra changes expected).
- [ ] CI is green on the target commit.
- [ ] Dependencies are pinned (`deps.lock`) and `make deps` works from a fresh checkout/unzip.
- [ ] For tag releases, repository secrets include the fork RPC URL for the target chainId (see section 1).

## 1. Proof gates (local)

- [ ] `make pr` passes (unit + diff + invariants + optional fork)
- [ ] `make nightly` passes (longer fuzz/invariant runs)

If releasing to a real network, also run fork tests against the target chain:

- [ ] `FORK_RPC_URL=... FORK_VRF_WRAPPER=... make fork` passes

## 2. Deploy

- [ ] Export deploy env vars for the target network (see `docs/deploy/*.env.example`)
- [ ] Deploy:

```bash
RPC_URL=... make deploy
```

Confirm the deployment artifacts are produced:

- [ ] `deployments/latest.json`
- [ ] `deployments/snapshots/deploy-<chainId>-<block>.json` (preferred) or `deployments/deploy-<chainId>-<block>.json` (legacy)
- [ ] `deployments/verify-latest.sh` and/or `deployments/verify/verify-<chainId>-<block>.sh`

## 3. Explorer verification (recommended)

- [ ] Set `ETHERSCAN_API_KEY`
- [ ] Run:

```bash
make verify
```

## 4. Release lock (digest + signature)

- [ ] Generate digest + signature:

```bash
make release-digest
```

- [ ] Offline verify:

```bash
make release-verify
```

Artifacts expected:

- [ ] `deployments/release-latest.json`
- [ ] `deployments/release/release-<chainId>-<block>.json`

## 5. Release notes (must include digest)

- [ ] Generate notes:

```bash
TAG_NAME=vX.Y.Z make release-notes
```

- [ ] Generate required frontend artifacts:

```bash
make release-frontend-manifest
make release-golden-vectors
make release-abis
```

- [ ] Enforce strict release check:

```bash
STRICT=1 make release-check
```

Artifacts expected:

- [ ] `deployments/release-notes-latest.md`
- [ ] `deployments/release/release-notes-<chainId>-<block>.md`
- [ ] `deployments/frontend-manifest-latest.json`
- [ ] `deployments/release/frontend-manifest-<chainId>-<block>.json`
- [ ] `deployments/golden-vectors-latest.json`
- [ ] `deployments/release/golden-vectors-<chainId>-<block>.json`

## 6. Package artifacts (recommended)

- [ ] Package a distributable archive:

```bash
TAG_NAME=vX.Y.Z make release-package
```

Expected:

- [ ] `dist/ssot-vX.Y.Z-0x........tar.gz`

## 6b. Audit handoff package (recommended for third-party audits)

- [ ] Build an **audit bundle** that includes code + docs + pinned deps metadata + release artifacts + verify helpers:

```bash
TAG_NAME=vX.Y.Z make audit-package
```

Expected:

- [ ] `dist/ssot-audit-vX.Y.Z-0x........tar.gz`

The audit bundle contains a `MANIFEST.sha256` for integrity checking and an `AUDIT_VERIFY.md` quick-start.

## 7. Tag & GitHub Release

- [ ] Update `CHANGELOG.md` with a short release section (include the digest line)
- [ ] Create tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

- [ ] Create a GitHub release:
  - Title: `vX.Y.Z`
  - Body: paste `deployments/release-notes-latest.md`
  - Attach: `dist/ssot-vX.Y.Z-0x........tar.gz`

> CI `Release Gate` enforces `STRICT=1 make release-check` **and** fork tests (`test/fork/*`) on `v*` tags.
> For CI fork tests, set the appropriate repository secret for the released chainId:
> - `FORK_RPC_URL_BASE` (8453), `FORK_RPC_URL_BASE_SEPOLIA` (84532)
> - `FORK_RPC_URL_ARBITRUM_ONE` (42161), `FORK_RPC_URL_ARBITRUM_SEPOLIA` (421614)
