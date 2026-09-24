# v1.5 release process

Follow the [v1.5 release workflow](../deploy/v15-release.md), including its live governance, signer and artifact-consistency gates. See [current deployment evidence](../deploy/v15/implementation-status.zh-CN.md) for what has actually been executed.

A release binds a deployment snapshot, signed release digest, frontend manifest, ABI index, golden vectors and release notes. The current public bundles are committed under:

- `frontend/packages/ssot/src/fixtures/release-bundles/chain-8453/51692502-cf3f3550/`
- `frontend/packages/ssot/src/fixtures/release-bundles/chain-84532/47140467-ae662a55/`

Active SDK manifests and ABIs live under `frontend/packages/ssot/src/release/embedded/` and `frontend/packages/ssot/src/abis/release/`. Local generated `deployments/` and `dist/` contents are ignored; they are not authoritative merely because their filenames contain `latest`.

After deployment and verified Safe governance acceptance, use `make release-v15` with the chain-specific snapshot, RPC and approved release signer. This runs governance verification, metadata generation, digest verification and guarded packaging. Import a verified package with `pnpm -C frontend ssot:sync -- --from <bundle>` and the trusted signer configuration described in the workflow.

Production application images are built by CI and deployed by immutable digest. Use [the Docker runbook](../../frontend/deploy/docker/README.md); do not compile on the production VPS.

Historical release documents retain their original observations, but old release tools and bundled artifacts have been removed from the working tree. Consult Git history when investigating them. The remaining historical chain obligations are recorded separately from the supported release path.
