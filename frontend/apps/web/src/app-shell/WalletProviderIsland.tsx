"use client";

import * as React from "react";
import { embeddedChainIds } from "@ssot/ssot/release";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { arbitrum, arbitrumSepolia, base, baseSepolia } from "wagmi/chains";

import { QueryProvider } from "./QueryProvider";

const CHAIN_BY_ID: Record<number, any> = {
  [arbitrum.id]: arbitrum,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia
};

const supportedChains = embeddedChainIds.map((id) => CHAIN_BY_ID[id]).filter(Boolean);

const chains = (supportedChains.length > 0
  ? supportedChains
  : [baseSepolia]) as unknown as readonly [typeof baseSepolia, ...(typeof baseSepolia)[]];

const transports = Object.fromEntries(chains.map((chain: any) => [chain.id, http()]));

const wagmiConfig = getDefaultConfig({
  appName: "ArbiGameFi",
  chains,
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "00000000000000000000000000000000",
  ssr: true,
  transports
});

export function WalletProviderIsland({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryProvider>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryProvider>
    </WagmiProvider>
  );
}
