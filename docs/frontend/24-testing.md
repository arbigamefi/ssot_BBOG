# 24 · Testing Strategy

| Owner | Frontend Lead |
| Status | Draft v1 |
| Last Updated | 2026-05-14 |
| Depends on | `../design/00-charter.md`, `../design/11-component-library.md`, `../design/13-web3-ux.md`, `../design/14-data-and-state.md`, `20-accessibility.md`, `22-performance.md` |
| Supersedes | — |

The testing strategy is a **pyramid with gates**. Every level has a clear
purpose, a clear coverage target, and a CI enforcement contract.

## 1. Test Pyramid

```
       e2e (Playwright)              [slow, broad, few]
       ────────────────
       visual regression             [Chromatic / Playwright snapshots]
       ────────────────
       integration / a11y           [Storybook + axe + @testing-library]
       ────────────────
       unit                         [vitest — fast, many]
```

| Tier        | Tool                                                    | Target                                                                   |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Unit        | `vitest` + `@testing-library/jest-dom`                  | logic, formatters, hooks, zod schemas                                    |
| Component   | Storybook + `@storybook/test` + `@storybook/addon-a11y` | UI primitives & patterns                                                 |
| Visual      | Chromatic (preferred) or Playwright snapshots           | per-component & per-page regression                                      |
| Integration | `@testing-library/react` + vitest                       | feature data hooks, form flows                                           |
| Contract    | vitest                                                  | encoding/decoding equality with `deployments/golden-vectors-latest.json` |
| e2e         | Playwright (incl. axe-playwright)                       | per-route happy + critical failure path                                  |
| Performance | Lighthouse CI                                           | per-route Web Vitals & bundle                                            |

## 2. Coverage Targets

| Layer                           | Statements                | Branches |
| ------------------------------- | ------------------------- | -------- |
| `@ssot/ui` primitives           | ≥ 95%                     | ≥ 90%    |
| `@ssot/ui` patterns             | ≥ 85%                     | ≥ 80%    |
| `@ssot/ui` utils                | 100%                      | 100%     |
| `@ssot/ssot` SDK + encoding     | 100%                      | 100%     |
| `apps/web` `features/*/data`    | ≥ 80%                     | ≥ 75%    |
| `apps/web` `features/*/actions` | ≥ 75%                     | ≥ 70%    |
| `apps/web` page composers       | ≥ 60% (composition tests) | n/a      |

Below target → CI fails.

## 3. Unit Tests

### 3.1 Conventions

- File next to source: `Button.test.tsx`, `format-amount.test.ts`.
- One `describe` per export.
- Test names: `it('formats <input> as <output>')`, not `it('works')`.
- No snapshot tests on logic — snapshots only for stable JSON structures
  (e.g., calldata vectors).

### 3.2 Hooks

`@testing-library/react`'s `renderHook` + RTK Query test wrappers.
TanStack Query test setup uses `QueryClientProvider` with retry disabled.

### 3.3 zod schemas

Round-trip tests:

```ts
it('rejects negative amount', () => {
  expect(() => placeBetSchema.parse({ amount: -1n, ... })).toThrow();
});
```

### 3.4 Formatters

Property-based tests via `fast-check` for `formatAmount`, `formatPercent`,
etc. — catches edge cases like 0n, `MAX_UINT256`, locale boundary cases.

## 4. Component Tests (Storybook)

### 4.1 Story coverage

Every primitive ships with:

- a `default.stories.tsx`
- a `states.stories.tsx` (one story per visual state)
- an interaction story using `@storybook/test`'s `play` function
- accessibility story via `@storybook/addon-a11y` (auto-enabled)

Every pattern adds:

- one composition story
- one error-state story
- one mobile-breakpoint story

### 4.2 Interaction tests

```tsx
import { expect } from "@storybook/test";
import { userEvent, within } from "@storybook/test";

export const PlacesBet: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText("Amount"), "10");
    await userEvent.click(c.getByRole("button", { name: /place bet/i }));
    await expect(c.getByText(/placing/i)).toBeInTheDocument();
  },
};
```

Stories with interactions are part of the build (`test-storybook`).

### 4.3 a11y per story

`@storybook/addon-a11y` runs axe on render. Serious/Critical violations
break the test.

## 5. Visual Regression

### 5.1 Tooling

Chromatic preferred; Playwright snapshots fallback.

### 5.2 Coverage

| Surface             | Variants captured                           |
| ------------------- | ------------------------------------------- |
| Every primitive     | default, hover, focus, active, disabled     |
| Every pattern       | each story marked `visual: true`            |
| Every primary route | desktop + mobile + dark theme + light theme |
| Loading skeletons   | per route                                   |
| Error states        | per route                                   |

### 5.3 Baseline workflow

- `main` branch is the canonical baseline.
- PR diffs require human approval for intentional changes.
- An auto-merge of a visual regression is impossible.

### 5.4 What we don't snapshot

- Live data values (we mock data with fixed seeds).
- Animations mid-frame (snapshots happen after `animate.complete`).
- Time-dependent UI (clocks frozen via `vi.setSystemTime`).

## 6. Integration & Form Tests

For `features/*/actions` flows: mock wagmi clients via `wagmi/connectors/mock`
and run the full state machine from `13-web3-ux.md §5`. Asserts:

- simulate runs before sign
- successful path invalidates declared query keys
- rejected user flow returns to idle without toast
- timeout path surfaces refund affordance

## 7. Contract Tests

