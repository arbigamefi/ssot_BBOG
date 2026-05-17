import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const state = {
  release: {
    name: "Base Sepolia",
    releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
    assets: [{ address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 }]
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

vi.mock("../../../components/ProductStateCard", () => ({
  ProductStateCard: ({ title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}));

vi.mock("../../../features/portfolio/overview/useTxJournal", () => ({
  useTxJournal: () => ({ data: [] })
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

import { PortfolioPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("PortfolioPageClient", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    state.release = {
      name: "Base Sepolia",
      releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
      assets: [
        { address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 }
      ]
    };
    state.readOnly = false;
    state.readOnlyReason = null;
    state.chainId = 84532;
    state.sdk = null;
    state.ready = false;
  });

  it("frames portfolio as a wallet profile and ledger console", () => {
    renderWithQueryClient(<PortfolioPageClient />);

    expect(screen.getByRole("heading", { name: /Wallet profile/i })).toBeDefined();
    expect(screen.getByText("Player identity")).toBeDefined();
    expect(screen.getByText("Execution context")).toBeDefined();
    expect(screen.getByText("VRF refund credit")).toBeDefined();
    expect(screen.getByText("Asset positions")).toBeDefined();
    expect(screen.getByText("Transaction journal")).toBeDefined();
    expect(
      screen.getAllByText("Connect a wallet to inspect account state.").length
    ).toBeGreaterThan(0);
  });
});
