import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@ssot/ui", () => ({
  Card: ({ children, ...props }: any) => <div data-testid="game-card" {...props}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
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

  it("renders game cards when gamesMeta is populated", () => {
    state.release = { gamesMeta: MOCK_GAMES_META };
    render(<GamesListClient />);
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

  it("displays module address (truncated)", () => {
    state.release = { gamesMeta: MOCK_GAMES_META };
    render(<GamesListClient />);
    expect(screen.getByText(/0x6666/)).toBeDefined();
  });

  it("shows paramsEncoding when present", () => {
    state.release = { gamesMeta: MOCK_GAMES_META };
    render(<GamesListClient />);
    expect(screen.getByText("uint8")).toBeDefined();
  });

  it("handles gamesMeta undefined (defaults to empty array)", () => {
    state.release = { gamesMeta: undefined };
    render(<GamesListClient />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
  });
});
