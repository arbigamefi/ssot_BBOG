# SCREEN SPEC — Games Directory

**Route**: `/games`

**Design status**: Figma-ready spec

**Product mode**: Acquisition to Gameplay bridge

**Primary user**: player choosing a room

**Primary action**: `Enter Room`

---

## 1. Screen Goal

Help the user choose a room quickly and confidently.

The page should answer:

- what rooms exist
- how they differ
- which room should I enter

It should feel like a curated room directory, not a release manifest browser.

---

## 2. Desktop Frame

Suggested desktop artboard:

- width: `1440`
- content max-width: `1240-1280`
- outer gutter: `32`

Suggested grid:

- 12-column
- clear featured area above grid

---

## 3. Layout Order

1. product header
2. page intro
3. featured strip
4. room family controls
5. room grid

---

## 4. First Fold

## 4.1 Page intro

Contains:

- page title
- one-line explanation

Copy target:
- short
- room-selection focused

## 4.2 Featured strip

Desktop:
- one primary featured room card
- one or two secondary support cards

Purpose:
- accelerate decision-making
- highlight the flagship room or current recommendation

## 4.3 Family controls

Use pill controls to group room types.

Recommended categories:

- fast
- precision
- classic table
- board play

These are user-facing categories, not protocol categories.

---

## 5. Room Grid

## 5.1 Card structure

Each card should contain:

- room icon or symbol
- room name
- one-line promise
- short room type tag
- one quick cue
- primary CTA

## 5.2 Cue examples

- `Fast binary play`
- `Precision threshold`
- `Classic table action`
- `Multi-pick board`

## 5.3 Visual hierarchy

- featured room strongest
- standard cards uniform but not flat
- room type tag quieter than room name
- CTA obvious but not oversized

---

## 6. Mobile Layout

Order:

1. title
2. featured room
3. family pills
4. stacked room cards

Rules:

- family pills horizontally scroll
- featured room remains first
- cards should be thumb-friendly and tap-clear

---

## 7. Copy Rules

Room descriptions should focus on play style, not protocol structure.

Do:

- explain room feeling
- explain decision style
- explain speed or variance

Do not:

- expose raw module semantics
- expose protocol routing language

---

## 8. State Specs

### 8.1 Normal

- featured strip visible
- categories visible
- grid populated

### 8.2 No featured room

- page still works
- first room in grid can inherit visual priority

### 8.3 Empty release

- route becomes a graceful unavailable state
- page should explain that no rooms are available

---

## 9. Motion Notes

Allowed:

- hover rise or glow on cards
- subtle active animation for family pills

Avoid:

- large card flips
- carousel gimmicks that hide room information

---

## 10. Implementation Notes

Truth sources:

- release for room identity
- governed presentation map for decorative metadata

Room cards must not invent:

- RTP claims
- unsupported assets
- module-derived facts not present in product copy

