import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileWalletDeepLinkBanner } from "./MobileWalletDeepLinkBanner";
import { MobileWalletEntryProvider } from "./MobileWalletEntryProvider";
import { requestWalletConnect } from "./wallet-connect-events";
import { walletDeepLink, walletDestination } from "./mobile-wallet-links";

const state = vi.hoisted(() => ({
  connected: false,
  pathname: "/",
  cookie: "rejected" as string | null,
  connect: vi.fn(),
  chainId: 8453
}));
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: state.connected }) }));
vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: state.connect, connectModalOpen: false })
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./ActiveChainProvider", () => ({
  useActiveChain: () => ({ selectedChainId: state.chainId })
}));
vi.mock("./compliance", () => ({
  useCompliance: () => ({
    hydrated: true,
    entryCleared: true,
    cookieConsent: state.cookie,
    rgDialogOpen: false
  })
}));

function View() {
  return (
    <MobileWalletEntryProvider>
      <MobileWalletDeepLinkBanner />
      <MobileWalletDeepLinkBanner menu />
    </MobileWalletEntryProvider>
  );
}

beforeEach(() => {
  state.connected = false;
  state.pathname = "/";
  state.chainId = 8453;
  state.cookie = "rejected";
  state.connect.mockClear();
  sessionStorage.clear();
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 iPhone Mobile Safari"
  });
  Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("mobile wallet entry", () => {
  it("shows an inline home hint and opens one shared sheet from the connection event", async () => {
    render(<View />);
    expect(screen.getByText("inlineTitle")).toBeVisible();
    expect(screen.getByText("unavailableHint")).toBeVisible();
    act(() => requestWalletConnect());
    await screen.findByRole("dialog");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /MetaMask/ })).toHaveAttribute(
      "href",
      expect.stringContaining("chainId=8453")
    );
    fireEvent.click(screen.getByRole("button", { name: "stay" }));
    expect(state.connect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not nudge or redirect an already connected browser", () => {
    state.connected = true;
    render(<View />);
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
    act(() => requestWalletConnect());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("closes its sheet on connection and suppresses late injected providers", () => {
    const view = render(<View />);
    act(() => requestWalletConnect());
    state.connected = true;
    view.rerender(<View />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    state.connected = false;
    view.rerender(<View />);
    act(() => {
      window.dispatchEvent(new Event("eip6963:announceProvider"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
  });
  it("does not show mobile advice in desktop or injected-wallet browsers", () => {
    Object.defineProperty(window, "ethereum", { configurable: true, value: { isMetaMask: true } });
    const view = render(<View />);
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
    view.unmount();
    Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Desktop Chrome" });
    render(<View />);
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
  });
  it("honors session dismissal but keeps the menu entry available", async () => {
    sessionStorage.setItem("arbigamefi.mobileDeepLink.dismissedV1", "1");
    render(<View />);
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "title" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
  });
  it("holds the floating prompt until cookies are resolved, and hides it under another modal", async () => {
    state.pathname = "/casino";
    state.cookie = null;
    const view = render(
      <MobileWalletEntryProvider>
        <span>Directory</span>
      </MobileWalletEntryProvider>
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    state.cookie = "rejected";
    view.rerender(
      <MobileWalletEntryProvider>
        <span>Directory</span>
      </MobileWalletEntryProvider>
    );
    expect(screen.getByRole("complementary")).toBeVisible();
    view.rerender(
      <MobileWalletEntryProvider>
        <div role="dialog" aria-modal="true">
          Other modal
        </div>
      </MobileWalletEntryProvider>
    );
    await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
  });
  it("never mounts the floating list over a game action bar", () => {
    state.pathname = "/casino/dice";
    render(
      <MobileWalletEntryProvider>
        <span>Game</span>
      </MobileWalletEntryProvider>
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("wallet handoff", () => {
  it("preserves the current route, selected network and public referral, dropping arbitrary data", () => {
    const ref = "0x93ac87413E17d01CBa37B6317f64890bF7f99aC3";
    const target = walletDestination(
      `https://arbigamefi.com/casino/dice?chainId=8453&ref=${ref}&token=secret#signature`,
      84532
    );
    expect(target).toBe(`https://arbigamefi.com/casino/dice?chainId=84532&ref=${ref}`);
    expect(new URL(walletDeepLink("trust", target)).searchParams.get("url")).toBe(target);
    expect(walletDeepLink("metamask", target)).toContain(
      "metamask.app.link/dapp/arbigamefi.com/casino/dice?chainId=84532"
    );
  });
});
