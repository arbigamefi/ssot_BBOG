import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BankProviderLedgerPanel } from "./BankProviderLedgerPanel";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key
}));

describe("provider ledger unknown balances", () => {
  afterEach(cleanup);

  it.each([
    { connected: false, loading: false },
    { connected: true, loading: true },
    { connected: true, loading: false, error: "RPC unavailable" }
  ])("does not invent zero balances while data is unavailable: %j", (state) => {
    render(<BankProviderLedgerPanel {...state} decimals={6} entries={[]} symbol="USDC" />);
    expect(screen.queryAllByText("0 USDC")).toHaveLength(0);
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("does not calculate net P&L before the current position is known", () => {
    render(
      <BankProviderLedgerPanel connected loading={false} decimals={6} entries={[]} symbol="USDC" />
    );
    expect(screen.getAllByText("0 USDC")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("retains pending and fixed claim equity when no shares remain in the wallet", () => {
    render(
      <BankProviderLedgerPanel
        connected
        loading={false}
        decimals={6}
        symbol="USDC"
        positionShares={0n}
        positionAssets={100_000_000n}
        recoveryComplete
        cashFlowComplete
        entries={[
          {
            id: "deposit",
            action: "deposit",
            assets: 100_000_000n,
            shares: 100_000_000n,
            txHash: "0xaa",
            blockNumber: 1,
            logIndex: 0
          }
        ]}
      />
    );
    const summary = (label: string) => within(screen.getByText(label).parentElement!);
    expect(summary("earn.ledger.summary.openValue").getByText("100 USDC")).toBeTruthy();
    expect(screen.queryByText("earn.ledger.summary.netPnl")).toBeNull();
  });

  it("does not calculate lifetime P&L from an incomplete cash flow page", () => {
    render(
      <BankProviderLedgerPanel
        connected
        loading={false}
        decimals={6}
        symbol="USDC"
        hasMore
        positionShares={0n}
        positionAssets={100_000_000n}
        entries={[]}
      />
    );
    expect(screen.queryByText("earn.ledger.summary.netPnl")).toBeNull();
  });

  it.each([{ recoveryComplete: false }, { recoveryComplete: true, hasUnsettledRecovery: true }])(
    "does not present unresolved historical rights as a complete zero return: %j",
    (recovery) => {
      render(
        <BankProviderLedgerPanel
          connected
          loading={false}
          decimals={6}
          symbol="USDC"
          entries={[]}
          positionAssets={0n}
          positionShares={0n}
          {...recovery}
        />
      );
      expect(screen.queryByText("earn.ledger.summary.netPnl")).toBeNull();
      expect(screen.getByText("earn.recovery.incompleteReturn")).toBeTruthy();
    }
  );

  it("counts recovery as cash received but excludes a Bank donation", () => {
    const base = { shares: 0n, txHash: "0xaa" as const, blockNumber: 1, logIndex: 0 };
    render(
      <BankProviderLedgerPanel
        connected
        loading={false}
        decimals={6}
        symbol="USDC"
        recoveryComplete
        cashFlowComplete
        positionAssets={0n}
        positionShares={0n}
        entries={[
          { ...base, id: "d", action: "deposit", assets: 10_000_000n },
          { ...base, id: "r", action: "recovery", assets: 7_000_000n, epochId: 1n },
          { ...base, id: "gift", action: "donation", assets: 3_000_000n }
        ]}
      />
    );
    expect(
      within(screen.getByText("earn.ledger.summary.withdrawn").parentElement!).getByText("7 USDC")
    ).toBeTruthy();
    expect(screen.queryByText("earn.ledger.summary.netPnl")).toBeNull();
    expect(screen.getByText("earn.recovery.donationNote")).toBeTruthy();
  });
  it("does not invent profit for received shares without a cost basis", () => {
    render(
      <BankProviderLedgerPanel
        connected
        loading={false}
        decimals={6}
        entries={[]}
        symbol="USDC"
        positionAssets={100_000_000n}
        positionShares={100_000_000n}
        cashFlowComplete
        recoveryComplete
      />
    );
    expect(
      within(screen.getByText("earn.ledger.summary.openValue").parentElement!).getByText("100 USDC")
    ).toBeTruthy();
    expect(screen.queryByText("earn.ledger.summary.netPnl")).toBeNull();
  });
});
