# Deploy the current contracts

The project is in development and has not launched. The [NFT-deposit/callback target](../design/lp-accounting-and-callback-implementation.md)
is implemented in the core contracts and application interfaces; release qualification is pending.
Current status is in the [release notes](../release/README.md). v1.6 is the only supported contract and release
format. Start with a fresh deployment, a fresh database schema, and the current application build.
Use the [Base Sepolia acceptance checklist](v16-sepolia-acceptance.md) to qualify the fresh NFT candidate.

## Before deployment

- Implement and verify NFT deposits, original-tree allocation and dual-custody accounting, durable same-callback settlement and every required
  consumer change. Remove abandoned interfaces and adapter fields, regenerate one ABI/release schema,
  then run the complete scenario matrix and independent review before freezing the final audit scope.
- Pin and license the verified tree sources; verify Bank constructor/initcode and Vault runtime size.
  Measure the full wrapper/tree callback and re-read coordinator limits; qualify every admitted game/round
  limit. Preserve the accepted LP ordering tradeoff and verify its public disclosure before outside funding.
  A previous standalone finalize
  budget or deployed test receipt is not evidence for this candidate.
- Configure the final Safe governance, guardian, keeper, signer, assets and VRF wrapper explicitly.
  Use `v16/chain-84532.env.example` as a template, replacing every placeholder.
  The first deployment is Base Sepolia with exactly one USDC casino pool.
- Re-read Safe code, owner and control hashes. Use current generated ABIs; a build without a verified
  imported manifest intentionally has no connected pools.
- Rehearse the steps below on the commit first:
  `test/fixtures/deploy-rehearsal.sh [new directory outside the repository] [commit]` runs the preflight, the deploy
  copy, the gated broadcast, the Safe's wiring from the copy and release-mode verification on a fork of the public Base
  Sepolia RPC, with mock Safe and guardian multisigs, an impersonated Safe and a throwaway keystore, in an environment
  stripped of inherited endpoints, wallets and Foundry settings. It uses no operator or production key (only the
  fixtures' public test key and a throwaway keystore), sends nothing to a real chain and ends with `E2E PASS` (about
  two minutes). It does not cover explorer verification, signing and packaging, Release Gate, the activation or the
  applications.

## Deployment and application setup

1. Run the preflight on the commit to deploy, with a roles file of public addresses (the deployer, the Safe with its
   owners and threshold, the guardian multisig with its owners and threshold, the release signer and the keeper; the
   format is in `script/release/read_chain.py`) and an output directory that does not exist yet:

   ```bash
   script/tools/with-ops-rpc.sh alchemy base-sepolia \
     bash script/release/run_preflight.sh <commit> <roles.json> <preflight directory>
   ```

   It needs no signing key and sends nothing. It works in a `git archive` of the commit outside the repository and
   stops at the first failure; `STAGES.tsv` lists the stages and `logs/` keeps their output with the RPC URL and key
   replaced.
   - `read-chain` (`read_chain.py`) reads everything at one block. It fails unless the Safe is exactly the reviewed
     2-of-3 of the listed owners with no module or guard; the guardian is a multisig of at least two signers, none of
     them a Safe signer; the deployer, keeper and signer have no code (no EIP-7702 delegation); the deployer is funded
     and its latest and pending nonces are equal (which shows only that the RPC node sees no pending transaction, not
     that none waits elsewhere); the roles are distinct, and neither a role nor a signer of the Safe or the guardian is
     the governance key exposed on the old production host; and the token, the VRF provider and the domain file are the certified ones. It fills
     `chain/deploy-params.env` from `v16/chain-<chainId>.env.example`.
   - `dry-run` runs `DeployV16` at that block with the deployer as sender. `verify-plan` (`verify_dryrun_plan.py`)
     accepts only the expected creations, in order: nonces, addresses, init code and constructor arguments, the Vault
     each Bank creates, the certified runtimes and the Owner policy parameters (`plan-review.json`).
   - `rehearsal` repeats the deployment on a local anvil fork of that block, then the Safe's wiring (scheduled, 72
     hours, executed), release verification, the deployed runtimes against the certified build and the live provider,
     then the activation and live verification. The rehearsed creations must equal the plan.

   A passed run writes `PREFLIGHT.txt`: commit, tree, chain, block, deployer and first nonce, the timelock address and
   the SHA-256 of the parameters, the plan and the domain file. Review the readback, the plan review and the
   parameters: all addresses, pool domains, Bank-created Vault bindings, risk and PF/XP outflow buffers, constant
   24-hour NFT cooldown, game limits, edge allocation and refund timeouts. LP free capital is L−K with no extra
   percentage withdrawal buffer. The official deployment defaults are `riskReserveBps=6000` (60% retained for new-risk
   admission) and independent `withdrawalBufferBps=1000` (10% PF/XP collection buffer). Reject missing Vault metadata
   instead of falling back to Bank. Run the preflight again, unchanged, right before the broadcast.
   The deployment follows ADR-0037 decision D1: the `GovernanceTimelock` is deployed first (delay 259,200 s,
   proposer the Safe, cancellers the Safe and the guardian, anyone executes) and every governed contract is
   constructed with it as governance, so the deploying key holds no role at any time and the script wires nothing.
   Before anything is broadcast the script rehearses the two release operations on the simulated deployment (the
   Safe schedules, 72 hours pass, anyone executes), checks the results as release verification does and restores
   the simulated state; a batch that would revert or wire something else stops the deployment.

