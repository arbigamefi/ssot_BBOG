import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as React from "react";

// ——— Shared mock state via object ref ———
const state = { release: null as any, readOnlyReason: null as string | null };

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release, readOnlyReason: state.readOnlyReason })
}));

vi.mock("../../../components/ProductStateCard", () => ({
  ProductStateCard: ({ title, description }: any) => (
    <div data-testid="placeholder">
      <h2>{title}</h2>
      <p data-testid="placeholder-desc">{description}</p>
    </div>
  )
}));

vi.mock("../../../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    ({
      "nav.games": "Games",
      "casino.directory.empty.noRelease": "No embedded release available for the connected chain.",
      "casino.directory.empty.noGames": "No games registered in the active release.",
      "casino.directory.hero.eyebrow": "Global Casino Lobby",
      "casino.directory.hero.title": "Enter the Floor",
      "casino.directory.hero.description":
        "All modules are 100% on-chain, verifiable, and connected directly to the isolated reserve bank. Play directly from your wallet.",
      "casino.directory.stats.livePlayers": "Live Players",
      "casino.directory.stats.maxWin": "Max Win (24H)",
      "casino.directory.filters.all": "All Modules",
      "casino.directory.filters.table": "Table Games",
      "casino.directory.filters.binary": "Binary / Fast",
      "casino.directory.filters.lottery": "Lottery",
      "casino.directory.filters.arcade": "Arcade",
      "casino.directory.search.placeholder": "Search games...",
      "casino.directory.search.aria": "Search games",
      "casino.directory.tags.binary": "Binary",
      "casino.directory.tags.table": "Table",
      "casino.directory.tags.lottery": "Lottery",
      "casino.directory.tags.arcade": "Arcade",
      "casino.directory.tags.module": "Module",
      "casino.directory.rooms.dice.title": "Precision Dice",
      "casino.directory.rooms.dice.promise": "1-99 sizing in seconds.",
      "casino.directory.rooms.dice.badge": "1% House Edge",
      "casino.directory.rooms.roulette.title": "European Roulette",
      "casino.directory.rooms.roulette.promise": "Classic 37-slot physical mechanics.",
      "casino.directory.rooms.roulette.badge": "Max Payout 36x",
      "casino.directory.rooms.coinToss.title": "Coin Toss",
      "casino.directory.rooms.coinToss.promise": "High-speed 50/50 resolution.",
      "casino.directory.rooms.coinToss.badge": "1% House Edge",
      "casino.directory.rooms.keno.title": "Keno Draft",
      "casino.directory.rooms.keno.promise": "Pick multi-spots for massive multipliers.",
      "casino.directory.rooms.keno.badge": "Huge 1,000x Win",
      "casino.directory.rooms.plinko.title": "Plinko",
      "casino.directory.rooms.plinko.promise": "Drop through eight rows and chase edge buckets.",
      "casino.directory.rooms.plinko.badge": "Up to 24.6x",
      "casino.directory.card.playing": `${values?.count ?? "{count}"} playing`,
      "casino.directory.card.playNow": "Play Now",
      "casino.directory.reserve.title": "Progressive Reserve Pool",
      "casino.directory.reserve.subtitle": "Transparent / Verifiable / Unlocked",
      "casino.directory.reserve.status": "Yielding Real Time"
    })[key] ?? key
}));

import { GamesListClient } from "./pageClient";

const MOCK_GAMES_META = [
  {
    gameId: "0x01",
    slug: "dice",
    label: "Dice",
    module: "0x6666666666666666666666666666666666666666",
    paramsEncoding: "uint8"
  },
  {
    gameId: "0x02",
    slug: "coin-toss",
    label: "Coin Toss",
    module: "0x7777777777777777777777777777777777777777"
  },
  {
    gameId: "0x03",
    slug: "plinko",
    label: "Plinko",
    module: "0x8888888888888888888888888888888888888888"
  },
  {
    gameId: "0x04",
    slug: "baccarat",
    label: "Baccarat",
    module: "0x9999999999999999999999999999999999999999"
  }
];

describe("GamesListClient", () => {
  afterEach(() => {
    cleanup();
    state.release = null;
    state.readOnlyReason = null;
  });

  it("shows placeholder when release is null", () => {
    state.release = null;
    state.readOnlyReason = "Not connected";
    render(<GamesListClient />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
    expect(screen.getByText("Not connected")).toBeDefined();
  });

  it("falls back to canonical rooms when gamesMeta is empty", () => {
    state.release = { gamesMeta: [] };
    render(<GamesListClient />);
    expect(screen.getByText("Enter the Floor")).toBeDefined();
    expect(screen.getAllByTestId("room-entry-card").length).toBeGreaterThan(0);
    expect(screen.getByText("European Roulette")).toBeDefined();
  });

  it("renders the rebuilt directory hero and game cards when gamesMeta is populated", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META
    };
    render(<GamesListClient />);
    expect(screen.getByText("Enter the Floor")).toBeDefined();
    expect(screen.getByText("Global Casino Lobby")).toBeDefined();
    expect(screen.getByText("Precision Dice")).toBeDefined();
    expect(screen.getAllByText("Coin Toss").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Plinko").length).toBeGreaterThan(0);
    expect(screen.getByText("Progressive Reserve Pool")).toBeDefined();
  });

  it("renders correct number of room entry cards", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META
    };
    render(<GamesListClient />);
    const cards = screen.getAllByTestId("room-entry-card");
    expect(cards.length).toBe(3);
  });

  it("does not render release games without implemented route modules", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META
    };
    render(<GamesListClient />);
    expect(screen.queryByText("Baccarat")).toBeNull();
    expect(
      Array.from(screen.getAllByTestId("room-entry-card")).map((card) =>
        card.getAttribute("data-slug")
      )
    ).toEqual(["dice", "plinko", "coin-toss"]);
  });

  it("links each game card to canonical game room routes", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META
    };
    render(<GamesListClient />);
    const diceLinks = screen
      .getAllByText("Precision Dice")
      .map((node) => node.closest("a")?.getAttribute("href"));
    expect(diceLinks).toContain("/casino/dice");

    const coinLinks = screen
      .getAllByText("Coin Toss")
      .map((node) => node.closest("a")?.getAttribute("href"));
    expect(coinLinks).toContain("/casino/coin-toss");

    const plinkoLinks = screen
      .getAllByText("Plinko")
      .map((node) => node.closest("a")?.getAttribute("href"));
    expect(plinkoLinks).toContain("/casino/plinko");
  });

  it("room entry cards have correct slug data attributes", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { gameHub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META
    };
    render(<GamesListClient />);
    const cards = screen.getAllByTestId("room-entry-card");
    expect(cards[0]?.getAttribute("data-slug")).toBe("dice");
    expect(cards[1]?.getAttribute("data-slug")).toBe("plinko");
    expect(cards[2]?.getAttribute("data-slug")).toBe("coin-toss");
  });

  it("handles gamesMeta undefined by rendering canonical fallback rooms", () => {
    state.release = { gamesMeta: undefined };
    render(<GamesListClient />);
    expect(screen.getAllByTestId("room-entry-card").length).toBeGreaterThan(0);
    expect(screen.getByText("Precision Dice")).toBeDefined();
  });
});
