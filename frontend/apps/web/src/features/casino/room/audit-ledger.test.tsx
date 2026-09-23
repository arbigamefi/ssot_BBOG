import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Tab is URL-driven (?tab=). A module-level value backs useSearchParams; the
// router.replace mock parses the new URL and updates it. Tests set the tab via
// `setTab(...)` before render to land on a given tab.
let currentTab: string | null = null;
const replaceMock = vi.fn((url: string) => {
  const query = url.split("?")[1] ?? "";
  currentTab = new URLSearchParams(query).get("tab");
});
function setTab(tab: string | null) {
  currentTab = tab;
}
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentTab ? `tab=${currentTab}` : ""),
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/casino/roulette"
}));

vi.mock("@heroicons/react/24/outline", () => ({
  ArrowTopRightOnSquareIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  )
}));

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

const game: GameMeta = {
  gameId: "0x1111111111111111111111111111111111111111",
  slug: "roulette",
  label: "European Roulette",
  module: "0x2222222222222222222222222222222222222222"
};

// Analytics + leaderboard hooks — fixed postgres-backed data scoped to `game`.
vi.mock("../useCasinoStats", () => ({
  useCasinoStats: () => ({
    data: {
      source: "postgres",
      asset: { address: "0xasset", decimals: 6, symbol: "USDC" },
      // Site-wide aggregate — deliberately distinct from the single game below
      // so the "All games" scope toggle can be asserted independently.
      stats: {
        betCount: 12,
        settledCount: 10,
        wonCount: 5,
        uniquePlayers: 7,
        turnover: "100000000",
        payout: "60000000",
        refundAmount: "0",
        payoutGross: "0"
      },
      games: [
        {
          gameId: "0x1111111111111111111111111111111111111111",
          slug: "roulette",
          label: "European Roulette",
          betCount: 5,
          settledCount: 4,
          wonCount: 2,
          uniquePlayers: 3,
          turnover: "50000000",
          payout: "25000000",
          refundAmount: "0",
          payoutGross: "0"
        }
      ]
    }
  }),
  useCasinoLeaderboard: ({
    by = "turnover",
    player
  }: { by?: "turnover" | "topWin"; player?: string } = {}) => ({
    data:
      by === "topWin"
        ? {
            source: "postgres",
            by: "topWin",
            gameId: "0x1111111111111111111111111111111111111111",
            asset: { address: "0xasset", decimals: 6, symbol: "USDC" },
            you: null,
            rows: [
              {
                rank: 1,
                betId: "11",
                player: "0xbbbb000000000000000000000000000000000002",
                stake: "10000000",
                payout: "300000000",
                refundAmount: "0",
                payoutGross: "300000000",
                multiplierPpm: "30000000"
              },
              {
                rank: 2,
                betId: "10",
                player: "0xaaaa000000000000000000000000000000000001",
                stake: "10000000",
                payout: "15000000",
                refundAmount: "0",
                payoutGross: "15000000",
                multiplierPpm: "1500000"
              }
            ]
          }
        : {
            source: "postgres",
            by: "turnover",
            gameId: "0x1111111111111111111111111111111111111111",
            asset: { address: "0xasset", decimals: 6, symbol: "USDC" },
            // Only the dedicated "off-list ranked" wallet resolves a position;
            // every other wallet is treated as unranked (you = null).
            you:
              player?.toLowerCase() === "0xeeee000000000000000000000000000000000007"
                ? { rank: 7, betCount: 3, turnover: "12000000" }
                : null,
            rows: [
              {
                rank: 1,
                player: "0xcccc000000000000000000000000000000000003",
                betCount: 4,
                settledCount: 4,
                turnover: "30000000",
                payout: "0",
                refundAmount: "0",
                payoutGross: "0"
              }
            ]
          }
  }),
  useCasinoTimeseries: () => ({
    data: {
      source: "postgres",
      gameId: "0x1111111111111111111111111111111111111111",
      asset: { address: "0xasset", decimals: 6, symbol: "USDC" },
      points: [
        {
          date: "2026-05-28",
          betCount: 1,
          settledCount: 1,
          wonCount: 1,
          uniquePlayers: 1,
          turnover: "10000000",
          payout: "15000000",
          refundAmount: "0",
          payoutGross: "15000000"
        },
        {
          date: "2026-05-29",
          betCount: 2,
          settledCount: 2,
          wonCount: 1,
          uniquePlayers: 2,
          turnover: "40000000",
          payout: "10000000",
          refundAmount: "0",
          payoutGross: "10000000"
        }
      ]
    }
  })
}));