2. Prepare the deploy copy; the Owner broadcasts from it:

   ```bash
   bash script/release/prepare_deploy_copy.sh <preflight directory> <copy directory>
   DEPLOY_ACCOUNT=<keystore name> script/tools/with-ops-rpc.sh infura base-sepolia \
     bash script/release/broadcast_v16.sh <preflight directory>
   ```

   The copy is the preflight's commit with its `deploy-params.env`, in a directory outside the repository: forge loads
   a `.env` it finds in the project or above, and the repository's `.env` holds API keys, so neither the copy nor a
   directory above it may hold one. `broadcast_v16.sh` asks for nothing until the preflight passed with the chain's
   certified domain file (not a test override) and was not broadcast, the copy is of its commit and still holds its
   parameters, the RPC is on its chain, the deployer has no code and its latest and pending nonces both equal the
   plan's first nonce, and a keyless simulation against the current chain produces exactly the preflight's plan. The
   Owner then types `BROADCAST` and the keystore password, which must unlock the deployer in `cast wallet address`;
   three wrong passwords end the run with nothing sent. The broadcast files, `broadcast.log` and the snapshot are kept
   in the preflight directory; the snapshot also stays at `deployments/latest-v16.json` in the copy, and the RPC that
   forge records there for each transaction has its key replaced on exit. A broadcast is never resumed: if forge fails
   partway, inspect `broadcast.log` and the transactions sent before anything else; a new preflight starts from the
   deployer's current nonce.
   Verify the sources from the copy, which compiles the deployed commit. `script/tools/with-etherscan-key.sh` passes
   `ETHERSCAN_V2_API_KEY` from the repository `.env` and replaces it in every output line (Owner, 2026-10-15):

   ```bash
   script/tools/with-etherscan-key.sh env SNAPSHOT_PATH=deployments/latest-v16.json make -C <copy directory> verify-v16
   ```

   It generates the verification helper from the snapshot using `script/tools/gen_verify_helpers.py`; the helper uses
   the Etherscan V2 endpoint for the snapshot's chain and the default compilation profile. Include LiquidityVault
   source/constructor verification and authenticate Bank↔Vault/asset addresses and both codehashes in the signed
   snapshot.
   Then prepare the Safe's timelock operations, also in the copy (`script/release/PrepareTimelockBatchesV16.s.sol`):

   ```bash
   SNAPSHOT_PATH=deployments/latest-v16.json script/tools/with-ops-rpc.sh alchemy base-sepolia \
     make -C <copy directory> timelock-batches-v16
   ```

   On a fork with the deployed addresses it rehearses what is left of both operations and writes, under
   `deployments/` in the copy, `safe-schedule-wiring-v16.json` and `safe-schedule-activation-v16.json` (Safe
   Transaction Builder files, one `scheduleBatch` call on the timelock each) and `timelock-operations-v16.json` (every
   call with its contract and function, both operation ids and states, and the `executeBatch` calldata). The Safe
   owners review the calls and schedule the wiring; publish the operations file for the 72-hour review. The wiring
   binds the routers, randomness consumers, guardians and sentinels, sets the Bank parameters that differ from the
   constructor defaults, registers the pool, the hub, its route and the eight certified games, and leaves every pool
   inactive. Anyone executes it once ready; LPs can then deposit and nobody can bet.

