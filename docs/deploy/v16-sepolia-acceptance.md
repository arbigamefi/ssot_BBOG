# Controlled Base Sepolia acceptance

This is a dated acceptance record for a testnet candidate, not a production launch or admission of
outside LP funding. Source changes made after this revision do not update the deployed immutable
contracts and need their own review, source identity and release.

## Deployed identity — 2026-10-02

| Input | Verified identity |
| --- | --- |
| Source | `5efbb07cd991b61b8074be7d1a3803b5dba46392` |
| Source tree | `b69c87c419e5bc892886996b04f4ae30cca98e57` |
| Release | [base-sepolia-v16-20261002](https://github.com/arbigamefi/ssot_BBOG/releases/tag/base-sepolia-v16-20261002) |
| Archive SHA-256 | `b04832d239610b7fa6eedfecffea91ae473684d4e6358e8c0fb70563080e8499` |
| Release digest | `0x7e7c13d4840206f08c05776cab7b2a2c6d9faa3c8a67219bd1729eb2c74d6582` |
| Chain / release start block | Base Sepolia `84532` / `47577983` |
| Casino pool / asset | Pool `1` / USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Bank | `0xC8203DA055Fd6Cf917FBD73209C8b2A5a1B6ed56` |
| GameHub | `0x041b23dE0F65ADcbdAC0e997F2526D47D0A52959` |
| Governance | 2-of-3 Safe `0x7F0c244e1701B069727670745FD047179Ef8691d` |
| Sports | Disabled; no Sports pool admitted |

[Release Gate](https://github.com/arbigamefi/ssot_BBOG/actions/runs/36980500524) executed signature,
artifact, governance and fork checks. The fork case entered PendingVRF; it did not itself prove a
live VRF callback or payment. Those paths have separate receipts below.

The running web and keeper were read back on the deployment host. Both embed this same chain,
release digest, Hub and Bank and carry the source revision above. Their immutable OCI indexes are:

- Web: `sha256:e3888bed8c46493fb74515a10050d91ec9c8e11ebe350efafe6e7346956d71e2`.
- Keeper: `sha256:1f638f29d2fa10031d96148981a7d1251dd3c472b96854ea8ee017e9613cff7a`.

Each index contains the amd64 image reported by the successful
[image build](https://github.com/arbigamefi/ssot_BBOG/actions/runs/36986250169), and that child image's
config digest matches the running container's image ID. Casino and LP deposit flags are explicitly
enabled for this controlled test; Sports stays disabled.

## Completed evidence

- [20 USDC deposit](https://sepolia.basescan.org/tx/0x25b6948d616642f6c43850eb293b7c1a0a5ac48eb54ce7c6007717204d9ceb55)
  minted 20 LP shares.
- [Dice #1 placement](https://sepolia.basescan.org/tx/0xb9e2b5b08b7c9f1e4dfde5cd683a10cab61d875ac3ff377b1a58c120b94b0fe1),
  [real VRF callback](https://sepolia.basescan.org/tx/0xd2b601c3f1b75543f3687adf833bc8dfb60330a886e408c7c0617ba4aec9e787)
  and [keeper settlement](https://sepolia.basescan.org/tx/0x5095cfe9d7e6afdbae1784f1c2681a9ac30082c6efce1cc755840d940ac28745)
  succeeded. The settlement transferred 1.96 USDC from Bank to the player. Two RPCs returned matching
  status and block hashes for the deposit, placement, callback and settlement receipts.
- At frozen block `47585140`, positions 1–3 were Settled: Dice, Dice and SicBo, each with a 1 USDC
  stake. Their net/gross payouts and terminal transaction hashes matched direct PostgreSQL reads.
  [Dice #2](https://sepolia.basescan.org/tx/0x27443021c1d54d17dd8877c13253094a1ed66e1049aff16daeb0079d2fd3891d)
  and [SicBo #3](https://sepolia.basescan.org/tx/0x5b9a8b5871c5dc94b6860efa0334fae92072678b561ed32c522146ccbce5f3b1)
  are the other two recorded settlements.
- The first sample took 16 seconds from placement to settlement and 6 seconds from random-ready
  to settlement. This is a sample, not a percentile or service guarantee.
- At that same block: token balance 20.233616 USDC, PF 0.03, active NAV 20.203616; active/global
  reserve, active holds, historical backing, fixed exit debt and player-payable debt were zero.
- Governance was the Safe, pending governance was zero and Bank was unpaused. Registry had no code
  before the release start block. Hub authorization events through the frozen block and current
  mappings showed only the expected GameHub for pool 1. This deployment-specific read does not fix
  the historical verifier's missing complete-set check.

The corresponding evidence was captured under `dist/base-sepolia-first-bet-2026-10-02/` and the
independent review artifact. Generated logs are not committed. The review artifact includes frozen
RPC responses, the actual receipts, database results and the OCI parent/child comparison.

## LP cash exit — independently verified 2026-10-03

The 1-share request is activated and claimed.
Both Base Sepolia RPC providers returned matching receipts, event logs and canonical block hashes:

| Stage | Actual receipt and result |
| --- | --- |
| Activation | [Keeper transaction](https://sepolia.basescan.org/tx/0x7ed5cedbb188d94042218b88025ac07fb40322f11271363a989da45472d67246), block `47608675`, status `1`, **2026-10-03 08:00:38 Asia/Shanghai**. Batch 1 priced 1,000,000 share units for 1,059,677 asset units and burned the escrowed shares. |
| Cash claim | [Wallet transaction](https://sepolia.basescan.org/tx/0xad10d22500d26650ccc2ddb00d9bba89a03b637b78b9ffec3254b7ac0efdf5bf), block `47613390`, status `1`, **10:37:48 Asia/Shanghai**. USDC transferred **1.059677** from Bank to the request controller. |
| Reconciliation | PostgreSQL contains the same `Withdraw` transaction, block and amounts. Keeper logs identify the activation transaction. The cash ledger does not store request/activation events; those are proved by chain receipts. |

The claim used a wallet route: its outer transaction sender is not the LP controller. The embedded
Bank call and `Withdraw` event identify the controller, receiver and sender as the deployment wallet
`0x93ac87413E17d01CBa37B6317f64890bF7f99aC3`.

Activation pricing used pre-activation active NAV `N=21,193,616`, total supply `S=20,000,000`,
queued shares `Q=1,000,000`, virtual offset `V=1,000`, and zero unsettled reserve. The source formula
gives `G=min(floor(S*(N+V)/(S+V)),N)=21,193,556` and
`floor(Q*G/S)=1,059,677` USDC base units. Integer rounding and the virtual offset explain the
three-base-unit difference from a direct `floor(N/20)` estimate.

At independently frozen block `47623267`, both providers agreed: Bank USDC `20.173939`, protocol
fee payable `0.04`, active NAV `20.133939`, total/owner LP shares `19`, escrow `0`, pending request
`0`, exit payable `0`, active/global reserve `0`, historical backing `0`, and player payable `0`.
Bank was unpaused. The historical recovery weight remains recorded, but its cash and risk amounts
are zero; this does not represent an unpaid claim.

At that block `nextPositionIdHint=5`: positions 1–4 are Settled. Position 4 is another Dice bet,
with a 1 USDC stake and zero payout, and its
[placement](https://sepolia.basescan.org/tx/0xad1b5faa31552b25e76e286960efce9b632cc4260ad16344ff9e625095fb8d02),
[random-ready callback](https://sepolia.basescan.org/tx/0xdf51673effb10d699d8b37e143c1fe0636c09314676caca9076adc32799d62c3)
and [settlement](https://sepolia.basescan.org/tx/0xe75a23882e0220a71686e3cd50d035a8574ebe86c5798fd7a61f399ce5ecd8f4)
receipts agree across both RPCs. All four positions' stakes and terminal gross/net/refund amounts
match PostgreSQL. This covers **two of eight games** (Dice and SicBo), with no refund case.

Cancellation was checked separately with historical **read-only `eth_call`**, not a signed
cancellation transaction. At block `47608674` (36 seconds after cutoff, before activation), both
providers returned 1,000,000 cancellable share units. At the activation block and frozen current
block they returned `NothingToCancel()`. Actual cancellation, nonzero unsettled-risk exits and
historical recovery payments remain separate acceptance cases.

The dated independent artifact contains the raw two-provider receipts/calls, accounting reads,
keeper logs, read-only SQL and checksums. Web and keeper still use deployed source `5efbb07c`;
local closeout changes have not been deployed and are not certified by these receipts.

## Eight-game normal settlement — verified 2026-10-03

At frozen block `47624589` (`0x43045c1d1204d204fae278b3f588ee012d210cd91110169ccd5f0be12809d942`),
all 15 positions are Settled, across two players and all eight admitted games:

| Game | Position IDs |
| --- | --- |
| Dice | 1, 2, 4, 15 |
| SicBo | 3 |
| Slots | 5, 6 |
| Roulette | 7, 8 |
| Coin Toss | 9, 10 |
| Keno | 11 |
| Baccarat | 12 |
| Plinko | 13, 14 |

Positions 5–15 came from the website acceptance wallet
`0xc8eC9920d573893E888db5D30b2B3B3824B1b684`; the deployment wallet still has four positions in
two games. The aggregate eight-game result must not be presented as eight games played by one wallet.
The new positions' placement, real random-ready callback and settlement receipts agree across both
RPCs. The deployed modules reproduce their gross payouts from the recorded parameters and actual
random words. Terminal fields, actual USDC transfers, PostgreSQL rows and keeper broadcast/mined
logs match. Neither authorizations nor position counters are used as proof of settlement.

The funding wallet received 120 test USDC and added 81 USDC to LP:
[31 USDC deposit](https://sepolia.basescan.org/tx/0xd4dcb2269da43db2aef1ed8c1fb8294e3a04abaf1cc2ac1bc30a301d22ec97b7)
minted 29.254173 shares;
[50 USDC deposit](https://sepolia.basescan.org/tx/0x110015d46d51a2d14c20a65db3f5acae6bb34f9b07ccc7ccdba2a4f7802fed22)
minted 47.184150 shares. The second deposit used a wallet route; its outer sender does not identify
the LP controller. Both deposits have matching successful receipts and actual owner-to-Bank transfers.

At **2026-10-03 09:03:36 UTC**, both new deposits were present exactly once in the finalized cash
ledger, with matching owner, Bank, transaction, block/log index, asset amount and minted shares.
The cash cursor was `47624084`, beyond the later deposit at `47624045`. The two RPC providers'
latest finalized heads differed (`47624333` and `47624084`); both covered the receipts. This proves
coverage of these deposits, not equality of the providers' latest finalized block/hash.

At the same frozen block, two providers agree: Bank balance **102.759613 USDC**, PF **0.15**,
active NAV **102.609613**, total/owner LP shares **95.438323**, deployment-wallet USDC **75.190054**;
all reserves, holds, recovery backing, player-payable debt and exit payable are zero. Whole cash
reconciliation is `20 + 81 + 15 - 12.180710 - 1.059677 = 102.759613` USDC. The final two terms are
actual net player payments and the LP cash claim. NAV subtracts PF; gross awards are a separate metric.

The deployment wallet also completed an
[exact 5 USDC GameHub authorization](https://sepolia.basescan.org/tx/0x2b1b35a851f25a0e8a210b07f4f12eaac0f00214416607c1fbada2ce9df53a89),
nonce 120. At this snapshot the allowance is still 5 USDC and unused. No deployment-wallet bet was
sent under this allowance. Boundary tests require their own simulations and receipts.

This completes one or more **normal terminal paths for each game**. New positions 7–15 have one
round and no stop limits. It does not complete the 100-round upper boundary, unused-stake refunds,
all parameter types, timeout refunds, nonzero LP recovery or operational fault recovery. The evidence
retains actual parameters, including Heads for Coin Toss, a three-number Keno selection, Player for
Baccarat and Medium for Plinko; the unexecuted planning defaults are not substituted for them.

## Dice 100-round boundary — 2026-10-03

Position **16** completed a real maximum-count Dice case: Under 50, 100 rounds at
0.01 USDC per round, **1 USDC total stake**, with both stop limits zero. The user's
[placement transaction](https://sepolia.basescan.org/tx/0x5eb1a04b402f2e1a48bb5e792b9a4c01da5f0b4f888b0f643d0e6444802b564d)
used nonce 121 and the previously approved allowance. Placement at block `47625676`
(17:27:20 Shanghai) was followed by the
[VRF callback](https://sepolia.basescan.org/tx/0x12b11e046b0ed9d1c8a388b774bc7afa75bf59f2d986b8ffe00448e27da87668)
at `47625681` (17:27:30), then the
[keeper's automatic settlement](https://sepolia.basescan.org/tx/0x66ccfff216f3e7f73f7fc8536a8db2d7e685073c118dccacdb62172f219173df)
at `47625685` (17:27:38). This sample took 18 seconds from placement block to terminal block;
it is not a tail-latency or availability guarantee.

Two RPC providers match the signed transaction, canonical lifecycle receipts, deployed module,
actual random words, `resolve` result, terminal state and USDC payment. Gross was **1.06 USDC**,
net paid **1.0388 USDC**, payout fee **0.0212**, protocol-fee accrual **0.01**, and unused-stake
refund zero. All 100 rounds were used. Independent expansion of the saved raw random word
with Solidity packed RNG bytes confirms **53 wins and 47 losses**, matching the deployed module.
PostgreSQL events/position and the keeper's broadcast,
receipt-materialized and mined records agree on the same terminal transaction. Two subsequent
`finalize.raced` log entries were duplicate enqueue observations; no duplicate payment occurred.

At the independent accounting snapshot `47625787`, Bank balance was **102.720813 USDC**,
PF **0.16**, active NAV **102.560813**, owner balance **75.228854**, allowance **4 USDC**, and
LP supply **95.438323 shares**. All risk reservations, holds and payment debts were zero.
The complete Bank token-transfer window from the earlier snapshot contains only this case's
1 USDC incoming stake and 1.0388 USDC outgoing payment. The integer equations are:

```text
Bank = 102.759613 + 1 - 1.0388 = 102.720813
PF   = 0.15 + 0.01 = 0.16
NAV  = 102.720813 - 0.16 = 102.560813
```

The provider cash ledger is an LP-event table; its empty player rows after this bet are not
casino-payment evidence. Bets/events and actual token receipts establish casino accounting.
The frozen runtime readback at `47625860` independently agrees with the balances above.

Placement used **1,474,624 / 1,913,318** execution gas. The VRF callback budget was **2,000,000**;
the entire coordinator fulfillment transaction used **270,712** gas, which is not a measurement
of the internal callback alone. The keeper settlement used **485,537 / 3,050,000** execution gas.
These are separate budgets and observed costs for this configuration.

VRF overpayment of `17123772478535` wei was refunded successfully, with no native refund credit
remaining. The owner's adjacent-block ETH debit reconciles exactly:
`49002162459458 = 34249146964334 VRF charge + 14746240000000 execution fee + 6775495124 L1 fee`.
This is an observed receipt equation, not a future fee cap.

This closes **Dice's 100-round normal execution**, not every module's maximum input, stop limit,
timeout, refused payment, recovery or operational fault case. Runtime remains the `5efbb07c`
deployment; the local rework candidate was not deployed or certified by these receipts.

## Early stop and unused-stake refund — 2026-10-03

Position **17** completed the next user-signed case, using the existing allowance and nonce 122:
[placement](https://sepolia.basescan.org/tx/0xf98898a73431d79fd1f0fa139016f2f12c32ef083e3fcab3d973f91e652f76bc).
Under 50 requested 100 rounds at 0.01 USDC per round, total 1 USDC, with `stopGain=stopLoss=0.01`.
Independent packed-byte expansion of the real random word gives **96 on the first roll**.
This loses under the configured rule and triggers **stopLoss** immediately. Only 0.01 USDC was
used; the remaining **0.99 USDC** was actually transferred from Bank to the original player.

Placement at block `47626314` (17:48:36 Shanghai) was followed by VRF at `47626319` (17:48:46)
and [automatic keeper settlement](https://sepolia.basescan.org/tx/0x3b1fc8cafeb81e85728fb4a184fdf63f3f857c71c342e02ce197fa6a1b697c61)
at `47626324` (17:48:56). The 20-second sample is not a latency guarantee. The normal terminal
state is **Settled / finalized**, with terminal `refundAmount=990000`; this is unused-stake
refund, not the separate PendingVRF timeout / `BetRefunded` path.

Two RPCs, deployed module resolution, SDK replay, raw random-word recomputation, PostgreSQL
position/events and keeper broadcast/receipt/mined records agree. Gross/net payout and payout
fee were zero. `usedTurnover=10000` and protocol-fee accrual **100 raw = 0.0001 USDC** show that
fees use the actually played amount, rather than charging all 100 requested rounds. The
database's `refund_raw=990000` was retained; there was no lost-refund indexing finding.

At independent frozen readbacks `47626428` and `47626396`, Bank assets were **102.730813 USDC**,
PF **0.1601**, active NAV **102.570713**, owner USDC **75.218854**, allowance **3 USDC**, and
LP supply **95.438323 shares**. All reserves, holds and payment debts were zero. The incremental
Bank token-transfer window contains only this case's 1 USDC incoming stake and 0.99 USDC refund.

```text
Bank = 102.720813 + 1 - 0.99 = 102.730813
PF   = 0.16 + 0.0001 = 0.1601
NAV  = 102.730813 - 0.1601 = 102.570713
```

Placement used **1,514,472 / 1,963,720** gas; keeper settlement **365,389 / 3,050,000**.
The VRF budget still used the requested 100-round count and the 2,000,000 callback cap.
Native overpayment was refunded successfully. The adjacent-block owner ETH debit matches
`49408021677104 = 34255265464112 VRF charge + 15144720000000 execution fee + 8036212992 L1 fee`.

This closes **real stopLoss plus unused-principal refund for this Dice configuration**.
StopGain remains supported by the previously executed local two-seed fixture, without a new
real-network StopGain receipt. Other games' stop configurations, timeout refunds and failure
recovery retain their separate acceptance boundaries. No next bet was prepared or broadcast.

## Pending acceptance and operating sequence

1. The zero-unsettled-risk cash exit above is complete. Perform an actual signed cancellation case
   in a later controlled batch; historical call simulation does not replace that receipt. Do not
   repeat the completed activation or cash claim.
2. Exercise old unsettled risk through partial exits, subsequent deposits/bets, later exits and
   historical recovery claims. Transfers/full exits must not move old rights to new holders. The
   normal settled bets cannot certify these paths.
3. The normal matrix above is funded and complete. For later cases, size the pool according to each
   game's `maxPayout()` and the active reserve/buffer check.
   For example, Slots with a 1 USDC total stake reserves 64 USDC. With a 10% risk buffer and no
   other active reserve, this needs about 70.12 USDC of pre-bet active NAV. That figure does not cover
   all game configurations. Keep the 1 USDC total minimum; smaller per-roll values still require
   sufficient total stake and total reserve.
4. Dice's 100-round execution and real StopLoss/unused-principal refund above are complete.
   Verify other maximum-size inputs, StopGain and other stop configurations; expired PendingVRF refunds;
   deployed-host WS disconnect/reconnect and HTTP catch-up; keeper restart/replay; refused payment
   and later original-player recovery; alert delivery; and actual Safe pause/unpause. Local validation is recorded in the [audit scope](../audit/v1.6-audit-scope.md); target-network cases require their own receipts.
5. Complete GameHub explorer source verification. The last captured submission failed; a later
   success requires an independent explorer/API readback. Signed runtime equality is separate proof.
6. Freeze the final source, ABIs, release and images, complete external audit and governance admission
   decisions, and measure business capacity, tail latency and costs before outside LP funding or a
   mainnet launch. Sports remains a separate gate.

Do not carry the old revision's receipts, local test counts or manifest identity forward as acceptance
of later contract bytes. Follow [the release checklist](../release/checklist.md) and
[deployment workflow](v16-release.md) for the final candidate.
