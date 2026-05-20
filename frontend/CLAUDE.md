# ArbiGameFi Frontend — AI Runtime Rules

This file is the short rule set for AI-assisted work inside `frontend/`.
Detailed policy lives in `../docs/frontend/32-ai-pairing.md`; current execution
order lives in `../docs/design/frontend-implementation-roadmap.md`; the
fullstack boundary lives in
`../docs/strategy/fullstack-product-architecture.md`.

If this file conflicts with release artifacts, contract SSOT, accepted ADRs, or
the active roadmap, those sources win.

## Operating Priority

1. Fix runtime correctness before cleanup.
2. Preserve chain-derived truth: release manifests, SDK encoding, golden
   vectors, result receipts, and keeper settlement.
3. Keep launch requirements in scope: i18n, security, testing, release hygiene,
   keeper, and durable bet index.
4. Simplify only where ownership is clear and no runtime boundary is crossed.
5. Do not add white-label/operator frontend work without a real requirement.

## Boundaries To Keep

Do not collapse or rewrite these for cosmetic simplicity:

- `frontend/packages/ssot/**`
- `frontend/packages/bet-index/**`
- `frontend/apps/keeper/**`
- `deployments/**`
- `docs/frontend/{21,23,24,30}-*.md`

## Hard Rules

AI-assisted changes must not:

- expose raw RPC, viem, ABI, contract, or server errors as product copy;
- add inline user-facing product copy without i18n keys;
- add product UI hex literals, per-game brand colors, `--ag-*`,
  `visual-system.ts`, or `cyber-*`;
- add prototype routes to `apps/web/src/app`;
- reintroduce legacy route aliases such as `/dice`, `/roulette`, `/invest`, or
  `/bets`;
- import wagmi, viem, or RainbowKit from pages or unrelated UI components;
- send transactions without a simulation/planning step;
- use native `<input type="number">` for asset amounts;
- use `parseFloat` or `Number(...)` on user-entered asset amounts;
- add `transition-all` or `dark:` Tailwind variants;
- create a new shell when `AppShell` variants are enough;
- edit generated deployment artifacts directly;
- edit audit reports as normal mutable docs;
- add a subgraph for MVP indexing.

If a user asks for one of these, explain the issue and propose the conforming
alternative.

## Preferred Checks

Use the smallest gate that proves the change.

Docs only:

```bash
pnpm -C frontend exec prettier --write <changed-docs>
git diff --check
```

Web app code:

```bash
pnpm -C frontend/apps/web typecheck
pnpm -C frontend/apps/web test
pnpm -C frontend/apps/web build
git diff --check
```

Shared runtime boundary:

```bash
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend build
git diff --check
```

After `pnpm -C frontend/apps/web build`, restore
`frontend/apps/web/next-env.d.ts` to reference `.next-dev/types/routes.d.ts`
before committing.

## Fast Scans

```bash
test ! -d frontend/apps/web/src/app/prototype
rg -n "prototype|compat|legacy|visual-system|cyber-" frontend/apps/web/src frontend/packages
rg -n -e "SiteChrome|TrustShell|ImmersiveGameLayout|PrototypeGameLayout|ShellSwitcher" frontend/apps/web/src
find frontend/apps/web/public -path '*ops*' -maxdepth 5 -print
```

Expected result is empty unless a future ADR explicitly changes the frontend
architecture.

## When To Update Docs

Update docs when a durable decision changes, when a runbook would mislead an
operator, or when an accepted ADR is superseded. Do not add docs just to
preserve chat history.

## PR / Commit Notes

AI disclosure is useful for substantial PRs or work touching money, security,
release, or settlement flow. It is not needed for every small local commit.

```markdown
## AI Assistance

- scope: <files or subsystem>
- basis: <roadmap, ADR, test, or runtime evidence>
- human-reviewed: yes
```
