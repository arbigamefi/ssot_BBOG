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
- Re-read Safe code, owner and control hashes. Use current generated ABIs; a build without a verified
  imported manifest intentionally has no connected pools.

## Deployment and application setup

1. Run `make deploy-dryrun` with the intended configuration and network RPC. Review all addresses,
   pool domains, reserve and withdrawal buffers, game limits, edge allocation and refund timeouts.
2. Run `make deploy-v16` with the approved keystore account. Set `SNAPSHOT_PATH` to the generated
   snapshot. Review and execute `make safe-acceptance-v16` with the Safe owners.
3. Run `make release-governance-check`, `make release-v16` and `make verify-v16` with the configured
   signer and network. A release contains a signed digest, manifest, ABIs and encoding vectors.
4. Import the verified bundle with `pnpm -C frontend ssot:sync -- --from <bundle>`, supplying the
   trusted signer and RPC. Check it with `pnpm -C frontend check:release`.
5. Build the web and keeper images from the same source revision. Configure a fresh PostgreSQL
   database; the keeper initializes the current schema and replays the selected Hub from its release
   block. Deploy by immutable image digest using the Docker deployment instructions.

## Network acceptance

Verify deposits; redemption requests and cancellation until actual activation, including after
earliest eligibility; and continued new betting before and after activation when active capital is
sufficient. Redemption must not trigger a betting pause. With an old recovery epoch still unresolved,
verify later activation and liquid claims, historical recovery ownership after transfers and full exits,
and correct recovery cash-flow indexing. Test payout-transfer failure and player-payable recovery.
Reconcile active NAV and active reserve separately from historical pocket backing, fixed liabilities and
global `totalReserved()` across activation, settlement and claims. New risk must not spend historical
backing; insufficient active funds and an independent emergency pause still reject new bets.
Every admitted casino game must finalize, and timed-out PendingVRF bets must refund. Reconcile
HouseEdgeAllocated events, actual cash transfers, XP and PF liabilities. Exercise restart/replay,
reorg handling, alert delivery, Safe pause and governance-only unpause.

Sports admission has its own terminal-path gate. Do not accept outside LP capital until the ADR-0035
implementation and external audit gates have been met. Local mocks cannot prove signer custody,
network availability or the actual Safe execution.
