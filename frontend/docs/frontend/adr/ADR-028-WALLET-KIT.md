# ADR-028: Wallet Kit Selection

## Context

The SSOT frontend has wagmi ^2.14.0 wired into the provider layer (ADR-012) but no wallet connection UI. Users have no way to connect, disconnect, or switch wallets from the app. All feature code talks to the SDK which returns `WALLET_NOT_CONNECTED` when no wallet is present, but there is no mechanism to trigger a connection.

We need a wallet kit library that provides:
- Connect/disconnect modal with popular wallet support (MetaMask, WalletConnect, Coinbase Wallet)
- Chain switching for supported networks (Base Sepolia, Base, Arbitrum)
- Account display (address, ENS, avatar)
- SSR compatibility (Next.js 15 App Router)

## Decision

Use **RainbowKit v2** (`@rainbow-me/rainbowkit`).

Rationale:
- **wagmi v2 native**: built specifically for wagmi v2 + viem v2 (our exact stack)
- **UI stack alignment**: uses Radix UI primitives + supports Tailwind theming, matching ADR-006
- **Minimal integration surface**: wraps existing `WagmiProvider`, adds `RainbowKitProvider`
- **ConnectButton component**: drop-in button with connect modal, chain switcher, account display, disconnect — all in one
- **SSR-friendly**: supports cookie-based hydration (our existing pattern)
- **Bundle size**: ~50KB gzipped, acceptable for a wallet-heavy dApp
- **Maintenance**: actively maintained by Rainbow, large ecosystem

Architecture integration:
- RainbowKit provider lives in `apps/web/src/app/providers/WebProviders.tsx` (provider wiring only)
- `ConnectButton` re-exported via thin wrapper in `providers/WalletButton.tsx` (respects ADR-012 boundary)
- Feature code never imports `@rainbow-me/rainbowkit` directly
- ESLint boundary updated to allow rainbowkit in provider wiring folder only

## Alternatives

- **ConnectKit** (Family): Smaller bundle (~20KB), wagmi v2 support. Rejected: less built-in theme customization, fewer wallet options out of the box.
- **AppKit / Web3Modal v3** (WalletConnect/Reown): Universal (ethers + viem). Rejected: heavier bundle (~100KB+), opinionated UI harder to align with our design system, over-engineered for our use case.
- **Custom implementation**: Build our own connect modal with raw wagmi hooks. Rejected: significant effort for a solved problem; wallet UX edge cases (deep linking, mobile wallets, WalletConnect QR) are non-trivial.

## Consequences

- New dependency: `@rainbow-me/rainbowkit` in `apps/web`
- Provider chain updated: `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider` → children
- ESLint config updated: `@rainbow-me/rainbowkit` allowed in `apps/web/src/app/providers/**`
- `NEXT_PUBLIC_WC_PROJECT_ID` env var needed for WalletConnect (optional, falls back to demo)
- ConnectButton available on all pages via AppShell header

## Status

Accepted
