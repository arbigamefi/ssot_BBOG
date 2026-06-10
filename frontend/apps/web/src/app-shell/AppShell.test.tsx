import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as React from "react";
import { AppShell } from "./AppShell";

// ——— Mock dependencies ———
const mockRelease = {
  name: "test-net",
  contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
  releaseDigest: "0xdeadbeefcafe"
};

const state = {
  pathname: "/portfolio/activity"
};

vi.mock("../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: mockRelease,
    readOnly: false,
    readOnlyReason: null,
    warnings: []
  })
}));

vi.mock("./WalletButton", () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() })
}));

// The header now uses a single, unified `WalletHeaderMenu` (wallet +
// chain switcher + network mismatch banner all in one) plus a mobile
// deep-link banner. Stub them out so AppShell smoke-tests stay focused
// on layout/nav and don't drag in the wagmi/RainbowKit stack.
vi.mock("./WalletHeaderMenu", () => ({
  WalletHeaderMenu: () => <button data-testid="wallet-button">Connect</button>
}));

vi.mock("./MobileWalletDeepLinkBanner", () => ({
  MobileWalletDeepLinkBanner: () => null
}));

// Compliance surfaces (age gate, cookie banner, RG dialog, reality check,
// self-exclusion route gate) need a provider; stub them so the AppShell
// layout test stays focused. SelfExclusionGate must pass children through.
vi.mock("./compliance", () => ({
  AgeTermsGate: () => null,
  CookieConsentBanner: () => null,
  ResponsibleGamblingDialog: () => null,
  RealityCheckTimer: () => null,
  SelfExclusionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCompliance: () => ({ openRgDialog: vi.fn() })
}));

vi.mock("./onboarding/OnboardingTour", () => ({
  OnboardingTour: () => null
}));

vi.mock("./pwa/InstallPrompt", () => ({
  InstallPrompt: () => null
}));

vi.mock("../components/LocaleSwitcher", () => ({
  LocaleSheetSwitcher: () => <div data-testid="locale-sheet-switcher">English</div>,
  LocaleSwitcher: () => <div data-testid="locale-switcher">English</div>
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false })
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "app.unknownNetwork": "Unknown network",
      "app.writesDisabled": "Writes are disabled.",
      "nav.account": "Account",
      "nav.affiliates": "Affiliates",
      "nav.bets": "Bets",
      "nav.casino": "Casino",
      "nav.claims": "Claims",
      "nav.baccarat": "Baccarat",
      "nav.coinToss": "Coin Toss",
      "nav.dice": "Dice",
      "nav.games": "Games",
      "nav.keno": "Keno",
      "nav.liquidity": "Liquidity",
      "nav.menu": "Menu",
      "nav.openMenu": "Open menu",
      "nav.closeMenu": "Close menu",
      "nav.language": "Language",
      "nav.refresh": "Refresh",
      "nav.openRooms": "Open Rooms",
      "nav.ops": "Ops",
      "nav.plinko": "Plinko",
      "nav.product": "Product",
      "nav.rooms": "Rooms",
      "nav.roulette": "Roulette",
      "nav.sicBo": "Sic Bo",
      "nav.slots": "Slots",
      "nav.status": "Status",
      "nav.support": "Support",
      "nav.sportsbook": "Sportsbook"
    })[key] ?? key
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ refresh: vi.fn() })
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
    state.pathname = "/portfolio/activity";
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

  it("renders the unified wallet menu in place of the old NetworkSwitcher", () => {
    // Network switching is now folded into the wallet menu; the stand-alone
    // NetworkSwitcher component no longer exists. We assert the unified
    // wallet trigger is present (the mock returns a `wallet-button` testid).
    render(
      <AppShell>
        <div>content</div>
      </AppShell>
    );
    expect(screen.getAllByTestId("wallet-button").length).toBeGreaterThanOrEqual(1);
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

  it("uses the dark theme on legal routes", () => {
    state.pathname = "/legal/privacy";
    const { container } = render(
      <AppShell>
        <div>legal content</div>
      </AppShell>
    );

    expect(container.firstElementChild?.className).toContain("theme-dark");
  });

  it("uses the dark theme on game room routes", () => {
    state.pathname = "/casino/dice";
    const { container } = render(
      <AppShell>
        <div>game content</div>
      </AppShell>
    );

    expect(container.firstElementChild?.className).toContain("theme-dark");
  });

  it("renders all active casino room links in game headers", () => {
    state.pathname = "/casino/slots";
    render(
      <AppShell>
        <div>game content</div>
      </AppShell>
    );

    const roomLinks = [
      ["Dice", "/casino/dice"],
      ["Plinko", "/casino/plinko"],
      ["Slots", "/casino/slots"],
      ["Baccarat", "/casino/baccarat"],
      ["Sic Bo", "/casino/sic-bo"],
      ["Roulette", "/casino/roulette"],
      ["Coin Toss", "/casino/coin-toss"],
      ["Keno", "/casino/keno"]
    ] as const;

    for (const [label, href] of roomLinks) {
      expect(screen.getAllByText(label)[0]?.closest("a")?.getAttribute("href")).toBe(href);
    }
    expect(screen.getAllByText("Slots").some((node) => node.className.includes("text-brand"))).toBe(
      true
    );
  });

  it("does not render the game-room rail on casino receipt routes", () => {
    state.pathname = "/casino/receipt/84532/2";
    render(
      <AppShell>
        <div>receipt content</div>
      </AppShell>
    );

    expect(screen.getByText("receipt content")).toBeDefined();
    expect(screen.queryByText("← Casino")).toBeNull();
  });

  it("uses the dark theme on the games directory route", () => {
    state.pathname = "/casino";
    const { container } = render(
      <AppShell>
        <div>games directory</div>
      </AppShell>
    );

    expect(container.firstElementChild?.className).toContain("theme-dark");
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
    expect(gamesLink.closest("a")?.getAttribute("href")).toBe("/casino");

    const sportsbookLink = screen.getAllByText("Sportsbook")[0]!;
    expect(sportsbookLink.closest("a")?.getAttribute("href")).toBe("/sportsbook");

    const investLink = screen.getAllByText("Liquidity")[0]!;
    expect(investLink.closest("a")?.getAttribute("href")).toBe("/earn");

    const betsLink = screen.getAllByText("Bets")[0]!;
    expect(betsLink.closest("a")?.getAttribute("href")).toBe("/portfolio/activity");
  });
});
