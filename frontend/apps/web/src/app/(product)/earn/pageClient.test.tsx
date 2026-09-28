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

vi.mock("../../../ssot/release/ReleaseProvider", () => {
  const value = () => ({
    release: state.release,
    readOnly: state.readOnly,
    readOnlyReason: state.readOnlyReason,
    chainId: state.chainId
  });
  return { useRelease: value, useOptionalRelease: value };
});

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
  BankrollPerformancePanel: ({ showIndexedHistory }: { showIndexedHistory?: boolean }) => (
    <div data-testid="bankroll-performance" data-indexed-history={String(showIndexedHistory)} />
  )
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
    execute: vi.fn((run: () => Promise<unknown>) => run())
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
    execute: vi.fn((run: () => Promise<unknown>) => run())
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

function setupAsyncBank({
  paused = false,
  queued = 3_000_000n,
  historical = 0n,
  cancellable = queued,
  eligibleAt = 200n,
  timestamp = 100n,
  claimAssets = 4_000_000n,
  playerPayable = 0n
}: {
  paused?: boolean;
  queued?: bigint;
  historical?: bigint;
  cancellable?: bigint;
  eligibleAt?: bigint;
  timestamp?: bigint;
  claimAssets?: bigint;
  playerPayable?: bigint;
} = {}) {
  state.ready = true;
  const account = "0x0000000000000000000000000000000000000abc";
  const snapshot = {
    bank: state.release.pools[0].bank,
    riskInPaused: paused,
    activeReserved: 10_000_000n,
    recoveryBacking: historical,
    currentEpoch: 2n,
    updatedAtBlock: 1000n,
    totalAssets: 100_000_000n,
    totalReserved: 10_000_000n,
    totalSupply: 100_000_000n,
    assetsPerShare: 1_000_000n,
    protocolFeesPayable: 0n,
    externalPayablesTotal: 0n
  };
  const position = {
    poolId: 1,
    user: account,
    shares: 5_000_000n,
    assetsEquivalent: 5_000_000n,
    queuedShares: queued,
    queuedLiquidAssets: queued,
    queuedRecoveryAssets: 2_000_000n,
    claimableShares: 4_000_000n,
    claimableAssets: claimAssets,
    cancellableShares: cancellable,
    activeAndClaimableAssets: 5_000_000n + queued + claimAssets,
    updatedAtBlock: 1000n,
    playerPayable,
    snapshotTimestamp: timestamp,
    queuedBatch:
      queued > 0n
        ? {
            batchId: 2n,
            cutoff: eligibleAt,
            activatedAt: 0n,
            priced: false,
            controllerShares: queued
          }
        : null
  };
  const right = {
    epochId: 1n,
    activatedAt: 80n,
    shares: historical,
    claimableAssets: 1_000_000n,
    claimedAssets: 0n,
    pendingAssets: historical,
    finalSynced: false,
    remainingHolds: 2n,
    remainingReserve: historical,
    updatedAtBlock: 1000n,
    snapshotTimestamp: timestamp
  };
  const success = { ok: true, txHash: "0x123" };
  state.sdk = {
    account,
    release: { ...state.release, chainId: state.chainId },
    bank: {
      getSnapshot: vi.fn().mockResolvedValue(snapshot),
      getPosition: vi.fn().mockResolvedValue(position),
      getRecoveryPage: vi.fn().mockResolvedValue({
        items: historical > 0n ? [right] : [],
        complete: true,
        updatedAtBlock: 1000n,
        snapshotTimestamp: timestamp
      }),
      getRecovery: vi.fn().mockResolvedValue(right),
      claimRecovery: vi.fn().mockResolvedValue(success),
      getAssetBalance: vi.fn().mockResolvedValue(20_000_000n),
      requestRedeem: vi.fn().mockResolvedValue(success),
      cancelRedeemRequest: vi.fn().mockResolvedValue(success),
      redeem: vi.fn().mockResolvedValue(success),
      withdraw: vi.fn().mockResolvedValue(success),
      deposit: vi.fn().mockResolvedValue(success),
      mint: vi.fn().mockResolvedValue(success),
      maxRedeem: vi.fn(),
      maxWithdraw: vi.fn(),
      previewRedeem: vi.fn(),
      previewWithdraw: vi.fn(),
      claimPlayerPayable: vi.fn().mockResolvedValue(success)
    }
  };
  return { snapshot, position, right, bank: state.sdk.bank, account };
}