const GAME_INFO_BETS = [
  { key: "straight", label: "Straight up", coverage: "1 number", multiplier: "36×" },
  { key: "redBlack", label: "Red / Black", coverage: "18 numbers", multiplier: "2×" }
];

const SIC_BO_INFO_BETS = [
  { key: "smallBig", label: "Small / Big", coverage: "48.6%", multiplier: "2.06×" },
  { key: "anyTriple", label: "Any triple", coverage: "2.78%", multiplier: "36×" },
  { key: "specificTriple", label: "Specific triple", coverage: "0.46%", multiplier: "216×" },
  { key: "singleFace", label: "Single face", coverage: "≈ 42%", multiplier: "up to 6×" }
];

const KENO_INFO_BETS = [
  { key: "p1", label: "Pick 1 spot", coverage: "Match 1 of 5", multiplier: "2.97×" },
  { key: "p5", label: "Pick 5 spots", coverage: "Match all 5", multiplier: "770× max" }
];

const TRANSLATIONS: Record<string, string> = {
  "casino.room.audit.tabs.live": "Live bets",
  "casino.room.audit.tabs.mine": "My bets",
  "casino.room.audit.tabs.leaderboard": "Leaderboard",
  "casino.room.audit.tabs.analytics": "Analytics",
  "casino.room.audit.tabs.info": "Game info",
  "casino.room.audit.columns.time": "Time",
  "casino.room.audit.columns.player": "Player",
  "casino.room.audit.columns.stake": "Stake",
  "casino.room.audit.columns.multiplier": "Multiplier",
  "casino.room.audit.columns.payout": "Payout",
  "casino.room.audit.columns.state": "State",
  "casino.room.audit.columns.bet": "Bet",
  "casino.room.audit.columns.coverage": "Win chance / condition",
  "casino.room.audit.columns.bets": "Bets",
  "casino.room.audit.columns.volume": "Volume",
  "casino.room.audit.emptyStates.live": "No bets yet",
  "casino.room.audit.emptyStates.mine": "You haven't played this game yet.",
  "casino.room.audit.emptyStates.top": "No wins yet",
  "casino.room.audit.emptyStates.connectWallet": "Connect your wallet to see your history.",
  "casino.room.audit.houseEdgeLabel": "House edge",
  "casino.room.audit.infoFormulaNote":
    "Win chance is the event probability. Multipliers shown are player-facing payouts after the current house edge.",
  "casino.room.audit.maxMultiplier": "{multiplier} max",
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
  "casino.room.audit.leaderboard.title": "Leaderboard",
  "casino.room.audit.leaderboard.empty": "No ranked players yet on this chain.",
  "casino.room.audit.leaderboard.scope": "Ranked by turnover",
  "casino.room.audit.leaderboard.scopeTopWin": "Ranked by payout multiple",
  "casino.room.audit.leaderboard.views.turnover": "By volume",
  "casino.room.audit.leaderboard.views.topWin": "Top wins",
  "casino.room.audit.leaderboard.you": "You",
  "casino.room.audit.leaderboard.yourPosition": "Your position",
  "casino.room.audit.analytics.empty": "No analytics yet on this chain.",
  "casino.room.audit.analytics.rtp": "RTP",
  "casino.room.audit.analytics.wagered": "Total wagered",
  "casino.room.audit.analytics.payout": "Total payout",
  "casino.room.audit.analytics.transactions": "Transactions",
  "casino.room.audit.analytics.won": "Won",
  "casino.room.audit.analytics.gainRatio": "Gain ratio",
  "casino.room.audit.analytics.bestEffort": "Indexed · best-effort",
  "casino.room.audit.analytics.players": "Players",
  "casino.room.audit.analytics.views.game": "This game",
  "casino.room.audit.analytics.views.all": "All games",
  "casino.room.audit.analytics.windowLabel": "Time range",
  "casino.room.audit.analytics.windows.all": "All",
  "casino.room.audit.analytics.windows.d1": "24h",
  "casino.room.audit.analytics.windows.d7": "7d",
  "casino.room.audit.analytics.windows.d30": "30d",
  "casino.room.audit.analytics.trend": "7-day volume",
  "casino.room.audit.analytics.trendWindow": "Daily turnover by chain placement time",
  "casino.room.gameInfo.roulette.tagline": "European roulette tagline.",
  "casino.room.gameInfo.keno.tagline": "Pick spots.",
  "casino.room.gameInfo.sic-bo.tagline": "Three dice."
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => {
    const t = (key: string, values?: Record<string, string | number>) => {
      const template = TRANSLATIONS[key];
      if (!template) return key;
      if (!values) return template;
      return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
    };
    (t as unknown as { raw: (key: string) => unknown }).raw = (key: string) => {
      if (key === "casino.room.gameInfo.roulette.bets") return GAME_INFO_BETS;
      if (key === "casino.room.gameInfo.keno.bets") return KENO_INFO_BETS;
      if (key === "casino.room.gameInfo.sic-bo.bets") return SIC_BO_INFO_BETS;
      return key;
    };
    return t;
  }
}));

