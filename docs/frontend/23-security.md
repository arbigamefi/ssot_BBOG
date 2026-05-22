# 23 · Security & Privacy

| Owner | Frontend Lead + Security |
| Status | Active |
| Last Updated | 2026-05-18 |
| Depends on | `../design/13-web3-ux.md`, `30-build-and-release.md` |
| Supersedes | Draft v1 exhaustive security spec |

The frontend is a wallet-facing app. Security work focuses on phishing
resistance, secret hygiene, wallet safety, and dependency discipline.

## 1. Threats We Care About Now

| Threat                                  | Control                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| Look-alike or stale deployment          | release digest, domain copy, BaseScan links                   |
| Wallet draining through bad approval UX | exact approval default, clear spender and amount              |
| Raw RPC/revert text confusing users     | typed error mapping and product copy                          |
| Secret leakage                          | no private values in `NEXT_PUBLIC_*`                          |
| Dangerous dependency                    | review new direct dependencies and lockfile changes           |
| Clickjacking                            | frame denial headers                                          |
| XSS                                     | no untrusted `dangerouslySetInnerHTML`, strict data rendering |

## 2. Environment Rules

Public env vars are visible to every user. Only expose values that are safe to
publish:

- public chain id;
- public RPC fallback;
- Sentry DSN;
- build SHA;
- release digest;
- WalletConnect project id.

Never expose:

- private keys;
- database URLs;
- provider admin keys;
- odds provider keys;
- keeper keys;
- signing keys.

## 3. Wallet Safety

- No automatic signing.
- No silent chain switch.
- No unlimited approval by default.
- No transaction send before local validation and preflight.
- No raw typed-data JSON as the primary signing UI.
- No final receipt based only on an index row.

## 4. Headers

Production should set:

```text
Content-Security-Policy
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security
```

The CSP may need framework allowances, but it should not allow arbitrary remote
scripts.

Production CSP requirements:

- no `unsafe-eval`;
- no Figma MCP capture bridge;
- `object-src 'none'`;
- `base-uri 'self'`;
- `form-action 'self'`;
- `frame-ancestors 'none'`;
- `upgrade-insecure-requests`.

## 5. Data And Privacy

Do not collect account-profile data in v1. Wallet activity is public on-chain;
analytics should avoid raw wallet addresses.

Allowed local storage:

- locale;
- theme;
- safe form drafts;
- UI preferences.

Not allowed:

- signatures;
- approval payloads;
- private keys;
- database credentials;
- unredacted error dumps with wallet metadata.

## 6. Dependencies

New direct dependencies need a short reason in the PR. Be stricter for:

- wallet libraries;
- crypto libraries;
- build plugins;
- packages with postinstall scripts;
- packages with unclear provenance.

Patch/minor updates can be routine; major runtime dependency changes need
targeted verification.

## 7. Incident Response

If a frontend security issue is suspected:

1. Stop the affected deployment or roll back.
2. Preserve logs and commit SHA.
3. Rotate any exposed secrets.
4. Verify release digest and public envs.
5. Document user impact and follow-up tests.

## 8. Do Not Do

- Do not add third-party widgets to product routes.
- Do not use `eval` or `new Function`.
- Do not render untrusted HTML.
- Do not place secrets in client envs.
- Do not accept arbitrary custom RPC URLs in production UI.
- Do not hide approval spender or amount.

## 9. Verification

```bash
rg -nE "\\beval\\(|new Function\\(|dangerouslySetInnerHTML" frontend/apps/web/src
rg -nE "NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|DATABASE|PRIVATE)" frontend
pnpm -C frontend/apps/web test -- src/server/security-headers.test.ts
pnpm -C frontend lint
pnpm -C frontend test
```
