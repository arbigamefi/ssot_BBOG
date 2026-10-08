# Sports markets and settlement

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

Sports admission is separate from casino admission. The accepted NFT-Vault target excludes
Sports until terminal paths and public-result LP pricing are independently validated; see
[ADR-0034](../../adr/0034-nft-liquidity-deposits.md). Code availability and a working odds
feed do not authorize a public market or establish a bounded lifetime for every ticket.

## Configuration and custody

Use a separate Sports-domain pool and its explicit Hub/Bank/Vault binding. Validate NFT maturity, net LP lock and the deposit-ID cutoff selected for each sports exposure; do not assume casino timing fits a long-lived market. Verify the asset decimals,
market/event IDs, supported outcome mapping, lock time, rulebook hash, risk limits and current risk
hash. Ticket and event caps use asset units, so reconcile aggregate exposure, not just ticket count.
Do not share an assumed casino admission result with a Sports pool.
Public match outcomes and reporter proposals may be known before settlement changes LP equity.
The casino recorded-VRF-result gate does not cover those states automatically; validate Sports
valuation and ordering protection before opening deposits or withdrawals against that risk.

Keep governance, keeper, odds signer, result reporter, challenger and arbitrator authority distinct.
Record the configured sets, reporter threshold and set hashes from chain. Only governance changes
those permissions. A permissionless terminalizer needs transaction gas, not reporting or governance
keys. Keep signing material out of browser bundles and repository configuration.

`NEXT_PUBLIC_SPORTSBOOK_ENABLED` controls the application entrypoint. The
[provider integration](../sportsbook-provider-the-odds-api.md) returns external odds; it does not
replace the signed on-chain ticket checks. Review expiry, player, stake, nonce, chain/Hub domain,
rulebook and signer/risk hashes before using a signed quote.

## Result lifecycle

Preserve the [rulebook and result evidence](../sportsbook-provider-evidence-policy.md) before a
reporter proposal. `finalizeResult` is public after `finalizesAt` if the result is unchallenged.
An authorized challenge before finality stops that route.

An authorized arbitrator can uphold the result, reopen reporting or void the market. Governance can
also call `voidMarket` on a challenged market once the current
`challengedAt + resultChallengeTimeoutSeconds` has elapsed, using a nonzero reason hash. This is a
governance action, not a permissionless keeper timeout. Reopening and missing reports do not have a
universal finite total deadline in the current design; do not advertise a guaranteed exit time.

For a resolved market, held tickets can settle publicly. For a voided market, held tickets can refund
or void according to the contract predicates. Read ticket state before retrying; duplicate calls
must not release exposure twice. Reconcile `poolEventReserved`, Router/Bank reserve and actual player
transfer or payable evidence after terminalization.

## Keeper and incident recovery

The current keeper separately enables Sports indexing and terminalization with durable storage.
It recovers TicketPlaced history from the release coverage origin, waits for coverage through a
market's event block, and pages held tickets without a total-count cutoff. It uses individual public
terminal calls and retries failed pages; a short public ticket feed is not proof of complete coverage.
See the [keeper configuration](../../../frontend/apps/keeper/README.md).

For an incident, record market/ticket state, finality and challenge timestamps, exposure, reporter
quorum, preserved evidence hashes and the current owner of the next action. Pause new risk if needed;
valid debt-out remains available during Bank pause. Escalate missing reports, contested evidence or
repeated reopenings to the appropriate authority instead of inventing a refund deadline.
