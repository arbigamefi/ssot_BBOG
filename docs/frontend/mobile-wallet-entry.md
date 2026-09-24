# Mobile wallet entry and casino availability

The homepage retains its prominent wallet card before browsing actions, with a full-width 56px filled button. The casino directory retains its dismissible bottom card after compliance and cookie choices are resolved. Game rooms retain their betting controls without a competing floating card. The mobile menu keeps a manual connection entry after the card is dismissed for the session.

Every connection action goes directly to the existing RainbowKit wallet selector through `MobileWalletEntryProvider`: homepage, floating card, mobile menu, header and game connection requests. There is no additional wallet drawer, custom wallet shortlist, last-selection storage or hand-built DApp browser link. The floating card yields while the connector or another dialog is open. Desktop, connected/reconnecting accounts and browsers with injected wallets do not receive mobile prompts; late provider announcements suppress them.

The copy says "Connect wallet". The existing connector and selected wallet handle mobile linking. Opening a wallet for connection approval does not guarantee that the website moves into its built-in browser; some flows return to the original browser. The application does not force navigation or automatically request an account connection on page load. See [RainbowKit mobile wallet connectors](https://rainbowkit.com/docs/custom-wallets).

`NEXT_PUBLIC_CASINO_RISK_IN_ENABLED` is a build-time frontend gate, not a contract pause. When disabled, mainnet casino pages explain availability before wallet connection, disable new-bet controls and offer the same game on Base Sepolia. Manual settlement/refund actions remain usable. The action handler checks availability before opening a wallet or executing a cached plan; unknown chains fail closed.

Regression coverage verifies direct connector invocation on iPhone/Android user agents, homepage/menu/floating actions, single event handling, late providers, session dismissal, dialog suppression and preservation of game controls. Real wallet-app handoff remains wallet/platform dependent; viewport and user-agent tests do not certify physical app behavior.
