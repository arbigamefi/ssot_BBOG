# Base Sepolia NFT release acceptance

This checklist applies to the launch candidate: NFT liquidity, direct-callback settlement and the governance of
[ADR-0037](../adr/0037-launch-candidate-authority-pause-capacity-void.md). The project has not launched. Current status
is in the [release notes](../release/README.md). The fresh deployment follows the Base Denim activation on Base Sepolia
and runs alongside the external audit (Owner, 2026-10-15); a contract change the audit requires means a new deployment
and a new acceptance. Do not mark a step complete without the corresponding candidate's source identity, receipt and
accounting evidence.

## Deployment inputs

- Base Sepolia, chain ID `84532`, exactly one USDC casino pool.
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, six asset decimals, verified again before deployment.
- The callback domain file `script/release/first-callback-domain-84532.json` is `CERTIFIED` by certificate v5 and its
  independent review. The broadcast refuses a preflight that ran on another domain file (`domainOverride=yes`).
- A roles file of public addresses for the preflight (format in `script/release/read_chain.py`):
  - the governance Safe, exactly the reviewed 2-of-3 of the listed owners with no module or guard (intended
    `0x7F0c244e1701B069727670745FD047179Ef8691d`; re-read owners, threshold, modules, guard and code hashes before
    signing);
  - the guardian, an independent multisig of at least two signers, none of them a Safe signer;
  - the deployer, the release signer and the keeper: distinct accounts with no code (no EIP-7702 delegation), none of
    them the governance key exposed on the old production host; the deployer funded for the deployment.
- Public chain parameters from the [configuration template](v16/chain-84532.env.example), which the preflight fills
  in. USDC minimum per round is 0.01, with at most 25 rounds (0.25 USDC at that minimum); qualify each game's full
  callback gas.
- Public browser RPC; Infura HTTP plus Alchemy WebSocket for keeper. Credentials stay out of artifacts.

Freeze the source commit/tree, Solidity 0.8.37 configuration, dependency identities, source bundle,
release digest, ABI inventory, Bank/Vault code hashes and immutable bindings. Record the new release
start block and exact web/keeper image digests. All listed identities must agree before funding.

## Base Denim (plan A13)

Base Sepolia makes five blocks a second from 2026-10-21 18:00 UTC; `block.timestamp` stays in whole seconds. The
off-chain tools measure durations in seconds and use block counts only to bound one RPC query. Local tests model this
cadence; they are not the live runs below.

- Before the preflight, run `script/ops/denim-activation-check.sh` on the activated chain and seal its directory. It
  must report Denim active, a block gas limit that still fits a void transaction, the `pending` block, the provider
  and USDC as in the domain file, and the direct-wrapper fork test passing at the same post-activation block. Record
  the result in plan §13.
- The preflight's and the broadcast's nonce gate: the deployer's `latest` and `pending` nonces are equal. It shows
  only what the RPC node sees.
- One live run each, recorded with its logs:
  - **keeper:** scans reach the head and `scan` health is not degraded once they do; a restart resumes payable
    discovery from `KEEPER_STATE_DIR` when the saved block's hash matches the chain, and replays from the release block
    otherwise; a failed save degrades `payables`.
  - **K0-4:** armed on the release; confirmations counted in seconds (`DRIFT_CONFIRMATION_SECONDS`, 24); the wiring
    and the activation announced on the operations and public channels; an alert delivered and its recovery reported;
    edge and referral changes reported as governance events.
  - **governance replay:** `verify_governance.py` in live mode from the signed checkpoint over the deployment's
    blocks, paging by the endpoint.
- Web and browser: the receipt fallback shows a settled bet's placement and terminal transactions; the browser index
  confirms after 24 seconds and rereads 48 seconds; the operations page judges indexer lag in seconds.

## LP acceptance

1. Approve Vault and deposit. Confirm the exact cash transfer, new NFT ID/current owner, tree capital
   L and deadline at deposit time plus 86,400 seconds. A second deposit creates another independent NFT.
2. Verify early withdrawal rejection and deadline preservation on NFT transfer. NFT operator approval
   does not permit cash withdrawal; the owner withdraws and receives the cash.
