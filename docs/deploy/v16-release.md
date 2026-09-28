# v1.6 release

v1.6 fixes the LP share of the house edge (see [SSOT v1.6](../constitution/SSOT.v1.6.md) and [ADR-0032](../adr/0032-fixed-lp-share-operator-funded-referrals.md)). It ships to Base Sepolia first. Base mainnet stays on v1.5 until the external review of the [frozen audit scope](../audit/v1.6-audit-scope.md) is finished and a separate mainnet decision is made.

The Safe, signing and explorer-verification rules are those of the [v1.5 workflow](v15-release.md). This page covers what v1.6 changes about them and the Sepolia switch.

## What changes for operators

A v1.6 release deploys a complete new stack: every contract, including new Banks and so new LP pools. Only `GameHub`, `SettlementRouter` and `DefaultReferralEngine` change their ABIs; the Banks, pool registry, VRF hub, game modules and sports contracts keep the v1.5 interfaces.

|                              | v1.5                                                             | v1.6                                                             |
| ---------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tooling                      | `DeployV15`, `*V15` release scripts                              | `DeployV16`, `*V16` release scripts                              |
| Make targets                 | `deploy-v15`, `safe-acceptance-v15`, `release-v15`, `verify-v15` | `deploy-v16`, `safe-acceptance-v16`, `release-v16`, `verify-v16` |
| `architectureVersion`        | `v1.5-safe-governance`                                           | `v1.6-house-edge-allocation`                                     |
| Release digest schema        | `SSOT_RELEASE_DIGEST_V15`                                        | `SSOT_RELEASE_DIGEST_V16`                                        |
| Artifacts                    | `deployments/*-latest-v15.*`, `deployments/abis-v15/`            | `deployments/*-latest-v16.*`, `deployments/abis-v16/`            |
| Release Gate signer variable | `V15_RELEASE_SIGNER`                                             | `V16_RELEASE_SIGNER`                                             |

### Parameters

The public packet for Base Sepolia is [v16/chain-84532.env.example](v16/chain-84532.env.example).

| Input                                    | Meaning                                                                                                                                      | Bound             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `DEFAULT_HOUSE_EDGE_BPS`                 | Base house edge `h_b`                                                                                                                        | 1–500             |
| `REF_L0_BPS`, `REF_L1_BPS`, `REF_L2_BPS` | Player rakeback and the two referrer levels, in bps of the base-edge portion of a bet's edge. L0 is paid only when the player has a referrer | Sum at most 3,500 |
| `REF_HOLDBACK_BPS`                       | Share of L1, L2 and markup awards that vests                                                                                                 | —                 |
| `REFUND_TIMEOUT_SECONDS`                 | Wait before a stuck bet can be refunded                                                                                                      | At most 86,400    |

The deploy script refuses `MAX_AFFILIATE_DELTA_BPS`, `REF_BASE_BUDGET_BPS`, `REF_DELTA_BUDGET_BPS`, `REF_LEVELS` and `REF_LEVEL0_BPS`–`REF_LEVEL5_BPS`. Remove them from any packet copied from v1.5. The affiliate markup cap always starts at 0.

### Governance after acceptance

Changing the base edge, or raising the markup cap, is two steps. The Safe calls `queueEdgeChange(param, bps)`; after `EDGE_CHANGE_DELAY` (7 days) anyone can call `activateEdgeChange(param)`. Until then the Safe can discard it with `cancelEdgeChange(param)`. Lowering the markup cap takes effect at once and discards a queued increase.

A referral schedule cannot be edited. The Safe creates a new one with `createReferralConfig` and switches to it with `setActiveReferralConfig`, which applies to bets accepted afterwards. Every bet keeps the schedule and payees it was accepted with.

The release gate refuses a snapshot while either edge-change queue holds a change (audit F-01), both before and after the Safe accepts governance.

## Release steps

