# Mobile wallet entry

[MobileWalletEntryProvider](../../frontend/apps/web/src/app-shell/MobileWalletEntryProvider.tsx)
routes connection requests to the existing RainbowKit selector. The homepage,
header, mobile menu, and eligible floating prompt share that entry. The prompt
yields to dialogs and is suppressed for connected/reconnecting users, desktop
browsers, and detected wallet providers.

[WalletDappHandoff](../../frontend/apps/web/src/app-shell/WalletDappHandoff.tsx)
handles named wallet choices on mobile browsers without an injected provider.
It opens the current page in supported wallet browsers from the original click.
WalletConnect, desktop, and wallet-browser connections retain their connector flow.
This adapter depends on the pinned RainbowKit selector markup; review it on upgrades.

The [link builder](../../frontend/apps/web/src/app-shell/wallet-dapp-links.ts)
requires HTTPS and preserves the path, query, fragment, and selected `chainId`.
Opening a link neither connects an account nor switches the wallet chain or sends
a transaction. Downloads are explicit actions. Browser-local form state does not
automatically transfer into a wallet browser.

## Dependency and device checks

Keep the [Cuer QR patch](../../frontend/patches/cuer@0.0.3.patch) with its locked
dependency. Both Docker dependency stages copy `patches/` before installation.
The patch avoids the installed encoder's rejection of a zero-width QR border.

```bash
pnpm -C frontend/apps/web test -- src/app-shell/WalletDappHandoff.test.tsx src/app-shell/wallet-dapp-links.test.ts src/app-shell/MobileWalletDeepLinkBanner.test.tsx
# With the local web server running:
pnpm -C frontend/apps/web e2e -- e2e/wallet-dapp-handoff.spec.ts
```

Automated tests cover selector behavior and navigation intent. Check real iPhone
and Android devices for installed/absent wallets, cold/unlocked apps, canceled OS
prompts, and return to the browser. A viewport or user-agent test cannot confirm
native app launch or successful account connection.
