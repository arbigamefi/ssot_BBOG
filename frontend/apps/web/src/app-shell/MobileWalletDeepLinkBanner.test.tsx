import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileWalletDeepLinkBanner } from "./MobileWalletDeepLinkBanner";
import { MobileWalletEntryProvider } from "./MobileWalletEntryProvider";
import { requestWalletConnect } from "./wallet-connect-events";

const state = vi.hoisted(() => ({
  connected: false,
  connect: vi.fn(),
  chainId: 8453
}));
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: state.connected }) }));
vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: state.connect })
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./ActiveChainProvider", () => ({
  useActiveChain: () => ({ selectedChainId: state.chainId })
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
  state.chainId = 8453;
  state.connect.mockClear();
  sessionStorage.clear();
  localStorage.clear();
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
  it.each(["Mozilla/5.0 iPhone Mobile Safari", "Mozilla/5.0 Android Mobile Chrome"])(
    "opens the existing wallet selector directly in %s",
    (userAgent) => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
      render(<View />);
      expect(screen.getByText("inlineTitle")).toBeVisible();
      expect(screen.getByText("unavailableHint")).toBeVisible();
      act(() => requestWalletConnect());
      expect(state.connect).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  );
  it("does not nudge or redirect an already connected browser", () => {
    state.connected = true;
    render(<View />);
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
    act(() => requestWalletConnect());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("hides prompts on connection and suppresses late injected providers", () => {
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
    act(() => requestWalletConnect());
    expect(state.connect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Desktop Chrome" });
    render(<View />);
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
  });
  it("honors session dismissal but keeps the menu connection entry available", () => {
    sessionStorage.setItem("arbigamefi.mobileDeepLink.dismissedV1", "1");
    render(<View />);
    expect(screen.queryByText("inlineTitle")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "title" }));
    expect(state.connect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("connects directly from the prominent home action", () => {
    render(<View />);
    fireEvent.click(
      within(screen.getByRole("complementary")).getByRole("button", { name: "title" })
    );
    expect(state.connect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
