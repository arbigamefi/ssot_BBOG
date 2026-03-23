# UI/UX WIREFRAME PACK — ArbiGameFi

> Historical reference only. This document no longer drives formal implementation.
> Current visual/layout truth is the active `ui-ux-v2-*` prototype suite.

**Status**: Historical reference

**Date**: 2026-03-09

**Scope**: `Low-fidelity wireframes for core ArbiGameFi routes`

**Related documents**

- `docs/frontend/UI-UX-DESIGN-BRIEF-2026-03.md`
- `docs/frontend/UI-UX-ARCHITECTURE-PACK-2026-03.md`
- `docs/frontend/UI-UX-DIRECTION-BOARD-2026-03.md`
- `docs/frontend/UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md`
- `docs/frontend/PAGE-SPECS/`

---

## 1. Purpose

This document converts the architecture pack into concrete low-fidelity route layouts.

It defines:

- content order
- first-fold priorities
- primary and secondary modules
- desktop and mobile layout intent

This pack should be sufficient to begin high-fidelity route design without re-deciding page structure.

---

## 2. Wireframe Rules

### 2.1 One dominant action

Every wireframe must reveal one obvious primary action.

### 2.2 One dominant surface

Every route must have a visual center.

Examples:

- home: hero
- games: room grid
- game room: game table + bet slip
- liquidity: LP summary + action area
- bets: ledger table

### 2.3 First fold discipline

The first fold must not contain secondary audit or explanatory modules unless the route itself is an audit route.

### 2.4 Mobile is intentionally redesigned

Mobile wireframes are not desktop wireframes collapsed vertically.

---

## 3. Home

## 3.1 Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Landing Header                                                            │
│ Brand | Rooms | Liquidity | Docs? | Primary CTA                           │
├────────────────────────────────────────────────────────────────────────────┤
│ HERO                                                                      │
│ Left: value proposition + supporting copy + primary CTA + secondary CTA   │
│ Right: atmospheric visual / highlighted room / trust cue                  │
├────────────────────────────────────────────────────────────────────────────┤
│ PROOF RIBBON                                                              │
│ room count | live activity | non-custodial | on-chain settlement          │
├────────────────────────────────────────────────────────────────────────────┤
│ FEATURED ROOMS                                                            │
│ 3–4 prominent room cards                                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ HOW IT WORKS                                                              │
│ choose room -> place ticket -> settle on-chain                            │
├────────────────────────────────────────────────────────────────────────────┤
│ WHY TRUST IT                                                              │
│ custody | randomness | ledger / release truth                             │
├────────────────────────────────────────────────────────────────────────────┤
│ LIVE PROOF                                                                │
│ compact recent bets + light bankroll proof                                │
├────────────────────────────────────────────────────────────────────────────┤
│ FINAL CTA                                                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.1.1 First-fold priority

1. value proposition
2. CTA
3. trust promise
4. visual atmosphere

### 3.1.2 Primary action

`Start Playing`

### 3.1.3 Secondary action

`Explore Rooms`

## 3.2 Mobile Wireframe

```text
┌──────────────────────────────┐
│ Landing Header               │
├──────────────────────────────┤
│ Hero                         │
│ headline                     │
│ support copy                 │
│ primary CTA                  │
│ secondary CTA                │
├──────────────────────────────┤
│ Proof ribbon                 │
├──────────────────────────────┤
│ Featured rooms               │
├──────────────────────────────┤
│ How it works                 │
├──────────────────────────────┤
│ Trust section                │
├──────────────────────────────┤
│ Live proof                   │
├──────────────────────────────┤
│ Final CTA                    │
└──────────────────────────────┘
```

---

## 4. Games Directory

## 4.1 Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Product Header                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Page intro                                                                │
│ title + short room-selection copy                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ FEATURED STRIP                                                            │
│ 1 featured room + 2 supporting rooms                                      │
├────────────────────────────────────────────────────────────────────────────┤
│ ROOM FAMILY FILTERS                                                       │
│ quick | precision | probability board | high-variance                     │
├────────────────────────────────────────────────────────────────────────────┤
│ ROOM GRID                                                                 │
│ card | card | card                                                        │
│ card | card | card                                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.1.1 Card content

Each room card must include:

- room name
- one-line room promise
- fast mental category
- one quick signal
- enter room CTA

## 4.2 Mobile Wireframe

```text
┌──────────────────────────────┐
│ Product Header               │
├──────────────────────────────┤
│ Title + intro                │
├──────────────────────────────┤
│ Featured room                │
├──────────────────────────────┤
│ Family filter pills          │
├──────────────────────────────┤
│ Room card                    │
│ Room card                    │
│ Room card                    │
└──────────────────────────────┘
```