The frontend encoders must produce **byte-equal** calldata to
`deployments/golden-vectors-latest.json`.

```ts
it.each(vectors)("encodes vector %#", (vector) => {
  const encoded = sdk.encode.placeBet(vector.input);
  expect(encoded).toEqual(vector.placeBetCalldata);
});
```

Vectors generated by the contracts repo (see
`docs/release/WHITEPAPER-PUBLISHING-STANDARD.zh-CN.md §X` and
`docs/frontend/README.md §2`).

## 8. End-to-End Tests (Playwright)

### 8.1 Scope

Per primary route, e2e covers:

- happy path
- one critical failure (rejected sign / wrong chain / paused bank)
- mobile viewport (`iPhone 14`)

Total ~25 e2e scenarios in v1. They run in CI nightly + pre-release.

### 8.2 Wallet emulation

Playwright uses a pre-seeded ephemeral wallet via `wagmi`'s mock connector
or `@nomicfoundation/hardhat-network-helpers` Anvil chain in CI. Real
mainnet is never reached.

### 8.3 a11y in e2e

`@axe-core/playwright` runs per page. Same severity contract as `20-`.

## 9. Performance Tests

### 9.1 Lighthouse CI

Runs against PR preview deployment.

`.lighthouserc.cjs`:

```js
module.exports = {
  ci: {
    collect: {
      url: [
        "/",
        "/casino",
        "/casino/dice",
        "/sportsbook",
        "/portfolio",
        "/earn",
        "/ops",
      ],
      numberOfRuns: 3,
    },
    assert: {
      preset: "lighthouse:no-pwa",
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 1.0 }],
        "first-contentful-paint": ["error", { maxNumericValue: 1800 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
      },
    },
  },
};
```

### 9.2 Bundle budget

`@next/bundle-analyzer` JSON → `scripts/check-bundle-budget.mjs` enforces
`22-performance.md §3`.

## 10. Test Data

### 10.1 Fixtures

`apps/web/src/test/fixtures/` hosts:

- `release.fixture.ts` — a frozen release manifest
- `bets.fixture.ts` — bet rows in every state
- `markets.fixture.ts` — sportsbook markets

Fixtures use real-world bigint amounts and addresses. They are the only
source of test data. Inline magic numbers in tests are rejected.

### 10.2 Mock SDK

`apps/web/src/test/mocks/sdk.ts` provides a mock `@ssot/ssot/sdk`
implementation injectable via the provider override. Behavior is
deterministic.

### 10.3 Mock wagmi

`wagmi/connectors/mock` with a deterministic account.

### 10.4 Time

`vi.useFakeTimers()` + `vi.setSystemTime()` for any test that touches
time. The system time is `2026-05-13T12:00:00Z` for all unit tests.

## 11. CI Pipeline

```yaml
# .github/workflows/frontend.yml (excerpt)
jobs:
  unit: # vitest, all packages
  components: # storybook test-runner
  integration: # vitest in feature folders
  contract: # golden-vector equality
  visual: # Chromatic
  e2e: # Playwright (preview deployment)
  perf: # Lighthouse CI (preview deployment)
  a11y: # axe-playwright (preview)
```

Order: `unit` + `components` + `integration` + `contract` are required;
`visual` + `e2e` + `perf` + `a11y` are required on PRs touching UI.

## 12. Lint & Type Gates

| Tool                                       | Required           |
| ------------------------------------------ | ------------------ |
| `pnpm typecheck`                           | per package        |
| `pnpm lint`                                | ESLint flat config |
| `prettier --check`                         | format             |
| `pnpm -C frontend/packages/ui lint:tokens` | token usage        |
| `secretlint`                               | secrets            |

ESLint key rules:

- `jsx-a11y/*` per `20-accessibility.md §13`
- `no-restricted-imports`: ban wagmi/viem outside allowed paths
- `no-restricted-syntax`: ban `transition-all` Tailwind class
- `boundaries/element-types`: enforces feature/pattern/primitive dependency direction

## 13. Local Workflow

```bash
# Fast loop
pnpm dev
pnpm test --watch
pnpm storybook

# Pre-push
pnpm typecheck && pnpm lint && pnpm test
```

Husky pre-commit: lint-staged. Pre-push: typecheck + unit tests.

## 14. Don'ts

- No snapshot test of arbitrary HTML — fragile.
- No `jest`/`mocha`/`tape` — we use vitest.
- No mocking of `@ssot/ssot` SDK at unit level beyond the official mock —
  it should remain interface-stable.
- No `it.skip` / `it.todo` in `main` without a tracking issue link.
- No use of real testnet RPC in CI.
- No flaky-tolerated tests — quarantine within 24h.
- No console.log in tests (eslint `no-console: error`).

## 15. How To Enforce

```bash
pnpm typecheck
pnpm test          # vitest all
pnpm test:contract # golden vectors
pnpm test:storybook
pnpm e2e
pnpm e2e:a11y
pnpm lighthouse:ci
node scripts/check-bundle-budget.mjs
```

## 16. Glossary

| Term                | Meaning                                          |
| ------------------- | ------------------------------------------------ |
| Pyramid             | Test-tier model: many small, few large           |
| Snapshot            | Saved expected output compared on each run       |
| Visual regression   | Snapshot of rendered pixels for diff             |
| Property-based test | Test that runs many randomly generated inputs    |
| Quarantine          | Mark flaky test, move to nightly, fix within SLA |
