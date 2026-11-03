# 02 · Voice & Copy

| Owner | Product + Frontend |
| Status | Active |
| Last Updated | 2026-11-03 |
| Depends on | `01-brand.md`, `../strategy/fullstack-product-architecture.md`, `../frontend/21-i18n.md` |
| Supersedes | Draft v1 copy manual |

Copy should make the product playable and verifiable. It should not expose
implementation noise. Live UI copy is a document: it must agree with the Terms,
the privacy policy and what the contracts do.

## 1. Voice

Use:

- calm, precise, direct language in sentence case;
- concrete actions;
- short explanations for risk, settlement and proof;
- user-facing terms before contract terms.

Avoid:

- hype and casino slang;
- emoji;
- jokes in error states;
- raw RPC/viem/ABI/server messages;
- unexplained acronyms in player-facing routes;
- promises the contracts do not make, such as returns for liquidity providers.

## 2. Terms

One name per concept, in every locale. Contract names (`Bank`, `LiquidityVault`, `GameHub`)
appear only under technical details, next to the address.

| Concept                                   | English             | 中文         |
| ----------------------------------------- | ------------------- | ------------ |
| The games area                            | Casino              | 游戏         |
| One game                                  | Game (not "room")   | 游戏         |
| The liquidity page, nav item and product  | Liquidity           | 流动性       |
| The money that pays winners               | House pool          | 庄池         |
| People who deposit into it                | Liquidity providers | 流动性提供者 |
| A liquidity position                      | Deposit NFT         | 存款 NFT     |
| Referral and rebate rewards, paid in USDC | Rewards             | 奖励         |
| What a player can withdraw                | Claimable balance   | 可领取余额   |
| The share of a win kept by the house      | House edge          | 庄家优势     |
| The amount bet                            | Stake               | 下注额       |
| The probability of winning                | Win chance          | 中奖概率     |
| The Chainlink VRF charge                  | Randomness fee      | 随机数费用   |
| The settlement record                     | Receipt             | 凭证         |

Retired on the player site: Bankroll, Pools, Bank, Vault, XP and Room. The Chinese site never
says 赌场.

Each game has one name everywhere, on the home page, in the lobby and in its room:

| Game       | English                 | 中文          |
| ---------- | ----------------------- | ------------- |
| `dice`     | Dice                    | 骰子          |
| `coinToss` | Coin Toss               | 抛硬币        |
| `roulette` | European Roulette       | 欧式轮盘      |
| `keno`     | Keno (not "Keno Draft") | Keno 选号     |
| `plinko`   | Plinko                  | Plinko 弹珠盘 |
| `slots`    | Slots                   | Slots 拉霸    |
| `baccarat` | Baccarat                | 百家乐        |
| `sicBo`    | Sic Bo                  | 骰宝          |

A game's category label describes the game: Sic Bo is not filed under Dice.

## 3. Locked Action Verbs

| Verb         | Use                                  |
| ------------ | ------------------------------------ |
| Connect      | wallet                               |
| Approve      | ERC-20 allowance                     |
| Place        | casino bet                           |
| Sign         | typed-data signature                 |
| Settle       | permissionless settlement fallback   |
| Refund       | stuck bet refund                     |
| Deposit      | liquidity deposit                    |
| Withdraw     | liquidity withdrawal                 |
| Claim        | claimable balance (rewards, refunds) |
| Copy         | clipboard                            |
| Open / Close | navigation, modal, drawer            |
| Retry        | transient failure                    |

Avoid `Submit`, `Send`, `Ape`, `Degen`, `Buy`, and promotional verbs. An action keeps its name
through the flow: the button that says "Place bet" leads to a status that says the bet was
placed.

## 4. Error Copy

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
- include next action when possible; where the fix is a single action, the main button becomes
  that action (for example "Lower to 1.06") and the reason sits above it;
- do not show contract call dumps, ABI signatures, stack traces, docs URLs, or
  viem version strings;
- do not use vague `Please try again` unless the error is truly transient.

## 5. Loading And Pending Copy

- Use domain-specific labels: `Estimating the randomness fee`, `Waiting for randomness`,
  `Settling result`.
- Do not use generic `Loading` on primary transaction surfaces.
- If a normal path is waiting on keeper, say so plainly.
- If manual action is a fallback, label it as a fallback.

## 6. Numbers

- Use locale-aware formatters.
- Token symbol follows amount: `1.98 USDC`.
- No scientific notation.
- No abbreviated `k/M/B` in settlement, payout, liability, or liquidity views.
- **Rounding direction.** What the player can receive rounds down; what they pay rounds up
  (the randomness fee is "up to X ETH"). Receipts show exact on-chain values.
- Write the win chance before the multiplier.
- Amounts, addresses and hashes use tabular figures (`01-brand.md` §4), not a monospace face.

## 7. Addresses, Hashes, And Time

- Address: `0x1234…abcd`.
- Hash/digest: first 8 + ellipsis + last 6 where space allows.
- Request ids may be truncated in compact UI but full value should be copyable
  or available in detail surfaces.
- Use absolute UTC timestamps for audit/detail pages; relative time is fine for
  recent activity.

## 8. Site States

Copy depends on what the build offers (`getCasinoAccess`):

| State   | When                            | What the copy says                                                                                          |
| ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Preview | Betting is closed               | Betting opens on Base after the audit report is published; launch news is on the official Telegram channel. |
| Testnet | Betting is open on a test chain | Bets use test USDC with no value; where to get it; real-USDC betting opens on Base after the audit report.  |
| Live    | Betting is open on a main chain | The launch copy.                                                                                            |

The official channels are Telegram (t.me/arbigamefi) and X (@arbi_game_fi), read from
`config/site.ts`. The site collects no email addresses.

## 9. i18n

Visible product copy must use the i18n key system. English-only inline copy is
allowed only in tests, ops exceptions explicitly marked as deferred, or root
crash fallback where providers may be unavailable.

Chinese copy is written for Chinese readers, not translated word for word. It uses the terms in
§2 and full-width punctuation.

## 10. Verification

```bash
rg -n "BetNotFound|readContract|Contract Call|viem@|execution reverted" frontend/apps/web/src
rg -n "\"[A-Z][^\"]*(failed|Failed|Error|Loading|Connect|Place|Settle|Result|Wallet)" frontend/apps/web/src
pnpm -C frontend/apps/web test -- src/i18n/config.test.ts
```
