# SCREEN SPEC — Home Landing

**Route**: `/`

**Design status**: Figma-ready spec

**Product mode**: Acquisition

**Primary user**: first-time visitor

**Primary action**: `Start Playing`

---

## 1. Screen Goal

Make a new visitor understand three things in one fast scan:

1. what ArbiGameFi is
2. why it is trustworthy
3. where to start playing

This screen should convert, not audit.

---

## 2. Desktop Frame

Suggested desktop artboard:

- width: `1440`
- content max-width: `1200-1280`
- outer gutter: `32-40`
- hero first fold target height: `760-860`

Suggested grid:

- 12-column
- generous section spacing

---

## 3. First Fold Layout

## 3.1 Header

Left:
- brand
- compact links: `Rooms`, `Liquidity`

Right:
- secondary utility link if needed
- primary CTA
- wallet button only if it does not overpower CTA

Header tone:
- minimal
- premium
- not dashboard-like

## 3.2 Hero Left Column

Order:

1. micro-label
2. main headline
3. support paragraph
4. primary CTA
5. secondary CTA
6. trust bullets

Headline target:
- 2 lines max on desktop
- large, high-contrast

Support copy target:
- 2 short sentences max

Trust bullets:
- `Non-custodial`
- `On-chain settlement`
- `Provable room facts`

## 3.3 Hero Right Column

One composed visual block only.

It may contain:

- featured room teaser
- abstract game-room atmosphere
- compact live proof

It must not contain:

- tables
- many tiny cards
- operational telemetry

---

## 4. Section Order

1. Hero
2. Proof ribbon
3. Featured rooms
4. How it works
5. Why trust this
6. Live proof
7. Final CTA

No additional sections before the hero.

---

## 5. Component Specs

## 5.1 Hero CTA group

Primary CTA:
- label: `Start Playing`
- filled
- strongest visual weight on page

Secondary CTA:
- label: `Explore Rooms`
- outlined or quieter filled style

## 5.2 Proof ribbon

Use one horizontal strip, not four separate heavy cards.

Include only compact proof items:

- live rooms
- recent activity
- non-custodial
- release-backed routing

## 5.3 Featured rooms

Desktop:
- one large featured card + two or three smaller supporting cards

Each card includes:

- room name
- one-line promise
- small category tag
- enter room CTA

## 5.4 How it works

Three steps only:

1. Choose a room
2. Set your ticket
3. Settle on-chain

Use large numeric markers and short copy.

## 5.5 Why trust this

Three trust pillars:

- custody
- settlement
- room truth

Each pillar:
- icon
- short label
- one sentence

## 5.6 Live proof

Keep compact.

Acceptable modules:

- recent room activity summary
- light bankroll proof
- current release-backed room count

Not acceptable:

- full bet ledger
- full asset tables

## 5.7 Final CTA

Single banner or final hero-style section with:

- one short line
- primary CTA

---

## 6. Mobile Layout

Order remains:

1. header
2. hero
3. proof ribbon
4. featured rooms
5. how it works
6. trust
7. live proof
8. final CTA

Rules:

- hero text should remain short
- proof ribbon can become stacked compact tiles
- featured rooms stack vertically
- CTA remains above the fold on common phone sizes

---

## 7. Copy Rules

Hero copy must avoid:

- `release digest`
- `indexer`
- `protocol truth`
- `manifest`

Hero copy should emphasize:

- wallet-native play
- non-custodial flow
- on-chain settlement
- premium room experience

---

## 8. State Specs

### 8.1 Normal

- release and live proof available

### 8.2 Read-only / release unavailable

- hero still renders
- CTA degrades to room exploration or docs
- trust copy remains

### 8.3 Wallet disconnected

- no warning banner needed in hero
- wallet connection remains optional until room entry

---

## 9. Motion Notes

Allowed:

- staggered hero reveal
- subtle hover on featured rooms
- gentle section fade-in

Avoid:

- looping glow spam
- overly animated counters

---

## 10. Implementation Notes

Truth sources:

- release for room catalog and identity
- SDK for light bankroll proof
- indexer for compact live proof only

Do not implement this page as:

- a dashboard
- a room list with hero text on top

