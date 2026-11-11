import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
      "casino.room.empty.moduleNotFound": "Module not found",
      "casino.room.empty.gameNotFound": "Game not found.",
      "casino.room.names.dice": "Precision Dice",
      "casino.room.names.roulette": "European Roulette",
      "casino.room.names.coinToss": "Coin Toss",
      "casino.room.names.keno": "Keno Draft",
      "casino.room.names.plinko": "Plinko",
      "casino.room.names.slots": "Slots",
      "casino.room.names.baccarat": "Baccarat",
      "casino.room.names.sicBo": "Sic Bo",
      "casino.room.closed.title": "This game is closed.",
      "casino.room.closed.body":
        "Bets placed before it closed still settle, and their receipts stay available.",
      "casino.room.closed.viewBets": "View your bets",
      "casino.room.closed.browse": "Browse open games",
      "casino.dice.head.title": "Dice",
      "casino.roulette.head.title": "Roulette",
      "casino.coin.head.title": "Coin toss",
      "casino.baccarat.head.title": "Baccarat",
      "casino.sicBo.head.title": "Sic bo",
      "casino.table.strip.preview":
        "Preview. Betting opens on Base after the audit report is published.",
      "casino.table.strip.testnet": "Test network. Test tokens have no value.",
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
  Button: ({ children, asChild }: any) =>
    asChild ? children : <button type="button">{children}</button>,
  Card: ({ children }: any) => <section>{children}</section>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CopyButton: ({ value }: any) => <button type="button">{value}</button>,
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
    },
    {
      gameId: "0x4444444444444444444444444444444444444444444444444444444444444444",
      slug: "baccarat",
      label: "Baccarat",
      module: "0x4444444444444444444444444444444444444444",
      paramsEncoding: "abi.encode(uint8 side)"
    },
    {
      gameId: "0x5555555555555555555555555555555555555555555555555555555555555555",
      slug: "sic-bo",
      label: "Sic Bo",
      module: "0x5555555555555555555555555555555555555555",
      paramsEncoding: "abi.encode(uint8 kind, uint8 value)"
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

// The app provides a query client.
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

  it("labels the room testnet on an open test chain and drops the strip on an open main chain", async () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    state.release = MOCK_RELEASE;
    const { unmount } = renderRoom("sic-bo");
    expect(await screen.findByText("Test network. Test tokens have no value.")).toBeDefined();
    expect(
      screen.queryByText("Preview. Betting opens on Base after the audit report is published.")
    ).toBeNull();
    unmount();

    state.chainId = 8453;
    renderRoom("sic-bo");
    expect(await screen.findByRole("heading", { level: 1, name: "Sic bo" })).toBeDefined();
    expect(screen.queryByText("Test network. Test tokens have no value.")).toBeNull();
    state.chainId = 84532;
    vi.unstubAllEnvs();
  });

  it("renders dice as the Carbon copy room", async () => {
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
  });

  it("renders roulette as the Carbon copy room", async () => {
    state.release = MOCK_RELEASE;

    renderRoom("roulette");

    expect(await screen.findByRole("heading", { level: 1, name: "Roulette" })).toBeDefined();
    expect(screen.getByRole("article", { name: "Bet slip" })).toBeDefined();
  });

  it("renders coin toss as the Carbon copy room", async () => {
    state.release = MOCK_RELEASE;

    renderRoom("coin-toss");

    expect(await screen.findByRole("heading", { level: 1, name: "Coin toss" })).toBeDefined();
    expect(screen.getByRole("article", { name: "Bet slip" })).toBeDefined();
  });

  it("renders baccarat as the Carbon copy room", async () => {
    state.release = MOCK_RELEASE;

    renderRoom("baccarat");

    expect(await screen.findByRole("heading", { level: 1, name: "Baccarat" })).toBeDefined();
    expect(screen.getByRole("article", { name: "Bet slip" })).toBeDefined();
  });

  it("renders sic bo as the Carbon copy room", async () => {
    state.release = MOCK_RELEASE;

    renderRoom("sic-bo");

    expect(await screen.findByRole("heading", { level: 1, name: "Sic bo" })).toBeDefined();
    expect(screen.getByRole("article", { name: "Bet slip" })).toBeDefined();
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
    expect(screen.queryByRole("article", { name: "Bet slip" })).toBeNull();
  });
});
