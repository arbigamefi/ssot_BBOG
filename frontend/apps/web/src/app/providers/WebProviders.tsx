"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { base, baseSepolia, arbitrum, arbitrumSepolia } from "wagmi/chains";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { embeddedChainIds } from "@ssot/ssot/release";

/**
 * WebProviders
 *
 * Provider wiring ONLY.
 *
 * Architecture rule:
 * - apps/web MAY import wagmi + rainbowkit only in this folder (provider wiring).
 * - Feature code MUST NOT talk to viem/wagmi/rainbowkit directly; it must go through @ssot/ssot SDK.
 *
 * NOTE: Chains are enabled based on embedded releases produced by `pnpm ssot:sync`.
 * If no embedded releases are present (before sync), we fall back to Base Sepolia for local development.
 */

const CHAIN_BY_ID: Record<number, any> = {
  [baseSepolia.id]: baseSepolia,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [arbitrumSepolia.id]: arbitrumSepolia,
};

const supportedChains = embeddedChainIds
  .map((id) => CHAIN_BY_ID[id])
  .filter(Boolean);

// Safety fallback: if no embedded chains are present (e.g. before sync), default to Base Sepolia.
// wagmi requires a non-empty readonly tuple; we guarantee at least one chain via the fallback.
const chains = (supportedChains.length > 0 ? supportedChains : [baseSepolia]) as unknown as readonly [typeof baseSepolia, ...typeof baseSepolia[]];

const transports = Object.fromEntries(chains.map((c: any) => [c.id, http()]));

const wagmiConfig = getDefaultConfig({
  appName: "ArbiGameFi",
  // WalletConnect project ID — optional for dev, required for production WalletConnect.
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "00000000000000000000000000000000",
  chains,
  transports,
  ssr: true,
});

const queryClient = new QueryClient();

export function WebProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
