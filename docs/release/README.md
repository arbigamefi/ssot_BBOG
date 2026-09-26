# v1.5 release process

> **Contract sources have moved to v1.6.** The sources now implement the v1.6 house-edge allocation
> ([ADR-0032](../adr/0032-fixed-lp-share-operator-funded-referrals.md)), which is not audited or deployed.
> The deploy and release scripts keep their V15 names until the v1.6 release renames them, but they now
> build and verify the v1.6 contracts and configuration. To re-verify or operate the live v1.5 deployment
> with its own tooling, check out commit `7ee449b88`.

Follow the [v1.5 release workflow](../deploy/v15-release.md), including its live governance, signer and artifact-consistency gates. See [current release facts](STATUS-v1.5.zh-CN.md) for scope and dated verification; the [implementation log](../deploy/v15/implementation-status.zh-CN.md) preserves historical execution evidence.

A release binds a deployment snapshot, signed release digest, frontend manifest, ABI index, golden vectors and release notes. The current public bundles are committed under:

- `frontend/packages/ssot/src/fixtures/release-bundles/chain-8453/51692502-cf3f3550/`
- `frontend/packages/ssot/src/fixtures/release-bundles/chain-84532/47140467-ae662a55/`

Active SDK manifests and ABIs live under `frontend/packages/ssot/src/release/embedded/` and `frontend/packages/ssot/src/abis/release/`. Local generated `deployments/` and `dist/` contents are ignored; they are not authoritative merely because their filenames contain `latest`.

After deployment and verified Safe governance acceptance, use `make release-v15` with the chain-specific snapshot, RPC and approved release signer. This runs governance verification, metadata generation, digest verification and guarded packaging. Import a verified package with `pnpm -C frontend ssot:sync -- --from <bundle>` and the trusted signer configuration described in the workflow.

Production application images are built by CI and deployed by immutable digest. Use [the Docker runbook](../../frontend/deploy/docker/README.md); do not compile on the production VPS.

Historical release documents retain their original observations, but old release tools and bundled artifacts have been removed from the working tree. Consult Git history when investigating them. The remaining historical chain obligations are recorded separately from the supported release path.
