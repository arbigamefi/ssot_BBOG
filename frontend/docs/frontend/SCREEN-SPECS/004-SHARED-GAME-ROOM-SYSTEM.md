# Screen Spec — Shared Game Room System

**Routes**:

- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`

**Active prototype sources**:

- `ui-ux-v2-roulette`
- `ui-ux-v2-dice`
- `ui-ux-v2-cointoss`
- `ui-ux-v2-keno`

## 1. Purpose

Define the active shared room grammar for all game rooms.

Every room must feel like one product family while keeping a game-specific stage and ticket language.

## 2. Shared Room Structure

Every room must contain:

1. room shell header
2. top game selector
3. compact room HUD
4. board or stage area
5. compact ticket rail
6. lower room tabs

## 3. Shared Room Rules

Rooms must not introduce:

- left global game rail
- heavy hero blocks above the stage
- protocol-first first fold
- multi-card room intros

## 4. Shared Ticket Rail

Required structure:

1. balance context
2. amount
3. quick actions
4. number of bets or room-specific count control
5. ticket summary
6. CTA
7. advanced disclosure only if needed

Stable rules:

- consistent width family
- CTA always strongest
- amount input always primary control
- transaction states live near the rail

## 5. Shared Lower Tabs

The shared lower tabs grammar is:

- `All Bets`
- `My Bets`
- `Players`
- `Analytics`
- `Game Details`

Rules:

- clearly secondary to the stage
- same tab order across all rooms
- tab content density can vary by room

## 6. Room-Specific Differentiation

### Dice

- stage emphasizes threshold control
- ticket language emphasizes precision and quick repetition

### Coin Toss

- stage emphasizes binary selection
- ticket language is the cleanest and shortest

### Roulette

- stage emphasizes the European table
- ticket language feels like a table ticket, not a generic form

### Keno

- stage emphasizes pick-building
- ticket language supports deliberate board selection

## 7. Mobile Rules

Order:

1. header
2. game selector
3. room HUD
4. stage
5. ticket rail
6. lower tabs

Gameplay context stays above the rail on mobile.
