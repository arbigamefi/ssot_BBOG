# Current release

The project has not launched. The source supports one contract model, v1.6: fixed 50% LP edge,
instant deposits, asynchronous redemption without a redemption-driven betting pause, and player-payable fallback.

Use the [deployment workflow](../deploy/v16-release.md) and
[contract rules](../constitution/SSOT.v1.6.md). Release artifacts are generated from the current source,
verified against the configured signer and chain, then imported into the application.

- One generated ABI set: `frontend/packages/ssot/src/abis/contracts/`.
- Verified deployment manifests: `frontend/packages/ssot/src/release/embedded/`.
- Test-only manifests and vectors: `frontend/packages/ssot/src/fixtures/`; these are not deployments.
- Generated deployment and packaging outputs are local build products, not committed history.

With no imported manifest the application reports that no release is available and offers no contract
writes. Do not insert old addresses or test fixtures to make the application appear connected.

Required before launch: final audit scope, external audit, fresh network acceptance, compliance
readiness (operating entity, jurisdictions, server-side geo-blocking, sanctions screening and player-limit
enforcement, terms including compensation for bets that can never settle) and operational readiness.
