# ADR-002: Protocol SDK Boundary (Single Entry Point)

## Context
Protocol drift historically happens when UI code directly imports ABIs/addresses and hand-encodes bytes.

## Decision
All protocol reads/writes MUST go through `packages/ssot` SDK.
UI/feature code MUST NOT:
- import ABIs/addresses
- encode `bytes` parameters
- call `viem.getLogs` directly

## Enforcement
- ESLint boundary rules
- PR review checklist items

## Consequences
- Slightly more up-front structure
- Dramatically reduced long-term drift risk
