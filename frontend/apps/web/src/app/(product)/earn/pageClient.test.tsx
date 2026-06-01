import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const state = {
  release: {
    releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
    assets: [
      { address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 }
    ],
    pools: [
      {
        poolId: 1,
        domainId: 1,
        domain: "Casino",
        active: true,
        asset: "0x0000000000000000000000000000000000000001",
        bank: "0x0000000000000000000000000000000000000002",
        symbol: "USDC",
        decimals: 6
      }
    ]
  } as any,
  readOnly: false,
  readOnlyReason: null as string | null,
  chainId: 84532,
  sdk: null as any,
  ready: false
};

vi.mock("next-intl", async () => {
  const messages = (await import("../../../i18n/locales/en/common.json")).default as Record<
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

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId
  })
}));

vi.mock("../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: state.ready
  })
}));

vi.mock("../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Provider performance panel pulls from the durable index over the network;
// stub it so this page test stays focused on the bank console wiring.
vi.mock("../../../features/earn/BankrollPerformancePanel", () => ({
  BankrollPerformancePanel: () => <div data-testid="bankroll-performance" />
}));

vi.mock("../../../components/ProductStateCard", () => ({
  ProductStateCard: ({ title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
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
  }),
  useSequencedTxAction: () => ({
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
  AssetSelector: ({ title }: any) => <div>{title}</div>,
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
    loading: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  }
}));

import { EarnPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("EarnPageClient", () => {
  afterEach(() => {
    cleanup();
    state.release = {
      releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
      assets: [
        { address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 }
      ],
      pools: [
        {
          poolId: 1,
          domainId: 1,
          domain: "Casino",
          active: true,
          asset: "0x0000000000000000000000000000000000000001",
          bank: "0x0000000000000000000000000000000000000002",
          symbol: "USDC",
          decimals: 6
        }
      ]
    };
    state.readOnly = false;
    state.readOnlyReason = null;
    state.chainId = 84532;
    state.sdk = null;
    state.ready = false;
  });

  it("frames earn as a bank reserve console", () => {
    renderWithQueryClient(<EarnPageClient />);

    expect(screen.getByRole("heading", { name: /Be the house in USDC/i })).toBeDefined();
    expect(screen.getByTestId("bankroll-performance")).toBeDefined();
    expect(screen.getByText("Deposit or exit")).toBeDefined();
    expect(screen.getByText("Verifiable reserve ledger")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Risk checks" }));
    expect(screen.getByText("Custody boundary")).toBeDefined();
    expect(screen.getByText("Connect a wallet to run bank actions.")).toBeDefined();
  });
});
