# SCREEN SPEC — Shared Game Room System

**Routes**:
- `/games/dice`
- `/games/coin-toss`
- `/games/roulette`
- `/games/keno`

**Design status**: Figma-ready system spec

**Product mode**: Gameplay

---

## 1. Purpose

Define the shared structural system every game room must inherit.

This ensures:

- all rooms feel like one product family
- each room still has its own gameplay character

This is the system-level spec that the room-specific high-fidelity screens must obey.

---

## 2. Shared Structural Rules

Every room must have:

1. minimal room header
2. top game selector
3. compact room strip
4. left bet slip on desktop
5. right gameplay surface on desktop
6. lower tabs for supporting content

No room should introduce:

- left global game rail
- heavy hero block above gameplay
- protocol-first first fold

---

## 3. Shared Bet Slip

## 3.1 Required sections

1. mode switch
2. amount
3. chip presets
4. round count
5. summary
6. CTA
7. advanced area

## 3.2 Required visual behavior

- same width family across rooms
- same CTA hierarchy across rooms
- same amount input prominence across rooms
- same tx state placement across rooms

## 3.3 Allowed room-specific adaptations

- different quick chip styling emphasis
- different copy tone
- different summary framing

But structure should remain stable.

---

## 4. Shared Room Strip

Must stay compact.

Contains:

- room title
- one compact state indicator
- optional tiny reassurance cue

Must not contain:

- long room description
- protocol explanation
- multi-card status stack

---

## 5. Shared Lower Tabs

Tabs:

- `Recent Bets`
- `How to Play`
- `Protocol`

Purpose:
- keep deeper information available
- keep it out of the first fold

Rules:

- tabs are secondary
- tabs should not visually compete with the table

---

## 6. Game-Specific Differentiation

## 6.1 Dice

Visual center:
- threshold or cap control

Character:
- precision
- fast adjustment
- numeric confidence

## 6.2 Coin Toss

Visual center:
- binary side choice

Character:
- simplest room
- cleanest room
- strongest binary contrast

## 6.3 Roulette

Visual center:
- European table

Character:
- classic table room
- flagship table feel

## 6.4 Keno

Visual center:
- number board

Character:
- tactical board room
- deliberate pick-building

---

## 7. Desktop Shared Layout

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Minimal Header                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Top Selector                                                              │
├────────────────────────────────────────────────────────────────────────────┤
│ Compact Room Strip                                                        │
├──────────────────────────────┬─────────────────────────────────────────────┤
│ Shared Bet Slip              │ Room-Specific Surface                      │
├──────────────────────────────┴─────────────────────────────────────────────┤
│ Shared Lower Tabs                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Mobile Shared Layout

```text
┌──────────────────────────────┐
│ Minimal Header               │
├──────────────────────────────┤
│ Top Selector                 │
├──────────────────────────────┤
│ Compact Room Strip           │
├──────────────────────────────┤
│ Room Surface                 │
├──────────────────────────────┤
│ Shared Bet Slip              │
├──────────────────────────────┤
│ Lower Tabs                   │
└──────────────────────────────┘
```

Rules:

- gameplay surface before bet slip if that room depends on visible table context
- bet slip immediately after the surface

---

## 9. Shared State System

Every room must design these states consistently:

- disconnected
- input ready
- quote ready
- approval required
- tx pending
- tx mined
- reconciled
- failed

State rendering rule:

the state belongs near the slip and action origin, not in floating unrelated banners.

---

## 10. Shared Content Rules

Player-facing first fold copy must avoid:

- release digest
- module
- params encoding
- indexer lag numbers
- raw protocol jargon

Those belong below the fold or in the protocol tab.

---

## 11. Figma Handoff Requirements

The Figma room system must include:

- one shared desktop room template
- one shared mobile room template
- one shared bet slip component system
- one shared room-strip component
- one shared lower-tabs component
- four room variants: Dice, Coin Toss, Roulette, Keno

---

## 12. Implementation Rule

Once this system is accepted:

- room-level frontend work should follow this system
- structural experimentation in code should stop
- only room-specific surface behavior should vary
