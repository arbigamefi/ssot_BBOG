import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

function createDb() {
  return {
    bets: {
      get: vi.fn(async () => state.localBet)
    },
    hubEvents: {
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
    hub: {
      getBet: vi.fn(async () => state.onChainBet),
      refund: vi.fn(async () => ({ ok: true, txHash: "0xabc" })),
      finalize: vi.fn(async () => ({ ok: true, txHash: "0xdef" }))
    }
  };
}

vi.mock("../../../ssot/runtime", () => ({
  useSSOTRuntime: () => ({ db: createDb() })
}));

vi.mock("../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({ sdk: createSdk() })
}));

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: state.chainId,
    readOnly: state.readOnly,
    release: state.release
  })
}));

vi.mock("../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("../../../features/tx/useDirectTxAction", () => ({
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
    player,
    stake: 1_000_000n,
    vrfFeePaid: 10_000n,
    state: state.localBet.state,
    placedAt: 1_765_000_000,
    ...overrides
  };
  state.timeline = [
    {
      id: "84532:0x123:0",
      chainId: 84532,
      hub: player,
      blockNumber: 100,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      logIndex: 0,
      eventName: "BetPlaced",
      argsJson: JSON.stringify({ betId: "42" }),
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

  it("shows finalize action only when random is ready and wallet is connected", async () => {
    state.sdkAccount = player;
    seedBet({ state: "randomReady" });

    renderWithQueryClient(<BetDetailPageClient betId="42" />);

    expect(await screen.findByRole("button", { name: /Finalize ticket/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Refund stake/i })).toBeNull();
  });
});
