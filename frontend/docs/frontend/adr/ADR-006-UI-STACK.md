# ADR-006: UI Stack (Tailwind + shadcn/ui + Storybook)

## Context
We want speed, consistency, and strong engineering defaults.

## Decision
- Tailwind for tokens/utility layout
- shadcn/ui (Radix) for accessible primitives
- Storybook for isolated UI development using mock Domain models

## Notes
- Design tokens are CSS vars (shadcn convention)
- UI components in `packages/ui` MUST be presentational only
