# Page Spec — Home

## Route

- `/`

## Purpose

Act as the acquisition landing page for the product. Home should explain the value proposition, establish trust, and route users into playable rooms without making them parse operator-facing diagnostics first.

## Modules

- `Hero` (headline, value prop, primary CTA)
- `ProofRibbon` (lightweight live counts sourced from release / SDK / indexer)
- `FeaturedRooms` (route players into room pages)
- `HowItWorks` (3-step flow from room selection to settlement)
- `TrustSection` (plain-language credibility story)
- `LiveProof` (compact recent activity + asset pulse)
- `FinalCTA` (repeat primary conversion path)

## Truth Sources

- Release artifact:
  - room catalog / game identity
  - network / release identity
  - read-only reason
- SDK read helpers:
  - lightweight per-asset bankroll proof
- Indexer:
  - recent bets / sync pulse / lightweight live activity

## Rules

- Home MUST behave like a landing page, not an operator dashboard.
- Shipped Home metrics MUST NOT use hardcoded product KPIs.
- Heavy audit surfaces such as full bet tables, detailed asset breakdowns, and ops diagnostics MUST live on their dedicated routes.
- Home MAY show live proof, but only in compact summary form that supports conversion instead of interrupting it.
- If an accelerator such as a subgraph is introduced later, it MUST remain secondary to release + SDK + indexer truth.

## Acceptance Criteria

- Hero clearly states the product value proposition and the primary action
- Primary CTA routes toward gameplay, not diagnostics
- Featured rooms are derived from the active release
- Live proof uses release / SDK / indexer truth without turning the page into a dashboard
- All numbers are formatted via shared format helpers
- No hardcoded KPI values in production UI
