"use client";

import * as React from "react";
import { embeddedChainIds } from "@ssot/ssot/release";
import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum, arbitrumSepolia, base, baseSepolia, mainnet } from "wagmi/chains";
import { RainbowKitProvider, connectorsForWallets, darkTheme } from "@rainbow-me/rainbowkit";
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

const supportedChainDefs = embeddedChainIds.map((id) => CHAIN_BY_ID[id]).filter(Boolean);

// The generic NEXT_PUBLIC_RPC_URL fallback is only safe for a single-chain
// deployment (one URL ≠ multiple networks). With >1 embedded chain we require
// per-chain URLs or an Alchemy key, both of which are correct per network.
const allowGenericFallback = supportedChainDefs.length <= 1;

const supportedChains = supportedChainDefs.map((chain) =>
  withConfiguredRpc(chain, undefined, { allowGenericFallback })
);

const appChains =
  supportedChains.length > 0
    ? supportedChains
    : [withConfiguredRpc(baseSepolia, undefined, { allowGenericFallback: true })];

const enableEnsLookup = process.env.NEXT_PUBLIC_ENABLE_ENS_LOOKUP === "true";

// Ethereum mainnet is appended purely as an ENS-resolution chain. It never
// appears in the network switcher (that's driven by embeddedChainIds) and is
// never used for transactions — only `useEnsName`/`useEnsAvatar` read it.
const chains = [...appChains, ...(enableEnsLookup ? [mainnet] : [])] as unknown as readonly [
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
  connectors,
  // Aggregate concurrent `eth_call` reads through Multicall3 instead of sending
  // one HTTP request per read. The SDK issues reads in batches already — a bank
  // snapshot is four reads, XP buckets four, bet pre-flight solvency four — so
  // without this each of those costs four provider requests instead of one.
  // Every embedded chain has Multicall3 at the canonical address, and viem
  // falls back to individual calls for any chain that does not.
  //
  // Note: viem's `http({ batch: true })` is a different thing (JSON-RPC request
  // coalescing). It saves HTTP round-trips but not provider quota, because
  // providers meter per RPC method call. Multicall aggregation is what actually
  // reduces the billed call count.
  batch: { multicall: true }
});

// The connect modal is the one surface a first-time player sees before anything
// else works, and RainbowKit defaults to its light theme. Left unset it renders
// a white dialog over a dark product, which reads as leaving the site at the
// exact moment trust matters most.
//
// Colors come from the shipped design tokens rather than literals, so the modal
// follows the app's palette instead of drifting from it.
// Radius matches for the same reason. Measured on the running modal, the
// "large" scale gives a 24px dialog, 12px wallet rows and a fully round
// "get a wallet" button -- a 24px surface appears nowhere in this product, and
// `rounded-full` here is for dots, avatars and badges, never a text button.
// "medium" lands on radii the site already uses: 8px rows are `rounded-lg`,
// and its 16px dialog is exactly the corner of our own mobile Sheet
// (`rounded-t-2xl`). Only the 28px circular close button stays round.
const walletModalTheme = darkTheme({
  accentColor: "hsl(var(--brand))",
  accentColorForeground: "hsl(var(--fg-inverse))",
  borderRadius: "medium",
  overlayBlur: "small"
});

export function WalletProviderIsland({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryProvider>
        <RainbowKitProvider
          appInfo={{ appName: "ArbiGameFi" }}
          modalSize="wide"
          showRecentTransactions={false}
          theme={walletModalTheme}
        >
          {children}
        </RainbowKitProvider>
      </QueryProvider>
    </WagmiProvider>
  );
}
