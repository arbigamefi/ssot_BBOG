# 02 · Voice & Copy

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `../frontend/21-i18n.md` |
| Supersedes | Draft v1 copy manual |

Copy should make the product playable and verifiable. It should not expose
implementation noise.

## 1. Voice

Use:

- calm, precise, direct language;
- concrete actions;
- short explanations for risk, settlement, and proof;
- user-facing terms before contract terms.

Avoid:

- hype and casino slang;
- emoji;
- jokes in error states;
- raw RPC/viem/ABI/server messages;
- unexplained acronyms in player-facing routes.

## 2. Locked Action Verbs

| Verb         | Use                                     |
| ------------ | --------------------------------------- |
| Connect      | wallet                                  |
| Approve      | ERC-20 allowance                        |
| Place        | casino bet or sportsbook ticket         |
| Sign         | typed-data signature                    |
| Settle       | sportsbook ticket settlement            |
| Finalize     | permissionless casino finalize fallback |
| Refund       | stuck bet/ticket refund                 |
| Deposit      | LP deposit                              |
| Withdraw     | LP withdrawal                           |
| Claim        | accrued XP/refund credit                |
| Copy         | clipboard                               |
| Open / Close | navigation, modal, drawer               |
| Retry        | transient failure                       |

Avoid `Submit`, `Send`, `Ape`, `Degen`, `Buy`, and promotional verbs.

## 3. Error Copy

Pattern:

```text
<What failed>: <why>. <What to do next>.
```

Examples:

- `Bet failed: insufficient USDC balance. Lower the stake or add funds.`
- `Round not found on this GameHub. Refresh the page, then place a new bet.`
- `Settlement delayed. The keeper should retry automatically.`

Rules:

- map raw provider errors to known product copy;
- include next action when possible;
- do not show contract call dumps, ABI signatures, stack traces, docs URLs, or
  viem version strings;
- do not use vague `Please try again` unless the error is truly transient.

## 4. Loading And Pending Copy

- Use domain-specific labels: `Estimating VRF fee`, `Waiting for randomness`,
  `Settling result`.
- Do not use generic `Loading` on primary transaction surfaces.
- If a normal path is waiting on keeper, say so plainly.
- If manual action is a fallback, label it as a fallback.

## 5. Numbers

- Use locale-aware formatters.
- Token symbol follows amount: `1.98 USDC`.
- No scientific notation.
- No abbreviated `k/M/B` in settlement, payout, liability, or LP views.
- Use mono for addresses, hashes, request ids, and large numeric proofs.

## 6. Addresses, Hashes, And Time

- Address: `0x1234…abcd`.
- Hash/digest: first 8 + ellipsis + last 6 where space allows.
- Request ids may be truncated in compact UI but full value should be copyable
  or available in detail surfaces.
- Use absolute UTC timestamps for audit/detail pages; relative time is fine for
  recent activity.

## 7. i18n

Visible product copy must use the i18n key system. English-only inline copy is
allowed only in tests, ops exceptions explicitly marked as deferred, or root
crash fallback where providers may be unavailable.

## 8. Verification

```bash
rg -n "BetNotFound|readContract|Contract Call|viem@|execution reverted" frontend/apps/web/src
rg -n "\"[A-Z][^\"]*(failed|Failed|Error|Loading|Connect|Place|Settle|Result|Wallet)" frontend/apps/web/src
pnpm -C frontend/apps/web test -- src/i18n/config.test.ts
```
