# Mobile wallet entry and casino availability

The homepage retains its prominent wallet card before browsing actions, with a full-width 56px filled button. The casino directory retains its dismissible bottom card after compliance and cookie choices are resolved. Game rooms retain their betting controls without a competing floating card. The mobile menu keeps a manual connection entry after the card is dismissed for the session.

Every connection action goes directly to the existing RainbowKit wallet selector through `MobileWalletEntryProvider`: homepage, floating card, mobile menu, header and game connection requests. There is no additional wallet drawer, custom wallet shortlist or last-selection storage. The floating card yields while the connector or another dialog is open. Desktop, connected/reconnecting accounts and browsers with injected wallets do not receive mobile prompts; late provider announcements suppress them.

The copy says "Connect wallet". In an ordinary mobile browser, choosing a named wallet opens the current DApp page in that wallet's browser. WalletConnect keeps the external pairing flow. Inside a wallet browser or on desktop, all wallets retain their official connectors. Opening the DApp does not approve an account connection or send a transaction. No navigation happens on page load.

`NEXT_PUBLIC_CASINO_RISK_IN_ENABLED` is a build-time frontend gate, not a contract pause. When disabled, mainnet casino pages explain availability before wallet connection, disable new-bet controls and offer the same game on Base Sepolia. Manual settlement/refund actions remain usable. The action handler checks availability before opening a wallet or executing a cached plan; unknown chains fail closed.

Regression coverage verifies direct connector invocation on iPhone/Android user agents, homepage/menu/floating actions, single event handling, late providers, session dismissal, dialog suppression and preservation of game controls. Real wallet-app handoff remains wallet/platform dependent; viewport and user-agent tests do not certify physical app behavior.

## Wallet selection regression (2026-09-24)

Opening the picker is not sufficient acceptance. On the deployed PR #71 build,
selecting MetaMask or WalletConnect reached Cuer's QR renderer and crashed the
page with `invalid border=0`. The installed `cuer@0.0.3` requests a borderless
matrix, while its locked `qr@0.6.0` dependency rejects a zero border. The checked-in
pnpm patch requests one module of padding then removes that ring before Cuer
positions its finders. It preserves QR content and geometry and does not downgrade
the encoder. Both Docker dependency stages must copy `patches/` before installation.
Follow the encoder's [documented custom-renderer approach](https://github.com/paulmillr/qr/blob/0.7.0/src/index.ts#L955-L960)
when replacing this patch with an upstream fix.

Mobile MetaMask uses MetaMask SDK, independently of WalletConnect. CSP permits
only its exact HTTPS/WebSocket pairing host, `metamask-sdk.api.cx.metamask.io`.
The generic Browser Wallet row is hidden when no injected provider exists;
EIP-6963 discovery remains enabled. The PR #72 universal-link overrides were
removed after real iPhone feedback: opening a connection/download URL is not
proof of app launch or DApp-browser navigation.

Tests exercise the actual installed Cuer renderer with synthetic pairing and
download URIs, verify matrix/finder alignment, preserve mobile URI payloads and
injected-provider behavior, and enter the real selector's download QR page in
E2E without a wallet or external relay. Release QA also clicks individual live
wallet choices and checks for page errors. None of these tests approve accounts,
sign messages or send transactions. A desktop emulator cannot certify physical
app launch, installation or return-to-browser behavior.

## Direct DApp-browser entry (2026-09-25)

`WalletDappHandoff` uses RainbowKit's `appInfo.disclaimer` slot to place guidance
and retry/download links inside the existing selector. It captures only named
wallet buttons inside the pinned `rk_connect_title` dialog on mobile browsers
without an injected or announced provider. RainbowKit 2.2.11 has no public
before-select hook; the `rk-wallet-option-*` dependency is protected by real
selector E2E tests and must be reviewed when upgrading RainbowKit.

The original user click calls a DApp-browser link synchronously. It does not wait
for a relay, generate a pairing URI or launch a second connector. Native App
links are used for MetaMask, Trust, Rainbow and OKX. Coinbase uses the official
HTTPS DApp-browser route from its MobileRelay; OS universal-link preferences can
still send that route to a web page. Unknown wallets and WalletConnect are not
intercepted. Download is an explicit action, never a timed inference that the
app is missing. The web page cannot reliably enumerate installed mobile apps.

Route sources:

- [MetaMask's deep-link parser](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/DeeplinkManager/utils/parseDeeplink.ts) maps `metamask://dapp/<host/path>` to its HTTPS DApp route; the [official generator](https://metamask.github.io/metamask-deeplinks/) documents the DApp action.
- [Trust Wallet documentation](https://github.com/trustwallet/developer/blob/master/develop-for-trust/deeplinking/deeplinking.md): `trust://open_url?coin_id=60&url=...`.
- [Rainbow's app handler](https://github.com/rainbow-me/rainbow/blob/develop/src/handlers/deeplinks.ts): `rainbow://dapp?url=...` navigates to `DAPP_BROWSER_SCREEN`.
- [OKX documentation](https://www.okx.com/web3/build/docs/sdks/app-universal-link), also referenced in [TRON's adapter encoding fix](https://github.com/tronprotocol/tronwallet-adapter/issues/47): `okx://wallet/dapp/url?dappUrl=...`.
- Coinbase's published `@coinbase/wallet-sdk@3.9.3`, `dist/relay/mobile/MobileRelay.js`: `https://go.cb-w.com/dapp?cb_url=...`. Current app compatibility still requires physical-device acceptance.

Only HTTPS DApp URLs are handed off. Path, query and fragment are preserved,
with `chainId` set to the site's selected network. This preserves site context;
it does not claim that a wallet has switched chains. Browser-local preferences
and unfinished form input do not automatically transfer to another browser.
`ActiveChainProvider` wraps `WalletProviderIsland` so the selector's React portal
receives the current chain context.

Acceptance covers a cold and unlocked app, absent app, canceled OS prompt,
returning to the browser, and connection from the wallet browser. Automated
tests cover navigation intent, encoding, no duplicate pairing, late provider
announcements, explicit downloads and unchanged desktop/WalletConnect behavior.
They do not substitute for actual iPhone/Android app acceptance.