---

## 5. Game Room

## 5.1 Shared Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Room Shell Header: Brand | All Games | Wallet                             │
├────────────────────────────────────────────────────────────────────────────┤
│ Top Game Selector                                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ Compact Room Strip                                                        │
│ title | room state | optional compact reassurance                         │
├──────────────────────────────┬─────────────────────────────────────────────┤
│ BET SLIP                     │ GAME SURFACE                               │
│ Manual / Auto                │ Main game interaction                      │
│ amount                       │ current active selection                   │
│ quick chips                  │ game-specific controls                     │
│ round count                  │                                             │
│ summary                      │                                             │
│ CTA                          │                                             │
├──────────────────────────────┴─────────────────────────────────────────────┤
│ Lower area tabs: Recent Bets | How to Play | Protocol                     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.1.1 First-fold rules

- no left game navigation
- no protocol cards competing with play
- no heavy explanatory copy above the table
- no large release or digest chrome

## 5.2 Shared Mobile Wireframe

```text
┌──────────────────────────────┐
│ Room Shell Header            │
├──────────────────────────────┤
│ Top Game Selector            │
├──────────────────────────────┤
│ Compact Room Strip           │
├──────────────────────────────┤
│ Game Surface                 │
├──────────────────────────────┤
│ Bet Slip                     │
├──────────────────────────────┤
│ Tabs                         │
└──────────────────────────────┘
```

### 5.2.1 Mobile rule

The game surface remains first.
The bet slip should follow immediately, not disappear deep below explanatory sections.

---

## 6. Roulette Room

## 6.1 Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Room Header                                                               │
├────────────────────────────────────────────────────────────────────────────┤
│ Top Game Selector                                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ Room Strip: Roulette | room state                                         │
├──────────────────────────────┬─────────────────────────────────────────────┤
│ BET SLIP                     │ ROULETTE TABLE                             │
│ Manual / Auto                │ Active selection strip                     │
│ Stake input                  │ 0 lane                                     │
│ Quick chips                  │ 1-36 board                                 │
│ Bet count                    │ dozens                                     │
│ Ticket summary               │ columns                                    │
│ Primary CTA                  │ outside bets                               │
├──────────────────────────────┴─────────────────────────────────────────────┤
│ Secondary Row                                                          │
│ Left: layout bets (split/street/corner/six line)                        │
│ Right: advanced raw mask disclosure + note                              │
├────────────────────────────────────────────────────────────────────────────┤
│ Tabs: Recent Bets | How to Play | Protocol                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.1.1 Priority

1. choose roulette call
2. set stake
3. place ticket

### 6.1.2 Required emphasis

The table must dominate the fold more than the room copy.

## 6.2 Mobile Wireframe

```text
┌──────────────────────────────┐
│ Room Header                  │
├──────────────────────────────┤
│ Top Game Selector            │
├──────────────────────────────┤
│ Room Strip                   │
├──────────────────────────────┤
│ Active selection strip       │
├──────────────────────────────┤
│ 0 lane                       │
│ 1-36 board                   │
│ dozens                       │
│ columns                      │
│ outside bets                 │
├──────────────────────────────┤
│ Bet Slip                     │
├──────────────────────────────┤
│ Layout bets accordion        │
├──────────────────────────────┤
│ Tabs                         │
└──────────────────────────────┘
```

---

## 7. Dice Room

## 7.1 Desktop Wireframe

```text
┌──────────────────────────────┬─────────────────────────────────────────────┐
│ BET SLIP                     │ DICE SURFACE                                │
│ amount                       │ cap / threshold hero                        │
│ quick chips                  │ range slider                                │
│ rounds                       │ odds / risk cue                             │
│ summary                      │ presets                                     │
│ CTA                          │                                             │
└──────────────────────────────┴─────────────────────────────────────────────┘
```

### 7.1.1 Rule

The cap or threshold control must be the visual center, not surrounding cards.

---

## 8. Coin Toss Room

## 8.1 Desktop Wireframe

```text
┌──────────────────────────────┬─────────────────────────────────────────────┐
│ BET SLIP                     │ BINARY SURFACE                              │
│ amount                       │ heads / tails selection                     │
│ quick chips                  │ current side confirmation                   │
│ rounds                       │ simple odds cue                             │
│ summary                      │                                             │
│ CTA                          │                                             │
└──────────────────────────────┴─────────────────────────────────────────────┘
```

### 8.1.1 Rule

The room should feel like a binary decision table, not a generic form with two buttons.

---

