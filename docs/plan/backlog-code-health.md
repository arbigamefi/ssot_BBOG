# Code Health Backlog

Post-audit code hygiene fixes. All items are non-critical (no direct fund-loss risk)
but improve maintainability, debugging ergonomics, and defensive coding.

Tracked as individual PRs; doc-first per CONTRIBUTING.md.

---

## Issues

### H-1 — AccountingLib.nav() unchecked overflow risk

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Status** | Pending |
| **PR** | `fix/h1-nav-unchecked-overflow` |
| **ADR** | None (defensive fix within existing function; ADR-0002 unchanged) |
| **Files** | `src/libs/AccountingLib.sol` |

`PF + XP` addition inside `unchecked` block could silently wrap on overflow.
Move addition to checked context; keep subtraction unchecked (safe after guard).

### H-2 — Error semantics: InsufficientBalance misused as authorization error

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Status** | Pending |
| **PR** | `fix/h2-error-semantics` |
| **ADR** | ADR-0026 |
| **Files** | `src/libs/Errors.sol`, `src/access/Governable.sol`, `src/core/Bank.sol` |

`Errors.InsufficientBalance()` is used for 4 authorization/config checks.
Add `Errors.Unauthorized()`, replace misuses.

### M-5 — Duplicated \_shouldStop across 4 game modules

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Status** | Pending |
| **PR** | `refactor/m5-stop-logic-lib` |
| **ADR** | ADR-0027 |
| **Files** | `src/libs/StopLogic.sol` (new), 4 modules, 2 diff tests |

Identical `_shouldStop` function in CoinToss, Dice, Roulette, Keno modules
and 2 diff test files. Extract to shared `StopLogic` library.

### L-1 — Errors.BadConfig redundant with InvalidConfig

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Status** | Pending |
| **PR** | `fix/errors-cleanup-l1-l4` |
| **ADR** | None |
| **Files** | `src/libs/Errors.sol`, `src/core/VRFHub.sol` |

`BadConfig` used once (VRFHub:144), same semantics as `InvalidConfig`.
Replace and remove. Also fixes indentation inconsistency.

### L-4 — SafeTransferLib.sol dead code

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Status** | Pending |
| **PR** | `fix/errors-cleanup-l1-l4` (combined with L-1) |
| **ADR** | None |
| **Files** | `src/libs/SafeTransferLib.sol` |

Not imported anywhere. Bank.sol uses OZ SafeERC20 (ADR-0015). Delete.

---

## PR Dependency Graph

```
PR 1 (this backlog)
  |
  v
PR 2 (L-1 + L-4)
  |
  +---> PR 3 (H-2)   -- depends on clean Errors.sol
  |
  +---> PR 4 (H-1)   -- depends on clean Errors.sol, parallel with PR 3
  |
PR 5 (M-5)           -- independent, merge any time after PR 1
```

## Acceptance Criteria

- All 5 issues marked completed
- `make pr` passes after each PR merge
- ADR-0026 and ADR-0027 recorded in `docs/adr/README.md`
- CHANGELOG updated per PR
