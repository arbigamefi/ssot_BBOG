"use client";

import * as React from "react";
import { embeddedChainIds } from "@ssot/ssot/release";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
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

const wagmiConfig = createConfig({
  chains,
  ssr: true,
  transports,
  connectors: [injected({ shimDisconnect: true })]
});

export function WalletProviderIsland({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryProvider>{children}</QueryProvider>
    </WagmiProvider>
  );
}
