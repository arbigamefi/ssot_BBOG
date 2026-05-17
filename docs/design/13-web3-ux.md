# 13 · Web3 UX

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `02-voice-and-copy.md`, `11-component-library.md`, `15-forms.md` |
| Supersedes | Draft v1 wallet platform spec |

Web3 UX has one job: make wallet, approval, signing, and settlement behavior
predictable. It should feel like a product flow, not a blockchain debugger.

## 1. Allowed Boundaries

Pages do not import wallet or RPC libraries directly.

Allowed places:

- provider island and wallet UI;
- feature data hooks;
- feature action hooks;
- server API routes;
- `@ssot/ssot` SDK and release helpers.

Shared visual components must not call RPC directly.

## 2. Wallet Connection

The primary wallet entry lives in the app shell. Feature surfaces use
`WalletGate` when a connected wallet is required.

Connected state shows:

- short address or ENS when available;
- current chain;
- copy and disconnect affordances;
- wrong-chain state when applicable.

Do not re-open the connect modal on every page load. Do not create separate
connect buttons inside every card.

## 3. Chain Handling

Supported chain data comes from release metadata and runtime config. Product
pages must not hard-code deployment addresses or chain ids.

Wrong-chain behavior:

1. Block write actions.
2. Show a clear `Switch network` action.
3. Resume the flow after the wallet reports the expected chain.

No silent chain switching. No signing on the wrong chain.

## 4. Approvals

Default v1 approval model is classic ERC-20 allowance:

```text
check allowance -> approve if needed -> wait for approval receipt -> continue
```

Approval copy must include token symbol, amount, and spender context. Unlimited
approval is not the default and must stay behind an explicit advanced choice.

Permit2 can be reconsidered later if it reduces real user friction. It is not a
v1 architectural requirement.

## 5. Write Flow Contract

Every money-moving action follows:

```text
validate -> quote/preflight -> approve if needed -> sign -> mined
         -> terminal readback -> receipt
```

For casino:

- users sign at most `approve` and `placeBet`;
- VRF fulfillment is asynchronous;
- keeper finalizes automatically when randomness is ready;
- manual settle is fallback copy, not the normal path;
- the final modal appears only after terminal chain state is known.

Do not show a final result modal that still says values are indexing.

## 6. Transaction States

Use a small shared vocabulary:

| State        | Meaning                                                        |
| ------------ | -------------------------------------------------------------- |
| `idle`       | User can edit.                                                 |
| `approving`  | Wallet approval flow is active.                                |
| `signing`    | Wallet signature or tx prompt is active.                       |
| `mining`     | Tx hash exists, receipt pending.                               |
| `waiting`    | Chain accepted the action, async result pending.               |
| `settling`   | Result is ready, keeper or fallback settlement is in progress. |
| `settled`    | Terminal state read back from chain.                           |
| `refundable` | Timeout path allows refund.                                    |
| `failed`     | Flow cannot continue without user action or retry.             |

Feature-specific labels may differ, but state meaning must not.

## 7. Error Copy

Map technical errors to product copy before rendering.

Common cases:

- wallet not connected;
- wrong chain;
- insufficient token balance;
- insufficient allowance;
- insufficient native balance for fee;
- wallet rejected request;
- tx reverted;
- RPC temporarily unavailable;
- result not found yet;
- keeper delayed;
- market locked or expired.

Raw viem, wagmi, JSON-RPC, Solidity selector, and stack trace text do not
belong in player UI.

## 8. Result Proof

Casino result proof must come from chain state or terminal chain logs:

- bet id;
- request id;
- random hash;
- payout or refund amount;
- terminal transaction hash when available;
- BaseScan links when the chain is public.

Recent-feed indexes and Postgres rows are useful for lists. They are not the
authority for the final receipt.

## 9. Signatures And Odds

Sportsbook odds signatures show human-readable fields:

- market;
- outcome;
- odds;
- max stake;
- expiry.

Near expiry, refresh odds instead of letting the user sign stale terms. Do not
render raw typed-data JSON as the primary UI.

## 10. Privacy

- Do not put wallet addresses in shareable URLs unless the page is explicitly a
  public wallet view.
- Do not send raw wallet addresses to analytics.
- Do not persist signatures or approval payloads.

## 11. Do Not Do

- Do not send a transaction without validating local inputs first.
- Do not prompt a wallet unexpectedly after the user thinks the action is done.
- Do not use indexer lag as final-result copy.
- Do not hide allowance amount or spender.
- Do not retry forever without visible state.
- Do not collapse keeper failures into generic "loading".

## 12. Verification

```bash
rg -nE "from ['\\\"]wagmi|from ['\\\"]viem|from ['\\\"]@rainbow" frontend/apps/web/src/app
rg -nE "viem@|Contract Call:|execution reverted|JSON-RPC" frontend/apps/web/src
rg -nE "(chainId|chain):\\s*[0-9]+" frontend/apps/web/src/app frontend/apps/web/src/features
pnpm -C frontend test
```
