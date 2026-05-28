"use client";

import * as React from "react";
import { embeddedChainIds } from "@ssot/ssot/release";
import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum, arbitrumSepolia, base, baseSepolia, mainnet } from "wagmi/chains";
import { RainbowKitProvider, connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet
} from "@rainbow-me/rainbowkit/wallets";

import { QueryProvider } from "./QueryProvider";
import { resolveMainnetEnsRpcUrl, resolvePublicRpcUrl, withConfiguredRpc } from "./rpc";

const CHAIN_BY_ID: Record<number, any> = {
  [arbitrum.id]: arbitrum,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia
};

const supportedChains = embeddedChainIds
  .map((id) => CHAIN_BY_ID[id])
  .filter(Boolean)
  .map((chain) => withConfiguredRpc(chain));

const appChains = supportedChains.length > 0 ? supportedChains : [withConfiguredRpc(baseSepolia)];

// Ethereum mainnet is appended purely as an ENS-resolution chain. It never
// appears in the network switcher (that's driven by embeddedChainIds) and is
// never used for transactions — only `useEnsName`/`useEnsAvatar` read it.
const chains = [...appChains, mainnet] as unknown as readonly [
  typeof baseSepolia,
  ...(typeof baseSepolia)[]
];

const transports = Object.fromEntries(
  chains.map((chain: any) => [
    chain.id,
    http(chain.id === mainnet.id ? resolveMainnetEnsRpcUrl() : resolvePublicRpcUrl(chain.id))
  ])
);

/**
 * WalletConnect project ID — required for ANY mobile-deep-link wallet flow.
 * Grab a free ID at https://cloud.walletconnect.com and set
 * NEXT_PUBLIC_WC_PROJECT_ID in your .env.local.
 *
 * Without a real ID the WalletConnect modal will still render but every
 * connection attempt fails with `Origin not allowed`. We log a clear warning
 * so this fails loudly in dev rather than silently in prod.
 */
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID && process.env.NEXT_PUBLIC_WC_PROJECT_ID.length > 0
    ? process.env.NEXT_PUBLIC_WC_PROJECT_ID
    : "DEMO_DO_NOT_USE_IN_PRODUCTION";

if (typeof window !== "undefined" && WC_PROJECT_ID === "DEMO_DO_NOT_USE_IN_PRODUCTION") {
  console.warn(
    "[wallet] NEXT_PUBLIC_WC_PROJECT_ID is not set. WalletConnect-backed wallets will fail. " +
      "Get a free project ID at https://cloud.walletconnect.com."
  );
}

/**
 * Explicit, hand-picked connector list. We use RainbowKit's modal UI for the
 * picker, but we own the wallet ordering and stay independent of the
 * `getDefaultConfig` opinions (which keeps changing across RK releases).
 *
 * Order is intentional — most-installed wallets first so the modal lands on
 * a winning option for the median player.
 */
const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [metaMaskWallet, coinbaseWallet, walletConnectWallet, trustWallet, rainbowWallet]
    },
    {
      groupName: "Other",
      wallets: [okxWallet, injectedWallet]
    }
  ],
  {
    appName: "ArbiGameFi",
    projectId: WC_PROJECT_ID
  }
);

const wagmiConfig = createConfig({
  chains,
  ssr: true,
  transports,
  connectors
});

export function WalletProviderIsland({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryProvider>
        <RainbowKitProvider
          appInfo={{ appName: "ArbiGameFi" }}
          modalSize="wide"
          showRecentTransactions={false}
        >
          {children}
        </RainbowKitProvider>
      </QueryProvider>
    </WagmiProvider>
  );
}
