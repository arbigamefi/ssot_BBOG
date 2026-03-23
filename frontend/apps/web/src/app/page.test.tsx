import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  release: null as any,
  readOnly: false,
  readOnlyReason: null as string | null,
  sdk: null as any,
  ready: false,
  db: null as any,
  indexerStatus: null as any,
  bets: [] as any[],
  betsLoading: false,
  betCount: 0,
  assetOverviews: [] as any[],
  overviewLoading: false,
  overviewError: null as Error | null
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: any) => {
    if (Array.isArray(queryKey) && queryKey.includes("bet-count")) {
      return { data: state.betCount, isLoading: false, error: null };
    }
    if (Array.isArray(queryKey) && queryKey.includes("asset-overview")) {
      return {
        data: state.assetOverviews,
        isLoading: state.overviewLoading,
        error: state.overviewError
      };
    }
    return { data: undefined, isLoading: false, error: null };
  }
}));

vi.mock("../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason
  })
}));

vi.mock("../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: state.ready
  })
}));

vi.mock("../ssot/runtime", () => ({
  useSSOTRuntime: () => ({
    db: state.db
  })
}));

vi.mock("../features/ops/useIndexer", () => ({
  useIndexer: () => ({
    indexerStatus: state.indexerStatus
  })
}));

vi.mock("../features/bets/useBets", () => ({
  useBets: () => ({
    data: state.bets,
    isLoading: state.betsLoading
  })
}));

vi.mock("../components/PageTransition", () => ({
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

import HomePage from "./page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
    state.release = null;
    state.readOnly = false;
    state.readOnlyReason = null;
    state.sdk = null;
    state.ready = false;
    state.db = null;
    state.indexerStatus = null;
    state.bets = [];
    state.betsLoading = false;
    state.betCount = 0;
    state.assetOverviews = [];
    state.overviewLoading = false;
    state.overviewError = null;
  });

  it("renders the prototype-first landing hero", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /the settlement engine/i })).toBeDefined();
    expect(screen.getByText(/for on-chain games/i)).toBeDefined();
    expect(screen.getByText("SSOT Architecture v1.0")).toBeDefined();
    expect(screen.getAllByText("Enter Rooms").length).toBeGreaterThan(0);
    expect(screen.getByText("A Platform for the Entire Ecosystem")).toBeDefined();
    expect(screen.getByText("Pure functional rooms.")).toBeDefined();
  });

  it("renders reserve proof and canonical room cards when release data exists", () => {
    state.release = {
      name: "Arbitrum",
      chainId: 42161,
      releaseDigest: "0xdeadbeefcafefeeddeadbeefcafefeed",
      contracts: { hub: "0x1234567890abcdef1234567890abcdef12345678" },
      games: {},
      assets: [{ address: "0x01", bank: "0x02", symbol: "USDC", decimals: 6 }],
      gamesMeta: [
        { gameId: "0x01", slug: "dice", label: "Dice", paramsEncoding: "uint8" },
        { gameId: "0x02", slug: "keno", label: "Keno", paramsEncoding: "uint40" }
      ]
    };
    state.indexerStatus = {
      lagBlocks: 1,
      config: { confirmations: 3 },
      lastRunAt: Date.now() - 60_000
    };
    state.betCount = 12;
    state.bets = [
      {
        id: "bet-1",
        betId: "1",
        gameId: "0x01",
        state: "Placed",
        updatedAt: Date.now() - 60_000,
        updatedBlock: 123
      }
    ];
    state.assetOverviews = [
      {
        address: "0x01",
        bank: "0x02",
        symbol: "USDC",
        decimals: 6,
        totalAssets: 1_000_000n,
        totalReserved: 250_000n,
        freeLiquidity: 750_000n,
        updatedAtBlock: 123n
      }
    ];

    render(<HomePage />);

    expect(screen.getByText("Bankroll reserves (R)")).toBeDefined();
    expect(screen.getByText("Settlement Volume")).toBeDefined();
    expect(screen.getByText("Active Partners")).toBeDefined();
    expect(screen.getAllByTestId("room-entry-card").length).toBe(2);
    expect(screen.getByText("Precision Dice")).toBeDefined();
    expect(screen.getByText("Keno Draft")).toBeDefined();

    const roomCards = screen.getAllByTestId("room-entry-card");
    expect(roomCards.length).toBeGreaterThan(0);

    const kenoLinks = screen
      .getAllByText("Keno Draft")
      .map((node) => node.closest("a")?.getAttribute("href"));
    expect(kenoLinks).toContain("/keno");
  });
});
