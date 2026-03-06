# ADR-030: Deploy Preview on Pull Requests

## Status

Accepted

## Context

PR reviewers must currently checkout branches locally and build to verify frontend changes. This slows down the review cycle and makes it harder to test visual/UX changes.

## Decision

Use Vercel CLI in a GitHub Actions workflow to deploy preview URLs on every PR that touches `frontend/`.

### Key design choices:

1. **Vercel CLI** (not Vercel GitHub integration) — gives full control over build and deploy steps, avoids auto-deploy of non-frontend PRs.

2. **PR path filter** — only triggers on changes in `frontend/` to avoid unnecessary deploys for Solidity-only PRs.

3. **Comment update pattern** — reuses a single PR comment (finds + updates) instead of creating new comments on each push, keeping the PR thread clean.

4. **Concurrency group** — cancels in-progress deploys when a new commit is pushed to the same PR.

5. **Skip drafts** — `if: github.event.pull_request.draft == false` avoids wasting build minutes on WIP branches.

## Required Secrets

| Secret | Where to get it |
|--------|----------------|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | `vercel link` → `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `vercel link` → `.vercel/project.json` |

## Alternatives Considered

- **Vercel GitHub App**: Auto-deploys everything, no fine-grained control. Rejected because the repo mixes Solidity and frontend code.
- **Netlify**: Viable but team already uses Vercel for other projects.
- **Cloudflare Pages**: Good option but less mature Next.js support at time of decision.

## Consequences

- Every non-draft PR gets a preview URL within ~2-3 minutes.
- Reviewers can test changes without local builds.
- Vercel usage is billed per-build (free tier: 6000 build-minutes/month).