async function openAsyncExit() {
  const actions = screen.getByRole("region", { name: "Deposit or exit" });
  fireEvent.click(within(actions).getByRole("button", { name: "Withdraw" }));
  await screen.findByLabelText("Shares to request");
  return actions;
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

  it("requests wallet shares while retaining pending and claimable equity", async () => {
    const { bank, account } = setupAsyncBank();
    renderWithQueryClient(<EarnPageClient />);
    await openAsyncExit();
    expect(screen.getByText("Active and priced LP value (estimate)")).toBeDefined();
    expect(screen.getAllByText("12 USDC").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Queued shares still bear active pool results/)[0]).toBeDefined();
    fireEvent.change(screen.getByLabelText("Shares to request"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Request redemption" }));
    await waitFor(() =>
      expect(bank.requestRedeem).toHaveBeenCalledWith(1, 5_000_000n, account, account)
    );
    expect(bank.redeem).not.toHaveBeenCalled();
    expect(bank.previewRedeem).not.toHaveBeenCalled();
    expect(bank.previewWithdraw).not.toHaveBeenCalled();
    expect(bank.maxRedeem).not.toHaveBeenCalled();
    expect(bank.maxWithdraw).not.toHaveBeenCalled();
  });

  it("allows requests and eligible cancellation while paused but blocks LP claims and deposits", async () => {
    const { bank, account } = setupAsyncBank({ paused: true, playerPayable: 2_000_000n });
    renderWithQueryClient(<EarnPageClient />);
    await openAsyncExit();
    expect(
      (screen.getByRole("button", { name: "Claim all exit assets" }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel queued shares" }));
    await waitFor(() => expect(bank.cancelRedeemRequest).toHaveBeenCalledWith(1, account));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Claim player award" }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole("button", { name: "Claim player award" }));
    await waitFor(() => expect(bank.claimPlayerPayable).toHaveBeenCalledWith(1, account));
    await waitFor(() =>
      expect((screen.getByLabelText("Shares to request") as HTMLInputElement).disabled).toBe(false)
    );
    fireEvent.change(screen.getByLabelText("Shares to request"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Request redemption" }));
    await waitFor(() =>
      expect(bank.requestRedeem).toHaveBeenCalledWith(1, 1_000_000n, account, account)
    );
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole("region", { name: "Deposit or exit" })).getByRole("button", {
            name: "Deposit"
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    fireEvent.click(
      within(screen.getByRole("region", { name: "Deposit or exit" })).getByRole("button", {
        name: "Deposit"
      })
    );
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1" } });
    expect(
      (screen.getByRole("button", { name: "Deposit assets" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(bank.deposit).not.toHaveBeenCalled();
  });

  it("keeps historical rights and priced cash when wallet shares and active supply are zero", async () => {
    const { bank, snapshot, position } = setupAsyncBank({ queued: 0n, historical: 3_000_000n });
    bank.getSnapshot.mockResolvedValue({
      ...snapshot,
      totalSupply: 0n,
      totalAssets: 0n,
      activeReserved: 0n
    });
    bank.getPosition.mockResolvedValue({
      ...position,
      shares: 0n,
      assetsEquivalent: 0n,
      activeAndClaimableAssets: 4_000_000n
    });
    renderWithQueryClient(<EarnPageClient />);
    const ledger = screen
      .getByRole("heading", { name: "Deposits, exits and recovery" })
      .closest("section")!;
    await waitFor(() => expect(within(ledger).getByText("Known LP value")).toBeDefined());
    await waitFor(() =>
      expect(within(ledger).getByText("Known LP value").parentElement?.textContent).toContain(
        "5 USDC"
      )
    );
    expect(within(ledger).getByText("Wallet shares")).toBeDefined();
    expect(within(ledger).getByText("Loaded net P&L").parentElement?.textContent).toContain("—");
    const recovery = await screen.findByRole("region", { name: "Epoch 1" });
    fireEvent.click(within(recovery).getByRole("button", { name: "Claim recovery" }));
    await waitFor(() =>
      expect(bank.claimRecovery).toHaveBeenCalledWith(
        1,
        1n,
        "0x0000000000000000000000000000000000000abc",
        "0x0000000000000000000000000000000000000abc"
      )
    );
  });

  it("discovers staying holders on later pages even when the first page has no owned rights", async () => {
    const { bank, account, right } = setupAsyncBank({ queued: 0n, historical: 3_000_000n });
    const cursor = { beforeBlock: 90, beforeLogIndex: 1 };
    bank.getRecoveryPage.mockImplementation(
      async (_pool: number, _owner: string, options: { cursor?: unknown }) =>
        options.cursor
          ? { items: [right], complete: true, updatedAtBlock: 1000n, snapshotTimestamp: 100n }
          : {
              items: [],
              complete: false,
              nextCursor: cursor,
              updatedAtBlock: 1000n,
              snapshotTimestamp: 100n
            }
    );
    renderWithQueryClient(<EarnPageClient />);
    const more = await screen.findByRole("button", { name: "Load more historical rights" });
    expect(screen.getByText(/Historical discovery is incomplete/)).toBeDefined();
    fireEvent.click(more);
    await screen.findByRole("region", { name: "Epoch 1" });
    expect(bank.getPosition).toHaveBeenCalledWith(1, account, { blockNumber: 1000n });
    expect(bank.getRecoveryPage).toHaveBeenLastCalledWith(1, account, {
      cursor,
      limit: 25,
      blockNumber: 1000n
    });
    expect(bank.requestRedeem).not.toHaveBeenCalled();
  });

  it("retains an unresolved right with zero currently claimable cash", async () => {
    const { bank, right } = setupAsyncBank({ historical: 3_000_000n });
    bank.getRecoveryPage.mockResolvedValue({
      items: [{ ...right, claimableAssets: 0n }],
      complete: true,
      updatedAtBlock: 1000n,
      snapshotTimestamp: 100n
    });
    renderWithQueryClient(<EarnPageClient />);
    const rightPanel = await screen.findByRole("region", { name: "Epoch 1" });
    expect(within(rightPanel).getByText("Earlier bets still open: 2")).toBeDefined();
    expect(
      (within(rightPanel).getByRole("button", { name: "Claim recovery" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.getByText(/Incomplete return:/)).toBeDefined();
  });

  it("starts discovery from the first page after refreshing to a newer Bank snapshot", async () => {
    const { bank, right, snapshot, position } = setupAsyncBank({ historical: 3_000_000n });
    renderWithQueryClient(<EarnPageClient />);
    await screen.findByRole("region", { name: "Epoch 1" });
    bank.getSnapshot.mockResolvedValue({ ...snapshot, updatedAtBlock: 1001n });
    bank.getPosition.mockResolvedValue({ ...position, updatedAtBlock: 1001n });
    bank.getRecoveryPage.mockImplementation(
      async (_pool: number, _owner: string, options: { blockNumber: bigint }) => ({
        items:
          options.blockNumber === 1001n
            ? [{ ...right, epochId: 2n, updatedAtBlock: 1001n }]
            : [right],
        complete: true,
        updatedAtBlock: options.blockNumber,
        snapshotTimestamp: 101n
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh historical rights" }));
    await screen.findByRole("region", { name: "Epoch 2" });
    expect(screen.queryByRole("region", { name: "Epoch 1" })).toBeNull();
    expect(bank.getRecoveryPage).toHaveBeenLastCalledWith(1, state.sdk.account, {
      cursor: undefined,
      limit: 25,
      blockNumber: 1001n
    });
  });

  it("rechecks recovery claimability and pause before sending a claim", async () => {
    const { bank, right, snapshot } = setupAsyncBank({ historical: 3_000_000n });
    renderWithQueryClient(<EarnPageClient />);
    const claim = await screen.findByRole("button", { name: "Claim recovery" });
    bank.getRecovery.mockResolvedValue({ ...right, claimableAssets: 0n });
    fireEvent.click(claim);
    await waitFor(() => expect(bank.getRecovery).toHaveBeenCalled());
    expect(bank.claimRecovery).not.toHaveBeenCalled();
    await waitFor(() => expect((claim as HTMLButtonElement).disabled).toBe(false));
    bank.getSnapshot.mockResolvedValue({ ...snapshot, riskInPaused: true });
    fireEvent.click(claim);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("The pool is paused"))
    );
    expect(bank.claimRecovery).not.toHaveBeenCalled();
  });

  it("shows failed historical discovery as unknown, even with zero wallet shares", async () => {
    const { bank, position } = setupAsyncBank({ queued: 0n });
    bank.getPosition.mockResolvedValue({
      ...position,
      shares: 0n,
      assetsEquivalent: 0n,
      activeAndClaimableAssets: 0n
    });
    bank.getRecoveryPage.mockRejectedValue(new Error("RPC unavailable"));
    renderWithQueryClient(<EarnPageClient />);
    expect(await screen.findByText(/Historical recovery could not be loaded/)).toBeDefined();
    expect(screen.queryByText("No historical rights found in the complete discovery.")).toBeNull();
    expect(screen.getByText("Loaded net P&L").parentElement?.textContent).toContain("—");
  });

  it("selects same-asset Banks separately and discards selection across chain or release changes", async () => {
    const first = state.release.pools[0];
    const second = { ...first, poolId: 2, bank: "0x0000000000000000000000000000000000000003" };
    state.release.pools = [first, second];
    const { bank, account, snapshot, position } = setupAsyncBank();
    bank.getSnapshot.mockImplementation(async (id: number) => ({
      ...snapshot,
      bank: id === 1 ? first.bank : second.bank
    }));
    bank.getPosition.mockImplementation(async (id: number) => ({
      ...position,
      poolId: id,
      claimableShares: BigInt(id) * 1_000_000n
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <EarnPageClient />
      </QueryClientProvider>
    );
    await openAsyncExit();
    const select = screen.getByRole("combobox", { name: "Pool" }) as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.options[0]!.textContent).toContain("0002");
    expect(select.options[1]!.textContent).toContain("0003");
    expect(screen.getByTestId("bankroll-performance").getAttribute("data-indexed-history")).toBe(
      "false"
    );
    fireEvent.change(select, { target: { value: `2:${second.bank}` } });
    await waitFor(() => expect(bank.getSnapshot).toHaveBeenCalledWith(2));
    fireEvent.click(await screen.findByRole("button", { name: "Claim all exit assets" }));
    await waitFor(() => expect(bank.redeem).toHaveBeenCalledWith(2, 2_000_000n, account, account));
    expect(bank.redeem).not.toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    await waitFor(() => expect(select.disabled).toBe(false));

    const newBank = "0x0000000000000000000000000000000000000004";
    state.release = {
      ...state.release,
      releaseDigest: "0xnew-release",
      pools: [{ ...first, bank: newBank }, second]
    };
    state.sdk = { ...state.sdk, release: { ...state.release, chainId: state.chainId } };
    bank.getSnapshot.mockClear().mockImplementation(async (id: number) => ({
      ...snapshot,
      bank: id === 1 ? newBank : second.bank
    }));
    view.rerender(
      <QueryClientProvider client={client}>
        <EarnPageClient />
      </QueryClientProvider>
    );
    await waitFor(() => expect(bank.getSnapshot).toHaveBeenCalledWith(1));
    expect(select.value).toBe(`1:${newBank}`);
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: ["ssot", "earn", "bank"] })
        .map((q) => q.queryKey)
    ).toContainEqual(["ssot", "earn", "bank", 84532, 1, newBank, "0xnew-release", account]);

    fireEvent.change(select, { target: { value: `2:${second.bank}` } });
    state.chainId = 8453;
    state.sdk = { ...state.sdk, release: { ...state.release, chainId: state.chainId } };
    bank.getSnapshot.mockClear();
    view.rerender(
      <QueryClientProvider client={client}>
        <EarnPageClient />
      </QueryClientProvider>
    );
    await waitFor(() => expect(bank.getSnapshot).toHaveBeenCalledWith(1));
    expect(select.value).toBe(`1:${newBank}`);
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: ["ssot", "earn", "bank"] })
        .map((q) => q.queryKey)
    ).toContainEqual(["ssot", "earn", "bank", 8453, 1, newBank, "0xnew-release", account]);
  });

  it("fails closed when a selected pool id identifies different Banks", async () => {
    const first = state.release.pools[0];
    state.release.pools = [first, { ...first, bank: "0x0000000000000000000000000000000000000003" }];
    const { bank } = setupAsyncBank();
    renderWithQueryClient(<EarnPageClient />);
    expect(bank.getSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Claim all exit assets" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Pool" }), {
      target: { value: "1:0x0000000000000000000000000000000000000003" }
    });
    expect(bank.getSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Claim all exit assets" })).toBeNull();
  });

  it("rejects a different Bank in the fresh exit preflight", async () => {
    const { bank, snapshot } = setupAsyncBank();
    renderWithQueryClient(<EarnPageClient />);
    await openAsyncExit();
    bank.getSnapshot.mockResolvedValue({
      ...snapshot,
      bank: "0x0000000000000000000000000000000000000003"
    });
    fireEvent.click(screen.getByRole("button", { name: "Claim all exit assets" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Pool status is temporarily unavailable. Refresh before trying again."
      )
    );
    expect(bank.redeem).not.toHaveBeenCalled();
  });

  it("cancels queued shares after eligibility while earlier historical rights remain open", async () => {
    const { bank, account } = setupAsyncBank({
      historical: 2_000_000n,
      eligibleAt: 90n,
      timestamp: 100n
    });
    renderWithQueryClient(<EarnPageClient />);
    await openAsyncExit();
    const queued = screen.getByRole("region", { name: "Queued request" });
    const historical = await screen.findByRole("region", { name: "Epoch 1" });
    expect(within(queued).getByText("3 shares / 3 USDC")).toBeDefined();
    expect(within(historical).getByText("Earlier bets still open: 2")).toBeDefined();
    expect(within(queued).getByText(/not a guaranteed activation or payment time/)).toBeDefined();
    expect(within(historical).queryByRole("button", { name: "Cancel queued shares" })).toBeNull();
    fireEvent.click(within(queued).getByRole("button", { name: "Cancel queued shares" }));
    await waitFor(() => expect(bank.cancelRedeemRequest).toHaveBeenCalledWith(1, account));
    expect(bank.redeem).not.toHaveBeenCalled();
  });

  it("rechecks activation before cancelling a request that was queued on screen", async () => {
    const { bank, position } = setupAsyncBank();
    renderWithQueryClient(<EarnPageClient />);
    await openAsyncExit();
    bank.getPosition.mockResolvedValue({
      ...position,
      cancellableShares: 0n,
      queuedShares: 0n,
      queuedLiquidAssets: 0n,
      queuedRecoveryAssets: 0n,
      queuedBatch: null
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel queued shares" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Activated requests cannot be cancelled")
      )
    );
    expect(bank.cancelRedeemRequest).not.toHaveBeenCalled();
  });

  it("never offers cancellation for an activated cash claim or historical rights", async () => {
    const { bank } = setupAsyncBank({ queued: 0n, historical: 3_000_000n });
    renderWithQueryClient(<EarnPageClient />);
    await openAsyncExit();
    expect(
      (screen.getByRole("button", { name: "Cancel queued shares" }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel queued shares" }));
    expect(bank.cancelRedeemRequest).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(/Earlier bets remain assigned to their original holders/)[0]
    ).toBeDefined();
    expect(await screen.findByText("Earlier bets still open: 2")).toBeDefined();
  });

  it.each([4_000_000n, 0n])(
    "claims all priced shares even when the entitlement is %s assets",
    async (claimAssets) => {
      const { bank, account } = setupAsyncBank({ claimAssets });
      renderWithQueryClient(<EarnPageClient />);
      await openAsyncExit();
      fireEvent.click(
        screen.getByRole("button", {
          name: claimAssets === 0n ? "Clear zero-value exit shares" : "Claim all exit assets"
        })
      );
      await waitFor(() =>
        expect(bank.redeem).toHaveBeenCalledWith(1, 4_000_000n, account, account)
      );
      expect(bank.withdraw).not.toHaveBeenCalled();
    }
  );

  it("keeps inactive pools visible for requests, cancellation and debt claims while closing deposits", async () => {
    state.release.pools[0].active = false;
    const { bank, account } = setupAsyncBank({ playerPayable: 2_000_000n });
    renderWithQueryClient(<EarnPageClient />);
    await screen.findByLabelText("Shares to request");
    expect(screen.getByRole("combobox", { name: "Pool" })).toBeDefined();
    expect(
      screen.getByText(/This pool is inactive and closed to new bets and deposits/)
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Claim all exit assets" }));
    await waitFor(() => expect(bank.redeem).toHaveBeenCalledWith(1, 4_000_000n, account, account));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Cancel queued shares" }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel queued shares" }));
    await waitFor(() => expect(bank.cancelRedeemRequest).toHaveBeenCalledWith(1, account));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Claim player award" }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole("button", { name: "Claim player award" }));
    await waitFor(() => expect(bank.claimPlayerPayable).toHaveBeenCalledWith(1, account));
    fireEvent.change(screen.getByLabelText("Shares to request"), { target: { value: "1" } });
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Request redemption" }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole("button", { name: "Request redemption" }));
    await waitFor(() =>
      expect(bank.requestRedeem).toHaveBeenCalledWith(1, 1_000_000n, account, account)
    );
    const depositTab = within(screen.getByRole("region", { name: "Deposit or exit" })).getByRole(
      "button",
      { name: "Deposit" }
    );
    await waitFor(() => expect((depositTab as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(depositTab);
    expect(screen.getByText("New deposits are closed")).toBeDefined();
    expect(screen.queryByLabelText("Amount")).toBeNull();
    expect(bank.deposit).not.toHaveBeenCalled();
    expect(bank.mint).not.toHaveBeenCalled();
  });

  it("keeps deposits available while historical bets remain unresolved", async () => {
    const { bank, account } = setupAsyncBank({ historical: 3_000_000n });
    renderWithQueryClient(<EarnPageClient />);
    await waitFor(() => expect(bank.getPosition).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Deposit assets" }));
    await waitFor(() => expect(bank.deposit).toHaveBeenCalledWith(1, 1_000_000n, account));
    expect(
      screen.getAllByText(/Deposits join active capital immediately at its current book price/)[0]
    ).toBeDefined();
  });

  it("blocks actions when the current Bank snapshot cannot be loaded", async () => {
    const { bank } = setupAsyncBank();
    bank.getSnapshot.mockRejectedValue(new Error("RPC unavailable"));
    renderWithQueryClient(<EarnPageClient />);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Deposit or exit" })).getByRole("button", {
        name: "Withdraw"
      })
    );
    await waitFor(() => expect(bank.getSnapshot).toHaveBeenCalled());
    expect(screen.queryByLabelText("Amount")).toBeNull();
    expect(screen.queryByLabelText("Shares to request")).toBeNull();
    expect(bank.maxRedeem).not.toHaveBeenCalled();
    expect(bank.maxWithdraw).not.toHaveBeenCalled();
    expect(bank.redeem).not.toHaveBeenCalled();
    expect(bank.withdraw).not.toHaveBeenCalled();
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
    expect(
      within(screen.getByRole("region", { name: "Deposit or exit" })).getByText(
        "Connect a wallet to run bank actions."
      )
    ).toBeDefined();
  });

  it("closes mainnet deposits and lands on the withdraw side", () => {
    state.chainId = 8453;
    renderWithQueryClient(<EarnPageClient />);

    const actions = screen.getByRole("region", { name: "Deposit or exit" });
    expect(
      within(actions).getByRole("button", { name: "Withdraw" }).getAttribute("aria-pressed")
    ).toBe("true");

    fireEvent.click(within(actions).getByRole("button", { name: "Deposit" }));
    expect(within(actions).getByText("New deposits are closed")).toBeDefined();
    expect(within(actions).queryByLabelText("Amount")).toBeNull();
  });

  it("blocks deposits above the connected wallet balance before opening wallet flow", async () => {
    state.ready = true;
    state.sdk = {
      account: "0x0000000000000000000000000000000000000abc",
      bank: {
        getSnapshot: vi.fn().mockResolvedValue({
          riskInPaused: false,
          bank: "0x0000000000000000000000000000000000000002",
          totalAssets: 10_000_000n,
          totalReserved: 0n,
          activeReserved: 0n,
          totalSupply: 10_000_000n,
          assetsPerShare: 1_000_000n,
          riskReserveBps: 1_000,
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
});
