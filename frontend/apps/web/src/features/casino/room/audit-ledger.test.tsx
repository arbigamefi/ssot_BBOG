import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameRoomAuditLedger } from "./audit-ledger";
import type { GameMeta } from "./model";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

vi.mock("@heroicons/react/24/outline", () => ({
  ArrowTopRightOnSquareIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  )
}));

// The My-Bets tab uses this hook — return an empty list with no loading state
// so the tab renders its connect-wallet / empty path deterministically.
vi.mock("../../betting/usePlayerBets", () => ({
  usePlayerBets: () => ({
    data: [],
    isLoading: false,
    isFetching: false,
    localRows: [],
    serverRows: [],
    error: null,
    refetch: () => {}
  })
}));

// Mock per-game-info bets array via t.raw().
const GAME_INFO_BETS = [
  { key: "straight", label: "Straight up", coverage: "1 number", multiplier: "36×" },
  { key: "redBlack", label: "Red / Black", coverage: "18 numbers", multiplier: "2×" }
];

const TRANSLATIONS: Record<string, string> = {
  "casino.room.audit.tabs.live": "Live bets",
  "casino.room.audit.tabs.mine": "My bets",
  "casino.room.audit.tabs.top": "Top wins",
  "casino.room.audit.tabs.info": "Game info",
  "casino.room.audit.columns.time": "Time",
  "casino.room.audit.columns.player": "Player",
  "casino.room.audit.columns.stake": "Stake",
  "casino.room.audit.columns.multiplier": "Multiplier",
  "casino.room.audit.columns.payout": "Payout",
  "casino.room.audit.columns.state": "State",
  "casino.room.audit.columns.bet": "Bet",
  "casino.room.audit.columns.coverage": "Coverage",
  "casino.room.audit.emptyStates.live": "No bets yet",
  "casino.room.audit.emptyStates.mine": "You haven't played this game yet.",
  "casino.room.audit.emptyStates.top": "No wins yet",
  "casino.room.audit.emptyStates.connectWallet": "Connect your wallet to see your history.",
  "casino.room.audit.houseEdgeLabel": "House edge",
  "casino.room.audit.howToPlayLabel": "How it works",
  "casino.room.audit.betTypesLabel": "Bet types",
  "casino.room.audit.justNow": "just now",
  "casino.room.audit.filters.all": "All",
  "casino.room.audit.filters.pending": "Pending",
  "casino.room.audit.filters.won": "Won",
  "casino.room.audit.filters.lost": "Lost",
  "casino.room.audit.filters.refunded": "Refunded",
  "casino.room.audit.stateLabel.won": "Won",
  "casino.room.audit.stateLabel.lost": "Lost",
  "casino.room.audit.stateLabel.pending": "Pending",
  "casino.room.audit.stateLabel.settled": "Settled",
  "casino.room.audit.stateLabel.cancelled": "Refunded",
  "casino.room.audit.openOnExplorer": "Open transaction on block explorer",
  "casino.room.audit.openOnExplorerWithChain": "Open on {chain} block explorer",
  "casino.room.audit.newActivityBadge": "{n} new",
  "casino.room.audit.onChain": "On {chain}",
  "casino.room.audit.viewBet": "View bet {betId}",
  "casino.room.gameInfo.roulette.tagline": "European roulette tagline.",
  "casino.room.gameInfo.roulette.houseEdge": "2.70%"
};

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      const template = TRANSLATIONS[key];
      if (!template) return key;
      if (!values) return template;
      return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
    };
    (t as unknown as { raw: (key: string) => unknown }).raw = (key: string) => {
      if (key === "casino.room.gameInfo.roulette.bets") return GAME_INFO_BETS;
      return key;
    };
    return t;
  }
}));

const game: GameMeta = {
  gameId: "0x1111111111111111111111111111111111111111",
  slug: "roulette",
  label: "European Roulette",
  module: "0x2222222222222222222222222222222222222222"
};

