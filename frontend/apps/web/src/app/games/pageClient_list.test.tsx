import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as React from "react";

// ——— Shared mock state via object ref ———
const state = { release: null as any, readOnlyReason: null as string | null };

vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release, readOnlyReason: state.readOnlyReason }),
}));

vi.mock("../../components/Placeholder", () => ({
  Placeholder: ({ title, description }: any) => (
    <div data-testid="placeholder">
      <h2>{title}</h2>
      <p data-testid="placeholder-desc">{description}</p>
    </div>
  ),
}));

vi.mock("../../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@ssot/ui", () => ({
  Button: ({ children, asChild }: any) => (asChild ? children : <button type="button">{children}</button>),
  PageHeader: ({ title, description }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  ),
  ReleaseBadge: ({ networkName }: any) => <span>{networkName}</span>,
  StatCard: ({ label, value, subValue }: any) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{value}</span>
      {subValue ? <span>{subValue}</span> : null}
    </div>
  ),
  GameCard: ({ slug, label, icon, description, rtp }: any) => (
    <div data-testid="game-card" data-slug={slug}>
      <h3>{label}</h3>
      <span>{icon}</span>
      {description && <p>{description}</p>}
      {rtp && <span>{rtp}</span>}
    </div>
  ),
}));

import { GamesListClient } from "./pageClient_list";

const MOCK_GAMES_META = [
  { gameId: "0x01", slug: "dice", label: "Dice", module: "0x6666666666666666666666666666666666666666", paramsEncoding: "uint8" },
  { gameId: "0x02", slug: "coin-toss", label: "Coin Toss", module: "0x7777777777777777777777777777777777777777" },
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

  it("shows placeholder when gamesMeta is empty", () => {
    state.release = { gamesMeta: [] };
    render(<GamesListClient />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
    const desc = screen.getByTestId("placeholder-desc");
    expect(desc.textContent).toContain("No games registered");
  });

  it("renders the rebuilt directory hero and game cards when gamesMeta is populated", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { hub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META,
    };
    render(<GamesListClient />);
    expect(screen.getByText("Enter a room the same way you would enter a real casino floor.")).toBeDefined();
    expect(screen.getByText("Game directory")).toBeDefined();
    expect(screen.getAllByText("Dice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Coin Toss").length).toBeGreaterThan(0);
    expect(screen.getByText("Browse by room, not by module.")).toBeDefined();
  });

  it("renders correct number of game cards", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { hub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META,
    };
    render(<GamesListClient />);
    const cards = screen.getAllByTestId("game-card");
    expect(cards.length).toBe(2);
  });

  it("links each game card to /games/[slug]", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { hub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META,
    };
    render(<GamesListClient />);
    const diceLinks = screen.getAllByText("Dice").map((node) => node.closest("a")?.getAttribute("href"));
    expect(diceLinks).toContain("/games/dice");

    const coinLinks = screen.getAllByText("Coin Toss").map((node) => node.closest("a")?.getAttribute("href"));
    expect(coinLinks).toContain("/games/coin-toss");
  });

  it("game cards have correct slug data attributes", () => {
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0xdeadbeefcafefeed",
      contracts: { hub: "0x1234567890abcdef1234567890abcdef12345678" },
      assets: [{ address: "0x01", symbol: "USDC", decimals: 6 }],
      gamesMeta: MOCK_GAMES_META,
    };
    render(<GamesListClient />);
    const cards = screen.getAllByTestId("game-card");
    expect(cards[0]?.getAttribute("data-slug")).toBe("dice");
    expect(cards[1]?.getAttribute("data-slug")).toBe("coin-toss");
  });

  it("handles gamesMeta undefined (defaults to empty array)", () => {
    state.release = { gamesMeta: undefined };
    render(<GamesListClient />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
  });
});
