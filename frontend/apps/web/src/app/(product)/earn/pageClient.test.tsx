import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    useLocale: () => "en",
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
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
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
import { toast } from "@ssot/ui";

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
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rows: [] }), { status: 200 }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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

    expect(
      screen.getByRole("heading", { name: /Provide payout capital to the USDC pool/i })
    ).toBeDefined();
    expect(screen.getByTestId("bankroll-performance")).toBeDefined();
    expect(screen.getByText("Deposit or exit")).toBeDefined();
    expect(screen.getByText("Verifiable reserve ledger")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Risk checks" }));
    expect(screen.getByText("Custody boundary")).toBeDefined();
    expect(screen.getByText("Connect a wallet to run bank actions.")).toBeDefined();
  });

  it("closes mainnet deposits and lands on the withdraw side", () => {
    state.chainId = 8453;
    renderWithQueryClient(<EarnPageClient />);

    const actions = screen.getByRole("region", { name: "Deposit or exit" });
    expect(
      within(actions).getByRole("button", { name: "Withdraw" }).getAttribute("aria-pressed")
    ).toBe("true");

    fireEvent.click(within(actions).getByRole("button", { name: "Deposit" }));
    expect(within(actions).getByText("Mainnet deposits are closed")).toBeDefined();
    expect(within(actions).queryByLabelText("Amount")).toBeNull();
  });

  it("blocks deposits above the connected wallet balance before opening wallet flow", async () => {
    state.ready = true;
    state.sdk = {
      account: "0x0000000000000000000000000000000000000abc",
      bank: {
        getSnapshot: vi.fn().mockResolvedValue({
          bank: "0x0000000000000000000000000000000000000002",
          totalAssets: 10_000_000n,
          totalReserved: 0n,
          totalSupply: 10_000_000n,
          assetsPerShare: 1_000_000n,
          minLiquidityBps: 1_000,
          protocolFeesPayable: 0n,
          externalPayablesTotal: 0n
        }),
        getPosition: vi.fn().mockResolvedValue(null),
        getAssetBalance: vi.fn().mockResolvedValue(1_000_000n)
      }
    };

    renderWithQueryClient(<EarnPageClient />);

    await waitFor(() => {
      expect(state.sdk.bank.getAssetBalance).toHaveBeenCalled();
    });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Deposit assets" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Amount exceeds the connected wallet balance.");
    });
  });

  it("uses account withdrawable assets for the withdraw max action", async () => {
    state.ready = true;
    state.sdk = {
      account: "0x0000000000000000000000000000000000000abc",
      bank: {
        getSnapshot: vi.fn().mockResolvedValue({
          bank: "0x0000000000000000000000000000000000000002",
          totalAssets: 100_000_000n,
          totalReserved: 0n,
          totalSupply: 100_000_000n,
          assetsPerShare: 1_000_000n,
          minLiquidityBps: 1_000,
          protocolFeesPayable: 0n,
          externalPayablesTotal: 0n
        }),
        getPosition: vi.fn().mockResolvedValue(null),
        getAssetBalance: vi.fn().mockResolvedValue(1_000_000n),
        maxWithdraw: vi.fn().mockResolvedValue(56_999_999n),
        maxRedeem: vi.fn().mockResolvedValue(57_000_000n)
      }
    };

    renderWithQueryClient(<EarnPageClient />);

    const actions = screen.getByRole("region", { name: "Deposit or exit" });
    fireEvent.click(within(actions).getByRole("button", { name: "Withdraw" }));

    await waitFor(() => {
      expect(state.sdk.bank.maxWithdraw).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Max" }) as HTMLButtonElement).disabled).toBe(
        false
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Max" }));

    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("56.999999");
  });
});
