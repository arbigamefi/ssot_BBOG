import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  release: {
    assets: [
      { address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 },
      { address: "0x0000000000000000000000000000000000000002", symbol: "WETH", decimals: 18 }
    ],
    pools: [
      {
        active: true,
        asset: "0x0000000000000000000000000000000000000002",
        domain: "sports",
        poolId: 2
      }
    ],
    gamesMeta: [
      {
        gameId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        label: "Dice"
      }
    ]
  } as any,
  bets: [] as any[],
  sportsTickets: [] as any[],
  loading: false
};

vi.mock("next-intl", async () => {
  const messages = (await import("../../../../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;

  function resolveMessage(key: string) {
    return key.split(".").reduce<unknown>((current, part) => {
      if (current && typeof current === "object" && part in current) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);
  }

  function translate(key: string, values?: Record<string, string | number>) {
    const message = resolveMessage(key);
    if (typeof message !== "string") return key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      message
    );
  }

  return {
    useTranslations: () => translate
  };
});

vi.mock("../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release })
}));

vi.mock("../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({ sdk: { account: "0x1111111111111111111111111111111111111111" } })
}));

vi.mock("../../../../features/betting/usePlayerBets", () => ({
  usePlayerBets: () => ({
    data: state.bets,
    isLoading: state.loading,
    localRows: state.bets,
    serverRows: []
  })
}));

vi.mock("../../../../features/sportsbook/usePlayerSportsTickets", () => ({
  usePlayerSportsTickets: () => ({
    data: state.sportsTickets,
    isLoading: state.loading
  })
}));

vi.mock("../../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

import { PortfolioActivityPageClient } from "./pageClient";

describe("PortfolioActivityPageClient", () => {
  afterEach(() => {
    cleanup();
    state.bets = [];
    state.sportsTickets = [];
    state.loading = false;
  });

  it("frames bets as an activity ledger", () => {
    render(<PortfolioActivityPageClient />);

    expect(screen.getByRole("heading", { name: /Betting activity/i })).toBeDefined();
    expect(screen.getByText("Ledger summary")).toBeDefined();
    expect(screen.getByText("Casino ledger")).toBeDefined();
    expect(screen.getAllByText("No bets align with the current filter.").length).toBeGreaterThan(0);
  });

  it("renders indexed tickets with a detail link", () => {
    state.bets = [
      {
        id: "84532:42",
        chainId: 84532,
        betId: "42",
        state: "placed",
        gameId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        asset: "0x0000000000000000000000000000000000000001",
        updatedBlock: 10,
        lastTxHash: "0x1234",
        lastEventName: "BetPlaced",
        updatedAt: Date.now(),
        stake: "1000000"
      }
    ];

    render(<PortfolioActivityPageClient />);

    expect(screen.getAllByText("#42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 USDC").length).toBeGreaterThan(0);
    expect(screen.getByText("View").closest("a")?.getAttribute("href")).toBe(
      "/portfolio/activity/42"
    );
  });

  it("renders sportsbook tickets with their ticket detail link", () => {
    state.sportsTickets = [
      {
        id: "84532:sports:12",
        chainId: 84532,
        ticketId: "12",
        state: "held",
        marketId: "6",
        poolId: "2",
        player: "0x1111111111111111111111111111111111111111",
        updatedBlock: 12,
        lastTxHash: "0xabcd",
        lastEventName: "TicketPlaced",
        updatedAt: Date.now(),
        stake: "1000000000000000000",
        payout: "5500000000000000000"
      }
    ];

    render(<PortfolioActivityPageClient />);

    expect(screen.getAllByText("S#12").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sportsbook #6").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 WETH").length).toBeGreaterThan(0);
    expect(screen.getByText("View").closest("a")?.getAttribute("href")).toBe(
      "/portfolio/tickets/12"
    );
  });
});
