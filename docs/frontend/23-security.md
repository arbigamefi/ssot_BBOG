# Security and privacy

**2026-10-04: Core and application interfaces implemented; local integration verified, release qualification pending.** NFT LiquidityVault deposits, fixed 24-hour withdrawal locks
and atomic VRF settlement attempts follow the [implementation plan](../design/lp-accounting-and-callback-implementation.md). Earlier candidate
deployments, tests and operations do not establish that this replacement is implemented.

Contract writes use the authenticated release and current SDK. Unknown release,
RPC, or Bank state must block the affected write. Wallet actions require explicit
user interaction and transaction preflight. Preserve selected chain and pool
identity through reads and writes; token address alone does not identify a Bank.

Display settlement separately from payment. A successful settlement may record a
player payable instead of transferring tokens. A player-debt claim pays only that player; it is not
an LP exit claim. Vault withdrawDeposit pays only the NFT owner; the official flow grants no NFT approval or keeper authority. NFT approval can transfer the deposit to another owner and therefore has economic consequences.
Fresh state checks bind Bank/Vault, NFT owner, fixed maturity, node value, L-K, pause and recorded-result settlement state. A displayed amount is not an execution guarantee. LP asset approvals target Vault; betting approvals target Hub. See [NFT liquidity](../adr/0034-nft-liquidity-deposits.md)
and [callback settlement](../adr/0006-vrf-callback-settlement.md).

## Environment and rendering

`NEXT_PUBLIC_*` values are browser-visible. Private keys, database credentials,
release signing keys, and provider admin secrets stay server-side. Public RPC
credentials need provider restrictions appropriate for browser exposure.
Do not store signatures or secrets in browser storage or render untrusted HTML.

[Security headers](../../frontend/apps/web/src/server/security-headers.mjs) deny
framing, disable camera/microphone/geolocation, set HSTS, and restrict connections
to configured services. Production CSP excludes `unsafe-eval` and the development
capture host; it still permits inline scripts/styles. Keep these allowances
explicit when reviewing changes rather than treating CSP as complete XSS protection.

The mainnet casino and LP deposit switches in
[casino-access.ts](../../frontend/apps/web/src/app-shell/casino-access.ts) control
website availability. They do not pause contracts or confer deployment authority.

Review wallet/dependency and lockfile changes together. Preserve the checked-in
Cuer patch and test the real wallet selector when changing those packages; see
[mobile wallet entry](mobile-wallet-entry.md). Error reporting behavior is described
in [observability](25-observability.md).

```bash
pnpm -C frontend/apps/web test -- src/server/security-headers.test.ts
```