3. Once the wiring has executed, run `make release-v16` with the configured signer and network. A release contains a
   signed digest, manifest, ABIs and encoding vectors. `make release-v16` runs `script/release/release_v16.sh` from a
   clean checkout of the deployed commit, with the copy's snapshot at `deployments/latest-v16.json`, through
   `script/tools/with-ops-rpc.sh infura <network>` (inputs in its header): the governance and
   callback-domain checks, then the only signing step, then notes, manifest, vectors, ABIs, verification and the
   package. The keystore password is read from the terminal and must unlock `RELEASE_SIGNER` in
   `cast wallet address` before anything is signed (Forge's own prompt reports a wrong password only as
   `vm.sign: no wallets available`); three wrong passwords end the run unsigned. A rerun keeps a release lock that
   already verifies for this snapshot and signer and does not ask for the password again; a lock that does not verify
   is never overwritten, nor is an existing package archive. Steps that read the chain are retried only after a
   transport failure. Each step's log is kept in `RELEASE_LOG_DIR` (default `dist/release-run-<UTC time>`) with the
   RPC URL and key replaced.
   Governance verification requires an RPC with historical code and complete authorization logs.
   The signed start block must precede the timelock's creation. The verifier replays the timelock's roles, delay
   and operations and every authority event of PoolRegistry, GameHub, ReferralRegistry and each Bank, rejects any
   hub, route, game, role or governance transfer the release does not declare and checks the same frozen block in
   Forge (`VerifyGovernanceV16`). Provider or coverage failure rejects the release. `GOVERNANCE_VERIFY_MODE=release`
   (the default, used for signing and the Release Gate) requires the pre-launch release state: the wiring executed
   and nothing else, the activation at most scheduled, every pool inactive, no pause, disabled game or void window.
   `GOVERNANCE_VERIFY_MODE=live` (the frontend import) checks a deployed release at any later time: the authority
   exactly as released, reductions (a pause, an inactive pool, a deregistered hub or route, a disabled game)
   reported as notes, and an active pool only after the release's activation executed.
   The release record signs the governance checkpoint of the signing run (`checkpointSha256`, block and block hash)
   together with the snapshot digest; the package ships it as `deployments/governance-checkpoint-latest-v16.json`,
   and the Release Gate, the image import and the drift monitor replay from that block.
   Logs are read in pages of `GOVERNANCE_LOG_PAGE_BLOCKS` blocks. The default follows the endpoint: 10,000 through
   `with-ops-rpc.sh infura`, 10 through `with-ops-rpc.sh alchemy` (its free tier), otherwise 200, under the 201 that
   Base's public RPC accepts. Since Base Denim (five blocks a second) a day is 432,000 blocks: 44 pages on Infura,
   2,160 on the public RPC. The Release Gate and the image import replay on the public RPC from the signed checkpoint:
   each day after signing adds about 2,160 pages, about an hour at the 1.7 seconds a page measured on Base Sepolia's
   public RPC (2026-10-14). Dispatch both on the day of signing; the Release Gate's 240-minute limit leaves about three
   days and the image workflow's 180 minutes about two. Transient
   provider failures (HTTP 408, 425, 429 and 5xx, dropped connections) are retried with backoff (`RPC_MAX_ATTEMPTS`,
   default 6; `RPC_BACKOFF_SECONDS`, default 1); errors name the HTTP status or JSON-RPC code, never the URL. Each run
   prints `checkpointSha256` and, with `GOVERNANCE_CHECKPOINT_OUT`, writes the replayed state. A later run starts from
   it with `GOVERNANCE_CHECKPOINT` only when `GOVERNANCE_CHECKPOINT_SHA256` comes from a signed record. Run the check
   locally through `script/tools/with-ops-rpc.sh infura <network>` with `RPC_URL="$OPS_RPC_URL"`; CI uses the Base
   public RPCs.
   Release verification also checks the first-callback certificate domain for the snapshot's chain
   (`script/release/first-callback-domain-<chainId>.json`). `make release-v16` runs this check before anything is
   signed, as `release-domain-check`.
   - `VerifyCallbackDomainV16.verify` works offline. It fails unless:
     - the certificate status is `CERTIFIED`;
     - each game uses the certified callback gas and at most the certified round count;
     - each module runtime matches the certified codehash;
     - each casino pool's minimum bet is at least the floor that keeps k > 0 and equals the Owner policy value
       (10,000), its risk reserve is 6000 bps, its withdrawal buffer 1000 bps, and its asset is the certified token;
     - the VRF wrapper is the certified one.
   - With `RPC_URL` set (`release-domain-check` always sets it), `VerifyCallbackDomainV16.run` forks the chain and
     compares every deployed core contract (VRFHub, GameHub, SettlementRouter, PoolRegistry, ReferralRegistry,
     DefaultReferralEngine, each Bank and Vault) with the certified build: immutable slots must hold the release
     values, the remaining code must hash to the certified artifact, and the constructor wiring must match the
     snapshot. `script/ci/fork_release_gate.sh` repeats this at the governance block. Without `RPC_URL` the script
     prints `WARNING: RPC_URL not set; deployed core runtimes were NOT verified (offline mode)` before its `OK`
     line and skips only this part; with `CALLBACK_REQUIRE_FORK=1` (the fork gate sets it) a missing `RPC_URL`
     fails instead.
   - `verify_callback_provider.py`, also part of `release-domain-check`, checks the live token and provider at
     one frozen block. It fails unless the USDC implementation and code, the coordinator and its gas parameters
     are the certified ones, and unless the coordinator's minimum request confirmations are at most the 3 that
     `GameHub.placeBet` requests: a higher minimum rejects every VRF request, so every new bet would revert.
   - The governance check (`verify_governance.py`) replays `GameRegistered` and fails unless the registered game
     set is exactly the certified eight.

   The domain file for chain 84532 was `CERTIFIED` from 2026-10-08, citing certificate v4 (seal `d67a7083…`), its
   erratum and the independent review (`d6c1619c…`) in its `certificateSeal` block. Any recertification trigger in
   ADR-0006 sets it back to `PENDING_INDEPENDENT_REVIEW`, after which every release attempt fails by design until a
   new certificate is accepted. Work package B changes certified runtimes, so since B9 (2026-10-11) the file is
   `PENDING_INDEPENDENT_REVIEW` with pins regenerated from the current build. The launch candidate's certificate v5
   (seal `5726389a…`, computed on freeze commit `1a5e9df00`) replaces v4. Its independent review accepted it on
   2026-10-15 (`independent-review-certificate-v5-2026-10-15/MANIFEST.sha256`, `2a7b8591…`), and the file is
   `CERTIFIED` again, citing both seals. Each chain needs its own certificate.

