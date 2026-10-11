# Current release

The project has not launched. The accepted target is immediate funding into per-deposit ERC721 NFTs,
a fixed 24-hour withdrawal cooldown, original Azuro V3 tree allocation and liquidity-limited synchronous
payment, plus same-callback VRF settlement. **Core contracts and application interfaces are implemented and locally verified; external audit and network acceptance are pending.**
Follow the [detailed plan](../design/lp-accounting-and-callback-implementation.md) and
[contract rules](../constitution/SSOT.v1.6.md).

Use the [Base Sepolia acceptance checklist](../deploy/v16-sepolia-acceptance.md) for one fresh
deployment, the current database schema and matching application build. Current local results and
remaining qualification are in the [core review](../audit/nft-core-integration-review.md).

- One generated ABI set: `frontend/packages/ssot/src/abis/contracts/`, including LiquidityVault.
- Authenticated manifests: `frontend/packages/ssot/src/release/embedded/`; every pool requires its
  Vault and reciprocal immutable Bank/asset binding.
- Test fixtures: `frontend/packages/ssot/src/fixtures/`, never deployment substitutes.
- Pinned tree sources and provenance belong in tracked vendor files; ignored dist is not a build dependency.
- Deployment/build products remain generated artifacts, not parallel contract implementations.

With no imported manifest the application exposes no contract writes. The [deployment workflow](../deploy/v16-release.md)
and [checklist](checklist.md) require exact source, signer, wrapper, governance and chain evidence.
Complete tree-inclusive callback gas qualification and the remaining external-LP release gates.
The user accepted the current ordering tradeoff; verify its public disclosure against the
[recorded decision](../audit/callback-and-lp-admission-review-2026-10-04.md).
A timer does not prove safe ordering, and the old 100-round limit is not automatically valid.

All known issues are resolved in one launch candidate before any real-money deployment; the plan is tracked in
[launch candidate](launch-candidate.zh-CN.md).

Launch also requires the existing operating-entity/jurisdiction decisions, server-side access requirements,
player limits, terms and operational readiness. Local tests and testnet funding do not establish launch readiness.
