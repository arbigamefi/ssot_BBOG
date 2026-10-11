import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const usdcAddress = "0x0000000000000000000000000000000000000001";
const usdtAddress = "0x0000000000000000000000000000000000000003";

const state = {
  release: {
    assets: [{ address: usdcAddress, symbol: "USDC", decimals: 6 }],
    pools: [
      {
        poolId: 1,
        domainId: 1,
        domain: "Casino",
        active: true,
        asset: usdcAddress,
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
  ready: false,
  flowError: undefined as any
};

vi.mock("next-intl", async () => {
  const messages = (await import("../../../../i18n/locales/en/common.json")).default as Record<
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
    useTranslations:
      (namespace?: string) => (key: string, values?: Record<string, string | number>) =>
        translate(namespace ? `${namespace}.${key}` : key, values)
  };
});

vi.mock("../../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId
  })
}));

vi.mock("../../../../ssot/sdk", () => ({
  useSSOTSDK: () => ({
    sdk: state.sdk,
    ready: state.ready
  })
}));

vi.mock("../../../../components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("../../../../components/ProductStateCard", () => ({
  ProductStateCard: ({ title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}));

vi.mock("../../../../features/tx/useDirectTxAction", () => ({
  useDirectTxAction: () => ({
    status: state.flowError ? "failed" : "idle",
    steps: [],
    hasActivity: Boolean(state.flowError),
    error: state.flowError,
    txHash: undefined,
    journalEntry: undefined,
    busy: false,
    reset: vi.fn(),
    execute: vi.fn()
  })
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@ssot/ui", () => ({
  AssetSelector: ({ title }: any) => <div>{title}</div>,
  ErrorCallout: ({ title, message, details }: any) => (
    <div>
      <strong>{title}</strong>
      <span>{message}</span>
      {details ? <pre>{details}</pre> : null}
    </div>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
  TxStatusChip: ({ status }: any) => <span>{status}</span>,
  TxStepper: ({ title, subtitle }: any) => (
    <div>
      <span>{title}</span>
      <span>{subtitle}</span>
    </div>
  ),
  toast: toastMock
}));

import { ClaimsPageClient } from "./pageClient";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("ClaimsPageClient", () => {
  afterEach(() => {
    cleanup();
    state.release = {
      assets: [{ address: usdcAddress, symbol: "USDC", decimals: 6 }],
      pools: [
        {
          poolId: 1,
          domainId: 1,
          domain: "Casino",
          active: true,
          asset: usdcAddress,
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
    state.flowError = undefined;
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  it("frames claims as a rewards and protocol claims console", () => {
    renderWithQueryClient(<ClaimsPageClient />);

    expect(screen.getByRole("heading", { name: /Rewards and protocol claims/i })).toBeDefined();
    expect(screen.getByText("Reward ledger")).toBeDefined();
    expect(screen.getByText("Claims transaction console")).toBeDefined();
    expect(screen.getByText("Connect a wallet to run claim actions.")).toBeDefined();
    expect(screen.getByText("Session claim activity")).toBeDefined();
  });

  it("uses the claims pool asset metadata instead of the first release asset", async () => {
    state.release = {
      assets: [
        { address: usdcAddress, symbol: "USDC", decimals: 6 },
        { address: usdtAddress, symbol: "USDT", decimals: 6 }
      ],
      pools: [
        {
          poolId: 1,
          domainId: 1,
          domain: "Casino",
          active: true,
          asset: usdtAddress,
          bank: "0x0000000000000000000000000000000000000002"
        }
      ]
    };
    state.sdk = {
      account: "0x1111111111111111111111111111111111111111",
      release: { chainId: 84532 },
      bank: {
        getPlayerPayable: vi.fn().mockResolvedValue(0n),
        getXPBuckets: vi.fn().mockResolvedValue({
          accrued: 5_000_000n,
          locked: 2_000_000n,
          holdback: 1_500_000n,
          holdbackReleasable: 750_000n
        }),
        getSnapshot: vi.fn().mockResolvedValue({
          bank: "0x0000000000000000000000000000000000000002",
          externalPayablesTotal: 4_000_000n,
          protocolFeesPayable: 1_250_000n,
          G: 100_000_000n,
          R: 10_000_000n
        })
      }
    };
    state.ready = true;

    renderWithQueryClient(<ClaimsPageClient />);

    expect((await screen.findAllByText("5 USDT")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.25 USDT").length).toBeGreaterThan(0);
  });

  it("lists what every pool owes the player, inactive pools included, and claims it", async () => {
    const usdtBank = "0x0000000000000000000000000000000000000004";
    state.release = {
      assets: [
        { address: usdcAddress, symbol: "USDC", decimals: 6 },
        { address: usdtAddress, symbol: "USDT", decimals: 6 }
      ],
      pools: [
        {
          poolId: 1,
          active: true,
          asset: usdcAddress,
          bank: "0x0000000000000000000000000000000000000002",
          symbol: "USDC",
          decimals: 6
        },
        {
          poolId: 2,
          active: false,
          asset: usdtAddress,
          bank: usdtBank,
          symbol: "USDT",
          decimals: 6
        }
      ]
    };
    const account = "0x1111111111111111111111111111111111111111";
    const claimPlayerPayable = vi
      .fn()
      .mockResolvedValue({ ok: true, txHash: `0x${"1".repeat(64)}` });
    state.sdk = {
      account,
      release: { chainId: 84532 },
      bank: {
        getPlayerPayable: vi.fn(async (poolId: number) => (poolId === 2 ? 2_500_000n : 0n)),
        claimPlayerPayable,
        getXPBuckets: vi
          .fn()
          .mockResolvedValue({ accrued: 0n, locked: 0n, holdback: 0n, holdbackReleasable: 0n }),
        getSnapshot: vi.fn().mockResolvedValue({ protocolFeesPayable: 0n })
      }
    };
    state.ready = true;

    renderWithQueryClient(<ClaimsPageClient />);

    expect(await screen.findByText("2.5 USDT")).toBeDefined();
    expect(screen.getByText("USDT · Pool #2")).toBeDefined();
    expect(screen.queryByText("USDC · Pool #1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    await waitFor(() => expect(claimPlayerPayable).toHaveBeenCalledWith(2, account));
    expect(toastMock.success).toHaveBeenCalledWith(
      "Claimed 2.5 USDT. It was paid to the player's wallet."
    );
  });

  it("never reads a failed balance as nothing to claim", async () => {
    state.sdk = {
      account: "0x1111111111111111111111111111111111111111",
      release: { chainId: 84532 },
      bank: {
        getPlayerPayable: vi.fn().mockRejectedValue(new Error("RPC offline")),
        getXPBuckets: vi
          .fn()
          .mockResolvedValue({ accrued: 0n, locked: 0n, holdback: 0n, holdbackReleasable: 0n }),
        getSnapshot: vi.fn().mockResolvedValue({ protocolFeesPayable: 0n })
      }
    };
    state.ready = true;

    renderWithQueryClient(<ClaimsPageClient />);

    expect(
      await screen.findByText(
        "The balance in pool #1 (USDC) could not be read. It is not assumed to be zero."
      )
    ).toBeDefined();
    expect(
      screen.queryByText("Nothing to claim. No pool owes this wallet anything right now.")
    ).toBeNull();
  });

  it("says plainly when nothing is owed", async () => {
    state.sdk = {
      account: "0x1111111111111111111111111111111111111111",
      release: { chainId: 84532 },
      bank: {
        getPlayerPayable: vi.fn().mockResolvedValue(0n),
        getXPBuckets: vi
          .fn()
          .mockResolvedValue({ accrued: 0n, locked: 0n, holdback: 0n, holdbackReleasable: 0n }),
        getSnapshot: vi.fn().mockResolvedValue({ protocolFeesPayable: 0n })
      }
    };
    state.ready = true;

    renderWithQueryClient(<ClaimsPageClient />);

    expect(
      await screen.findByText("Nothing to claim. No pool owes this wallet anything right now.")
    ).toBeDefined();
  });
  it("shows claim failures and failed reads as copy, never provider or parser text", async () => {
    const raw = "execution reverted: 0xdeadbeef (provider text)";
    const claimXPAccrued = vi.fn();
    state.flowError = {
      code: "TX_REVERTED",
      message: raw,
      severity: "error",
      details: { args: ["0xdeadbeef", "1000000"] }
    };
    state.sdk = {
      account: "0x1111111111111111111111111111111111111111",
      release: { chainId: 84532 },
      bank: {
        getPlayerPayable: vi.fn().mockResolvedValue(0n),
        getXPBuckets: vi.fn().mockRejectedValue(new Error(raw)),
        getSnapshot: vi.fn().mockResolvedValue({ protocolFeesPayable: 0n }),
        claimXPAccrued
      }
    };
    state.ready = true;

    renderWithQueryClient(<ClaimsPageClient />);

    expect(
      await screen.findByText(
        "This could not be read from the chain just now. It is not assumed to be zero; check again shortly."
      )
    ).toBeDefined();
    expect(
      screen.getByText("The transaction failed on-chain and changed nothing, but gas was spent.")
    ).toBeDefined();
    expect(screen.queryByText(raw)).toBeNull();
    // No raw revert arguments under the localized message.
    expect(screen.queryByText(/0xdeadbeef/)).toBeNull();

    fireEvent.change(screen.getAllByPlaceholderText("0.00")[0]!, { target: { value: "1.2.3" } });
    // The last "Claim XP" button submits; the first one picks the action.
    fireEvent.click(screen.getAllByRole("button", { name: "Claim XP" }).at(-1)!);
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Enter the amount as a number with a dot for decimals, for example 12.5, and at most 6 decimal places."
      )
    );
    expect(claimXPAccrued).not.toHaveBeenCalled();
  });
});
