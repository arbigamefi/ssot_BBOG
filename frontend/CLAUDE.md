# ArbiGameFi Frontend — AI Runtime Rules

This file is the short rule set for AI-assisted work inside `frontend/`.
Detailed policy lives in `../docs/frontend/`; the fullstack boundary lives in
`../docs/strategy/fullstack-product-architecture.md`.

If this file conflicts with release artifacts, contract SSOT or accepted ADRs,
those sources win.

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
- add redirect aliases, compatibility layers or migration code for earlier
  builds: the project is pre-launch, so replaced code is deleted outright;
- import wagmi, viem, or RainbowKit from pages or unrelated UI components;
- send transactions without a simulation/planning step;
- use native `<input type="number">` for asset amounts;
- use `parseFloat` or `Number(...)` on user-entered asset amounts;
- add `transition-all` or `dark:` Tailwind variants;
- create a new shell when `AppShell` variants are enough;
- edit generated deployment artifacts directly;
- edit audit reports as normal mutable docs;
- add a subgraph for MVP indexing;
- mix old-palette utilities (`surface-*`, `fg-*`, `brand`, `accent`, state
  colours) into a page rebuilt in Carbon copy.

If a user asks for one of these, explain the issue and propose the conforming
alternative.

## Brand: Carbon Copy

The brand is Carbon copy (`../docs/design/01-brand.md`): every bet prints a
receipt, and the receipt is the visual language. Pages move to it one at a
time (`01-brand.md` §11).

- A rebuilt page uses only Carbon copy utilities from
  `packages/ui/src/tokens/carbon-copy.css` (`bg-carbon`, `bg-paper`, `text-ink`,
  `text-faded`, `text-display`, `font-print`, `rounded-sheet`, …).
- Ink never sits on carbon. Input edges on paper use `faded`, never `thermal`.
- `font-print` (Doto) prints figures only. Rebuilt pages use no monospace face.
- Only printed objects are boxed (receipt, slip, ticket stub, stamp, scale):
  no cards, no decorative shadows, no win or lose colours, no confetti.
- Use the terms in `../docs/design/02-voice-and-copy.md` §2 in every locale
  (Liquidity, House pool, Rewards, Stake, Win chance, …). Contract names appear
  only under technical details.
- Copy follows the site state from `getCasinoAccess`: preview, testnet or live.
- When the last page moves, delete `arbi-dark.css`, `arbi-light.css` and the old
  theme entries in the same change.

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
```

Expected result is empty unless a future ADR explicitly changes the frontend
architecture.

## When To Update Docs

Update docs when a durable decision changes or when a runbook would mislead an
operator. Rewrite the current doc instead of stacking superseded records. Do not
add docs just to preserve chat history.

## PR / Commit Notes

AI disclosure is useful for substantial PRs or work touching money, security,
release, or settlement flow. It is not needed for every small local commit.

```markdown
## AI Assistance

- scope: <files or subsystem>
- basis: <roadmap, ADR, test, or runtime evidence>
- human-reviewed: yes
```
