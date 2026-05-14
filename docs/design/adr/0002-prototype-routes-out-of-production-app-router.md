# ADR-0002 · Prototype Routes Out Of Production App Router

| Status | Accepted |
| Date | 2026-05-14 |
| Owner | Frontend Lead |
| Reviewers | Eng Manager, Product Lead |
| Supersedes | — |
| Superseded by | — |
| Affects | `frontend/apps/web/src/app/prototype/**`, `frontend/apps/web/middleware.ts`, `docs/design/03-information-architecture.md` |

## 1. Context

The pre-rewrite frontend contains 17 `/prototype/*` routes under
`apps/web/src/app/prototype/`. These routes are indexed by Next.js App
Router, accessible at production URLs, and discoverable by crawlers.

Some prototype pages are near-duplicates of production routes (notably
`/prototype/ui-ux-v2-flagship` ≈ `/`). Each duplicate accumulated its own
copy of marketing copy, value propositions, and assets.

This violates:

- `docs/design/00-charter.md §7 N4` (No prototype routes in the
  production App Router).
- the principle of single source of truth (the marketing copy lives in two
  places).

## 2. Decision

Prototype, exploration, and design-sandbox pages live in
`apps/web/src/sandbox/` and are **not** routable in production. A
middleware rule blocks any prototype path in production environments.

## 3. Rationale

- Production routing is a contract. A route on `arbigamefi.com` implies
  product-grade behavior; prototypes do not.
- Design exploration is healthy. The fix is location, not deletion.
- Storybook serves component-level exploration. Page-level exploration
  belongs in a non-routable sandbox plus optional Vercel preview
  deployments.
- SEO: shipping half-finished pages to crawlers damages domain authority.

## 4. Alternatives Considered

| Alternative                                  | Pros                          | Cons                                                                      | Why not chosen                             |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| Keep prototype routes, add `noindex`         | Minimal change                | Still routable, still discoverable internally, still drifts vs production | Drift is the real problem, not just SEO    |
| Move prototype routes behind auth            | Hides them                    | Adds auth complexity; prototypes still ship to prod                       | Overkill                                   |
| Delete prototype routes entirely             | Cleanest                      | Loses design exploration history                                          | Sandbox preserves history without shipping |
| Move to `apps/web/src/sandbox/` non-routable | Preserves work; ships nothing | Sandbox is editor-discoverable only                                       | Chosen                                     |

## 5. Consequences

Positive:

- Production routes correspond 1:1 to `docs/design/03-information-architecture.md §3`.
- Design exploration continues without leaking to users.
- Removes ~17 page directories from production build.
- Bundle savings: prototype-only icons / mocks no longer ship to prod.

Negative:

- Designers must learn to preview via Storybook or local sandbox.
- Lose direct-URL sharing of prototype variants (replaced by Vercel preview
  deploys per branch).

## 6. Migration Plan

1. Move `apps/web/src/app/prototype/` → `apps/web/src/sandbox/`.
2. The sandbox folder must **not** be imported by anything under
   `apps/web/src/app/` (boundaries rule).
3. Add middleware:

   ```ts
   // apps/web/src/middleware.ts
   import { NextResponse } from "next/server";
   import type { NextRequest } from "next/server";

   export function middleware(req: NextRequest) {
     if (req.nextUrl.pathname.startsWith("/prototype")) {
       return NextResponse.rewrite(new URL("/404", req.url));
     }
   }
   ```

4. Add CI rule:
   ```bash
   test ! -d frontend/apps/web/src/app/prototype
   rg -nE "from .*sandbox" frontend/apps/web/src/app  # forbidden import
   ```
5. Storybook gains a `Sandbox/` section showing approved sandbox pages
   for design review.

## 7. SSOT Documents Affected

- `docs/design/03-information-architecture.md` — §3 sitemap explicitly
  excludes prototype.
- `docs/design/00-charter.md §7 N4` — restated.
- `docs/frontend/30-build-and-release.md` — preview deployment notes.

## 8. Acceptance Criteria

- [ ] `apps/web/src/app/prototype/` directory does not exist.
- [ ] Production build does not include sandbox files.
- [ ] Middleware blocks `/prototype/*` in production env.
- [ ] CI rule fails on reintroduction.

## 9. References

- Frontend audit `docs/design/north-star.md §1`.
- Charter `docs/design/00-charter.md §7-N4`.
- Frontend-rewrite blueprint `docs/design/frontend-rewrite-blueprint.md §2`.
