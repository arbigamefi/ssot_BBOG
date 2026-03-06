"use client";

/**
 * Thin re-exports of RainbowKit UI surface.
 *
 * This wrapper keeps `@rainbow-me/rainbowkit` imports inside the `providers/`
 * folder, respecting the ESLint architecture boundary (ADR-012, ADR-028).
 * Feature code and AppShell import these wrappers instead of rainbowkit directly.
 */
export { ConnectButton as WalletButton } from "@rainbow-me/rainbowkit";
export { useConnectModal } from "@rainbow-me/rainbowkit";
