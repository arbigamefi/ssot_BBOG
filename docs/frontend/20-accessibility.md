# Accessibility

Use native buttons, links, labels, and form controls. Keep keyboard focus visible;
do not communicate transaction state or win/loss solely through color or motion.
Associate input errors with their fields and explain why an action is unavailable.

Reuse the existing [overlay components](../../frontend/apps/web/src/components/overlay)
for dialogs and sheets. Their tests cover focus handling and nested overlays.
Language selection has [keyboard tests](../../frontend/apps/web/src/components/LocaleSwitcher.test.tsx).
Use the existing [motion guidance](../design/12-motion.md) and preserve information
when reduced motion is requested.

For changed transaction flows, check keyboard navigation, labels, focus return,
and visible status through wallet connection, approval, submission, and result.
Earn must distinguish wallet shares, pending redemption, claimable assets, and
player payables. Request, cancel, and claim are separate actions; a pending request
is not an asset transfer. See [Earn controls](../../frontend/apps/web/src/features/earn).

The [Playwright accessibility suite](../../frontend/apps/web/e2e/a11y.spec.ts)
checks selected pages with axe. It does not establish complete accessibility
conformance or replace keyboard and screen-reader checks of changed flows.
With the local server running:

```bash
pnpm -C frontend/apps/web e2e -- e2e/a11y.spec.ts
```
