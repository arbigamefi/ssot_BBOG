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
  PageHeader: ({ title, description }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
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

  it("renders page header and game cards when gamesMeta is populated", () => {
    state.release = { gamesMeta: MOCK_GAMES_META };
    render(<GamesListClient />);
    expect(screen.getByTestId("page-header")).toBeDefined();
    expect(screen.getByText("Games")).toBeDefined();
    expect(screen.getByText("Dice")).toBeDefined();
    expect(screen.getByText("Coin Toss")).toBeDefined();
  });

  it("renders correct number of game cards", () => {
    state.release = { gamesMeta: MOCK_GAMES_META };
    render(<GamesListClient />);
    const cards = screen.getAllByTestId("game-card");
    expect(cards.length).toBe(2);
  });

  it("links each game card to /games/[slug]", () => {
    state.release = { gamesMeta: MOCK_GAMES_META };
    render(<GamesListClient />);
    const diceLink = screen.getByText("Dice").closest("a");
    expect(diceLink?.getAttribute("href")).toBe("/games/dice");

    const coinLink = screen.getByText("Coin Toss").closest("a");
    expect(coinLink?.getAttribute("href")).toBe("/games/coin-toss");
  });

  it("game cards have correct slug data attributes", () => {
    state.release = { gamesMeta: MOCK_GAMES_META };
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
