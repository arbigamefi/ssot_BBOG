import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const ACCOUNT = "0x0000000000000000000000000000000000000007";
const BANK = "0x0000000000000000000000000000000000000002";
const VAULT = "0x0000000000000000000000000000000000000003";
const ASSET = "0x0000000000000000000000000000000000000001";
const state = { sdk: null as any, readOnly: false };
const tx = { ok: true, txHash: "0x123" };
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key
}));
vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    chainId: 84532,
    readOnly: state.readOnly,
    release: {
      releaseDigest: "0x123",
      assets: [{ address: ASSET, symbol: "USDC", decimals: 6 }],
      pools: [
        {
          poolId: 1,
          domainId: 1,
          active: true,
          bank: BANK,
          vault: VAULT,
          asset: ASSET,
          symbol: "USDC",
          decimals: 6
        }
      ]
    }
  })
}));
vi.mock("../../../ssot/sdk", () => ({ useSSOTSDK: () => ({ sdk: state.sdk, ready: true }) }));
vi.mock("../../../app-shell/casino-access", () => ({ isLpDepositEnabledForChain: () => true }));
vi.mock("../../../components/PageTransition", () => ({
  PageTransition: ({ children }: any) => <div>{children}</div>
}));
vi.mock("../../../features/earn/BankrollPerformancePanel", () => ({
  BankrollPerformancePanel: () => null
}));
vi.mock("../../../features/earn/useBankProviderLedger", () => ({
  useBankProviderLedger: () => ({ entries: [], coverageComplete: true })
}));
vi.mock("../../../features/tx/useDirectTxAction", () => {
  const useFlow = () => ({
    status: "idle",
    steps: [],
    hasActivity: false,
    busy: false,
    reset: vi.fn(),
    execute: (run: () => Promise<unknown>) => run()
  });
  return { useDirectTxAction: useFlow, useSequencedTxAction: useFlow };
});
vi.mock("@ssot/ui", () => ({
  cn: (...x: any[]) => x.filter(Boolean).join(" "),
  toast: { success: vi.fn(), error: vi.fn() }
}));
import { EarnPageClient } from "./pageClient";

function position(overrides: Record<string, unknown> = {}) {
  return {
    poolId: 1,
    asset: ASSET,
    bank: BANK,
    vault: VAULT,
    depositId: 1099511627776n,
    owner: ACCOUNT,
    assets: 7_000_000n,
    withdrawAfter: 1_700_000_000n,
    maxPercent: 1_000_000_000_000n,
    maxAssets: 7_000_000n,
    status: "ready",
    snapshotTimestamp: 1_700_000_001n,
    updatedAtBlock: 10n,
    ...overrides
  };
}
let queryClient: QueryClient;
function mount() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EarnPageClient />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  state.readOnly = false;
  state.sdk = {
    account: ACCOUNT,
    bank: {
      getSnapshot: vi.fn().mockResolvedValue({
        bank: BANK,
        vault: VAULT,
        L: 100_000_000n,
        K: 1_000_000n,
        P: 1_000_000n,
        R: 2_000_000n,
        G: 101_000_000n,
        lpFreeCapital: 99_000_000n,
        lpStatus: "ready",
        totalTurnover: 0n,
        totalPayoutGross: 0n,
        updatedAtBlock: 10n,
        snapshotTimestamp: 1_700_000_001n
      }),
      getAssetBalance: vi.fn().mockResolvedValue(20_000_000n),
      getPlayerPayable: vi.fn().mockResolvedValue(0n),
      claimPlayerPayable: vi.fn().mockResolvedValue(tx)
    },
    vault: {
      getDeposits: vi.fn().mockResolvedValue({
        items: [position()],
        nftCount: 1n,
        complete: true,
        updatedAtBlock: 10n
      }),
      quoteWithdrawal: vi.fn().mockResolvedValue({
        position: position(),
        percent: 1_000_000_000_000n,
        assets: 7_000_000n,
        executable: true,
        closeOnly: false
      }),
      addDeposit: vi.fn().mockResolvedValue(tx),
      withdrawDeposit: vi.fn().mockResolvedValue(tx)
    }
  };
});
afterEach(() => {
  cleanup();
  queryClient?.clear();
  vi.clearAllMocks();
});

