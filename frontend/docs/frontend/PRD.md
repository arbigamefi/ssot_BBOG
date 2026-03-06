# PRD — SSOT Frontend v2 (Institution-Grade)

**Status**: Draft → Gate-0 (Interface Freeze)

## 1. Mission
Build a **proof-disciplined** frontend that treats the protocol integration and UI consistency as first-class, governed artifacts—mirroring SSOT contract development practices.

This frontend must be:
- **SSOT-aligned**: addresses/ABIs/gameIds/assets are sourced from a **Release Artifact**.
- **Auditable**: every write transaction is preflight-simulated; user-visible errors are deterministic and domain-mapped.
- **Reproducible**: bet/history derives from Hub events and is replayable locally.
- **UI-governed**: page layout + component style rules are defined in an explicit **UI Constitution**.

## 2. Scope
### In-scope (v2)
- Games: Dice, CoinToss, Roulette, Keno
- Betting: plan→approve (if needed)→placeBet (payable VRF fee)
- Bet lifecycle: events as truth (placed / randomReady / finalized / refunded)
- LP: per-asset Bank (NAV/reserved/free/min liquidity/protocol fees/XP buckets)
- Referral: bindReferrer + affiliate use in bets
- VRF refund credit: view + claim
- Release identity: show release digest in UI and bind it into tx journal
- Storybook-based UI development with mock Domain data

### Not in-scope (v2 initial)
- Admin console (governance/config management)
- Mandatory subgraph dependency (allowed as accelerator later; not truth)
- Full analytics product (only minimal ops/telemetry)

## 3. Core Principles (MUST)
1. **Release Artifact is the only source of protocol truth**
   - No hardcoded hub/bank addresses outside release files.
2. **Protocol integration is a single entrypoint**
   - UI/pages MUST NOT import ABIs/addresses or encode bytes directly.
3. **Events are facts**
   - Bet history and state derive from Hub events; view calls are secondary/reconcile.
4. **Write transactions are executed via txPipeline**
   - Preflight simulate → stepper (approve/place) → receipt → event reconcile → journal.
5. **UI is governed**
   - All layout/spacing/typography/colors/states are governed by `UI-CONSTITUTION.md`.
   - New pages MUST include a page spec under `PAGE-SPECS/`.

## 4. Architecture Overview
See ADRs for decisions.

- `packages/ssot`: Release loader, config, SDK surface, indexer, error decoding
- `packages/ui`: Design tokens + shadcn components + Storybook
- `apps/web`: Next.js app router; feature composition; no ABI imports

## 5. Functional DoD (v2)
1. All bets via `Hub.placeBet(payable)` with VRF fee from `Hub.quoteVRFFee(betCount)`
2. ERC20 approvals target `bank = hub.bankFor(asset)`, default to **top-up only**
3. Bet history from Hub events; params decoded per game
4. Refund and claimRefundCredit are accessible in UI
5. LP shows SSOT Bank semantics (NAV/reserved/free/minLiq/PF/XP buckets)
6. Referral bindReferrer works; affiliate is passed (if configured) without violating pricing policy
7. UI shows release digest (at least first 8 chars)
8. Read-only mode triggers if release is invalid/unavailable

## 6. Non-Functional DoD
- DomainError mapping (no raw revert selectors in UI)
- Local tx journal records action, tx hashes, release digest, timestamps
- Indexer supports confirmations/reorg rollback
- Storybook coverage for core UI components/states
- Boundary lint prevents protocol leakage into UI