4. Run the authenticated **Frontend Docker Images** workflow on the same source commit with the
   signed bundle's release tag, exact filename, approved SHA-256, and `chain_id=84532`. Configure the
   independent `V16_RELEASE_SIGNER` repository variable. The workflow verifies the archive's source
   revision, artifact consistency, signature and live governance, then imports only the selected chain.
   Amount precision and symbols come from the signed snapshot; a failed verification cannot replace
   active metadata. Ordinary PR/push image builds do not publish deployment images.
   The importer first copies the bundle's files once into a private directory, taking regular files only (a link is
   refused), and validates and activates those same bytes. Its manifest must be exactly what
   `GenerateFrontendManifestV16` writes for the signed snapshot, apart from `gitSha` and `generatedAt` and the case
   of hex strings, so no field reaches the frontend unchecked; the strict release check applies the same comparison.
   JSON with a repeated key and pool IDs above 2^53 − 1 (the largest exact JavaScript integer) are rejected.
5. Configure a fresh PostgreSQL database and one keeper using Infura HTTP plus Alchemy WebSocket.
   The keeper initializes the current schema and replays the selected Hub from its release block.
   Use [Docker deployment instructions](../../frontend/deploy/docker/README.md) to pin both immutable
   image digests, the reviewed source revision, chain ID and expected release digest before startup.
   Browser RPC remains public. Casino and LP deposit feature flags default off on both supported
   chains until the appropriate acceptance stage; enable them only in the reviewed acceptance image. Contract pause and available capital remain independent admission checks.

