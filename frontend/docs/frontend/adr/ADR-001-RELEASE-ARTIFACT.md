# ADR-001: Release Artifact Strategy (Embedded by Default)

## Context
SSOT protocol addresses and module mappings must be sourced from a single truth, similar to contract release artifacts.

## Decision
We embed a validated release snapshot JSON into the build (`packages/ssot/release/embedded`).
Runtime remote loading MAY be added later, but must be validated and can only relax into read-only on failure.

## Alternatives
- Environment variables / hand-typed addresses
- Always remote-load from CDN/Git

## Consequences
- Frontend releases are tied to a specific protocol release digest.
- Safer: prevents silent drift and misconfigured networks.
