import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as React from "react";
import { AppShell } from "./AppShell";

// ——— Mock dependencies ———
const mockRelease = {
  name: "test-net",
  contracts: { hub: "0x1234567890abcdef1234567890abcdef12345678" },
  releaseDigest: "0xdeadbeefcafe"
};

const state = {
  pathname: "/bets"
};

vi.mock("../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: mockRelease,
    readOnly: false,
    readOnlyReason: null,
    warnings: []
  })
}));

vi.mock("../app/providers/WalletButton", () => ({
  WalletButton: () => <button data-testid="wallet-button">Connect</button>,
  useConnectModal: () => ({ openConnectModal: vi.fn() })
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname
}));

vi.mock("@ssot/ui", () => ({
  ReadOnlyBanner: ({ reason }: any) => <div data-testid="readonly-banner">{reason}</div>
}));

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
    state.pathname = "/bets";
  });
  it("renders the ArbiGameFi brand link", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    expect(screen.getByText("ArbiGameFi")).toBeDefined();
    expect(screen.getByText("Game Rooms")).toBeDefined();
  });

  it("renders primary navigation links and demotes advanced routes", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const primaryLinks = [
      "Home",
      "Games",
      "Bets",
      "Liquidity",
      "Account"
    ];
    for (const label of primaryLinks) {
      const links = screen.getAllByText(label);
      expect(links.length).toBeGreaterThanOrEqual(1);
    }

    expect(screen.getByText("Advanced")).toBeDefined();
    expect(screen.getAllByText("Claims").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Referral").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ops").length).toBeGreaterThanOrEqual(1);
  });

  it("renders at least one WalletButton", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const walletBtns = screen.getAllByTestId("wallet-button");
    expect(walletBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the network name", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const networkNames = screen.getAllByText(/test-net/i);
    expect(networkNames.length).toBeGreaterThanOrEqual(1);
  });

  it("renders children in main", () => {
    render(
      <AppShell>
        <div data-testid="child">Hello</div>
      </AppShell>
    );
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("has a hamburger menu button with aria-label", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const btns = screen.getAllByLabelText("Toggle navigation menu");
    expect(btns.length).toBeGreaterThanOrEqual(1);
    expect(btns[0]!.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles mobile menu on hamburger click", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const btn = screen.getAllByLabelText("Toggle navigation menu")[0]!;

    // Initially closed
    expect(btn.getAttribute("aria-expanded")).toBe("false");

    // Click to open
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    // Click to close
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("nav links point to correct hrefs", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const gamesLink = screen.getAllByText("Games")[0]!;
    expect(gamesLink.closest("a")?.getAttribute("href")).toBe("/games");

    const betsLink = screen.getAllByText("Bets")[0]!;
    expect(betsLink.closest("a")?.getAttribute("href")).toBe("/bets");
  });

  it("uses minimal header chrome on game room routes", () => {
    state.pathname = "/games/dice";
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );

    expect(screen.getByText("All Games")).toBeDefined();
    expect(screen.queryByText("Game Rooms")).toBeNull();
    expect(screen.queryByText("Release")).toBeNull();
    expect(screen.queryByText("Digest")).toBeNull();
    expect(screen.queryByText("Hub")).toBeNull();
  });
});
