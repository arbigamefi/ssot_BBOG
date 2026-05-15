import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const state = {
  release: {
    assets: [
      { address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 }
    ],
    gamesMeta: [
      {
        gameId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        label: "Dice"
      }
    ]
  } as any,
  bets: [] as any[],
  loading: false
};

vi.mock("../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release })
}));

vi.mock("../../../../features/betting/useBets", () => ({
  useBets: () => ({ data: state.bets, isLoading: state.loading })
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

import { BetsPageClient } from "./pageClient";

describe("BetsPageClient", () => {
  afterEach(() => {
    cleanup();
    state.bets = [];
    state.loading = false;
  });

  it("frames bets as an activity ledger", () => {
    render(<BetsPageClient />);

    expect(screen.getByRole("heading", { name: /Betting activity/i })).toBeDefined();
    expect(screen.getByText("Ledger summary")).toBeDefined();
    expect(screen.getByText("Casino ledger")).toBeDefined();
    expect(screen.getAllByText("No tickets align with the current filter.").length).toBeGreaterThan(
      0
    );
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

    render(<BetsPageClient />);

    expect(screen.getAllByText("#42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 USDC").length).toBeGreaterThan(0);
    expect(screen.getByText("View").closest("a")?.getAttribute("href")).toBe(
      "/portfolio/activity/42"
    );
  });
});