## RPC endpoints

Every local operator step that reads or writes the chain gets its endpoint from `script/tools/with-ops-rpc.sh
<infura|alchemy> <base-sepolia|base> <command>`, which builds it from the repository `.env`, hands it to the command
as `OPS_RPC_URL` and replaces the key in every line the command prints. The wrapper cannot redact files, so the
operator scripts replace the key in the logs and records they write themselves. No key is ever typed on a command
line.

| Key                                                         | Used for                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALCHEMY_API_KEY_OPS` (`alchemy`)                           | preflight and its fork rehearsal, `make timelock-batches-v16`, the gas matrix; a free-tier key, so never a log scan (`eth_getLogs` takes at most 10 blocks)                                                                           |
| `INFURA_API_KEY_OPS` (`infura`)                             | broadcast, release signing (`release_v16.sh`), governance replay, K0-4 on the operator's machine, and the mainnet backup keeper's HTTP endpoint (Owner, 2026-10-14)                                                                   |
| `INFURA_API_KEY_PROD_KEEPER`, `ALCHEMY_API_KEY_PROD_KEEPER` | the production keeper's HTTP and WebSocket endpoints, on the server only; the Owner writes them there with `script/ops/send-keeper-rpc.sh` ([production rebuild](../ops/runbooks/production-rebuild.md)), and no local step uses them |

The browser and the web server use the Base public RPCs, and so do CI and the K0-4 monitor on the production host
for Base Sepolia (Owner, 2026-10-15; a dedicated key before mainnet), with no key. Source verification uses
`ETHERSCAN_V2_API_KEY` through `script/tools/with-etherscan-key.sh` only.

## From deployment to betting

The governance timelock sets the earliest dates; each operation waits at least 72 hours after the Safe schedules it.

| When                  | Step                                                                                                                                          | State afterwards                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| day 0                 | preflight again, broadcast (step 2); the Safe schedules the wiring and the operations file is published; K0-4 announces it                    | contracts exist, nothing wired                                                      |
| day 3 at the earliest | anyone executes the wiring                                                                                                                    | pool registered and inactive: LPs can deposit, nobody can bet                       |
| after the wiring      | release signed and packaged (step 3, release mode), Release Gate `release-ready`, images built and imported (step 4), stack deployed (step 5) |                                                                                     |
| after the release     | the Safe schedules the activation, whose predecessor is the wiring; published and announced as before                                         |                                                                                     |
| day 6 at the earliest | anyone executes the activation                                                                                                                | betting open; testnet acceptance follows the [checklist](v16-sepolia-acceptance.md) |

Until an operation is ready, the Safe or the guardian can cancel it; once ready, anyone can execute it (ADR-0037 D5).
The Safe, as sentinel, or the guardian pauses a Bank at once (`setRiskInPaused(true)`); unpausing is a timelock
operation and waits another 72 hours.

## Network acceptance

Verify addDeposit/addDepositFor and mature withdrawDeposit by NFT ID and 1e12 fraction. Asset
approval targets Vault; withdrawal requires the current owner and pays that owner. Check per-deposit
24-hour maturity, partial-success relock, transfer-preserved deadlines, full burn, zero-value close,
liquidity limits and same-receipt payment. Verify the browser immediately reduces capital/max bet.
No withdrawal schedules a betting pause. Reconcile Vault root L, K=R−P, G=L+P, both cash balances,
surplus and PF/XP/player debts at one block. Exited capital has no subsequent claim. Exercise fixed
cutoff allocation, full-tree fallback and empty-root protocol capital, not just a happy-path withdrawal.

Normal wrapper fulfillment must persist the seed and settle without a keeper transaction. Force a
callback failure, verify the canonical LP gate and retained seed, then retry to one terminal payment
and one acknowledgment. Verify genuine missing-randomness timeout refunds and refusal to refund a
received result. Exercise failed token payment, original-player debt claim and native fee credits.

Keep Infura HTTP and Alchemy WS; prove real subscription ingestion, disconnect/reconnect, HTTP catch-up,
terminal event indexing, duplicate/reorg handling, process restart, alert delivery and Safe pause/unpause.
Payable discovery and provider cash history may wait for finalized blocks; monitor this coverage separately
from live Bank reads. Normal callback completion and live capital refresh do not wait for those scanners.

Complete external audit, accepted ordering-risk disclosures, callback gas and chosen
business-load qualification before outside LP funding. Local mocks cannot prove signer custody, actual
Safe execution, provider availability or deployed-network behavior.

## Reproducible source and deployment inputs

`make audit-package` packages a clean, committed source tree, including frontend,
current ABI inventory, dependency locks, tests and audit documents. It records the
full commit and tree in `SOURCE_REVISION` and `SOURCE_TREE` and checksums the
export. It needs no deployment or signing key and does not assert that tests passed.
Keep the test logs and audit verdict bound to that same revision.

`make release-package` also requires a clean commit. Its archive includes
`SOURCE_REVISION` and the Etherscan verification helper generated from the packaged snapshot; a local
`deployments/verify-latest-v16.sh` that differs from it (left from another deployment) stops the package, and an
existing archive of the same name is never rewritten. Deployment inputs remain ignored generated artifacts. After
uploading that bundle to its GitHub release, run **Release Gate** from the release tag, so that the gate which runs is
the tagged commit's own `release.yml`, not whatever the default branch holds:

```bash
gh workflow run release.yml --ref <release_tag> -f release_tag=<release_tag> -f bundle_name=<asset> \
  -f bundle_sha256=<approved sha256> -f audited_source_tree=<tree>
