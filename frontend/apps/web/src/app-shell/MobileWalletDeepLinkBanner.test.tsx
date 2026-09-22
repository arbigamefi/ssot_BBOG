import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

import { MobileWalletDeepLinkBanner } from "./MobileWalletDeepLinkBanner";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("@heroicons/react/24/outline", () => ({
  ArrowTopRightOnSquareIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  XMarkIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  )
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "mobileDeepLink.title": "Open in wallet",
      "mobileDeepLink.description": "Smoothest on mobile inside a wallet browser.",
      "mobileDeepLink.dismiss": "Dismiss",
      "mobileDeepLink.openIn.metamask": "Open in MetaMask",
      "mobileDeepLink.openIn.coinbase": "Open in Coinbase Wallet",
      "mobileDeepLink.openIn.trust": "Open in Trust"
    })[key] ?? key
}));

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

describe("MobileWalletDeepLinkBanner", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setUserAgent(MOBILE_UA);
    // A wallet in-app browser injects this; its absence is what makes the
    // banner relevant at all.
    delete (window as { ethereum?: unknown }).ethereum;
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("starts collapsed, hiding the wallet links until asked", () => {
    // Expanded by default it occupied 250-400px at the top of every mobile
    // page -- half a phone screen spent before the product is visible. The
    // advice is worth keeping; taking the top of the funnel to deliver it is
    // not. So the links must not render until the visitor opts in.
    render(<MobileWalletDeepLinkBanner />);

    const toggle = screen.getByRole("button", { name: "Open in wallet" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    const panel = document.getElementById("mobile-deep-link-options");
    expect(panel).not.toBeNull();
    expect((panel as HTMLElement).hidden).toBe(true);
    expect(screen.queryByText("Smoothest on mobile inside a wallet browser.")).not.toBeNull();
  });

  it("reveals all three wallet links when expanded", () => {
    render(<MobileWalletDeepLinkBanner />);
    const toggle = screen.getByRole("button", { name: "Open in wallet" });

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById("mobile-deep-link-options") as HTMLElement;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelectorAll("a").length).toBe(3);
  });

  it("collapses again on a second click", () => {
    render(<MobileWalletDeepLinkBanner />);
    const toggle = screen.getByRole("button", { name: "Open in wallet" });

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((document.getElementById("mobile-deep-link-options") as HTMLElement).hidden).toBe(true);
  });

  it("stays dismissible, and a dismissal survives within the session", () => {
    const { unmount } = render(<MobileWalletDeepLinkBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("button", { name: "Open in wallet" })).toBeNull();

    unmount();
    render(<MobileWalletDeepLinkBanner />);
    expect(screen.queryByRole("button", { name: "Open in wallet" })).toBeNull();
  });

  it("does not render on desktop", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );
    render(<MobileWalletDeepLinkBanner />);
    expect(screen.queryByRole("button", { name: "Open in wallet" })).toBeNull();
  });

  it("does not render inside a wallet browser", () => {
    (window as { ethereum?: unknown }).ethereum = { isMetaMask: true };
    render(<MobileWalletDeepLinkBanner />);
    expect(screen.queryByRole("button", { name: "Open in wallet" })).toBeNull();
  });
});