describe("GameRoomAuditLedger", () => {
  beforeEach(() => {
    currentTab = null;
    replaceMock.mockClear();
  });
  afterEach(() => cleanup());

  it("renders all five tab buttons", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    for (const name of ["Live bets", "My bets", "Leaderboard", "Analytics", "Game info"]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
  });

  it("uses fixed release house edge and edge-adjusted multipliers on the info tab", () => {
    setTab("info");
    render(
      <GameRoomAuditLedger
        game={{ ...game, slug: "sic-bo", label: "Sic Bo" }}
        betAmount={10}
        gameMeta={{ slug: "sic-bo", houseEdgeBps: 100 }}
        recentBets={[]}
      />
    );

    expect(screen.getByText("1.00%")).toBeDefined();
    expect(screen.queryByText("2.78% – 30.6%")).toBeNull();
    expect(screen.getByText("Win chance / condition")).toBeDefined();
    expect(screen.getByText("2.04×")).toBeDefined();
    expect(screen.getByText("35.64×")).toBeDefined();
    expect(screen.getByText("213.84×")).toBeDefined();
    expect(screen.getByText("5.94× max")).toBeDefined();
    expect(
      screen.getByText(
        "Win chance is the event probability. Multipliers shown are player-facing payouts after the current house edge."
      )
    ).toBeDefined();
  });

  it("uses the current Keno payout table instead of stale localized multipliers", () => {
    setTab("info");
    render(
      <GameRoomAuditLedger
        game={{ ...game, slug: "keno", label: "Keno" }}
        betAmount={10}
        gameMeta={{ slug: "keno", houseEdgeBps: 200 }}
        recentBets={[]}
      />
    );

    expect(screen.getByText("2.00%")).toBeDefined();
    expect(screen.queryByText("770× max")).toBeNull();
    expect(screen.getByText("490.49× max")).toBeDefined();
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
        assetSymbol="USDC"
        recentBets={[
          {
            id: "84532:1",
            betId: "1",
            player: "0xabcdef1234567890abcdef1234567890abcdef12",
            state: "finalized",
            stake: "10000000",
            payout: "25000000",
            refundAmount: "0",
            updatedAt: Date.now()
          }
        ]}
      />
    );
    expect(screen.getByText("10.00 USDC")).toBeDefined();
    expect(screen.getByText("25.00 USDC")).toBeDefined();
    expect(screen.getByText("2.50×")).toBeDefined();
  });

  it("formats mixed-asset recent rows with each row's own asset metadata", () => {
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        assetSymbol="USDC"
        assetDecimals={6}
        assetContexts={[
          {
            asset: {
              address: "0x0000000000000000000000000000000000000001",
              decimals: 6,
              symbol: "USDC"
            },
            pool: { poolId: 1, asset: "0x0000000000000000000000000000000000000001" },
            poolId: 1
          },
          {
            asset: {
              address: "0x0000000000000000000000000000000000000002",
              decimals: 18,
              symbol: "WETH"
            },
            pool: { poolId: 2, asset: "0x0000000000000000000000000000000000000002" },
            poolId: 2
          }
        ]}
        recentBets={[
          {
            id: "84532:2",
            betId: "2",
            asset: "0x0000000000000000000000000000000000000002",
            poolId: "2",
            player: "0xabcdef1234567890abcdef1234567890abcdef12",
            state: "finalized",
            stake: "1000000000000000000",
            payout: "2000000000000000000",
            refundAmount: "0",
            updatedAt: Date.now()
          }
        ]}
      />
    );
    expect(screen.getByText("1.00 WETH")).toBeDefined();
    expect(screen.getByText("2.00 WETH")).toBeDefined();
  });

  it("writes the active tab to the URL when a tab is clicked", () => {
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));
    expect(replaceMock).toHaveBeenCalledWith("/casino/roulette?tab=leaderboard", { scroll: false });
  });

  it("shows the connect-wallet empty state on the My bets tab without a wallet", () => {
    setTab("mine");
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    expect(screen.getByText("Connect your wallet to see your history.")).toBeDefined();
  });

  it("renders the game-info table from t.raw bets array", () => {
    setTab("info");
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    expect(screen.getByText("European roulette tagline.")).toBeDefined();
    expect(screen.getByText("2.70%")).toBeDefined();
    expect(screen.getByText("Straight up")).toBeDefined();
    expect(screen.getByText("36.00×")).toBeDefined();
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
            refundAmount: "0",
            finalizedTxHash: "0xdeadbeef"
          }
        ]}
      />
    );
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
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        assetSymbol="USDC"
        chainId={84532}
        recentBets={[]}
      />
    );
    expect(screen.getByText("On Base Sepolia")).toBeDefined();
  });

  it("filters My bets by state when the strip is clicked", () => {
    setTab("mine");
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        assetSymbol="USDC"
        chainId={84532}
        recentBets={[]}
        playerAddress="0x1234567890abcdef1234567890abcdef12345678"
      />
    );
    expect(screen.getByRole("tab", { name: "All", selected: true })).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Won" }));
    expect(screen.getByRole("tab", { name: "Won", selected: true })).toBeDefined();
  });

  it("shows the per-game turnover leaderboard on the Leaderboard tab", () => {
    setTab("leaderboard");
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        assetSymbol="USDC"
        chainId={84532}
        recentBets={[]}
      />
    );
    // Ranked player + formatted turnover (30 USDC from "30000000" @ 6 decimals, trailing zeros trimmed).
    expect(screen.getByText("30 USDC")).toBeDefined();
    expect(screen.getByRole("tab", { name: "By volume", selected: true })).toBeDefined();
  });

  it("marks the connected wallet's leaderboard row with a You badge", () => {
    setTab("leaderboard");
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        chainId={84532}
        recentBets={[]}
        // Same address as the ranked turnover row (checksum-cased to prove the
        // comparison is case-insensitive).
        playerAddress="0xCCCC000000000000000000000000000000000003"
      />
    );
    expect(screen.getByText("You")).toBeDefined();
  });

  it("does not show a You badge when the connected wallet is not ranked", () => {
    setTab("leaderboard");
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        chainId={84532}
        recentBets={[]}
        playerAddress="0xdddd000000000000000000000000000000000099"
      />
    );
    expect(screen.queryByText("You")).toBeNull();
    expect(screen.queryByText("Your position")).toBeNull();
  });

  it("shows the connected wallet's rank when it sits outside the top rows", () => {
    setTab("leaderboard");
    render(
      <GameRoomAuditLedger
        game={game}
        betAmount={10}
        assetSymbol="USDC"
        chainId={84532}
        recentBets={[]}
        // Off-list ranked wallet (rank 7) — not present in the rendered rows.
        playerAddress="0xeeee000000000000000000000000000000000007"
      />
    );
    expect(screen.getByText("Your position")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined(); // rank
    expect(screen.getByText("12 USDC")).toBeDefined(); // turnover
    expect(screen.getByText("You")).toBeDefined(); // pill on the your-rank row
  });

  it("shows durable top wins by multiplier inside the Leaderboard tab", () => {
    setTab("leaderboard");
    render(<GameRoomAuditLedger game={game} betAmount={10} recentBets={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Top wins" }));
    const multipliers = screen.getAllByText(/\d+\.\d{2}×/);
    expect(multipliers[0]?.textContent).toBe("30.00×");
    expect(multipliers[1]?.textContent).toBe("1.50×");
  });

  it("shows per-game professional analytics (RTP, gain ratio, payout) on the Analytics tab", () => {
    setTab("analytics");
    render(<GameRoomAuditLedger game={game} betAmount={10} chainId={84532} recentBets={[]} />);
    // turnover 50, payout 25 → RTP 50.00%; wonCount 2 / betCount 5 → 40.00%.
    expect(screen.getByText("50.00%")).toBeDefined(); // RTP headline
    expect(screen.getByText("50 USDC")).toBeDefined(); // total wagered
    expect(screen.getByText("25 USDC")).toBeDefined(); // total payout
    expect(screen.getByText("40.00%")).toBeDefined(); // gain ratio
    expect(screen.getByText("2")).toBeDefined(); // won count
    expect(screen.getByText("3")).toBeDefined(); // unique players
  });

  it("switches analytics to the all-games aggregate via the scope toggle", () => {
    setTab("analytics");
    render(<GameRoomAuditLedger game={game} betAmount={10} chainId={84532} recentBets={[]} />);
    // Default scope: the per-game RTP.
    expect(screen.getByText("50.00%")).toBeDefined();
    expect(screen.getByRole("tab", { name: "This game", selected: true })).toBeDefined();

    fireEvent.click(screen.getByRole("tab", { name: "All games" }));
    // Aggregate: payout 60 / wagered 100 → RTP 60.00%; won 5 / bets 12 → 41.67%.
    expect(screen.getByText("60.00%")).toBeDefined(); // RTP headline
    expect(screen.getByText("100 USDC")).toBeDefined(); // total wagered
    expect(screen.getByText("60 USDC")).toBeDefined(); // total payout
    expect(screen.getByText("41.67%")).toBeDefined(); // gain ratio
    expect(screen.getByText("5")).toBeDefined(); // won count
    expect(screen.getByText("7")).toBeDefined(); // unique players
  });

  it("offers a 24h/7d/30d/All time-range selector on the Analytics tab", () => {
    setTab("analytics");
    render(<GameRoomAuditLedger game={game} betAmount={10} chainId={84532} recentBets={[]} />);
    // Defaults to all-time.
    expect(screen.getByRole("tab", { name: "All", selected: true })).toBeDefined();
    for (const name of ["24h", "7d", "30d"]) {
      expect(screen.getByRole("tab", { name })).toBeDefined();
    }
    fireEvent.click(screen.getByRole("tab", { name: "7d" }));
    expect(screen.getByRole("tab", { name: "7d", selected: true })).toBeDefined();
  });
});
