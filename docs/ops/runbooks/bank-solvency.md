# Bank/Vault solvency and NFT deposits

Target runbook for the [accepted design](../../design/lp-accounting-and-callback-implementation.md);
core implementation is locally verified; fresh network validation is pending. Do not use new getters with an older ABI.
Read one numbered block from the authenticated release. Verify chain, Bank, Vault, asset and both
immutable counterpart bindings; format money using asset decimals, not NFT metadata.

## Accounting

Read Bank cash Bb, Vault cash Bv, PF/XP/player debt PP, pending principal P, total reserve R, Vault root
L, locked capital K, G=L+P, open count, configuration and canonical unbooked-result count together.

- Require R≥P, K=R−P and 0≤K≤L. The tree root is LP capital. Do not use a token balance as L.
- Require Bv=L+Sv and Bb=P+PF+XP+PP+Sb, with nonnegative separately reported surplus Sv/Sb.
  Surplus grants no NFT or LP capital and is not automatically assigned to the next depositor.
  There is no new surplus sweep/distribution interface.
- G is the existing new-bet risk basis. LP free capital is L−K. No extra LP percentage buffer
  applies; separate PF/XP outflow policy does not reduce the NFT entitlement.
- Missing reads or cash/ledger deficits are unavailable/invalid states, not successful zero-value
  quotes. Stop LP funding, new risk and optional outflows while invalid. Legitimate terminal/player
  debt paths retain their own atomic accounting and payment checks.
- For a position of stake s, reserve r and complete terminal cost C, release P by s, R by r and K by
  r−s. With LP capital present, allocate s−C through the fixed cutoff and original tree algorithm.
  Player payout deferred to PP is still a cost; its later claim is not a second loss.
- If L was zero and s−C>0, the positive result becomes explicit Bank protocol capital, separate from
  game-fee metrics. L stays zero and G falls by s. Do not credit an empty tree.
- PF/XP/PP claims reduce Bank cash and their matching liability. They do not debit tree capital again.
- Exact-transfer, non-rebasing admitted tokens are an accounting premise. Report every deficit,
  failed asset read or unexpected balance change; never describe a clamp as reconciliation.

## NFT value and availability

Each new deposit creates an independent NFT/leaf. It matures 86,400 seconds later. A successful partial
withdrawal restarts the remainder's timer; a failed call does not. Transfer preserves its ID/deadline.
Only its current owner may withdraw, and cash is paid to that owner. ERC721 approvals can transfer the
NFT and therefore transfer economic control; the keeper must hold none.

A withdrawal uses 1e12 fraction precision against the current leaf value, floored to asset units.
It succeeds atomically or changes nothing. Zero-percent and zero-cash partial requests are rejected;
a mature zero-value NFT may be burned by a full request. Full successful withdrawal burns the NFT;
withdrawn capital has no future recovery claim.

Availability is bounded by the leaf value and global L−K, plus maturity, pause, accounting and result
gates. Do not add each NFT's individually quoted global free-capital cap to get portfolio liquidity.
Aggregate eligible owned capital, then cap once by L−K. Percentage execution amounts may change as
P&L is booked before inclusion.

K>0 prevents emptying the pool; K=0 permits full exit, including when a zero-net-capital position remains.
No LP action schedules a betting pause. Reduced capital may reject a subsequent oversized bet.
A stuck position retains its capital lock. Neither maturity nor the protocol promises all capital can
exit at a fixed time.

Original tree allocation can fall back to all current capital: the entire loss when the old range is
insufficient, or profit when that range is empty. New money is not categorically free of old outcomes.
Burned NFTs never regain rights.

## Result gate and recovery

A received but unbooked canonical seed blocks Vault deposits and withdrawals even if GameHub still says
PendingVRF. Vault also checks Bank's accounting/busy state. NFT transfers preserve rights and are not
cash withdrawal. Missing binding or result reads fail closed.

Diagnose and retry the original result through the [casino runbook](game-finalization-diffs.md).
Never clear its counter, invent a result or refund a known winner to restore LP access. The Bank-only
Vault settlement path does not apply the external LP gate; otherwise the gate would deadlock recovery.
Ordinary betting retains its own capital, capacity and pause conditions.

## Payment and monitoring

A terminal bet may leave fully backed PP. Anyone may trigger payment to the original player only.
Track payment failures/retry separately from completed accounting.

Reconcile NFT mint/transfer/burn with deposit/withdraw cash events without double counting.
Use chain/Vault/depositId for ownership, and actual payer/recipient for cash. A transfer price or new
owner's cost basis is unknown unless independently established. Refresh L/G and max bet at the LP
receipt block; finalized history may lag. A healthy keeper does not prove payment or complete coverage.
