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

## Deployment and application setup

1. Run `make deploy-dryrun` with the intended configuration and network RPC. Review all addresses,
   pool domains, Bank-created Vault bindings, risk and PF/XP outflow buffers, constant 24-hour NFT
   cooldown, game limits, edge allocation and refund timeouts. LP free capital is L−K with no extra
   percentage withdrawal buffer. The official deployment defaults are `riskReserveBps=6000` (60% retained
   for new-risk admission) and independent `withdrawalBufferBps=1000` (10% PF/XP collection buffer).
   Reject missing Vault metadata instead of falling back to Bank.
2. Run `make deploy-v16` with the approved keystore account. Set `SNAPSHOT_PATH` to the generated
   snapshot. The command generates the verification helper from that snapshot using
   `script/tools/gen_verify_helpers.py`. Set `ETHERSCAN_V2_API_KEY` for verification;
   the helper uses the Etherscan V2 endpoint for the snapshot's chain and the default
   compilation profile. Include LiquidityVault source/constructor verification and authenticate
   Bank↔Vault/asset addresses and both codehashes in the signed snapshot. Review and execute `make safe-acceptance-v16` with the Safe owners.
3. Run `make release-v16` and then `make verify-v16` with the configured signer and network. A release contains a
   signed digest, manifest, ABIs and encoding vectors. `make release-v16` runs `script/release/release_v16.sh` from a
   clean checkout through `script/tools/with-ops-rpc.sh infura <network>` (inputs in its header): the governance and
   callback-domain checks, then the only signing step, then notes, manifest, vectors, ABIs, verification and the
   package. The keystore password is read from the terminal and must unlock `RELEASE_SIGNER` in
   `cast wallet address` before anything is signed (Forge's own prompt reports a wrong password only as
   `vm.sign: no wallets available`); three wrong passwords end the run unsigned. A rerun keeps a release lock that
   already verifies for this snapshot and signer and does not ask for the password again; a lock that does not verify
   is never overwritten, nor is an existing package archive. Steps that read the chain are retried only after a
   transport failure. Each step's log is kept in `RELEASE_LOG_DIR` (default `dist/release-run-<UTC time>`) with the
   RPC URL and key replaced.
   Governance verification requires an RPC with historical code and complete authorization logs.
   The signed start block must precede Registry/SportsHub creation. The verifier replays all Hub/pool
   and Sports role grants, rejects undeclared members and checks the same frozen block in Forge.
   A zero optional Sports role declares an empty set; provider or coverage failure rejects the release.
   Logs are read in pages of `GOVERNANCE_LOG_PAGE_BLOCKS` blocks (default 200, the Base public RPC limit). Transient
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
     are the certified ones.
   - The governance check (`verify_governance.py`) replays `GameRegistered` and fails unless the registered game
     set is exactly the certified eight.

   The domain file is `CERTIFIED` for chain 84532 since 2026-10-08, citing certificate v4 (seal
   `d67a7083…`), its erratum and the independent review (`d6c1619c…`) in its `certificateSeal` block. Any
   recertification trigger in ADR-0006 sets it back to `PENDING_INDEPENDENT_REVIEW`, after which every release
   attempt fails by design until a new certificate is accepted. Each chain needs its own certificate.
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

Sports admission is separate. Complete external audit, accepted ordering-risk disclosures, callback gas and chosen
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
uploading that bundle to its GitHub release, run **Release Gate** manually with:

- `release_tag`: the tag for the source commit used to deploy and package;
- `bundle_name`: the exact release asset filename;
- `bundle_sha256`: the independently approved SHA-256 of that archive;
- `audited_source_tree`: the git tree hash of the externally audited source (from the audit report and the
  freeze commit record). It must equal the repository variable `V16_AUDITED_TREE`, which the Owner sets from the
  same report, so one person typing a tree hash cannot pass the gate alone; every job refuses a tag whose tree
  differs from either, and `release-ready` prints the value for the approver.

The workflow downloads that exact asset, checks the digest, commit and file
inventory, and rejects unsafe archive members before staging it. It then runs the
strict snapshot/signature/manifest/ABI checks, proof gates and live governance/fork
gate. Required repository signer and RPC settings remain mandatory. A tag push
alone does not validate a release without its deployment bundle. Source audit
packaging is not a replacement for these deployment checks.

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