## 9. Keno Room

## 9.1 Desktop Wireframe

```text
┌──────────────────────────────┬─────────────────────────────────────────────┐
│ BET SLIP                     │ KENO BOARD                                  │
│ amount                       │ number grid                                 │
│ quick chips                  │ selected count                              │
│ rounds                       │ clear / quick pick                          │
│ summary                      │                                             │
│ CTA                          │                                             │
└──────────────────────────────┴─────────────────────────────────────────────┘
```

### 9.1.1 Rule

The number board must feel like a play board, not like a mask editor.

---

## 10. Bets Ledger

## 10.1 Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Product Header                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Title + source explanation                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ Summary strip                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│ Filters: search | game | status | time                                    │
├────────────────────────────────────────────────────────────────────────────┤
│ Ledger table                                                              │
│ betId | game | stake | vrf fee | status | updated | tx                    │
└────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 Mobile Wireframe

```text
┌──────────────────────────────┐
│ Product Header               │
├──────────────────────────────┤
│ Title + source note          │
├──────────────────────────────┤
│ Filters                      │
├──────────────────────────────┤
│ Bet row card                 │
│ Bet row card                 │
│ Bet row card                 │
└──────────────────────────────┘
```

---

## 11. Bet Detail

## 11.1 Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Product Header                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Summary Hero                                                              │
│ bet status | decoded outcome | stake | current action state               │
├──────────────────────┬─────────────────────────────────────────────────────┤
│ Timeline             │ Action / explanation card                           │
├──────────────────────┴─────────────────────────────────────────────────────┤
│ Params | Transactions | Protocol facts                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.1.1 First-fold rule

The user should know what happened to this bet before seeing raw identifiers.

---

## 12. Liquidity

## 12.1 Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Product Header                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ LP Intro Strip                                                            │
│ how to read this page                                                     │
├────────────────────────────────────────────────────────────────────────────┤
│ Key metrics: NAV | Reserved | Free | Buffer floor                         │
├────────────────────────────────────────────────────────────────────────────┤
│ Asset tabs                                                                │
├──────────────────────────────┬─────────────────────────────────────────────┤
│ Position / Action Area       │ Metric explanations                         │
│ deposit / withdraw / redeem  │ PF / XP / optional outflow                 │
├──────────────────────────────┴─────────────────────────────────────────────┤
│ Supporting trust sections                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

## 12.2 Mobile Wireframe

```text
┌──────────────────────────────┐
│ Product Header               │
├──────────────────────────────┤
│ LP Intro Strip               │
├──────────────────────────────┤
│ Key metrics                  │
├──────────────────────────────┤
│ Asset tabs                   │
├──────────────────────────────┤
│ Position / Action Area       │
├──────────────────────────────┤
│ Explanations                 │
└──────────────────────────────┘
```

---

## 13. Account

## 13.1 Desktop Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Product Header                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Account Summary                                                           │
│ wallet | release identity | key balances                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ Position cards                                                            │
├──────────────────────────────┬─────────────────────────────────────────────┤
│ Allowances / refund credit   │ Tx journal                                  │
└──────────────────────────────┴─────────────────────────────────────────────┘
```

### 13.1.1 Rule

This page should feel like a self-audit dashboard, not only a tx history table.

---

## 14. Claims / Referral / Ops

These routes should receive lower-fidelity wireframes only after the core routes above are accepted.

Reason:

- they are important
- but they are not the core conversion or gameplay path

Their high-fidelity design should happen after:

- home
- games
- rooms
- bets
- liquidity
- account

---

## 15. State Placement Rules

### 15.1 Wallet disconnected

- home: subtle
- games directory: subtle
- game room: explicit in bet slip
- liquidity: explicit in action area
- account: route-level empty / gated state

### 15.2 Loading

Loading skeletons should occupy the exact future layout regions, not generic spinners floating above them.

### 15.3 Empty

Empty states must route forward:

- bets empty -> go to games
- room activity empty -> still allow play
- liquidity empty -> explain how to deposit

### 15.4 Transaction states

Pending, success, failure, and reconcile states should remain near the action origin, especially in rooms and liquidity.

---

## 16. Handoff Rules

Once this wireframe pack is accepted:

1. high-fidelity design should preserve these structural priorities
2. frontend implementation should not invent new major layout regions
3. any structural deviation should be documented before coding

---

## 17. Immediate Next Deliverable

The next design artifact should be:

`High-Fidelity Core Route Pack`

Recommended order:

1. Home
2. Games Directory
3. Roulette Room
4. Shared Game Room system
5. Liquidity
6. Bets
7. Bet Detail
8. Account