gh run view <run id> --json headSha,event,jobs \
  --jq '{headSha, event, jobs: [.jobs[] | {name, conclusion}]}'
```

The inputs:

- `release_tag`: the tag for the source commit used to deploy and package;
- `bundle_name`: the exact release asset filename;
- `bundle_sha256`: the independently approved SHA-256 of that archive;
- `audited_source_tree`: the git tree hash of the source the accepted audit covers. For the launch candidate that is
  the tree the professional external audit accepted, after its fix review, as recorded in the freeze commit record.
  It must equal the repository variable `V16_AUDITED_TREE`, which the Owner sets from that record, and every job
  refuses a tag whose tree differs from either. Unset since the 2026-10-11 clean slate, the variable makes every
  gate fail until the Owner records the accepted tree.

Accept the run only when `headSha` is the tag's commit, `event` is `workflow_dispatch`, and the jobs are exactly
`tree-equivalence-gate`, `proof-gates (unit)`, `proof-gates (diff)`, `proof-gates (invariants)`, `release-gate` and
`release-ready`, all successful; judge the release on `release-ready`, which prints the tag, tree and bundle for the
approver. The two tree values catch a wrong tag or a mistyped tree; they are not a two-person control. The repository
has no environment, ruleset or branch protection, so whoever can set repository variables and dispatch workflows can
pass the gate alone.

The workflow downloads that exact asset, checks the digest, commit and file
inventory, and rejects unsafe archive members before staging it. It then runs the
strict snapshot/signature/manifest/ABI checks, proof gates and live governance/fork
gate. The release signer comes from the repository variable `V16_RELEASE_SIGNER`; the governance replay and fork gate
use the Base public RPCs and need no RPC secret. A tag push alone does not validate a release without its deployment
bundle. Source audit packaging is not a replacement for these deployment checks.

The ABI comparison reads `out/`, so the strict release check and the image import build it themselves
(`forge build src`) and then run `script/release/check_current_build.py`: every artifact the ABIs are compared with
must name its contract as compilation target, come from the solc build pinned in `deps.lock` and record the
keccak256 of each of its source files as they are in the checkout. No workflow step has to build first. The
**Release Path** workflow runs the release gate's offline steps and the image import on fresh checkouts, in workflow
order, with a release of the locally deployed `ReleaseImportFixture`, on every push that touches the release path
(`script/ci/release_path.sh`).

The fork gate explicitly enables `NftDirectWrapperFork.t.sol` and requires all four tests to
execute and pass. It uses the authenticated snapshot's wrapper, USDC and CoinToss gas limit at the
fresh block returned by governance verification. Historical block/wrapper overrides are rejected.
This gate currently supports the first single-USDC casino pool; it checks real wrapper/token
integration for one round, not every game's maximum-complexity callback gas. The standalone test
without explicit targets is a separate reproducible historical reference and cannot qualify a release.
