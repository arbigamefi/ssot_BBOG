# 02 · Voice & Copy

| Owner | Design Lead + Product Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `00-charter.md`, `01-brand.md` |
| Supersedes | — |

This document is the **language SSOT**. Every visible string in production
must conform to it, including error toasts, button labels, empty-state copy,
table column headers, time formatters, address truncations, and meta
descriptions. Inconsistent vocabulary destroys brand trust faster than visual
inconsistency.

## 1. Voice

Four-axis voice model (everything we ship must lean toward the **right side**):

| Axis      | ← Avoid                                    | Prefer →                                         |
| --------- | ------------------------------------------ | ------------------------------------------------ |
| Tone      | hype, breathless, promo                    | calm, declarative                                |
| Authority | hedged ("might", "may", "could")           | precise ("is", "does", "will")                   |
| Address   | second-person warm ("you're crushing it!") | second-person neutral ("you control the wallet") |
| Density   | adjective-heavy                            | noun- and verb-heavy                             |

Allowed examples:

- "Place bet" ✅
- "You hold the asset until settlement." ✅
- "Bet failed: VRF request was not fulfilled within the timeout window." ✅

Disallowed examples:

- "🎉 Awesome! Your bet is in!" ❌
- "Hop in, the action is hot!" ❌
- "Click to deposit some sweet, sweet liquidity!" ❌

Emoji policy: **no emoji** in production UI. Toasts, modals, buttons, headings,
empty states, and errors must use no emoji or pictographic characters. Status
is communicated by icon + color + text, never emoji.

## 2. Reading Level

Target **Flesch grade 8** for body copy. The audience is informed but not
necessarily a quant. Avoid jargon in unqualified body text:

- "delta budget" → "affiliate bonus pool"
- "skyline pricing" → "tiered referral payouts"
- "EIP-712 typed data" → "signed off-chain quote"

In `/ops`, jargon is allowed and expected. In `/`, `/casino/*`, `/portfolio`,
and `/earn`, jargon must be paired with a short hover/tooltip explanation.

## 3. Action Verbs (locked)

Every CTA and confirm button uses one of these verbs. No synonyms.

| Verb           | Use                                                |
| -------------- | -------------------------------------------------- |
| **Place**      | bet, ticket                                        |
| **Cancel**     | revocable pre-confirmation actions only (rare)     |
| **Confirm**    | final step after preview                           |
| **Approve**    | ERC-20 allowance                                   |
| **Sign**       | EIP-712 typed-data signature (no fund movement)    |
| **Connect**    | wallet (only)                                      |
| **Disconnect** | wallet (only)                                      |
| **Deposit**    | LP deposit to Bank                                 |
| **Withdraw**   | LP withdrawal from Bank                            |
| **Claim**      | accrued XP, refund credit, kickback                |
| **Refund**     | initiate timed refund of a stuck bet               |
| **Finalize**   | call `finalize(betId)` (permissionless settlement) |
| **Settle**     | sportsbook ticket settle                           |
| **Retry**      | re-attempt after transient failure                 |
| **Copy**       | clipboard action                                   |
| **Open**       | navigation, modal, drawer                          |
| **Close**      | dismiss modal, drawer                              |
| **Save**       | persistent settings only                           |

Disallowed verbs (and why):

