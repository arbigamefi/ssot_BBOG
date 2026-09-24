# Frontend Engineering Docs — Lean Index

| Owner | Frontend Lead |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../strategy/fullstack-product-architecture.md`, `../design/frontend-implementation-roadmap.md` |

This directory contains launch-relevant engineering references for the frontend
and adjacent runtimes. It is no longer a process-gate directory.

## Required For Launch

- [`README.md`](./README.md) — release artifact contract, frontend manifest,
  golden vectors, v1.3 ABI/release rules, and sportsbook release gates.
- [`21-i18n.md`](./21-i18n.md) — multilingual launch policy.
- [`23-security.md`](./23-security.md) — wallet, RPC, CSP, secret, and supply
  chain rules.
- [`24-testing.md`](./24-testing.md) — tests and proof gates.
- [`30-build-and-release.md`](./30-build-and-release.md) — build, release,
  preview, rollback, and environment handling.
- [`casino-keeper-v1.md`](./casino-keeper-v1.md) — casino keeper operation and
  automatic settlement contract.
- [`mobile-wallet-entry.md`](./mobile-wallet-entry.md) — mobile wallet handoff,
  connection prompts, and frontend mainnet availability boundaries.

## Keep As Reference

- [`20-accessibility.md`](./20-accessibility.md) — accessibility baseline.
- [`22-performance.md`](./22-performance.md) — bundle/Core Web Vitals targets.
- [`25-observability.md`](./25-observability.md) — Sentry/RUM/event guidance.

## Low-Churn / Historical Process Docs

These may be slimmed or folded into the required docs when touched:

- [`31-governance.md`](./31-governance.md)
- [`32-ai-pairing.md`](./32-ai-pairing.md)

The runtime assistant rules live in [`../../frontend/CLAUDE.md`](../../frontend/CLAUDE.md);
that file is more important than keeping process theory in this directory.

## Operating Rule

Before adding a new frontend engineering document, name the launch risk or
runtime boundary it protects. If the answer is only "process consistency", add
the rule to the active roadmap or an existing doc instead.