describe("NFT Earn console", () => {
  it("keeps the action disabled until its own pending execution finishes", async () => {
    let finish!: (value: typeof tx) => void;
    state.sdk.vault.addDeposit.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    mount();
    fireEvent.change(screen.getByLabelText("earn.actions.amount"), { target: { value: "1" } });
    const button = screen.getByRole("button", { name: "earn.actions.submit.deposit" });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(state.sdk.vault.addDeposit).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(state.sdk.vault.addDeposit).toHaveBeenCalledTimes(1);
    finish(tx);
    await waitFor(() => expect(screen.getByLabelText("earn.actions.amount")).toHaveValue(""));
  });
  it("deposits asset units through Vault and never offers share minting", async () => {
    mount();
    await waitFor(() => expect(state.sdk.bank.getSnapshot).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("earn.actions.amount"), { target: { value: "1.25" } });
    const button = screen.getByRole("button", { name: "earn.actions.submit.deposit" });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() =>
      expect(state.sdk.vault.addDeposit).toHaveBeenCalledWith(1, 1_250_000n, ACCOUNT)
    );
    expect(screen.queryByText("earn.actions.amountMode.shares")).toBeNull();
  });
  it("shows tree value, uses ONE for full withdrawal and refreshes after payment", async () => {
    mount();
    fireEvent.click(
      screen.getAllByRole("button", { name: "earn.actions.tabs.withdraw.label" })[0]!
    );
    const button = await screen.findByRole("button", { name: "earn.nft.withdraw" });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByText("7 USDC")).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() =>
      expect(state.sdk.vault.withdrawDeposit).toHaveBeenCalledWith(
        1,
        1099511627776n,
        1_000_000_000_000n
      )
    );
    expect(state.sdk.vault.quoteWithdrawal).toHaveBeenCalledWith(
      1,
      1099511627776n,
      1_000_000_000_000n,
      { blockNumber: 10n }
    );
  });
  it("does not withdraw after current ownership changes during preflight", async () => {
    mount();
    fireEvent.click(
      screen.getAllByRole("button", { name: "earn.actions.tabs.withdraw.label" })[0]!
    );
    const button = await screen.findByRole("button", { name: "earn.nft.withdraw" });
    await waitFor(() => expect(button).not.toBeDisabled());
    state.sdk.vault.quoteWithdrawal.mockResolvedValue({
      position: position({ owner: ASSET }),
      executable: true,
      assets: 7_000_000n
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(state.sdk.vault.quoteWithdrawal).toHaveBeenCalledWith(
        1,
        1099511627776n,
        1_000_000_000_000n
      )
    );
    expect(state.sdk.vault.withdrawDeposit).not.toHaveBeenCalled();
  });
  it.each(["paused", "unbookedResult", "invalidAccounting"])(
    "blocks deposits on %s",
    async (lpStatus) => {
      state.sdk.bank.getSnapshot.mockResolvedValue({
        bank: BANK,
        vault: VAULT,
        L: 1n,
        lpStatus,
        updatedAtBlock: 10n
      });
      mount();
      await screen.findByText(`earn.nft.status.${lpStatus}`);
      fireEvent.change(screen.getByLabelText("earn.actions.amount"), { target: { value: "1" } });
      expect(screen.getByRole("button", { name: "earn.actions.submit.deposit" })).toBeDisabled();
      expect(state.sdk.vault.addDeposit).not.toHaveBeenCalled();
    }
  );
  it("treats a failed NFT read as unavailable instead of an empty wallet", async () => {
    state.sdk.vault.getDeposits.mockRejectedValue(new Error("RPC offline"));
    mount();
    fireEvent.click(
      screen.getAllByRole("button", { name: "earn.actions.tabs.withdraw.label" })[0]!
    );
    await screen.findByText("earn.nft.unavailable");
    expect(screen.queryByText("earn.nft.empty")).toBeNull();
  });
  it("blocks an unavailable or mismatched authoritative Vault instead of showing an empty wallet", async () => {
    state.sdk.bank.getSnapshot.mockResolvedValue({
      bank: BANK,
      vault: ASSET,
      L: 1n,
      lpStatus: "ready",
      updatedAtBlock: 10n
    });
    mount();
    await screen.findByText("earn.nft.unavailable");
    fireEvent.change(screen.getByLabelText("earn.actions.amount"), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "earn.actions.submit.deposit" })).toBeDisabled();
    expect(state.sdk.vault.getDeposits).not.toHaveBeenCalled();
  });
  it("paginates NFT values without presenting the count as assets", async () => {
    const cursor = { nextIndex: 25n };
    state.sdk.vault.getDeposits
      .mockResolvedValueOnce({
        items: [position()],
        nftCount: 26n,
        complete: false,
        nextCursor: cursor,
        updatedAtBlock: 10n
      })
      .mockResolvedValue({
        items: [position({ depositId: 1099511627777n, assets: 3_000_000n })],
        nftCount: 26n,
        complete: true,
        updatedAtBlock: 10n
      });
    mount();
    fireEvent.click(
      screen.getAllByRole("button", { name: "earn.actions.tabs.withdraw.label" })[0]!
    );
    fireEvent.click(await screen.findByRole("button", { name: "earn.ledger.loadMore" }));
    await screen.findByText("3 USDC");
    expect(state.sdk.vault.getDeposits).toHaveBeenCalledWith(1, ACCOUNT, {
      cursor,
      limit: 25,
      blockNumber: 10n
    });
    expect(screen.queryByText("26 USDC")).toBeNull();
  });
  it("keeps player debt claim separate and available while LP operations are paused", async () => {
    state.sdk.bank.getSnapshot.mockResolvedValue({
      bank: BANK,
      vault: VAULT,
      L: 1n,
      lpStatus: "paused",
      updatedAtBlock: 10n
    });
    state.sdk.bank.getPlayerPayable.mockResolvedValue(2_000_000n);
    mount();
    const button = await screen.findByRole("button", { name: "earn.nft.claimPlayer" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(state.sdk.bank.claimPlayerPayable).toHaveBeenCalledWith(1, ACCOUNT));
  });
});
