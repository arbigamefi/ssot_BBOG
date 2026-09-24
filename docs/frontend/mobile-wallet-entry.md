# Mobile wallet entry and casino availability

The homepage retains its prominent wallet card before browsing actions, with a full-width 56px filled button. The casino directory retains its dismissible bottom card after compliance and cookie choices are resolved. Game rooms retain their betting controls without a competing floating card. The mobile menu keeps a manual connection entry after the card is dismissed for the session.

Every connection action goes directly to the existing RainbowKit wallet selector through `MobileWalletEntryProvider`: homepage, floating card, mobile menu, header and game connection requests. There is no additional wallet drawer, custom wallet shortlist, last-selection storage or hand-built DApp browser link. The floating card yields while the connector or another dialog is open. Desktop, connected/reconnecting accounts and browsers with injected wallets do not receive mobile prompts; late provider announcements suppress them.

The copy says "Connect wallet". The existing connector and selected wallet handle mobile linking. Opening a wallet for connection approval does not guarantee that the website moves into its built-in browser; some flows return to the original browser. The application does not force navigation or automatically request an account connection on page load. See [RainbowKit mobile wallet connectors](https://rainbowkit.com/docs/custom-wallets).

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
The SDK is configured to use its HTTPS universal link for an app/install path,
and owns mobile navigation so RainbowKit does not launch the same pairing twice.
Trust, Rainbow and OKX retain their existing connectors and injected-provider
handling, with HTTPS mobile handoffs instead of app-only URI schemes. The
generic Browser Wallet row is hidden when no injected provider exists;
EIP-6963 discovery remains enabled. WalletConnect keeps its standard external
wallet pairing interface. These are connector settings, not another chooser.

Tests exercise the actual installed Cuer renderer with synthetic pairing and
download URIs, verify matrix/finder alignment, preserve mobile URI payloads and
injected-provider behavior, and enter the real selector's download QR page in
E2E without a wallet or external relay. Release QA also clicks individual live
wallet choices and checks for page errors. None of these tests approve accounts,
sign messages or send transactions. A desktop emulator cannot certify physical
app launch, installation or return-to-browser behavior.