| ❌                                                    | Replace with                                |
| ----------------------------------------------------- | ------------------------------------------- |
| Submit                                                | Place / Confirm / Sign (depends on context) |
| Send                                                  | Place / Withdraw / Approve                  |
| Yeet, Stake (as a verb meaning "deposit"), Ape, Degen | — never                                     |
| Buy                                                   | (we don't sell anything)                    |
| Order                                                 | (we don't sell anything)                    |
| Pay                                                   | Confirm / Place                             |

## 4. Microcopy Patterns

### 4.1 Buttons

- One verb, one noun: `Place bet`, `Approve USDC`, `Confirm withdrawal`.
- Sentence case (not title case): `Place bet`, not `Place Bet`.
- No trailing punctuation.
- Loading state replaces the label with a participle verb: `Placing…` (not
  `Loading…`).
- Disabled state preserves the label; rely on `--fg-subtle` color + cursor.

### 4.2 Error toasts

Pattern: `<What failed>: <why> <what to do>`.

Example: `Bet failed: insufficient USDC balance. Top up or lower the stake.`

Don't:

- Show raw RPC errors. They must be mapped to a known taxonomy (see
  `13-web3-ux.md` §6).
- Start with "Oops" / "Uh oh" / "Whoops".
- End with "Please try again." (vague). Tell the user **exactly** what to do.

### 4.3 Empty states

Three sentences max:

1. What this surface is for.
2. Why it is empty.
3. The one action that would un-empty it.

Example for `/portfolio/activity`:

```
Activity ledger.
No bets, deposits, or claims have been recorded for this wallet.
Place a bet to start your ledger.
```

### 4.4 Loading

- Skeletons (preferred): for known-shape content (lists, cards, tables).
- Spinners: only for indeterminate-shape Awaitings (e.g., a tx preview).
- Never both on the same surface.
- A skeleton must replace the same DOM region it will populate, with the
  same dimensions, to avoid layout shift.

### 4.5 Gated states

`Connect your wallet to <action>.` is the only allowed phrasing for the
not-connected gate. No "Sign in" — there is no account system.

### 4.6 Destructive actions

Confirmation copy follows the **state-result-irreversible** pattern:

> Refund this bet?
>
> The stuck VRF request will be detached and your stake returned to your
> wallet. This action cannot be undone.

The destructive verb appears in the primary button. The "Cancel" button never
uses the word "Close" for a destructive confirmation.

## 5. Numbers and Units

### 5.1 Token amounts

| Decimals on screen | Threshold                           |
| ------------------ | ----------------------------------- |
| 0                  | amount ≥ 10 000                     |
| 2                  | 1 ≤ amount < 10 000                 |
| 4                  | 0.01 ≤ amount < 1                   |
| 6                  | 0 < amount < 0.01                   |
| `0`                | amount == 0 exactly                 |
| `< 0.000001`       | non-zero amount below display floor |

Always:

- Locale-aware grouping with `,` for en-US, `.` for de-DE, etc. Use
  `Intl.NumberFormat` (never manual replace).
- Trim trailing zeros (`1.500 USDC` → `1.5 USDC`).
- Token symbol after the number, separated by a single space.

Never:

- Round to fewer decimals than the underlying value requires for safety
  (showing `1000 USDC` for a 1000.999999 stake is misleading).
- Use scientific notation in UI.
- Use ` k` / ` M` / ` B` suffixes in any settlement-relevant view. They are
  allowed in marketing tickers only, and they must round down.

### 5.2 Percentages

- Always 2 decimals if value < 10 %, else 1 decimal: `0.49 %`, `1.25 %`,
  `12.5 %`, `100 %`.
- House edge displayed as `1.00 %` not `100 bps` in player-facing views.
- bps appears only in `/ops` and ADRs.

### 5.3 BPS conversion

- 1 bp = 0.01 %.
- Display formula `bps / 100` with the rules in §5.2.
- Never show "bps" in a casino room or portfolio surface.

### 5.4 Multipliers

`2x`, `36x`, `1 000x` (using `Intl.NumberFormat` grouping).

Never `2.0x`, never `36.00x`.

### 5.5 Addresses

`0xAbCd…1234` — 6 chars after `0x` + ellipsis + last 4 chars. Implemented in
`@ssot/ui/utils/shortAddress`.

Don't:

- Truncate to 4 + 4, 5 + 5, or any other length anywhere.
- Lowercase in display (use checksum casing).
- Display the full address inline; use a `CopyButton` for the full form.

### 5.6 Hashes / digests

Same `XXXXXX…YYYY` truncation but at 8 + 4 (digests are visually distinct
from addresses).

### 5.7 Dates and times

- Relative time for events ≤ 24 h: `just now`, `5m ago`, `2h ago`.
- Absolute UTC after 24 h: `2026-05-13 14:32 UTC`.
- Never show wall-clock local time in audit-relevant surfaces (`/ops`,
  `/portfolio/activity`, bet detail page). Always UTC.
- `Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ... })` is the only
  formatter allowed.

### 5.8 Time durations

- < 60 s → `12s`
- < 60 min → `2m 30s`
- < 24 h → `3h 12m`
- ≥ 24 h → `2d 4h`

## 6. Address Book of Forbidden Terms

These appear in the current UI and must be removed:

| ❌ Current                         | ✅ Replacement                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "Just now" with no time threshold  | "just now" only if < 15 s, else exact                                                                  |
| "Wallet pending"                   | "Wallet not connected"                                                                                 |
| "Bet placed" generic               | depends on state: `Held`, `Pending VRF`, `Random ready`, `Settled (win)`, `Settled (loss)`, `Refunded` |
| "Awesome!"                         | (silence — show data)                                                                                  |
| "House edge" without context       | "House edge (effective)" with tooltip linking to `01-brand.md` glossary                                |
| "Provably fair" used as decoration | use only where a verifiable artifact exists on the same screen                                         |
| "Click here"                       | the action verb (`Connect`, `Place bet`)                                                               |
| "Loading…" generic                 | participle of the actual verb (`Placing…`, `Confirming…`, `Approving…`)                                |
| "Big win!"                         | "Settled · win" + amount, no exclamation                                                               |

## 7. Translation Readiness

All strings must be translation-ready from the first commit. That means:

- Strings live in `frontend/packages/ui/src/i18n/en.ts` or in
  per-feature `messages.ts` files — never inline in JSX.
- Use ICU MessageFormat for plurals and gendered placeholders.
- Use named placeholders: `{amount} {symbol}` — not positional `{0} {1}`.
- One key per concept, not per location. Reuse `bet.action.place` everywhere a
  "Place bet" button is rendered.
- Encode units as ICU constructs, not concatenation:
  `"You staked {amount, number} {symbol}."`

Disallowed inline strings (CI failure):

```tsx
<button>Place bet</button>           // ❌
<button>{t('bet.action.place')}</button>  // ✅
```

Exception: developer-only routes (`/ops`) may bypass i18n initially. Document
the exception in the file with a `// i18n: deferred` comment.

## 8. SEO & Meta Copy

- Page `<title>` template: `"<Page Name> · ArbiGameFi"`.
- Page meta description ≤ 155 chars, plain prose, no superlatives.
- Twitter card title = page title; description = meta description.
- OG image generated per-route with the same brand template (see
  `01-brand.md` §8).

## 9. Don'ts

- No emoji in production UI.
- No exclamation points outside marketing hero copy.
- No "we" / "us" / "our" in dashboard surfaces. The protocol is the subject,
  not the team.
- No ambiguous "Try again" CTAs.
- No mixed casing in headings (Sentence case, period).
- No marketing copy on dashboards. `/portfolio` does not say "Welcome back,
  champion."
- No copy that promises a feature not yet shipped. A page describes what is
  on it, today.
- No prices in fiat unless we are showing a fiat-priced asset (we are not).
- No "approve infinity" without a one-click "approve exact amount" alternative
  in the same UI.

## 10. How To Enforce

```bash
# Inline string heuristic — fails review if strings outside i18n exist
rg -nE ">[A-Z][a-z]+ [a-z]+<" frontend/apps/web/src/app \
  | rg -v "messages|i18n|<svg|<path|placeholder="

# Forbidden tokens
rg -nE "\bAwesome\b|\bOops\b|\bUh oh\b|\bWhoops\b" frontend/apps/web/src

# Emoji ban
rg -nE "[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]" frontend/apps/web/src \
  --pcre2 --hidden

# Address truncation must use the shared util
rg -nE "slice\(0, ?[0-9]+\).*slice\(-[0-9]+\)" frontend/apps/web/src \
  | rg -v "shortAddress"
```

These are codified in `../frontend/24-testing.md` as lint rules.

## 11. Appendix · Standard Glossary

| Term       | Definition                                               | Surface                            |
| ---------- | -------------------------------------------------------- | ---------------------------------- |
| Bank       | Per-asset vault holding bankroll                         | every route                        |
| NAV        | Net asset value (B − PF − XP)                            | earn, ops                          |
| LP shares  | ERC-20 share of a Bank                                   | earn, portfolio                    |
| House edge | Protocol fee taken on payout                             | casino, marketing                  |
| VRF        | Verifiable Random Function (Chainlink)                   | casino room, ops                   |
| Settlement | Bet outcome resolved on-chain                            | casino room, sportsbook, portfolio |
| Reserved   | Max possible payout held against the bet                 | casino room, ops                   |
| XP bucket  | Affiliate liability bucket (accrued / locked / holdback) | portfolio, ops                     |

Whenever a term in this glossary appears for the first time on a player-facing
page, it must be paired with a `Tooltip` (see `11-component-library.md` §3.10)
that surfaces this definition verbatim.
