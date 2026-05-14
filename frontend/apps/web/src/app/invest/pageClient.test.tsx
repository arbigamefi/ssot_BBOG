import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const state = {
  release: {
    releaseDigest: "0x7ad0f2cb0000000000000000000000000000000000000000000000000000e1349f",
    assets: [{ address: "0x0000000000000000000000000000000000000001", symbol: "USDC", decimals: 6 }]
  } as any,
  readOnly: false,
  readOnlyReason: null as string | null,
  chainId: 84532,
  sdk: null as any,
  ready: false
};

vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId
  })
}));

vi.mock("../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: state.ready
  })
}));

vi.mock("../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("../../components/Placeholder", () => ({
  Placeholder: ({ title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}));

vi.mock("../../features/tx/useDirectTxAction", () => ({
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

import { InvestPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("InvestPageClient", () => {
  afterEach(() => {
    cleanup();
    state.release = {
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

  it("frames invest as a bank reserve console", () => {
    renderWithQueryClient(<InvestPageClient />);

    expect(screen.getByRole("heading", { name: /USDC bankroll control/i })).toBeDefined();
    expect(screen.getByText("Bank transaction console")).toBeDefined();
    expect(screen.getByText("Capital posture")).toBeDefined();
    expect(screen.getByText("Custody boundary")).toBeDefined();
    expect(screen.getByText("Connect a wallet to run bank actions.")).toBeDefined();
  });
});
