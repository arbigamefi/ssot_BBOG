# Base Sepolia NFT release acceptance

This checklist applies to the current NFT liquidity and direct-callback implementation. The project
has not launched. Current status is in the [release notes](../release/README.md);
SDK, Earn and keeper have corresponding local verification. Final candidate binding and fresh network
acceptance remain incomplete. Do not mark a step complete
without the corresponding candidate's source identity, receipt and accounting evidence.

## Deployment inputs

- Base Sepolia, chain ID `84532`, exactly one USDC casino pool; Sports disabled.
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, six asset decimals, verified again before deployment.
- Intended governance: 2-of-3 Safe `0x7F0c244e1701B069727670745FD047179Ef8691d`; re-read owners,
  threshold, modules, guard and code hashes before signing.
- Explicit deployer, guardian, metadata signer, keeper, wrapper and per-game callback admission from
  the [configuration template](v16/chain-84532.env.example). USDC minimum per round is 0.01,
  with at most 25 rounds (0.25 USDC at that minimum); qualify each game's full callback gas.
- Public browser RPC; Infura HTTP plus Alchemy WebSocket for keeper. Credentials stay out of artifacts.

Freeze the source commit/tree, Solidity 0.8.37 configuration, dependency identities, source bundle,
release digest, ABI inventory, Bank/Vault code hashes and immutable bindings. Record the new release
start block and exact web/keeper image digests. All listed identities must agree before funding.

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
- Record gas for qualified game limits and tree/referral/token paths against current wrapper/coordinator
  limits. A single-round fork or successful retry does not qualify an over-budget normal callback.

## Application and operations acceptance

Use a fresh database and the same authenticated deployment metadata in web and keeper. Verify NFT
ownership/positions, cash events, multiple events per receipt, same-transaction ready/finalized events,
block hashes, rollback on reorg and replay after restart. A transfer is not an LP deposit or withdrawal.

Prove Alchemy WS ingestion, disconnect/reconnect, Infura HTTP catch-up and terminal indexing. A normal
callback completion must not cause an unnecessary keeper finalize transaction. Retry actual failures,
submit eligible missing-seed refunds and distinguish harmless terminal races from operational failures.
Verify alert delivery and Safe pause/unpause/guardian replacement with current receipts and readbacks.

## Release decision

Record each scenario as passed, failed or not executed, linked to its receipt/log and exact source.
Require completed SDK/Earn/keeper integration, independent review, callback gas qualification and the
accepted external-LP ordering-risk disclosures. The user's economic decision is recorded in
[ADR-0034](../adr/0034-nft-liquidity-deposits.md#pre-inclusion-ordering-owner-decision-2026-10-04); it does not qualify gas or
deployment. Capacity acceptance awaits the user-defined business peak.
Follow the [release procedure](v16-release.md) for user-controlled signing and deployment. Testnet
transactions, local tests and this checklist do not constitute external audit or production acceptance.
