# ADR-010: Design Tokens via CSS Variables (shadcn convention)

## Context
To ensure theme consistency and allow later UI redesign, we need stable tokens.

## Decision
Use shadcn's CSS variable token model in `globals.css` and Tailwind config referencing `hsl(var(--...))` values.

## Consequences
- Easy dark mode
- Minimal refactors for redesign
