import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
  ReadOnlyBanner: ({ reason }: any) => <div data-testid="readonly-banner">{reason}</div>,
  ShellHeader: ({ children }: any) => <header>{children}</header>,
  ShellHeaderBrand: ({ name }: any) => <div>{name}</div>,
  ShellHeaderNav: ({ children }: any) => <nav>{children}</nav>,
  ShellHeaderActions: ({ children }: any) => <div>{children}</div>,
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
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
    expect(screen.getAllByText("ArbiGameFi").length).toBeGreaterThanOrEqual(1);
  });

  it("renders trust-route navigation links", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const primaryLinks = [
      "Games",
      "Sportsbook",
      "Liquidity",
      "Bets",
      "Claims",
      "Affiliates",
      "Account"
    ];
    for (const label of primaryLinks) {
      const links = screen.getAllByText(label);
      expect(links.length).toBeGreaterThanOrEqual(1);
    }
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

  it("marks the active route in the app header nav", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const betsLink = screen.getAllByText("Bets")[0]!;
    expect(betsLink.className).toContain("text-fg");
    expect(betsLink.className).toContain("border-b-2");
  });

  it("nav links point to correct hrefs", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    const gamesLink = screen.getAllByText("Games")[0]!;
    expect(gamesLink.closest("a")?.getAttribute("href")).toBe("/games");

    const sportsbookLink = screen.getAllByText("Sportsbook")[0]!;
    expect(sportsbookLink.closest("a")?.getAttribute("href")).toBe("/sportsbook");

    const investLink = screen.getAllByText("Liquidity")[0]!;
    expect(investLink.closest("a")?.getAttribute("href")).toBe("/invest");

    const betsLink = screen.getAllByText("Bets")[0]!;
    expect(betsLink.closest("a")?.getAttribute("href")).toBe("/bets");
  });
});