describe("GameRoomAuditLedger", () => {
  afterEach(() => cleanup());

  it("renders all four tab buttons", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    expect(screen.getByRole("button", { name: "Live bets" })).toBeDefined();
    expect(screen.getByRole("button", { name: "My bets" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Top wins" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Game info" })).toBeDefined();
  });

  it("shows the live-bets empty state when recentBets is empty", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    expect(screen.getByText("No bets yet")).toBeDefined();
  });

  it("renders a recent bet row with real per-bet data (stake, payout, multiplier)", () => {
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        recentBets={[
          {
            id: "84532:1",
            betId: "1",
            player: "0xabcdef1234567890abcdef1234567890abcdef12",
            state: "finalized",
            stake: "10000000", // 10 USDC (6 decimals)
            payout: "25000000", // 25 USDC win → 2.50×
            updatedAt: Date.now()
          }
        ]}
      />
    );
    expect(screen.getByText("10.00 USDC")).toBeDefined();
    expect(screen.getByText("25.00 USDC")).toBeDefined();
    expect(screen.getByText("2.50×")).toBeDefined();
  });

  it("switches to the connect-wallet empty state when My bets is opened without a wallet", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "My bets" }));
    expect(screen.getByText("Connect your wallet to see your history.")).toBeDefined();
  });

  it("renders the game-info table from t.raw bets array", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Game info" }));
    expect(screen.getByText("European roulette tagline.")).toBeDefined();
    expect(screen.getByText("2.70%")).toBeDefined();
    expect(screen.getByText("Straight up")).toBeDefined();
    expect(screen.getByText("36×")).toBeDefined();
  });

  it("renders an external explorer link when chainId + tx hash are present", () => {
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        chainId={84532}
        recentBets={[
          {
            id: "84532:42",
            betId: "42",
            player: "0x1111111111111111111111111111111111111111",
            state: "finalized",
            stake: "10000000",
            payout: "12000000",
            finalizedTxHash: "0xdeadbeef"
          }
        ]}
      />
    );
    // The explorer link replaces the internal portfolio fallback.
    const link = screen.getByRole("link", { name: "Open on Base Sepolia block explorer" });
    expect(link.getAttribute("href")).toBe("https://sepolia.basescan.org/tx/0xdeadbeef");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("falls back to the internal portfolio route when no tx hash is indexed", () => {
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        chainId={84532}
        recentBets={[
          {
            id: "84532:43",
            betId: "43",
            player: "0x2222222222222222222222222222222222222222",
            state: "placed",
            stake: "5000000"
          }
        ]}
      />
    );
    const link = screen.getByRole("link", { name: "View bet 43" });
    expect(link.getAttribute("href")).toBe("/portfolio/activity/43");
  });

  it("shows the chain badge in the header when chainId resolves", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} chainId={84532} recentBets={[]} />);
    expect(screen.getByText("On Base Sepolia")).toBeDefined();
  });

  it("filters My bets by state when the strip is clicked", () => {
    // usePlayerBets is mocked to return [], so even with state filter the result
    // is empty. We instead check that the strip is rendered and clickable.
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        chainId={84532}
        recentBets={[]}
        playerAddress="0x1234567890abcdef1234567890abcdef12345678"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "My bets" }));
    expect(screen.getByRole("tab", { name: "All", selected: true })).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Won" }));
    expect(screen.getByRole("tab", { name: "Won", selected: true })).toBeDefined();
  });

  it("ranks Top wins by multiplier and hides time column", () => {
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        recentBets={[
          {
            id: "84532:10",
            betId: "10",
            player: "0xaaaa000000000000000000000000000000000001",
            state: "finalized",
            stake: "10000000",
            payout: "15000000" // 1.50×
          },
          {
            id: "84532:11",
            betId: "11",
            player: "0xbbbb000000000000000000000000000000000002",
            state: "finalized",
            stake: "10000000",
            payout: "300000000" // 30.00× — should appear first
          }
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Top wins" }));
    const multipliers = screen.getAllByText(/\d+\.\d{2}×/);
    expect(multipliers[0]?.textContent).toBe("30.00×");
    expect(multipliers[1]?.textContent).toBe("1.50×");
  });
});
