import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const pushMock = vi.fn();

const state = {
  release: null as any,
  readOnlyReason: null as string | null,
  chainId: 84532,
  bets: [] as any[],
  betsLoading: false,
  betsError: null as Error | null,
  indexerStatus: { lastSyncedBlock: 321, lagBlocks: 4 },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId,
  }),
}));

vi.mock("../../../features/bets/useBetsByGame", () => ({
  useBetsByGame: () => ({
    data: state.bets,
    isLoading: state.betsLoading,
    error: state.betsError,
  }),
}));

vi.mock("../../../features/ops/useIndexer", () => ({
  useIndexer: () => ({
    indexerStatus: state.indexerStatus,
  }),
}));

vi.mock("../../../features/betting/ui/GameBetPanel", () => ({
  GameBetPanel: ({ game, children }: any) => (
    <div data-testid="game-bet-panel">
      <div>{game.label}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("../../../components/Placeholder", () => ({
  Placeholder: ({ title, description }: any) => (
    <div data-testid="placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock("../../../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@ssot/ui", () => ({
  Button: ({ children, asChild }: any) => (asChild ? children : <button type="button">{children}</button>),
  Card: ({ children }: any) => <section>{children}</section>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CoinTossParamsForm: () => <div>Coin Toss Params</div>,
  CopyButton: ({ value }: any) => <button type="button">{value}</button>,
  DataTable: ({ columns, data, onRowClick, loading, emptyMessage }: any) => {
    if (loading) return <div>Loading…</div>;
    if (!data.length) return <div>{emptyMessage}</div>;
    return (
      <div data-testid="data-table">
        {data.map((row: any, index: number) => (
          <div
            key={row.id}
            data-testid={`row-${index}`}
            role="button"
            tabIndex={0}
            onClick={() => onRowClick?.(row, index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onRowClick?.(row, index);
            }}
          >
            {columns.map((column: any) => (
              <div key={column.key}>{column.render(row, index)}</div>
            ))}
          </div>
        ))}
      </div>
    );
  },
  DiceParamsForm: () => <div>Dice Params</div>,
  ErrorCallout: ({ title, message }: any) => (
    <div data-testid="error-callout">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  ),
  KenoParamsForm: () => <div>Keno Params</div>,
  ReleaseBadge: ({ networkName }: any) => <span>{networkName}</span>,
  RouletteParamsForm: () => <div>Roulette Params</div>,
  createDefaultRouletteSelection: () => ({ kind: "straight", number: 0 }),
  summarizeRouletteSelection: () => ({
    family: "Straight",
    display: "Straight 0",
    coverage: 1,
    helper: "Single-number call.",
  }),
  StatusBadge: ({ label }: any) => <span>{label}</span>,
  TabBar: ({ tabs, activeKey, onTabChange }: any) => (
    <div data-testid="tab-bar">
      {tabs.map((tab: any) => (
        <button key={tab.key} type="button" data-active={tab.key === activeKey} onClick={() => onTabChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

import { GamePageClient } from "./pageClient";

const MOCK_RELEASE = {
  name: "Base Sepolia",
  releaseDigest: "0xdeadbeefcafefeed",
  contracts: {
    hub: "0x1234567890abcdef1234567890abcdef12345678",
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      bank: "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff",
    },
  ],
  gamesMeta: [
    {
      gameId: "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b",
      slug: "dice",
      label: "Dice",
      module: "0x8fb66ccc25d07b252d282be646d24444c062c667",
      paramsEncoding: "abi.encode(uint8 cap)",
    },
    {
      gameId: "0x2d2e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914aaa",
      slug: "roulette",
      label: "Roulette",
      module: "0x1111111111111111111111111111111111111111",
      paramsEncoding: "abi.encode(uint8 kind, uint40 payload)",
    },
  ],
};

const MOCK_BETS = [
  {
    id: "84532:1",
    betId: "1",
    state: "placed",
    player: "0x1111111111111111111111111111111111111111",
    updatedAt: Date.now() - 60_000,
    lastTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  },
];

describe("GamePageClient", () => {
  afterEach(() => {
    cleanup();
    pushMock.mockReset();
    state.release = null;
    state.readOnlyReason = null;
    state.bets = [];
    state.betsLoading = false;
    state.betsError = null;
    state.indexerStatus = { lastSyncedBlock: 321, lagBlocks: 4 };
  });

  it("shows placeholder when release is unavailable", () => {
    state.release = null;
    state.readOnlyReason = "No release";
    render(<GamePageClient slug="dice" />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
    expect(screen.getByText("No release")).toBeDefined();
  });

  it("renders release-driven game room and recent bets", () => {
    state.release = MOCK_RELEASE;
    state.bets = MOCK_BETS;

    render(<GamePageClient slug="dice" />);

    expect(screen.getAllByText("Dice").length).toBeGreaterThan(0);
    expect(screen.getByTestId("game-bet-panel")).toBeDefined();
    expect(screen.getByText("Open ledger")).toBeDefined();
    expect(screen.getByText(/Choose the table call, size the ticket/)).toBeDefined();
    expect(screen.getByText("Current cap:")).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
    expect(screen.getByText("Sync:")).toBeDefined();
    expect(screen.getByText("Recent bets")).toBeDefined();
    expect(screen.getByRole("button", { name: "Playbook" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Room Facts" })).toBeDefined();
    expect(screen.getByTestId("data-table")).toBeDefined();
    expect(screen.getAllByTestId("tab-bar").length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Room Facts" }));
    expect(screen.getAllByText("abi.encode(uint8 cap)").length).toBeGreaterThan(0);
    expect(screen.getByText("USDC")).toBeDefined();
  });

  it("renders roulette as a standard European table room", () => {
    state.release = MOCK_RELEASE;

    render(<GamePageClient slug="roulette" />);

    expect(screen.getAllByText("Roulette").length).toBeGreaterThan(0);
    expect(screen.getByText("European roulette")).toBeDefined();
    expect(screen.getByText("Table-first room")).toBeDefined();
    expect(screen.getByText("Playbook")).toBeDefined();
    expect(screen.getByText("Room Facts")).toBeDefined();
    expect(screen.queryByText("Mask table")).toBeNull();
  });

  it("navigates to bet detail when a recent bet row is clicked", () => {
    state.release = MOCK_RELEASE;
    state.bets = MOCK_BETS;

    render(<GamePageClient slug="dice" />);
    fireEvent.click(screen.getByTestId("row-0"));
    expect(pushMock).toHaveBeenCalledWith("/bets/1");
  });

  it("shows placeholder when slug is not present in release", () => {
    state.release = MOCK_RELEASE;
    render(<GamePageClient slug="keno" />);
    expect(screen.getByTestId("placeholder")).toBeDefined();
    expect(screen.getByText(/No game with slug 'keno'/)).toBeDefined();
  });
});
