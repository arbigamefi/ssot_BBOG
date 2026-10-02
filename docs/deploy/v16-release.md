# Deploy the current contracts

The project is in development and has not launched. v1.6 is the only supported contract and release
format. Start with a fresh deployment, a fresh database schema, and the current application build.

## Before deployment

- Complete the current contract, SDK, keeper and frontend tests, including casino admission and batch
  redemption. Implement and verify ADR-0035's accepted requirement: old stuck positions cannot block
  later exits, and historical risk/recovery rights remain owned. Verify the exact release source and
  generated ABIs, then freeze the resulting final audit scope.
- Configure the final Safe governance, guardian, keeper, signer, assets and VRF wrapper explicitly.
  Use `v16/chain-84532.env.example` as a template, replacing every placeholder.
  The first deployment is Base Sepolia with exactly one USDC casino pool.
- Re-read Safe code, owner and control hashes. Use current generated ABIs; a build without a verified
  imported manifest intentionally has no connected pools.

## Deployment and application setup

1. Run `make deploy-dryrun` with the intended configuration and network RPC. Review all addresses,
   pool domains, reserve and withdrawal buffers, game limits, edge allocation and refund timeouts.
2. Run `make deploy-v16` with the approved keystore account. Set `SNAPSHOT_PATH` to the generated
   snapshot. Review and execute `make safe-acceptance-v16` with the Safe owners.
3. Run `make release-governance-check`, `make release-v16` and `make verify-v16` with the configured
   signer and network. A release contains a signed digest, manifest, ABIs and encoding vectors.
4. Run the authenticated **Frontend Docker Images** workflow on the same source commit with the
   signed bundle's release tag, exact filename, approved SHA-256, and `chain_id=84532`. Configure the
   independent `V16_RELEASE_SIGNER` repository variable. The workflow verifies the archive's source
   revision, artifact consistency, signature and live governance, then imports only the selected chain.
   Amount precision and symbols come from the signed snapshot; a failed verification cannot replace
   active metadata. Ordinary PR/push image builds do not publish deployment images.
5. Configure a fresh PostgreSQL database and one keeper using Infura HTTP plus Alchemy WebSocket.
   The keeper initializes the current schema and replays the selected Hub from its release block.
   Use [Docker deployment instructions](../../frontend/deploy/docker/README.md) to pin both immutable
   image digests, the reviewed source revision, chain ID and expected release digest before startup.
   Browser RPC remains public; feature flags default off until the appropriate acceptance stage.

## Network acceptance

Verify deposits; redemption requests and cancellation until actual activation, including after
earliest eligibility; and continued new betting before and after activation when active capital is
sufficient and the 128 active-risk-position capacity is not full. Redemption must not trigger a betting pause. Verify that settlement makes staying capital available in that same transaction. With an old recovery epoch still unresolved,
verify later activation and liquid claims, historical recovery ownership after transfers and full exits,
and correct recovery cash-flow indexing. Test payout-transfer failure and player-payable recovery.
Reconcile active NAV and active reserve separately from historical pocket backing, fixed liabilities and
global `totalReserved()` across activation, settlement and claims. New risk must not spend historical
backing; insufficient active funds and an independent emergency pause still reject new bets.
Every admitted casino game must finalize, and timed-out PendingVRF bets must refund. Reconcile
HouseEdgeAllocated events, actual cash transfers, XP and PF liabilities. Exercise restart/replay,
reorg handling, alert delivery, Safe pause and governance-only unpause.
Verify the new keeper's WS subscription and a real ready event through its final transaction receipt;
exercise disconnect/reconnect and HTTP catch-up. Restoring an old development keeper does not satisfy
this gate. Retire old containers, release bindings and obsolete data separately after accounting for
any remaining old-contract funds and positions; no compatibility or migration implementation is needed.
Bank payable discovery, historical-risk monitoring and provider cash-flow indexing advance through
finalized blocks. Verify the target RPC supports this tag and monitor finalized coverage separately
from the latest head. Automatic payable discovery, risk alerts and indexed LP cash flows may lag by
chain finality; betting, batch activation and on-chain user claims do not wait for these scanners.

Sports admission has its own terminal-path gate. Do not accept outside LP capital until the ADR-0035
implementation and external audit gates have been met. Local mocks cannot prove signer custody,
network availability or the actual Safe execution.

## Reproducible source and deployment inputs

`make audit-package` packages a clean, committed source tree, including frontend,
current ABI inventory, dependency locks, tests and audit documents. It records the
full commit and tree in `SOURCE_REVISION` and `SOURCE_TREE` and checksums the
export. It needs no deployment or signing key and does not assert that tests passed.
Keep the test logs and audit verdict bound to that same revision.

`make release-package` also requires a clean commit. Its archive includes
`SOURCE_REVISION`; deployment inputs remain ignored generated artifacts. After
uploading that bundle to its GitHub release, run **Release Gate** manually with:

- `release_tag`: the tag for the source commit used to deploy and package;
- `bundle_name`: the exact release asset filename;
- `bundle_sha256`: the independently approved SHA-256 of that archive.

The workflow downloads that exact asset, checks the digest, commit and file
inventory, and rejects unsafe archive members before staging it. It then runs the
strict snapshot/signature/manifest/ABI checks, proof gates and live governance/fork
gate. Required repository signer and RPC settings remain mandatory. A tag push
alone does not validate a release without its deployment bundle. Source audit
packaging is not a replacement for these deployment checks.
