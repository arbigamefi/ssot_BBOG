# SSOT Frontend — Phase 2 Backlog

> From "it runs" to "operationally ready".

## Pre-Conditions (Phase 1 completed)

- SDK tests pass (64 unit tests)
- Three packages typecheck with zero errors
- Theme token abstraction enables one-file brand swap
- Error boundary + Toaster wired
- Code-split game page, liquidity page, claims page
- Architecture boundary enforced by ESLint (no direct wagmi/viem in feature code)

---

## Legend

| Tag | Meaning |
|-----|---------|
| **P0** | Launch blocker — cannot go live without this |
| **P1** | Must-have for operational quality |
| **P2** | Nice-to-have / completeness |
| **Dep** | Dependency — must ship before dependent items |

---

## Backlog Items

### 1. SDK: `Hub.finalize(betId)` — P0 / Dep

**Why**: If a bet is stuck in `randomReady` (VRF delivered random but `onRandomWords` callback ran out of gas or Hub's auto-finalize failed), the user has no way to push it to `finalized`. This is a launch blocker.

**Acceptance**:
- `sdk.hub.finalize(betId)` calls `Hub.finalize(uint256)` via `simulateAndWrite`
- Typecheck passes; unit test covers revert mapping

**Files**: `packages/ssot/src/sdk/types.ts`, `create.ts`

---

### 2. SDK: `Hub.bindReferrer` + `referrerOf` — P1 / Dep

**Why**: Referral page cannot function without these.

**Acceptance**:
- `sdk.hub.bindReferrer(referrer)` writes; `sdk.hub.referrerOf(player)` reads
- Typecheck passes

**Files**: `packages/ssot/src/sdk/types.ts`, `create.ts`

---

### 3. SDK: 14 Missing Error Mappings — P1

**Why**: Without mappings, contract reverts display as generic `REVERT_ErrorName` strings instead of user-friendly messages.

**Missing Hub errors**: `BetNotFound`, `NotVRFHub`, `InsufficientBalance`, `InvalidBps`, `InvalidConfig`, `ZeroAddress`

**Missing Bank errors**: `BetAlreadyExists`, `BetNotOpen`, `ReservedTooSmall`, `RefundTooLarge`, `XPInvalidAward`, `XPTooManyAwards`, `EnforcedPause`, `NotHub`

**Acceptance**:
- All custom errors from Hub.abi.json and Bank.abi.json have entries in `mapRevert`
- Test covers each new mapping

**Files**: `packages/ssot/src/sdk/errors.ts`, `errors.test.ts`

---

### 4. SDK: `Bank.maxWithdraw` + `maxRedeem` + `mint` — P1

**Why**: Liquidity page "Max" button requires on-chain view call. `mint` completes ERC4626 surface.

**Note**: Bank ABI shows `maxWithdraw(owner)` and `maxRedeem(owner)` take a single `address` parameter (not asset), because each Bank instance is asset-specific.

**Acceptance**:
- `sdk.bank.maxWithdraw(owner)` and `sdk.bank.maxRedeem(owner)` return `bigint`
- `sdk.bank.mint(shares, receiver)` writes, returns `TxResult & { assets?: bigint }`
- Liquidity page uses these for "Max" button

**Files**: `packages/ssot/src/sdk/types.ts`, `create.ts`, `apps/web/src/app/liquidity/pageClient.tsx`

---

### 5. txPipeline: Timeout + Retry + Rate Limit — P1

**Why**: `waitForTransactionReceipt` has no timeout. If a TX never confirms, UI spins forever. RPC providers throttle at ~5 req/s.

**Acceptance**:
- Receipt timeout: 120s (throws `TX_TIMEOUT` domain error)
- Simulate retry: 1 retry with 2s backoff on transient RPC errors
- RPC throttle: minimum 200ms between calls
- Tests for timeout and retry paths

**Files**: `packages/ssot/src/sdk/txPipeline.ts`, `txPipeline.test.ts`

See: ADR-026-INDEXER-BANK-EVENTS.md, ADR-027-TX-TIMEOUT-RETRY.md

---

### 6. Indexer: Bank Events — P1

**Why**: Hub indexer covers 4 events (BetPlaced, BetRandomReady, BetFinalized, BetRefunded). Bank events are completely unindexed: XPAwarded, XPLockedUnlocked, XPHoldbackReleased, XPAcruedClaimed, BetSettled. Claims page relies on on-demand reads with no historical visibility.

**Also**: Fix atomicity bug — hubIndexer cursor update is outside the Dexie transaction.

**Acceptance**:
- `bankIndexer.ts` indexes 5 Bank events using same cursor+rewind pattern
- Dexie schema extended: `bankEvents`, `xpHistory` tables
- hubIndexer cursor update moved inside Dexie transaction
- Ops page shows bank indexer sync status

**Files**: `packages/ssot/src/indexer/bankIndexer.ts` (new), `schema.ts`, `hubIndexer.ts`, `index.ts`

See: ADR-026-INDEXER-BANK-EVENTS.md

---

### 7. Referral Page — P1 (depends on #2)

**Why**: Currently a placeholder. Referral is a core user acquisition feature.

**Acceptance**:
- Query current referrer: `sdk.hub.referrerOf(account)`
- Bind referrer form: `sdk.hub.bindReferrer(address)`
- Display binding status with success/error toast

**Files**: `apps/web/src/app/referral/page.tsx`, `pageClient.tsx` (new)

---

### 8. Bet Detail Enhancement — P1 (depends on #1)

**Why**: `/bets/[betId]` only shows basic fields. Users cannot refund stuck bets or finalize ready bets from the UI.

**Acceptance**:
- Display full bet info from `sdk.hub.getBet(betId)`
- Refund button (visible when state=placed and timeout elapsed)
- Finalize button (visible when state=randomReady)
- TX stepper shows operation progress

**Files**: `apps/web/src/app/bets/[betId]/page.tsx`, `pageClient.tsx`

---

### 9. SDK Integration Tests — P1

**Why**: 64 unit tests cover individual functions, but no integration test exercises the `createSSOTSDK()` → plan → execute flow end-to-end with mocked viem clients.

**Acceptance**:
- Factory output shape test
- planPlaceBet → executePlan flow (mock publicClient + walletClient)
- deposit → withdraw → redeem flow
- Error mapping injection test
- reconcile flow test

**Files**: `packages/ssot/src/sdk/__tests__/integration.test.ts` (new)

---

### 10. UI Quality: Skeleton + ARIA — P2

**Why**: No loading skeletons (pages flash empty). No ARIA live regions for error callouts. No focus management.

**Acceptance**:
- Skeleton component in `@ssot/ui`
- `role="alert" aria-live="polite"` on ErrorCallout
- `aria-current="step"` on TxStepper
- Loading states use `<Skeleton />` instead of text

**Files**: `packages/ui/src/components/ui/skeleton.tsx` (new), protocol components

---

### 11. i18n Infrastructure — P2 (optional)

**Why**: No i18n foundation. All strings are hardcoded in English.

**Acceptance**:
- String key type definitions
- English string bundle
- i18n Provider context
- One component converted as proof (ErrorCallout)

**Files**: `packages/ui/src/i18n/` (new directory)

---

## Execution Order

```
Batch 1 (blockers):   #1 finalize + #2 referrer SDK + #3 error mappings
Batch 2 (core):       #4 maxWithdraw + #5 txPipeline + #6 bank indexer  [parallel]
Batch 3 (pages):      #7 referral + #8 bet detail + #9 integration tests [parallel]
Batch 4 (polish):     #10 skeleton/ARIA + #11 i18n                       [parallel]
```

## Verification (every PR)

1. `pnpm typecheck` — zero errors across all 3 packages
2. `pnpm test` — all tests pass
3. `pnpm lint` — ESLint architecture boundary enforced
