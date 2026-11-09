import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalletHeaderMenu } from "./WalletHeaderMenu";
import { WalletEntryContext } from "./wallet-entry-context";

const walletAddress = "0xd6622cBaA82995bD62b3316b696c23314263BFB9";
const disconnect = vi.fn();
const openConnectModal = vi.fn();
const switchChain = vi.fn();
const setSelectedChainId = vi.fn();
const baseSepolia = { id: 84532, environment: "testnet", name: "Base Sepolia" };
const base = { id: 8453, environment: "mainnet", name: "Base Mainnet" };
let isConnected = true;
let walletChainId = 84532;
let supportedChains = [baseSepolia];

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: walletAddress,
    connector: { name: "Browser Wallet" },
    isConnected,
    chainId: walletChainId
  }),
  useDisconnect: () => ({ disconnect }),
  useEnsName: () => ({ data: null }),
  useSwitchChain: () => ({ isPending: false, switchChain })
}));

vi.mock("wagmi/chains", () => ({ mainnet: { id: 1 } }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const copy: Record<string, string> = {
      connect: "Connect wallet",
      open: `Wallet ${values?.address}`,
      connectedVia: `via ${values?.wallet}`,
      copyAddress: "Copy address",
      copied: "Address copied",
      viewOnExplorer: "View on block explorer",
      "mismatch.title": "Wallet on a different chain",
      "mismatch.description": `Switch your wallet to ${values?.target}.`,
      "mismatch.switch": "Switch wallet",
      "mismatch.switching": "Switching",
      network: "Network",
      pages: "Your pages",
      portfolio: "Portfolio",
      bets: "Bets",
      claims: "Claims",
      disconnect: "Disconnect"
    };
    return copy[key] ?? key;
  }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("./ActiveChainProvider", () => ({
  useActiveChain: () => ({
    selectedChain: baseSepolia,
    selectedChainId: 84532,
    supportedChains,
    setSelectedChainId
  })
}));

vi.mock("./chain-registry", () => ({
  getExplorerAddressUrl: () => "https://sepolia.basescan.org/address/test"
}));

function openMenu() {
  const trigger = screen.getByRole("button", { name: /0xd662…BFB9/ });
  fireEvent.click(trigger);
  return trigger;
}

describe("WalletHeaderMenu", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    isConnected = true;
    walletChainId = 84532;
    supportedChains = [baseSepolia];
  });

  it("opens the wallet selector when no wallet is connected", () => {
    isConnected = false;
    render(
      <WalletEntryContext.Provider
        value={{
          eligible: false,
          dismissed: false,
          mainnetUnavailable: false,
          open: openConnectModal
        }}
      >
        <WalletHeaderMenu />
      </WalletEntryContext.Provider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(openConnectModal).toHaveBeenCalledOnce();
  });

  it("opens the player's own pages and Disconnect from the address", () => {
    render(<WalletHeaderMenu />);
    const trigger = openMenu();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const pages = screen.getByRole("navigation", { name: "Your pages" });
    const links = within(pages).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Portfolio", "/portfolio"],
      ["Bets", "/portfolio/activity"],
      ["Claims", "/portfolio/claims"]
    ]);
    expect(screen.getByText("via Browser Wallet")).toBeVisible();
    // One chain in the build, so there is nothing to choose.
    expect(screen.queryByText("Network")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and returns focus to the address", () => {
    render(<WalletHeaderMenu />);
    const trigger = openMenu();
    screen.getByRole("link", { name: "Bets" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("offers to move a wallet that sits on another chain", () => {
    walletChainId = 8453;
    render(<WalletHeaderMenu />);
    openMenu();
    expect(screen.getByText("Wallet on a different chain")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Switch wallet" }));
    expect(switchChain).toHaveBeenCalledWith({ chainId: 84532 });
  });

  it("lists the networks when the build has more than one", () => {
    supportedChains = [base, baseSepolia];
    render(<WalletHeaderMenu />);
    openMenu();
    expect(screen.getByRole("button", { name: "Base Sepolia" }).getAttribute("aria-current")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Base Mainnet" }));
    expect(setSelectedChainId).toHaveBeenCalledWith(8453);
  });
});
