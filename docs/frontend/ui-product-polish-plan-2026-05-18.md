---
Owner: Frontend
Status: Active
Last Updated: 2026-05-18
Depends-on: docs/strategy/fullstack-product-architecture.md
---

# UI Product Polish Plan

## Thesis

ArbiGameFi should read as a lean B2C casino and sportsbook product: dense, fast, readable, and trustworthy. The UI should feel closer to an operating surface with clear betting affordances than to a protocol dashboard or internal audit console.

## Scope

This phase is not another architecture rewrite. It is a page-by-page product polish pass covering:

- marketing home
- affiliate landing
- casino directory
- casino room
- sportsbook list and market detail
- portfolio overview, activity, claims, referral
- earn
- ops
- legal pages

## Visual Bar

Every primary page must pass these checks before launch:

- First viewport states the user job without extra explanation.
- Primary action is visually dominant and unambiguous.
- Numbers, odds, payout, status, and proof data use consistent hierarchy.
- Mobile layout has no clipped labels, crowded controls, or horizontal overflow.
- Empty, loading, error, disconnected, wrong-chain, and terminal states are designed, not accidental.
- Components use the active token system only: `surface`, `fg`, `brand`, `accent`, and semantic status tokens.
- No page relies on old shadcn semantic tokens such as `muted`, `background`, `primary`, `accent`, or `ring`.

## Priority Order

1. Component baseline cleanup: token consistency, disabled states, focus rings, typography, skeletons, pagination, toast, copy controls.
2. Casino room: bet panel, round status, result modal, game stage readability, recent bets, mobile betting flow.
3. Casino directory and home room directory: scannable games, stronger status/proof hierarchy, less decorative weight.
4. Portfolio and activity: ledger density, status chips, receipt pages, empty states.
5. Earn and affiliate: conversion clarity, risk copy, referral economics, connected/disconnected states.
6. Sportsbook: market list scanning, ticket placement, terminal ticket status.
7. Ops and legal: restrained operational readability.

## First Wave

The first implementation wave is intentionally small and low risk:

- replace legacy UI token classes in shared UI components
- remove arbitrary text sizes in shared primitives
- improve disabled/hover/focus surfaces
- tighten skeleton and toast presentation
- keep global palette unchanged until page screenshots confirm the change is worth it

## Verification

Each wave needs:

- `pnpm -C frontend/packages/ui test`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend/apps/web build`
- rendered desktop and mobile screenshot checks for the pages touched in that wave

## Stop Rules

- Do not introduce a new design system.
- Do not add new marketing copy unless it clarifies a user action.
- Do not change contract or SDK behavior for a visual-only fix.
- Do not redesign every page at once; polish by highest traffic and highest user-risk surface first.
