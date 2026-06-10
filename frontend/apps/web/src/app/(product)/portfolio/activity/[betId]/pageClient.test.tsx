import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const gameId = "0x1111111111111111111111111111111111111111111111111111111111111111";
const asset = "0x0000000000000000000000000000000000000001";
const player = "0x0000000000000000000000000000000000000002";

const state = {
  chainId: 84532,
  readOnly: false,
  release: {
    releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
    assets: [{ address: asset, symbol: "USDC", decimals: 6 }],
    gamesMeta: [{ gameId, label: "Dice" }]
  } as any,
  localBet: null as any,
  onChainBet: null as any,
  timeline: [] as any[],
  sdkAccount: null as string | null
};

vi.mock("next-intl", async () => {
  const messages = (await import("../../../../../i18n/locales/en/common.json")).default as Record<
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

function createDb() {
  return {
    bets: {
      get: vi.fn(async () => state.localBet)
    },
    gameHubEvents: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => state.timeline)
        }))
      }))
    }
  };
}

function createSdk() {
  return {
    account: state.sdkAccount,
    gameHub: {
      getBet: vi.fn(async () => state.onChainBet),
      refund: vi.fn(async () => ({ ok: true, txHash: "0xabc" })),
      finalize: vi.fn(async () => ({ ok: true, txHash: "0xdef" }))
    }
  };
}

vi.mock("../../../../../ssot/runtime", () => ({
  useSSOTRuntime: () => ({ db: createDb() })
}));

vi.mock("../../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({ sdk: createSdk() })
}));

vi.mock("../../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: state.chainId,
    readOnly: state.readOnly,
    release: state.release
  })
}));

vi.mock("../../../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("../../../../../features/tx/useDirectTxAction", () => ({
  useDirectTxAction: () => ({
    status: "idle",
    steps: [],
    hasActivity: false,
    error: undefined,
    txHash: undefined,
    journalEntry: undefined,
    busy: false,
    reset: vi.fn(),
    execute: vi.fn()
  })
}));

vi.mock("@ssot/ui", () => ({
  ErrorCallout: ({ title, message }: any) => (
    <div>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  ),
  TxStatusChip: ({ status }: any) => <span>{status}</span>,
  TxStepper: ({ title, subtitle }: any) => (
    <div>
      <span>{title}</span>
      <span>{subtitle}</span>
    </div>
  ),
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

import { BetDetailPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function seedBet(overrides: Record<string, unknown> = {}) {
  state.localBet = {
    id: "84532:42",
    chainId: 84532,
    betId: "42",
    state: "placed",
    gameId,
    asset,
    player,
    updatedBlock: 10,
    lastTxHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    lastEventName: "BetPlaced",
    updatedAt: Date.now(),
    ...overrides
  };
  state.onChainBet = {
    betId: 42n,
    chainId: 84532,
    gameId,
    asset,
    bank: "0x0000000000000000000000000000000000000003",
    player,
    stake: 1_000_000n,
    reserved: 1_980_000n,
    amountPerRoll: 1_000_000n,
    betCount: 1,
    stopGain: 0n,
    stopLoss: 0n,
    effectiveHouseEdgeBps: 200,
    vrfFeePaid: 10_000n,
    vrfFeeCharged: 0n,
    vrfCallbackGasLimit: 220_000,
    requestId: 0n,
    randomHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    state: state.localBet.state,
    placedAt: 1_765_000_000,
    ...overrides
  };
  state.timeline = [
    {
      id: "84532:0x123:0",
      chainId: 84532,
      gameHub: player,
      blockNumber: 100,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      logIndex: 0,
      eventName: "BetPlaced",
      argsJson: JSON.stringify({ positionId: "42" }),
      createdAt: 1_765_000_000
    }
  ];
}

describe("BetDetailPageClient", () => {
  afterEach(() => {
    cleanup();
    state.readOnly = false;
    state.localBet = null;
    state.onChainBet = null;
    state.timeline = [];
    state.sdkAccount = null;
    vi.unstubAllGlobals();
  });

  it("frames a ticket as a receipt dossier", async () => {
    seedBet();

    renderWithQueryClient(<BetDetailPageClient betId="42" />);

    expect(await screen.findByRole("heading", { name: /Dice receipt/i })).toBeDefined();
    expect(screen.getByText("Receipt dossier")).toBeDefined();
    expect(screen.getByText("Receipt matrix")).toBeDefined();
    expect(screen.getByText("Lifecycle proof")).toBeDefined();
    expect(screen.getByText("Indexed lifecycle events")).toBeDefined();
    expect(screen.getAllByText("1 USDC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("BetPlaced").length).toBeGreaterThan(0);
  });

  it("matches v1.3 positionId events in the lifecycle timeline", async () => {
    seedBet();

    renderWithQueryClient(<BetDetailPageClient betId="42" />);

    expect((await screen.findAllByText("BetPlaced")).length).toBeGreaterThan(0);
    expect(screen.queryByText("No indexed lifecycle events yet.")).toBeNull();
  });

  it("shows finalized VRF and settlement proof using native fee units", async () => {
    seedBet({
      state: "finalized",
      vrfFeePaid: 73_169_600_001_705n,
      vrfFeeCharged: 73_169_600_001_700n,
      requestId: 88900432683796515367687110441888685110385694721876547794792857014691553370968n,
      randomHash: "0xc1dd6522ffc33603f07c9f43cc35e6ad9f0fd8228b7715f072787026f04f5894",
      vrfRequestedAt: 1_765_000_020,
      resolvedAt: 1_765_000_120,
      settledAt: 1_765_000_120
    });
    state.timeline.push({
      id: "84532:0x456:1",
      chainId: 84532,
      gameHub: player,
      blockNumber: 120,
      txHash: "0x4564567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      logIndex: 1,
      eventName: "BetFinalized",
      argsJson: JSON.stringify({
        positionId: "42",
        payoutGross: "1800000",
        payoutNet: "1780000",
        feeOnPayout: "20000",
        protocolFeeAccrual: "20000"
      }),
      createdAt: 1_765_000_120
    });

    renderWithQueryClient(<BetDetailPageClient betId="42" />);

    expect((await screen.findAllByText("Won")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.00007316 ETH").length).toBeGreaterThan(0);
    expect(screen.queryByText(/0\.00007316 USDC/)).toBeNull();
    expect(screen.getByText("VRF request id")).toBeDefined();
    expect(
      screen.getByText(
        "88900432683796515367687110441888685110385694721876547794792857014691553370968"
      )
    ).toBeDefined();
    expect(screen.getByText("0xc1dd...5894")).toBeDefined();
    expect(screen.getAllByText("BetFinalized").length).toBeGreaterThan(0);
    expect(screen.getByText("1.78 USDC")).toBeDefined();
    expect(screen.getByText("0.78 USDC")).toBeDefined();
  });

  it("handles clipboard rejection without throwing a receipt console error", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    seedBet();

    renderWithQueryClient(<BetDetailPageClient betId="42" />);

    const copyButtons = await screen.findAllByRole("button", { name: "Copy" });
    expect(copyButtons[0]).toBeDefined();
    fireEvent.click(copyButtons[0]!);

    expect(await screen.findByText("Failed")).toBeDefined();
    expect(writeText).toHaveBeenCalledWith("42");
  });

  it("shows finalize action only when random is ready and wallet is connected", async () => {
    state.sdkAccount = player;
    seedBet({ state: "randomReady" });

    renderWithQueryClient(<BetDetailPageClient betId="42" />);

    expect(await screen.findByRole("button", { name: /Finalize bet/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Refund stake/i })).toBeNull();
  });
});