3. At maturity, verify the displayed amount and executable 1e12 fraction against the same block's
   `min(nodeValue, L-K)`. Confirm payment and capital reduction in the withdrawal receipt itself.
4. Confirm partial success restarts the remainder's 24-hour deadline; failure leaves it unchanged.
   Full withdrawal burns the NFT; a mature zero-value NFT can be closed without a cash payment.
5. Verify game capital and maximum bet refresh after the receipt. Withdrawal does not initiate a
   betting pause. Exited capital has no later PnL or recovery claim.
6. Reconcile both token balances, L/P/R/K/G, surplus and all PF/XP/player liabilities at one block.
   A wallet NFT count is not a cash balance; donations do not become tree capital.

## Betting and settlement acceptance

- Confirm a normal real wrapper callback records the canonical seed and settles the bet in the same
  transaction, with actual player payment, referral/protocol accounting, tree PnL and result acknowledgment.
- Exercise a failed terminal child call: the seed remains recorded, LP cash operations are blocked
  for that Bank, and a public retry/finalize uses exactly that seed and pays only once.
- Verify a genuine missing-randomness bet becomes refundable after its snapshotted one-hour deadline.
  A received seed cannot be refunded as missing, even if GameHub has not yet recorded delivery.
- Verify failed player transfer records debt without double-debiting LP capital; claims pay the original
  player. Separately exercise actual wrapper-native charges, excess return and failed-return credits.
- A player holds at most 2 open positions; a third bet reverts. A Bank holds at most 128, and K0-4 raises its
  capacity alert at 96.
- Record gas for qualified game limits and tree/referral/token paths against current wrapper/coordinator
  limits. A single-round fork or successful retry does not qualify an over-budget normal callback.

## Governance and safety acceptance (ADR-0037)

- The wiring and the activation each wait 72 hours after the Safe schedules them; the operations file is published,
  K0-4 announces both, and anyone executes them once ready. After the wiring the pool is registered and inactive (LPs
  can deposit, nobody can bet); after the activation betting is open.
- Cancel a queued operation (Safe or guardian) before it is ready.
- Pause a Bank at once (the Safe as sentinel, or the guardian): new bets and deposits stop, LP withdrawals continue;
  unpause through the timelock, 72 hours.
- Replace the guardian through the timelock.
- Disable a game: immediate and irreversible (a new game ID is registered through the timelock).
- Open a void window for a Bank with an unbookable result (Safe or guardian). Anyone may then call `voidBet` on a bet
  of its cohort 24 hours after its VRF request, and on any other unbookable bet after 7 days; `voidBet` first
  attempts the settlement and voids only if that fails.
- Queue an edge change (72 hours, plus the existing 7 days) and cancel it at once.

## Application and operations acceptance

Use a fresh database and the same authenticated deployment metadata in web and keeper. Verify NFT
ownership/positions, cash events, multiple events per receipt, same-transaction ready/finalized events,
block hashes, rollback on reorg and replay after restart. A transfer is not an LP deposit or withdrawal.

Prove Alchemy WS ingestion, disconnect/reconnect, Infura HTTP catch-up and terminal indexing. A normal
callback completion must not cause an unnecessary keeper finalize transaction. Retry actual failures,
submit eligible missing-seed refunds and distinguish harmless terminal races from operational failures.
Verify alert delivery with current receipts and readbacks.

## Release decision

Record each scenario as passed, failed or not executed, linked to its receipt/log and exact source.
Require completed SDK/Earn/keeper integration, independent review, callback gas qualification and the
accepted external-LP ordering-risk disclosures. The user's economic decision is recorded in
[ADR-0034](../adr/0034-nft-liquidity-deposits.md#pre-inclusion-ordering-owner-decision-2026-10-04); it does not qualify gas or
deployment. Capacity acceptance awaits the user-defined business peak. Certificate v5 covers Base Sepolia only; Base
mainnet needs its own certificate.
Follow the [release procedure](v16-release.md) for user-controlled signing and deployment. Testnet
transactions, local tests and this checklist do not constitute external audit or production acceptance.
