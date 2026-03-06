# UI Constitution — SSOT Frontend v2

**Status**: Draft → Gate-0

This document is the **single source of truth** for visual and interaction consistency.
It plays the same role as an SSOT “spec/constitution” on the contract side.

Conventions:
- **MUST**: non-negotiable rules (enforced via components/lint/review)
- **SHOULD**: strong recommendations; deviations require justification in PR
- **MAY**: optional patterns

Related documents (all treated as SSOT for frontend governance):
- PRD: `docs/frontend/PRD.md`
- Roadmap: `docs/frontend/ROADMAP.md`
- Page specs: `docs/frontend/PAGE-SPECS/`
- ADRs: `docs/frontend/adr/`
- Component inventory: `docs/frontend/COMPONENT-INVENTORY.md`
- Copy style: `docs/frontend/COPY-STYLE.md`

---

## 1) Design System Foundations (Tokens)

### 1.1 Theme + Tokens
- The UI MUST be expressed through a small set of tokens:
  - Color semantic roles: `bg`, `fg`, `muted`, `accent`, `primary`, `destructive`, `border`, `ring`
  - Radii: `sm`, `md`, `lg`, `xl`, `2xl`
  - Shadows: `sm`, `md`, `lg`
  - Spacing scale: Tailwind default (4px baseline)

- Tokens MUST be implemented using Tailwind + CSS variables (shadcn style), not inline hex codes scattered across components.

### 1.2 Typography
- Font sizes SHOULD follow a small set of roles:
  - `text-sm` (secondary), `text-base` (default), `text-lg` (section header), `text-2xl` (page header)
- Numbers (prices, balances, bps) MUST use tabular numbers (`tabular-nums`) where applicable.

### 1.3 Layout & Spacing
- Page content MUST be placed in a centered container with consistent max width.
- Vertical rhythm MUST use a consistent scale (e.g. `space-y-6`, `gap-6`).
- Cards MUST have consistent padding (`p-4`/`p-6`) and rounding (`rounded-2xl`).

---

## 2) Component Governance

### 2.1 Component Sources
- Base primitives MUST be shadcn/ui (Radix) where available.
- App-specific composites MUST live in `features/*/ui` or `packages/ui/src/components/` (depending on reusability).

### 2.2 Component Contract
- Components in `packages/ui` MUST be **pure presentational**:
  - MUST accept props and render.
  - MUST NOT import protocol SDK, wallet clients, or fetch data.

### 2.3 States (Required)
Every interactive component MUST support:
- Loading
- Disabled
- Error (when applicable)
- Empty (for list/table components)

All states MUST be visually consistent across the app.

---

## 3) Transaction UX Standard (Institution-Grade)

All write actions (bet, deposit, redeem, bind referrer, refund, claim) MUST use the standardized flow:

1. **Plan**: compute required steps (approve? placeBet? value?) and show user a preview.
2. **Preflight**: simulate the tx(s) and surface deterministic errors before signing.
3. **Stepper**: render explicit steps:
   - Step 1: Approve (if needed)
   - Step 2: Execute action
4. **Receipt**: confirm mined status and show tx hash.
5. **Reconcile**: subscribe to events and update state to chain truth.

### 3.1 User Guarantees
- UI MUST clearly show:
  - Stake (ERC20) amount and asset
  - VRF fee (native) as `msg.value`
  - Target approval spender (`bank`), not `hub`
  - Max house edge bps the user agrees to

### 3.2 Error Messages
- UI MUST show **DomainError** messages.
- UI MUST NOT show raw revert selectors or hex revert data.

---

## 4) Data Presentation Standards

### 4.1 Amount Formatting
- All formatting MUST be centralized helpers (no ad-hoc `toFixed` scattered in UI).
- USDC-like assets MUST display with 2–6 decimals depending on magnitude.
- Percent/bps MUST include unit (`bps` or `%`) and use consistent rounding.

### 4.2 Tables & Lists
- Tables SHOULD use consistent column alignment:
  - Text left
  - Numbers right (tabular)
- Empty states MUST be intentional, not blank whitespace.

---

## 5) Page Structure Standard

Every page MUST follow:
- Page header: title + short subtitle + release badge
- Primary card(s) for core action
- Secondary card(s) for history/advanced
- Footer with links to docs/discord/support (optional)

New pages MUST be specified in `docs/frontend/PAGE-SPECS/` before implementation.

---

## 6) Storybook Policy

- Every new UI component in `packages/ui` MUST have:
  - a Storybook story
  - at least: default, loading, disabled, error (if relevant)
- Feature components MAY have stories if they are purely presentational.

---

## 7) Dark Mode

- The app MUST support dark mode (CSS variables), matching shadcn conventions.
- Color usage MUST be semantic tokens, not fixed colors.

---

## 8) Review Checklist (MUST)

A PR that modifies UI MUST answer:
1. Does this change violate any MUST rule? If yes, why?
2. Are tokens used instead of hardcoded colors?
3. Are transaction flows using the standard stepper?
4. Are new components covered by Storybook stories?
5. Does the page have a corresponding page spec?
