# ADR-007: Storybook as UI Gate

## Context
We want UI/UX iteration independent of protocol connectivity and reproducible states.

## Decision
`packages/ui` MUST maintain Storybook stories for each reusable component, covering default + key states.

## Enforcement
- CI may run `build-storybook`
- PR checklist requires stories for new UI components
