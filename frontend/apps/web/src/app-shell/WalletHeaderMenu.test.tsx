import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalletHeaderMenu } from "./WalletHeaderMenu";
import { WalletEntryContext } from "./wallet-entry-context";

const walletAddress = "0xd6622cBaA82995bD62b3316b696c23314263BFB9";
const disconnect = vi.fn();
const openConnectModal = vi.fn();
const switchChain = vi.fn();
let isConnected = true;
let walletChainId = 84532;

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: walletAddress,
    connector: { name: "Browser Wallet" },
    isConnected,
    chainId: walletChainId
  }),
  useChainId: () => 84532,
  useDisconnect: () => ({ disconnect }),
  useEnsAvatar: () => ({ data: null }),
  useEnsName: () => ({ data: null }),
  useSwitchChain: () => ({ isPending: false, switchChain })
}));

vi.mock("viem/ens", () => ({
  normalize: (value: string) => value
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const copy: Record<string, string> = {
      "walletMenu.chainSection": "Active chain",
      "walletMenu.connectedVia": `Via ${values?.wallet ?? "wallet"}`,
      "walletMenu.copyAddress": "Copy address",
      "walletMenu.disconnect": "Disconnect",
      "walletMenu.mismatch.description": `Switch your wallet to ${values?.target ?? "the active chain"}.`,
      "walletMenu.mismatch.switch": "Switch wallet",
      "walletMenu.mismatch.title": "Wallet on a different chain",
      "walletMenu.viewOnExplorer": "View on explorer",
      "nav.closeMenu": "Close menu"
    };
    return copy[key] ?? key;
  }
}));

vi.mock("./ActiveChainProvider", () => ({
  useActiveChain: () => ({
    selectedChain: { environment: "testnet", name: "Base Sepolia", shortName: "Base Sepolia" },
    selectedChainId: 84532
  })
}));

vi.mock("./ChainSwitcher", () => ({
  ChainOptionList: ({ onSelect }: { onSelect: () => void }) => (
    <button type="button" onClick={onSelect}>
      Base Sepolia
    </button>
  ),
  ChainSwitcher: () => <button type="button">Base Sepolia</button>
}));

vi.mock("./chain-registry", () => ({
  getExplorerAddressUrl: () => "https://basescan.org/address/test"
}));

describe("WalletHeaderMenu", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
    disconnect.mockClear();
    openConnectModal.mockClear();
    switchChain.mockClear();
    isConnected = true;
    walletChainId = 84532;
  });

  it("opens the wallet selector through the application provider when disconnected", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "connectWalletButton" }));
    expect(openConnectModal).toHaveBeenCalledOnce();
  });

  it("opens connected wallet actions in the shared mobile sheet", async () => {
    render(<WalletHeaderMenu mode="sheet" />);

    fireEvent.click(screen.getByRole("button", { name: /0xd662/i }));

    expect(await screen.findByRole("dialog", { name: /0xd662/i })).toBeDefined();
    expect(screen.getByText("Via Browser Wallet")).toBeDefined();
    expect(screen.getByText("Active chain")).toBeDefined();
    expect(screen.getByRole("button", { name: "Base Sepolia" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Disconnect" })).toBeDefined();
  });
});

it("offers a wallet network correction for a connected unsupported chain", () => {
  walletChainId = 8453;
  render(<WalletHeaderMenu />);
  fireEvent.click(screen.getByRole("button", { name: /0xd662/i }));
  expect(screen.getByText("Wallet on a different chain")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Switch wallet" }));
  expect(switchChain).toHaveBeenCalledWith({ chainId: 84532 });
});
