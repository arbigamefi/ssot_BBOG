# ROADMAP — ArbiGameFi Frontend v2

**Status**: Active execution roadmap

## 1. Active Baseline

The active frontend baseline is now:

- [V2-PROTOTYPE-BASELINE-2026-03-23.md](./V2-PROTOTYPE-BASELINE-2026-03-23.md)
- [UI-CONSTITUTION.md](./UI-CONSTITUTION.md)
- [UI-UX-DESIGN-BRIEF-2026-03.md](./UI-UX-DESIGN-BRIEF-2026-03.md)
- [UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md](./UI-UX-HIGH-FIDELITY-CORE-ROUTES-2026-03.md)
- [PROTOTYPE-TO-IMPLEMENTATION-MAP-2026-03.md](./PROTOTYPE-TO-IMPLEMENTATION-MAP-2026-03.md)
- [SCREEN-SPECS/README.md](./SCREEN-SPECS/README.md)

These documents, together with the current `ui-ux-v2-*` prototypes, are the only active visual and implementation baseline.

## 2. Binding Product Decision

The current frontend follows this priority order:

1. current `ui-ux-v2-*` prototypes for visual hierarchy and layout
2. brand and copy documents for product language
3. current provider / sdk / runtime / indexer / tx flow for functionality
4. archive frontend only as local interaction reference

## 3. Active Route Families

### 3.1 Acquisition

- `/`
- `/games`

### 3.2 Gameplay

Canonical:

- `/roulette`
- `/dice`
- `/cointoss`
- `/keno`

Compatibility:

- `/games/[slug]`

### 3.3 Trust

Canonical:

- `/invest`
- `/bets`
- `/bets/[betId]`
- `/account`
- `/claims`
- `/referral`
- `/ops`

Compatibility:

- `/liquidity`

## 4. Execution Order

### Phase 0 — Baseline cleanup

- freeze docs against the current v2 prototypes
- remove prototype-note language from active standards
- mark old design planning docs as historical references

### Phase 1 — P0 acquisition

- `/` aligned to `ui-ux-v2-flagship`
- `/games` aligned to `ui-ux-v2-directory`

### Phase 2 — P1 gameplay

- shared `RoomShell`
- `/roulette` aligned to `ui-ux-v2-roulette`
- `/dice` aligned to `ui-ux-v2-dice`
- `/cointoss` and `/keno` aligned to their prototypes
- shared `TicketRailBase`
- shared `LowerRoomTabs`

### Phase 3 — P2 trust

- `/invest` aligned to `ui-ux-v2-liquidity`
- `/bets` and `/bets/[betId]` aligned to trust prototypes
- `/account`, `/claims`, `/referral`, `/ops` aligned to their prototypes

### Phase 4 — cutover cleanup

- keep canonical routes as public entrypoints
- keep compatibility redirects for `/games/[slug]` and `/liquidity`
- remove archive-first visual residues
- remove obsolete prototype-only UI experiments

## 5. Active Companion Documents

- [BRAND-STARTER-PACK-2026-03.md](./BRAND-STARTER-PACK-2026-03.md)
- [MESSAGING-COPY-PACK-2026-03.md](./MESSAGING-COPY-PACK-2026-03.md)
- [LANDING-COPY-DRAFT-2026-03.md](./LANDING-COPY-DRAFT-2026-03.md)
- [SCREEN-SPECS/001-HOME-LANDING.md](./SCREEN-SPECS/001-HOME-LANDING.md)
- [SCREEN-SPECS/002-GAMES-DIRECTORY.md](./SCREEN-SPECS/002-GAMES-DIRECTORY.md)
- [SCREEN-SPECS/003-ROULETTE-ROOM.md](./SCREEN-SPECS/003-ROULETTE-ROOM.md)
- [SCREEN-SPECS/004-SHARED-GAME-ROOM-SYSTEM.md](./SCREEN-SPECS/004-SHARED-GAME-ROOM-SYSTEM.md)
- [PAGE-SPECS/010-GAMES.md](./PAGE-SPECS/010-GAMES.md)

## 6. Historical Reference Documents

These documents remain useful for historical decisions or supporting context, but they are no longer active layout sources:

- `ACTION-PLAN-UI-PRODUCTIZATION.md`
- `FRONTEND-ROUTE-REVIEW-2026-03.md`
- `UI-UX-ARCHITECTURE-PACK-2026-03.md`
- `UI-UX-WIREFRAME-PACK-2026-03.md`
- `BETSWIRL-GAP-ANALYSIS-2026-03.md`
- `PROTOTYPE-FREEZE-CHECKLIST-2026-03.md`
- `PROTOTYPE-FREEZE-REVIEW-2026-03.md`
- `PROTOTYPE-IMPROVEMENT-MATRIX-2026-03.md`
- `FRONTEND-STATE-AND-PROTOTYPE-REVIEW-2026-03-16.md`
