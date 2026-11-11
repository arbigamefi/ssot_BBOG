import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const state = {
  release: null as any,
  readOnlyReason: null as string | null,
  chainId: 84532,
  bets: [] as any[],
  betsLoading: false,
  betsError: null as Error | null,
  indexerStatus: { lastSyncedBlock: 321, lagSeconds: 4 },
  account: null as string | null,
  sdkExtra: null as Record<string, unknown> | null
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/casino/dice",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId
  })
}));

vi.mock("../../../../features/betting/useRecentBets", () => ({
  useRecentBets: () => ({
    data: state.bets,
    isLoading: state.betsLoading,
    error: state.betsError
  })
}));

vi.mock("../../../../features/ops/useIndexer", () => ({
  useIndexer: () => ({
    indexerStatus: state.indexerStatus
  })
}));

vi.mock("../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    // A real SDK keeps its identity across renders.
    sdk: state.sdkExtra ?? (state.account ? { account: state.account } : null)
  })
}));

vi.mock("../../../../ssot/runtime", () => ({
  useSSOTRuntime: () => ({
    db: null
  })
}));

vi.mock("../../../../app-shell/wallet-entry-context", () => ({
  useConnectModal: () => ({
    openConnectModal: vi.fn()
  })
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace?: string) => (relativeKey: string) =>
    ({
      "casino.room.shell.liveModule": "Live SSOT Module",
      "casino.room.shell.previewModule": "Preview SSOT Module",
      "casino.room.shell.testnetModule": "Testnet SSOT Module",
      "casino.room.shell.maxBet": "Max bet",
      "casino.room.shell.maxPayout": "Max payout",
      "casino.room.empty.moduleNotFound": "Module not found",
      "casino.room.empty.gameNotFound": "Game not found.",
      "casino.room.names.dice": "Precision Dice",
      "casino.room.names.roulette": "European Roulette",
      "casino.room.names.coinToss": "Coin Toss",
      "casino.room.names.keno": "Keno Draft",
      "casino.room.names.plinko": "Plinko",
      "casino.room.names.slots": "Slots",
      "casino.room.audit.loading": "Loading audit stream",
      "casino.room.roundStatus.title": "Round status",
      "casino.room.roundStatus.phases.loadingQuote.label": "Estimating VRF fee",
      "casino.room.roundStatus.phases.loadingQuote.detail":
        "Reading the current randomness fee before you place a round.",
      "casino.room.roundStatus.phases.loadingQuote.status": "Estimating",
      "casino.room.roundStatus.phases.waitingVrf.label": "Waiting for draw",
      "casino.room.roundStatus.phases.waitingVrf.detail":
        "Your bet is on-chain. Waiting for verifiable randomness to open the result.",
      "casino.room.roundStatus.phases.waitingVrf.status": "Waiting for draw",
      "casino.room.roundStatus.phases.timeoutSoft.label": "Draw is taking longer than usual",
      "casino.room.roundStatus.phases.timeoutSoft.detail":
        "The round is still safe. Keep this page open while Chainlink fulfills the request.",
      "casino.room.roundStatus.phases.timeoutSoft.status": "Waiting",
      "casino.room.roundStatus.phases.placing.label": "Placing bet",
      "casino.room.roundStatus.phases.placing.detail":
        "Approve if needed, then sign PlaceBet. The round starts once the transaction is mined.",
      "casino.room.roundStatus.phases.placing.status": "Placing",
      "casino.room.roundStatus.phases.settling.label": "Settling result",
      "casino.room.roundStatus.phases.settling.detail":
        "Randomness is ready. Keeper settlement should complete automatically.",
      "casino.room.roundStatus.phases.settling.status": "Settling",
      "casino.room.roundStatus.phases.manualSettleOffered.label": "Keeper delay",
      "casino.room.roundStatus.phases.manualSettleOffered.detail":
        "Settlement is delayed. You can manually settle this result as a fallback.",
      "casino.room.roundStatus.phases.manualSettleOffered.status": "Manual settle offered",
      "casino.room.roundStatus.phases.settled.label": "Round settled",
      "casino.room.roundStatus.phases.settled.detail":
        "Settlement is confirmed on-chain. Preparing the final result proof.",
      "casino.room.roundStatus.phases.settled.status": "Settled",
      "casino.room.roundStatus.phases.refundable.label": "Refund path available",
      "casino.room.roundStatus.phases.refundable.detail":
        "VRF did not complete before the protocol timeout. You can refund the stake.",
      "casino.room.roundStatus.phases.refundable.status": "Refundable",
      "casino.room.roundStatus.phases.failed.label": "Round monitor failed",
      "casino.room.roundStatus.phases.failed.detail":
        "Unable to read the latest round state from the RPC provider.",
      "casino.room.roundStatus.phases.failed.status": "Failed",
      "casino.room.roundStatus.phases.ready.label": "Ready",
      "casino.room.roundStatus.phases.ready.detail":
        "One click will approve if needed, place the bet, and watch settlement.",
      "casino.room.roundStatus.phases.ready.status": "Ready",
      "casino.room.roundStatus.metrics.vrfEstimate": "VRF estimate",
      "casino.room.roundStatus.metrics.betId": "Bet ID",
      "casino.room.roundStatus.metrics.vrfRequest": "VRF request",
      "casino.room.roundStatus.actions.settleResult": "Settle result",
      "casino.room.roundStatus.actions.refundStake": "Refund stake",
      "casino.room.betPanel.walletBalance": "Wallet Balance",
      "casino.room.betPanel.syncing": "Syncing...",
      "casino.room.betPanel.amount.label": "Bet Amount",
      "casino.room.betPanel.amount.aria": "Bet amount",
      "casino.room.betPanel.amount.min": "Min",
      "casino.room.betPanel.amount.max": "Max",
      "casino.room.betPanel.rolls.label": "Rolls",
      "casino.room.betPanel.rolls.total": "Total: 10 USDC",
      "casino.room.betPanel.rolls.aria": "Roll count",
      "casino.room.betPanel.advanced.label": "Advanced",
      "casino.room.betPanel.advanced.stopGain": "Stop Gain (USDC)",
      "casino.room.betPanel.advanced.stopLoss": "Stop Loss (USDC)",
      "casino.room.betPanel.advanced.offPlaceholder": "0 = off",
      "casino.room.betPanel.advanced.gainStop": "Gain stop at +0 USDC",
      "casino.room.betPanel.advanced.lossStop": "Loss stop at 0 USDC",
      "casino.room.betPanel.summary.multiplier": "Multiplier",
      "casino.room.betPanel.summary.winChance": "Win Chance",
      "casino.room.betPanel.summary.expectedPayout": "Expected Payout",
      "casino.room.betPanel.placeBet.connectWallet": "CONNECT WALLET",
      "casino.room.betPanel.placeBet.failedRetry": "TRANSACTION FAILED - RETRY",
      "casino.room.betPanel.placeBet.roundInProgress": "ROUND IN PROGRESS",
      "casino.room.betPanel.placeBet.betMined": "BET MINED...",
      "casino.room.betPanel.placeBet.signing": "SIGNING / PLACING...",
      "casino.room.betPanel.placeBet.revealing": "REVEALING...",
      "casino.room.betPanel.placeBet.approveThenPlace": "APPROVE, THEN PLACE BET",
      "casino.room.betPanel.placeBet.preparing": "PREPARING ROUND...",
      "casino.room.betPanel.placeBet.placeBet": "PLACE BET",
      "casino.room.selection.coin.selectFace": "Select Face",
      "casino.room.selection.coin.heads": "Heads",
      "casino.room.selection.coin.tails": "Tails",
      "casino.room.selection.keno.spotsLabel": "/ 5 Spots",
      "casino.room.selection.keno.autoPick": "Auto Pick",
      "casino.room.selection.keno.clear": "Clear",
      "casino.room.selection.keno.empty": "No spots selected. Click the grid to pick numbers.",
      "casino.room.selection.plinko.riskProfile": "Risk Profile",
      "casino.room.selection.plinko.low": "Low",
      "casino.room.selection.plinko.medium": "Medium",
      "casino.room.selection.plinko.high": "High",
      "casino.room.selection.plinko.lowDetail": "Smoother board",
      "casino.room.selection.plinko.mediumDetail": "Balanced edge",
      "casino.room.selection.plinko.highDetail": "Extreme buckets",
      "casino.room.selection.sicBo.yes": "Yes",
      "casino.room.selection.sicBo.no": "No",
      "casino.room.stage.loading": "Loading stage",
      "casino.room.history.recent.rolls": "RECENT ROLLS",
      "casino.room.history.recent.draws": "RECENT DRAWS",
      "casino.room.history.recent.buckets": "RECENT BUCKETS",
      "casino.room.history.recent.flips": "RECENT FLIPS",
      "casino.room.history.states.settled": "SETTLED",
      "casino.room.history.states.refunded": "REFUNDED",
      "casino.room.history.states.vrfReady": "VRF READY",
      "casino.room.history.states.placed": "PLACED",
      "casino.room.history.empty": "Waiting for first play...",
      "casino.room.result.title": "Chain result",
      "casino.room.result.outcomes.refunded.label": "Stake refunded",
      "casino.room.result.outcomes.refunded.detail":
        "The refund path returned the stake after the VRF timeout window.",
      "casino.room.result.outcomes.win.label": "Win confirmed",
      "casino.room.result.outcomes.win.detail": "Payout proof is confirmed from BetFinalized.",
      "casino.room.result.outcomes.returned.label": "Stake returned",
      "casino.room.result.outcomes.returned.detail": "The settled payout equals the stake.",
      "casino.room.result.outcomes.loss.label": "Loss confirmed",
      "casino.room.result.outcomes.loss.detail":
        "BetFinalized is confirmed with zero or below-stake payout.",
      "casino.room.result.facts.betId": "Bet ID",
      "casino.room.result.facts.netPayout": "Net payout",
      "casino.room.result.facts.refund": "Refund",
      "casino.room.result.facts.requestId": "Request ID",
      "casino.room.result.facts.netResult": "Net result",
      "casino.room.result.facts.randomHash": "Random hash",
      "casino.room.result.facts.settlementTx": "Settlement tx",
      "casino.room.closed.title": "This game is closed.",
      "casino.room.closed.body":
        "Bets placed before it closed still settle, and their receipts stay available.",
      "casino.room.closed.viewBets": "View your bets",
      "casino.room.closed.browse": "Browse open games",
      "casino.dice.head.title": "Dice",
      "casino.roulette.head.title": "Roulette",
      "casino.table.strip.preview":
        "Preview. Betting opens on Base after the audit report is published.",
      "casino.table.action.telegram": "Join on Telegram",
      "casino.table.slip.label": "Bet slip"
    })[namespace ? `${namespace}.${relativeKey}` : relativeKey] ?? relativeKey
}));

