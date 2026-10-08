# Earn provider console

**Status: Implemented and locally verified; release qualification pending (2026-10-04).** This is a
separate ERC-721 LiquidityVault with LiquidityTree accounting and a fixed 24-hour withdrawal lock.
Earlier ERC-20, batch and recovery implementations are not supported target modes. The
[implementation plan](lp-accounting-and-callback-implementation.md) owns the delivery gates;
[NFT liquidity rules](../adr/0034-nft-liquidity-deposits.md) own the economic semantics.

## Pool and deposit reads

LiquidityVault holds LP capital. Bank continues to hold bettor principal and account for player,
protocol and referral obligations. Read the bound Vault and Bank at one block:

- `L` is the LiquidityTree root, the sum of current deposit entitlements. It is not a token balance
  minus liabilities and there is no fungible share price or virtual offset.
- `P` is unresolved bettor principal and `R` the gross maximum payout reserve recorded by Bank.
  Net LP lock is `K = R - P`; betting solvency capital is `G = L + P`.
- A mature NFT can withdraw at most `min(nodeValue, max(L - K, 0))`, subject to owner, pause,
  accounting and recorded-result checks. No additional LP withdrawal buffer applies.
- The existing betting buffer still uses G. Deposits and new bets also enforce the admitted `G <= 2^108-1` numerical bound; node capital alone is insufficient to check it. An NFT transfer changes ownership, not pool capital;
  a deposit, withdrawal or booked game result changes relevant capital and triggers refresh.

For each owned deposit, show NFT ID, current owner, canonical node value, `withdrawAfter`, estimated
withdrawal amount and currently executable limit. Values come from custom Vault deposit views,
not ERC-4626 previews or max functions. `min(nodeValue, L-K)` is a cash upper bound, not always an
exactly executable amount at the percentage precision. For `V=nodeValue>0`, `F=L-K` and `ONE=1e12`,
the maximum percentage is ONE when `F>=V`; otherwise it is
`floor(((F+1)*ONE-1)/V)`. Quote actual assets as `floor(V*percent/ONE)` and reject a zero-asset partial
withdrawal. A mature zero-value NFT instead offers a 100% close action. See the
[exact quote rules](lp-accounting-and-callback-implementation.md#5-合约接口与依赖).
Individual maxima share the same free capital and cannot be summed as concurrently payable cash.
The combined owner limit caps eligible values once by F and remains an upper bound subject to
percentage granularity and intervening transactions. Display unallocated token surplus separately for diagnosis;
a donation does not change the tree, and Earn provides no surplus withdrawal action.

## Deposit and withdrawal

`addDeposit(amount)` / `addDepositFor(owner, amount)` creates a new NFT every time and sets its maturity to 24 hours after
that deposit. The asset approval spender is LiquidityVault; betting approvals still target the Hub.
There is no mint-by-shares, top-up of an existing NFT or per-wallet share balance.

`withdrawDeposit(id, percent)` requires the connected wallet to be the current NFT owner and pays
that owner. Use the adopted `1e12 = 100%` percentage scale and current node quote. A successful partial
withdrawal relocks the remaining value for 24 hours. A 100% withdrawal burns the NFT; a matured
zero-value NFT can also be destroyed with the full-withdraw operation. Zero percent and a partial
withdrawal that rounds to zero are rejected. Failed operations do not reset the lock or create cashflow.

NFT transfers preserve the original `withdrawAfter`. The recipient receives the deposit's current
and future tree entitlement. An approved NFT spender/operator cannot call cash withdrawal directly,
but can transfer the NFT to itself and become its owner: NFT approval is an economic permission.
The official deposit/withdrawal flow neither requests NFT approval nor grants keeper authority.

There is no daily queue, old-risk claim or later cash-claim phase. A successful withdrawal immediately
reduces the tree and transfers cash. Existing bets do not impose a last-NFT retention rule: when
`K = 0`, all LP capital can be withdrawn even with open bets, if other conditions permit. When later
profit arrives with a zero tree root, it goes to protocol capital, not an empty root or a past NFT owner.

## Eligibility and failures

A recorded random result awaiting accounting prevents LP additions and withdrawals in the affected
Vault. The gate reads the bound Bank's pause, busy and accounting state and its canonical
Router-to-VRF result status. Missing or failed authoritative reads block affected writes and show
unavailable data; there is no guessed healthy zero or fabricated maturity. NFT ownership transfers
alone do not settle results or reset the lock.

Ordinary LP withdrawal introduces no planned betting pause. Reduced capital can lower the maximum
stake; new betting is rejected at `L = 0`. Liquidity, capacity and emergency pause remain distinct.
A permanently failing recorded-result settlement can keep LP cash operations unavailable, so the
page does not promise a guaranteed full-exit time. Every successful receipt invalidates the pool,
deposit and cash-history snapshot; a racing bet can make an earlier quote no longer executable.

## History and economic explanation

The ledger records Vault deposit/withdrawal cash events per NFT and tracks ERC-721 ownership events
separately. Record asset payer, initial owner, current owner and actual cash recipient as different
roles. An NFT transfer is not an asset deposit or cash profit. Deposit lifetime funding and value
may be shown, but a recipient's wallet return is unknown when acquisition cost is not established.
Do not invent a share-price performance series or treat Bank gameplay GGR as the NFT's return.

Bank snapshots the last deposit ID when opening a bet. Its subsequent gain/loss is allocated using
that old-deposit prefix: a prefix unable to bear a loss causes the entire loss to be allocated over
the current tree; a zero-value prefix causes profit to fall back to the current tree. Thus newer
NFTs can participate in older results in those fallback cases. Successful withdrawn capital has no
future profit, loss or recovery entitlement. State these rules without claiming equal returns across
entry or withdrawal times.

Keep player debt and its claim separate from LP capital. Normal VRF fulfillment saves the seed and
attempts the single GameHub settlement implementation; failure retains the same result for retry.
WS notifications and HTTP catch-up converge on terminal truth and distinguish actual payment from
a payable. Full callback/tree gas, including the adopted 40-level tree, must be measured in stage 0;
100-round callback support is not assumed. Pre-fulfillment ordering, integration and independent
review remain external-LP gates; the 24-hour lock and atomic callback do not prove complete MEV safety.
