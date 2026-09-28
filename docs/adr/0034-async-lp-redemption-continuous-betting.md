# ADR-0034: Asynchronous LP redemption and player payables

- **Status:** Accepted and implemented together with [ADR-0035](0035-recovery-rights-without-exit-blocking.md). Local integration validation is complete; external audit and fresh network acceptance remain required. See the [candidate evidence](../audit/v1.6-audit-scope.md).
- **Applies to:** the single current prelaunch Bank and its SDK, keeper and application.
- **Standards:** synchronous deposits follow [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626); asynchronous redemption follows [ERC-7540](https://eips.ethereum.org/EIPS/eip-7540), with ERC-7575/ERC-165 interfaces. Historical recovery is a separate extension.

## Context

Pending stakes are already in the Bank's cash balance before their outcomes are booked. Immediate redemption at that book value would let a player-LP withdraw against their own stake or an informed LP exit before a revealed payout is booked. A reserve-based limit cannot make that price final.

LP operations must not stop adequately funded betting. A permanently unresolved position must not gate later LP exits. [ADR-0035](0035-recovery-rights-without-exit-blocking.md) defines the complete reserve segregation, frozen ownership, liquid valuation, historical recovery and residual accounting that meet these requirements. There is one waiting request queue; completed activation does not wait for any older epoch.

## Deposits and ownership

`deposit` and `mint` are synchronous at the active Bank's virtual-offset book price. Before the next epoch boundary, new LPs participate in current active positions. They do not acquire rights to previously segregated recovery epochs. The application states both facts and does not describe the book quote as guaranteed realizable cash.

Share transfers change active ownership only. Historical rights remain with each epoch's frozen holder. Ordinary transfers and mint/deposit receivers cannot be the Bank; only internal request escrow may put Bank shares in its custody. The zero address and Bank itself are invalid request controllers. `rescueToken` rejects both the underlying asset and Bank share token.

## Request, activation and cancellation

- `requestRedeem(shares, controller, owner)` escrows positive shares. The caller is the owner, an approved owner operator or an ERC-20 spender. A finite allowance is consumed unless owner/operator authority applies; infinite allowances remain infinite.
- Request rights belong to the controller. Cancellation returns queued shares to that controller, even when the former owner differs. Former-owner ERC-20 allowance does not authorize later claims or cancellation.
- `requestId = 0`; standard pending and claimable views aggregate the controller's ordinary redemption state. Historical recovery is exposed separately and is never silently included in ordinary max/pending values.
- Governance chooses a batch period from one hour to seven days, initially one day. A queue becomes eligible at the first Unix-time multiple strictly after its first request. Parameter changes affect only new queues.
- Requests continue joining the unactivated queue after eligibility. Cancellation remains available until actual activation, including while paused. Empty queues retire without leaving an activation blocker.
- Anyone may activate an eligible queue when the Bank is unpaused. The transaction fixes the risk/ownership boundary, segregates only the current epoch's old reserve, prices available liquid cash, burns queued shares once and advances the epoch. Old recovery epochs and unclaimed cash never gate it.

Activation does not transfer assets to LPs. Cash and later recoveries are pulled by their entitled holders. No normal redemption phase invokes an emergency pause or adds a new-bet rejection condition.

## Ordinary liquid claims

The batch records its total shares and fixed liquid assets without visiting controllers. A controller receives the floor of its proportional part of that batch. Lazy synchronization assigns a priced request once before its queue slot can be reused. Permissionless synchronization is available during pause and cannot transfer tokens, choose a receiver or change ownership. Views agree with effective synchronized state.

Each controller keeps aggregate claimable shares and assets. These share units were already burned at activation:

- `redeem(s)` pays `floor(s * claimableAssets / claimableShares)`. Redeeming all units pays all assets. A zero-asset claim can still clear positive units without a token transfer; it never erases historical recovery rights.
- `withdraw(a)` pays exactly `a` and consumes `ceil(a * claimableShares / claimableAssets)`. Reject a partial withdrawal that would consume every unit while leaving assets behind.
- `previewRedeem` and `previewWithdraw` revert for asynchronous redemption. `maxWithdraw` and `maxRedeem` report only ordinary fixed claims and return zero while LP claims are paused.
- Batch rounding remains backed until all batch shares have been assigned. Release only the actual remainder once. ADR-0035 specifies the distinct full-exit and partial-exit residual rules; assigned but unpaid assets remain liabilities.

Only the controller or its currently approved operator can claim to a receiver. `setOperator` is powerful: an operator may redirect claimed assets. The application never requests authorization for a protocol keeper; users claim for themselves. An authorized asset claim to the Bank itself is an explicit donation, not an external cash receipt.

## Player transfer failures preserve terminalization

`settleBet` and `refundBet` first attempt to pay the player. A refused transfer records the full player debt, releases the hold reserve and permits the position to reach its terminal state. Use the pinned OpenZeppelin `SafeERC20.trySafeTransfer`; only transfer failure is converted, never arbitrary Router/settlement reverts.

A token's internal out-of-gas failure, including through a proxy, follows the same debt policy. A caller can defer cash delivery by under-funding the transfer but cannot reduce or redirect the debt, and the keeper claims every payable for its player on its next pass. Completing the Bank, Router and Hub terminal state must all succeed or the entire transaction reverts. There is no guarantee with an arbitrary transaction gas limit.

Every admitted token must leave balances unchanged after a failed transfer; returning false does not undo token side effects. Admission retains exact-transfer, non-rebasing assets. A token that moves assets and then returns false fails this assumption.

Anyone may claim a player's payable, including during pause, but it always pays that player. Receiver blacklisting therefore cannot block terminalization or redirect the debt; cash waits until the recipient can receive it. Claims decrease the debt before transfer and revert atomically on failure. They do not charge LP capital or historical recovery twice. An issuer-wide token pause can still prevent actual token payments.

## Accounting and risk domains

Every share quote, SSOT view, new-risk check and optional-outflow check uses the same active NAV definition:

```text
active NAV = cash - PF - XP - fixed LP exits - player payables - historical recovery backing
```

Current-epoch reserves protect active risk; historical reserves are protected inside their own recovery backing. No new bet or optional outflow can spend historical backing or fixed claims. Combined terminal cost includes player net payout, refund, PF and all XP buckets and must not exceed the held reserve. Reserve must cover the original stake for full refunds.

Paying fixed liabilities to an external receiver reduces cash and the corresponding liability equally. The historical epoch is charged when a terminal obligation is booked, not when the recipient later claims it. Historical protocol residuals are distinct from gameplay fee counters and metrics.

## Emergency pause and admission

Pause blocks new risk, deposits, activation, LP cash/recovery payments and PF/XP optional claims. It does not block settlements, refunds, player-payable claims, request cancellation or bookkeeping-only synchronization. Ordinary epoch operation does not use pause.

Casino Hub/module admission still requires public terminal paths, bounded inputs and gas, correct fee allocation and full-payout/refund behavior. A recoverable LP ledger is not permission to admit knowingly defective games. Sports terminalization remains a separate admission gate. Removing Hub/pool admission stops new risk without disabling existing position settlement.

`PendingVRF` refunds retain the one-day contract maximum timeout: this bounds eligibility, not transaction inclusion or asset transfer. `RandomReady` positions finalize through valid admitted module/referral paths; a winner is never refunded merely to clear a batch. Casino parameter payloads remain at most 64 bytes to bound finalization storage reads/copies.

## Consumers and verification

Keeper activation and historical monitoring are independent. Keeper continues finalization and eligible refunds, claims player payables for their players (with backoff while the asset refuses the transfer), tolerates transaction races and reconciles missed events/restarts. Alert state advances only after notification succeeds. Delayed historical recovery never becomes a scheduled betting shutdown.

Earn distinguishes waiting shares, priced liquid cash and historical recovery. Cash-flow/PnL indexing includes actual ordinary withdrawals and recovery payments with correct beneficiaries; segregation and share burns are not cash receipts. Incomplete discovery or uncertain recovery must remain visible rather than being silently valued at zero.

[ADR-0035](0035-recovery-rights-without-exit-blocking.md) owns the frozen-curve model and its proof boundaries. Solidity, actual Bank/SDK integration, permissions, token failure, checkpoint timing, gas/runtime size, keeper, indexer, replay and UI must all be validated on the final source/ABI identity. Mathematical models and earlier-source test counts are not release acceptance. Freeze only after integration, then complete external audit and a fresh network acceptance.