vi.mock("../../../../components/ProductStateCard", () => ({
  ProductStateCard: ({ title, description }: any) => (
    <div data-testid="placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}));

vi.mock("../../../../components/ConnectWalletPrompt", () => ({
  ConnectWalletPrompt: ({ action }: any) => <div data-testid="connect-wallet-prompt">{action}</div>
}));

vi.mock("../../../../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>
}));

vi.mock("@ssot/ui", () => ({
  AssetSelector: ({ title }: any) => <div>{title}</div>,
  AuditTabs: ({ children }: any) => <div>{children}</div>,
  AuditTableHeader: ({ children }: any) => <div>{children}</div>,
  AuditTableRow: ({ children }: any) => <div>{children}</div>,
  AuditTableCell: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, asChild }: any) =>
    asChild ? children : <button type="button">{children}</button>,
  Card: ({ children }: any) => <section>{children}</section>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CopyButton: ({ value }: any) => <button type="button">{value}</button>,
  DataTable: ({ columns, data, onRowClick, loading, emptyMessage }: any) => {
    if (loading) return <div>Loading…</div>;
    if (!data.length) return <div>{emptyMessage}</div>;
    return (
      <div data-testid="data-table">
        {data.map((row: any, index: number) => (
          <div
            key={row.id ?? row.player ?? index}
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
  ErrorCallout: ({ title, message }: any) => (
    <div data-testid="error-callout">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  ),
  RoomStrip: ({ title }: any) => <div>{title}</div>,
  StatusBadge: ({ label, status }: any) => <span>{label ?? status}</span>,
  TabBar: ({ tabs, activeKey, onTabChange }: any) => (
    <div data-testid="tab-bar">
      {tabs.map((tab: any) => (
        <button
          key={tab.key}
          type="button"
          data-active={tab.key === activeKey}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

import { GamePageClient, getCasinoRoomPendingStates } from "./pageClient";

const MOCK_RELEASE = {
  name: "Base Sepolia",
  releaseDigest: "0xdeadbeefcafefeed",
  contracts: {
    gameHub: "0x1234567890abcdef1234567890abcdef12345678"
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      bank: "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff"
    }
  ],
  pools: [
    {
      asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      bank: "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff",
      decimals: 6,
      domain: "Casino",
      domainId: 1,
      poolId: 1,
      symbol: "USDC"
    }
  ],
  gamesMeta: [
    {
      gameId: "0x8d8e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914a8b",
      slug: "dice",
      label: "Dice",
      module: "0x8fb66ccc25d07b252d282be646d24444c062c667",
      paramsEncoding: "abi.encode(uint8 cap)"
    },
    {
      gameId: "0x2d2e6987fb3617c00abdd68d6c1f7eac28b7f9f96b25367e9b65dacaa0914aaa",
      slug: "roulette",
      label: "Roulette",
      module: "0x1111111111111111111111111111111111111111",
      paramsEncoding: "abi.encode(uint8 kind, uint40 payload)"
    },
    {
      gameId: "0x3333333333333333333333333333333333333333333333333333333333333333",
      slug: "coin-toss",
      label: "Coin Toss",
      module: "0x3333333333333333333333333333333333333333",
      paramsEncoding: "abi.encode(bool isHeads)"
    }
  ]
};

const MOCK_BETS = [
  {
    id: "84532:1",
    betId: "1",
    state: "placed",
    player: "0x1111111111111111111111111111111111111111",
    updatedAt: Date.now() - 60_000,
    lastTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
];

// The app provides a query client; the shared room's audit ledger loads lazily and needs it once it arrives.
function renderRoom(slug: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GamePageClient slug={slug} />
    </QueryClientProvider>
  );
}

describe("GamePageClient", () => {
  afterEach(() => {
    cleanup();
    state.release = null;
    state.readOnlyReason = null;
    state.bets = [];
    state.betsLoading = false;
    state.betsError = null;
    state.indexerStatus = { lastSyncedBlock: 321, lagSeconds: 4 };
    state.account = null;
    state.sdkExtra = null;
  });

  it("shows placeholder when release is unavailable", () => {
    state.release = null;
    state.readOnlyReason = "No release";
    renderRoom("dice");
    expect(screen.getByTestId("placeholder")).toBeDefined();
    expect(screen.getByText("No release")).toBeDefined();
  });

  it("separates wallet transaction progress from game-stage waiting animation", () => {
    expect(
      getCasinoRoomPendingStates({
        isLocalPending: false,
        isTransactionActive: true,
        isOutcomeTracking: false,
        hasStageReveal: false,
        hasCasinoOutcome: false
      })
    ).toEqual({
      isBetPanelPending: true,
      isStagePending: false
    });

    expect(
      getCasinoRoomPendingStates({
        isLocalPending: false,
        isTransactionActive: false,
        isOutcomeTracking: true,
        hasStageReveal: false,
        hasCasinoOutcome: false
      })
    ).toEqual({
      isBetPanelPending: true,
      isStagePending: true
    });

    expect(
      getCasinoRoomPendingStates({
        isLocalPending: true,
        isTransactionActive: false,
        isOutcomeTracking: false,
        hasStageReveal: false,
        hasCasinoOutcome: false
      })
    ).toEqual({
      isBetPanelPending: true,
      isStagePending: false
    });

    expect(
      getCasinoRoomPendingStates({
        isLocalPending: false,
        isTransactionActive: false,
        isOutcomeTracking: true,
        hasStageReveal: true,
        hasCasinoOutcome: false
      })
    ).toEqual({
      isBetPanelPending: true,
      isStagePending: false
    });

    expect(
      getCasinoRoomPendingStates({
        isLocalPending: false,
        isTransactionActive: false,
        isOutcomeTracking: false,
        hasStageReveal: true,
        hasCasinoOutcome: true
      })
    ).toEqual({
      isBetPanelPending: true,
      isStagePending: false
    });

    expect(
      getCasinoRoomPendingStates({
        isLocalPending: false,
        isTransactionActive: false,
        isOutcomeTracking: false,
        hasStageReveal: false,
        hasCasinoOutcome: true,
        isResultVisible: true
      })
    ).toEqual({
      isBetPanelPending: true,
      isStagePending: false
    });
  });

  it("renders the shared room shell for a game that has not moved to Carbon copy", async () => {
    state.release = MOCK_RELEASE;
    state.bets = MOCK_BETS;

    renderRoom("coin-toss");

    // The shared shell loads as its own chunk.
    expect(await screen.findByText("Coin Toss")).toBeDefined();
    // Betting is not enabled for the website in tests, so the room is labelled a preview.
    expect(screen.getByText("Preview SSOT Module")).toBeDefined();
    expect(screen.queryByText("Live SSOT Module")).toBeNull();
    expect(screen.getByLabelText("Wallet Balance")).toBeDefined();
    expect(screen.getAllByText("Bet Amount").length).toBeGreaterThanOrEqual(1);
  });

  it("labels the room testnet on an open test chain and live on an open main chain", async () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    state.release = MOCK_RELEASE;
    state.bets = MOCK_BETS;
    const { unmount } = renderRoom("coin-toss");
    expect(await screen.findByText("Testnet SSOT Module")).toBeDefined();
    expect(screen.queryByText("Live SSOT Module")).toBeNull();
    expect(screen.queryByText("Preview SSOT Module")).toBeNull();
    unmount();

    state.chainId = 8453;
    renderRoom("coin-toss");
    expect(await screen.findByText("Live SSOT Module")).toBeDefined();
    expect(screen.queryByText("Testnet SSOT Module")).toBeNull();
    state.chainId = 84532;
    vi.unstubAllEnvs();
  });

  it("renders dice as the Carbon copy room, with no shared shell", async () => {
    state.release = MOCK_RELEASE;
    state.bets = MOCK_BETS;

    renderRoom("dice");

    // Each room loads as its own chunk.
    expect(await screen.findByRole("heading", { level: 1, name: "Dice" })).toBeDefined();
    expect(
      screen.getByText("Preview. Betting opens on Base after the audit report is published.")
    ).toBeDefined();
    expect(screen.getByRole("article", { name: "Bet slip" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Join on Telegram" }).getAttribute("href")).toBe(
      "https://t.me/arbigamefi"
    );
    expect(screen.queryByText("Preview SSOT Module")).toBeNull();
    expect(screen.queryByLabelText("Wallet Balance")).toBeNull();
  });

  it("renders roulette as the Carbon copy room, with no shared shell", async () => {
    state.release = MOCK_RELEASE;

    renderRoom("roulette");

    expect(await screen.findByRole("heading", { level: 1, name: "Roulette" })).toBeDefined();
    expect(screen.getByRole("article", { name: "Bet slip" })).toBeDefined();
    expect(screen.queryByText("Preview SSOT Module")).toBeNull();
    expect(screen.queryByLabelText("Wallet Balance")).toBeNull();
  });

  it("renders coin toss as a canonical room shell", async () => {
    state.release = MOCK_RELEASE;

    renderRoom("coin-toss");

    expect(await screen.findByText("Coin Toss")).toBeDefined();
    expect(screen.getByLabelText("Wallet Balance")).toBeDefined();
    expect(screen.getAllByText("Bet Amount").length).toBeGreaterThanOrEqual(1);
  });

  it("shows placeholder when slug is not present in release", () => {
    state.release = MOCK_RELEASE;
    renderRoom("keno");
    expect(screen.getByTestId("placeholder")).toBeDefined();
    expect(screen.getByText("Game not found.")).toBeDefined();
  });

  it("shows a disabled game as closed, without a bet panel", async () => {
    state.release = MOCK_RELEASE;
    state.account = "0x1111111111111111111111111111111111111111";
    state.sdkExtra = {
      account: state.account,
      release: { chainId: 84532 },
      gameHub: {
        getGameConfig: vi.fn().mockResolvedValue({
          gameId: MOCK_RELEASE.gamesMeta[0]!.gameId,
          module: MOCK_RELEASE.gamesMeta[0]!.module,
          maxBetCount: 25,
          houseEdgeBps: 200,
          callbackGasLimit: 2_447_746,
          disabled: true
        }),
        quoteVRFFee: vi.fn()
      }
    };

    renderRoom("dice");

    expect(await screen.findByTestId("game-closed")).toBeDefined();
    expect(screen.getByText("This game is closed.")).toBeDefined();
    expect(
      screen.getByText(
        "Bets placed before it closed still settle, and their receipts stay available."
      )
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "View your bets" }).getAttribute("href")).toBe(
      "/portfolio/activity"
    );
    await waitFor(() => expect(screen.queryByLabelText("Wallet Balance")).toBeNull());
  });
});
