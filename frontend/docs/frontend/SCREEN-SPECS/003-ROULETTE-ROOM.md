# SCREEN SPEC — Roulette Room

**Route**: `/games/roulette`

**Design status**: Figma-ready spec

**Product mode**: Gameplay

**Primary user**: active player

**Primary action**: `Place Ticket`

---

## 1. Screen Goal

Make roulette feel like the flagship digital table game room.

The room should make the player instantly understand:

- I am in roulette
- this is a standard European table
- I choose a bet on the table
- I set the stake on the slip
- I submit one clear ticket

It must not feel like a generic params editor.

---

## 2. Desktop Frame

Suggested desktop artboard:

- width: `1440`
- content max-width: `1280`
- outer gutter: `24-32`

Main fold split:

- left slip: `320-360`
- right table: remaining width

---

## 3. First Fold Structure

1. room shell header
2. top game selector
3. compact room strip
4. left bet slip
5. right roulette table

No left-side game navigation.

---

## 4. Room Shell Header

Contains only:

- brand
- `All Games`
- wallet

No digest, release, hub, or ops chrome in the first fold.

---

## 5. Top Game Selector

Horizontal pill row.

Must remain above the room content.

Purpose:
- room switching
- room family continuity

The selector must not dominate the room.

---

## 6. Compact Room Strip

Contains:

- `Roulette`
- short room state chip
- optional sync reassurance in compact form

Must be one short band only.

No long explanatory paragraph here.

---

## 7. Left Bet Slip

## 7.1 Vertical order

1. `Manual / Auto`
2. slip title
3. stake amount
4. quick chips
5. number of bets
6. ticket summary
7. primary CTA
8. advanced disclosure

## 7.2 Visual treatment

- strong dark panel
- crisp internal spacing
- chip buttons feel tactile
- amount input is the strongest element after CTA
- CTA is the strongest element in the slip

## 7.3 Ticket summary

Must show:

- active bet
- total stake
- wallet state
- one short summary note

Must not become a wall of tx copy.

## 7.4 CTA behavior

Disconnected:
- `Connect wallet`

Ready:
- `Review ticket`

Approval needed:
- `Approve and place ticket`

Ready to sign:
- `Place ticket`

---

## 8. Right Table Surface

## 8.1 Primary order

1. active bet strip
2. main European board
3. dozens
4. columns
5. outside bets

## 8.2 Secondary order

Below the primary board region:

- layout bets
- raw mask disclosure

## 8.3 Board rules

- 0 lane is vertically distinct
- numbers `1-36` use red/black differentiation
- selected state is strong and immediate
- dozens, columns, and outside bets feel attached to the table system

## 8.4 Active bet strip

Must show:

- current bet label
- number coverage
- short helper line
- clear action

This strip is reassurance, not another card stack.

---

## 9. Mobile Layout

Order:

1. room shell header
2. top game selector
3. room strip
4. active bet strip
5. board
6. dozens / columns / outside
7. slip
8. layout bets accordion
9. tabs below

Rules:

- board stays above slip
- slip remains immediately reachable
- advanced bet structures collapse cleanly

---

## 10. Required States

### 10.1 Default

- straight selection visible by default

### 10.2 Straight selected

- clear active number highlight

### 10.3 Outside bet selected

- active outside chip or block state

### 10.4 Structured bet selected

- layout section shows active state clearly

### 10.5 Disconnected

- slip CTA changes to connect
- table remains usable for preselection

### 10.6 Pending / Success / Refundable

These states should appear in or near the slip, not replace the whole room.

---

## 11. Copy Rules

Do:

- use player-facing table language
- keep helper text short

Do not:

- expose bitmask language in default UI
- expose encoding language in the first fold

---

## 12. Motion Notes

Allowed:

- active cell highlight transition
- chip press feedback
- CTA hover or press response

Avoid:

- flashing table effects
- noisy casino-style blinking

---

## 13. Implementation Notes

Protocol truth:

- standard European roulette
- top game selector remains on top
- raw mask hidden behind advanced disclosure

This spec supersedes any older room concept that used:

- left-side game rail
- mask-first default interaction
- heavy room hero above the table