1. Freeze the source commit, dependency pins and packet. The contracts in `src` must be the audited tree named in the audit scope. Re-read the Safe code, owners and control hashes and every address in the packet in full; do not copy an address from transaction history.
2. Run `make deploy-dryrun` with the packet and a Base Sepolia `RPC_URL`. Check the simulated configuration: base edge 200, schedule 1,000 / 2,000 / 500, holdback 3,000, refund timeout 3,600, markup cap 0.
3. Broadcast with `make deploy-v16` and the approved keystore account. Keep the Foundry broadcast traces.
4. Set `SNAPSHOT_PATH` to the new snapshot and run `make safe-acceptance-v16`. Two Safe owners review, sign and execute the package, as for v1.5.
5. Run `make release-governance-check`, then `make release-v16` with `RELEASE_ACCOUNT`. Submit explorer sources with `make verify-v16` and record the results.
6. Import the bundle with `pnpm -C frontend ssot:sync -- --from <bundle>`, with `RPC_URL` and `RELEASE_SIGNER` set. Run the import from a checkout of the v1.6 line: the sync verifies a bundle with the checkout's own release scripts, so it accepts only bundles of the same line. The mainnet v1.5 release already in `frontend/packages/ssot/src/release/embedded/` stays as it is.
7. Switch the application (next section).

## Switching Base Sepolia

Mainnet and Base Sepolia share one production stack (Compose project `arbigamefi-v15`, database `arbigamefi_v15`). The Sepolia switch is an application release inside that stack, not a new stack.

1. Settle the v1.5 Sepolia GameHub first. Pause new risk on its Banks (`setRiskInPaused(true)`, from the guardian or the Safe) and let the keeper finalize or refund every open bet. After the switch the keeper no longer settles that hub.
2. Take a bet-index dump with `script/ops/bet-index-backup.sh` as a restore point for incidents. The switch does not migrate the index: production was re-keyed by GameHub ([#88](https://github.com/arbigamefi/ssot_BBOG/pull/88)) with the `979be07a6` deploy on 2026-09-27, and every image since writes that key.
3. Build the Web and keeper images in CI from the commit that carries the imported release, and deploy them by digest. The image guard accepts a v1.5 or v1.6 release on each chain, so mainnet on v1.5 and Base Sepolia on v1.6 pass together.
4. The Sepolia keepers start indexing the new GameHub from its release block. Bets of the v1.5 Sepolia hub stay in the index; receipt links that name that hub (`?hub=`) still open them, while feeds and analytics show the active release only.

## Sepolia acceptance

The release is accepted when all of these hold on Base Sepolia:

- New bets on every casino game and both pools reach VRF and settle; a timeout refund and a partial refund complete.
- For each settled bet, the `HouseEdgeAllocated` event reconciles: `edge = floor(U × h_e / 10,000)`, the operator share is half of it rounded down, LPs keep the rest, and L0, L1, L2 and the protocol fee match the schedule for a player with no referrer, one referrer and two levels. The awards match the Bank XP events and the protocol fee accrual.
- The receipt page shows the same split.
- A base-edge change is queued, read back with `pendingEdgeChange`, and cancelled. Activation needs the full 7 days; rehearse it only if the schedule allows the wait.
- The keeper recovers after a restart and after a failed index write; the Safe and guardian can pause and unpause.

Local tests use a Safe configuration mock. They do not prove owner custody or the Safe rehearsal.

## Rollback

Deployed contracts cannot be rolled back, and their open bets still have to end. Before an application rollback, pause new risk on the v1.6 Banks and let every open bet on the v1.6 GameHub finalize or refund: after the rollback, the keeper no longer settles that hub.

The rollback redeploys the previous Web and keeper images by digest. This returns Base Sepolia to the v1.5 embedded release while its contracts are still usable. Do not restore a database dump. Those images already use the GameHub-keyed index, and the database also serves mainnet, so a restore would discard mainnet rows too. The v1.6 hub's bets stay in the index.

## Local checks

```sh
FOUNDRY_PROFILE=pr forge test --threads 1 --match-path test/unit/DeploymentV16.t.sol -vv
FOUNDRY_PROFILE=pr forge test --no-match-path test/unit/DeploymentV16.t.sol --match-path 'test/unit/*' -vv
python3 -m unittest discover -s test/ops -v
python3 test/mutation/v16_mutants.py --check
node --check frontend/scripts/ssot-sync.mjs
git diff --check
```
