# Mobile wallet entry and casino availability

The homepage offers an inline wallet-browser entry below the primary actions. The casino directory offers a dismissible bottom card after compliance and cookie choices are resolved. Game rooms retain their betting controls without a competing floating card. The mobile menu keeps a manual entry after the card has been dismissed for the session.

All connect requests pass through one `MobileWalletEntryProvider`. An unconnected mobile browser opens a single lazy-loaded sheet with explicit MetaMask and Trust Wallet links, a normal browser connection option, and a copyable URL fallback. Desktop, connected/reconnecting accounts, and browsers with an injected wallet use the existing connection path. Late provider announcements suppress the prompt. No automatic redirects, installed-wallet claims, or successful-connection claims are made.

The wallet destination retains the current page, selected chain and valid public referral address. Other query parameters and fragments are discarded. Unsaved betting inputs and session storage do not move between browser applications. PWA installation prompts yield to the wallet entry.

`NEXT_PUBLIC_CASINO_RISK_IN_ENABLED` is a build-time frontend gate, not a contract pause. When disabled, mainnet casino pages explain availability before wallet connection, disable new-bet controls and offer the same game on Base Sepolia. Manual settlement/refund actions remain usable. The action handler checks availability before opening a wallet or executing a cached plan; unknown chains fail closed.

Validation covers eligibility, late providers, overlapping dialogs, session dismissal with manual re-entry, single connect-event handling, destination filtering, mainnet guarding and preserved exit actions. The production build was inspected at 390px and 1440px, including the testnet link and ordinary connection modal. Device wallet-app handoff remains a separate real iOS/Android acceptance step; viewport resizing does not simulate a mobile user agent.
