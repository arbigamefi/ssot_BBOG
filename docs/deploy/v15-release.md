# v1.5 release and retirement

This is the active fresh-deployment workflow. Historical v1.3/v1.4 documents and signed bundles describe old addresses; they are not current deployment instructions. The new workflow is implemented but a generated snapshot or passing local test is **not** evidence of a completed on-chain v1.5 release.

## Required public configuration

Use a chain-specific environment on the approved deployment machine. Never commit signing keys. `DEPLOYER` is the temporary bootstrap signer public address, while `GOV` is the final Safe; they must differ. `RELEASE_SIGNER` is the independently pinned EOA signing release metadata, not a substitute for Safe governance. Deployment signing stays in the Foundry keystore (`DEPLOY_ACCOUNT`) or hardware wallet; the Solidity deployment script never reads a private key. Metadata signing uses `RELEASE_ACCOUNT` through the same Foundry keystore mechanism; neither script reads raw private keys.

| Input                                                     | Meaning                                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOYER`                                                | Approved public deployer address; provide the matching keystore account only when broadcasting                                      |
| `CHAIN_ID`, `RPC_URL`                                     | Explicit chain and matching endpoint; use 84532 for rehearsal and 8453 for mainnet                                                  |
| `GOV`                                                     | Deployed 2/3 Safe; never an undeployed same-address assumption                                                                      |
| `SAFE_CODE_HASH`                                          | Reviewed proxy runtime code hash                                                                                                    |
| `SAFE_OWNERS_HASH`                                        | `keccak256(abi.encode(address[] owners, uint256 threshold))`, in the exact on-chain owner order                                     |
| `SAFE_CONTROL_HASH`                                       | `keccak256(abi.encode(singleton, singleton.codehash, guard, fallbackHandler, fallbackCodeHash))`; zero fallback uses zero code hash |
| `GUARDIAN`                                                | Approved pause-only address; explicit zero disables guardian                                                                        |
| `KEEPER_ADDRESS`                                          | Dedicated chain-specific keeper, distinct from deployer and Safe                                                                    |
| `RELEASE_SIGNER`                                          | Trusted public metadata signer, required for signing, verification and frontend import                                              |
| `VRF_WRAPPER`, `REQUEST_GAS_PRICE_WEI`                    | Chain-specific wrapper and explicit fee estimate input                                                                              |
| `NUM_POOLS`, `POOL_ID_i`, `POOL_ASSET_i`, `POOL_DOMAIN_i` | Reviewed pool topology; domain 1 is Casino, 2 is Sports                                                                             |
| Bank/referral/Sports settings                             | Existing typed configuration supported by `DeployV15`; decimals and bounded BPS are checked before narrowing                        |

The Safe policy requires three distinct owners, threshold two, no enabled modules and no transaction guard. The control hash binds the singleton and fallback handler, including bytecode. Before approving the hash, verify their provenance; getter values alone do not establish that a contract is a genuine Safe.

The provided Safe `0x7F0c244e1701B069727670745FD047179Ef8691d` was observed on both Base and Base Sepolia on 2026-09-22. Both had:

- Proxy code hash `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c`.
- Owners hash `0xd5bf35b7ae948fcce133bdd94ac14595373f7df73cb7710793c10867f83f3888`.
- Control hash `0x4e0c8cd9e1809b45688e53e24083d406ec8883bd124c1ba2dfec21a223555057`.

These are dated observations, not permanent owner approval. Re-read before broadcast. The observed singleton and fallback code hashes match the official [SafeL2 1.4.1 deployment record](https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.4.1/safe_l2.json) and [CompatibilityFallbackHandler record](https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.4.1/compatibility_fallback_handler.json). Storage slots follow the versioned [GuardManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/GuardManager.sol) and [FallbackManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/FallbackManager.sol) sources. Safe software version 1.4.1 is unrelated to this protocol's v1.5 release version.

## Deploy, accept, then publish

1. Freeze the source commit, dependency pins, chain-specific parameter packet, funding/gas limit, and deployment signer. Archive the old commit and database before retirement work.
2. Run `make deploy-dryrun`. Inspect total cost and all constructor/configuration transactions before `make deploy`. Preserve Foundry broadcast traces on a partial failure. Resume only the exact reviewed broadcast; do not rerun a fresh deployment blindly or erase nonce/address evidence.
3. Every new Bank is paused before registry/router wiring. The bootstrap signer initializes the topology and nominates the Safe on all governable contracts. The snapshot records final `gov`, separate `bootstrapGovernance`, the original constructor arguments, code hashes, guardian and independent keeper. `bootstrapStatus=pending-safe-acceptance` is the historical outcome of deployment, not a release verdict.
4. Set `SNAPSHOT_PATH` to the exact chain-specific v1.5 snapshot and `SAFE_BATCH_PATH` to an output under `deployments/`. Run `make safe-acceptance-v15`. The file is a Safe transaction-builder package containing only `acceptGovernance()` calls. Accepted targets are omitted on regeneration; unexpected governance or pending addresses block preparation.
5. Two real Safe owners review/sign/execute the package. The Safe itself must call each target. Do not send `acceptGovernance()` directly from an owner EOA. Verify inner execution success and each target event. Partial acceptance cannot pass the release gate.
6. Run `make release-governance-check`, then `make release`. The gate checks chain, target bytecode, complete target governance, zero pending governance, Safe controls, guardian, Bank asset/router, paused state and published risk settings, pool routing, configured game modules, referral pricing and VRF settings. Artifact signature verification pins `RELEASE_SIGNER` separately; metadata cannot designate its own trust anchor.
7. Import the resulting bundle with `pnpm -C frontend ssot:sync -- --from <bundle>`, retaining `RPC_URL` and `RELEASE_SIGNER`. Import validates artifact consistency, trusted signature and live governance before replacing active embedded files. v1.3/v1.4 bundles are rejected as active imports.
8. Set the GitHub `V15_RELEASE_SIGNER` repository variable to the approved public metadata signer before a release tag; the Release Gate also requires the target chain RPC secret and checks live governance. Build immutable Web and keeper images in CI. Both contain `/app/release-manifests`; the deployment script checks equal v1.5 chain/digest/address manifests and the same reviewed OCI revision before changing services.

The pre-launch gate intentionally expects paused Banks. Opening risk requires a separate Safe transaction after release checks and the approved canary. Subsequent application-only releases must preserve the accepted contract identity; do not use a contract pre-launch deployment command as the routine application restart command.

## Fresh application state

The production Compose project is `arbigamefi-v15`. The database name is `arbigamefi_v15`; Web and both keepers must use that database. New project names create distinct database and keeper-health volumes. Do not restore the old `bets` projection into the new database: its key is `(chain_id, bet_id)`, while a new Hub restarts numbering.

Set `WEB_IMAGE`, `KEEPER_IMAGE` to reviewed `ghcr.io/arbigamefi/ssot-bbog-{web,keeper}@sha256:...` references and `EXPECTED_REVISION` to the full CI source commit. `IMAGE_TAG` and implicit `latest` images are retired. The deployment wrapper validates environment identity, pulls images, checks their embedded releases, then starts services without a build.

Stage the new stack in its own directory. The old Caddy still owns ports 80/443: validate the new services internally and perform the listener handover only in the cutover window. Do not start two Caddy listeners on the same ports or stop the old listener before the new Web is ready. Old and new keepers must not share signing nonce custody during the overlap.

New Sepolia acceptance must cover fresh bets, VRF, settlement/refund, DB and UI, plus restart/index-write-failure recovery and Safe/guardian pause/recovery. Local tests use a Safe configuration mock; they do not prove actual owner signature custody or recovery rehearsal.

## Historical retirement

The 2026-09-22 maintenance operation settled old Sepolia positions 142 and 143 normally. Their transactions are `0xe7af164aa47c80e874abae78e9e6bff5c84953dbf733ea5db94f54447347ba54` and `0x263b6af79d13757b4162d721dc39a5254c77382b9af1e5060fbbf587c0e5e203`. At the subsequent readback, total reserved was zero and the old USDC Bank had 186 held / 186 settled. This does not dispose of remaining LP assets or protocol fees, nor cover every historical deployment.

Remove old active scripts/configuration/containers only after new-chain acceptance and explicit disposal of remaining obligations. Keep the archived source, signed address records, database backup and transaction evidence. Existing historical fixtures remain evidence until their test dependencies and assets are retired; never rewrite them as v1.5 artifacts.

Application rollback must retain the new v1.5 contract addresses and compatible schema. Returning users to v1.4 addresses after v1.5 has accepted bets is not an application rollback.

## Local checks

```sh
FOUNDRY_PROFILE=pr forge test --threads 1 --match-path test/unit/DeploymentV15.t.sol -vv
FOUNDRY_PROFILE=pr forge test --no-match-path test/unit/DeploymentV15.t.sol --match-path 'test/unit/*' -vv
python3 -m unittest discover -s test/ops -v
node --check frontend/scripts/ssot-sync.mjs
bash -n frontend/deploy/docker/deploy-images.sh frontend/deploy/docker/check-production-env.sh
git diff --check
```

The deployment script tests serialize execution because Foundry environment variables are process-wide and are not restored by EVM snapshots. A non-strict `make release-check` skip when no v1.5 artifacts exist is not release acceptance.
