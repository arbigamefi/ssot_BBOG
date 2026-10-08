import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BankProviderLedgerPanel } from "./BankProviderLedgerPanel";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
const owner = "0x1111111111111111111111111111111111111111" as const;
const payer = "0x2222222222222222222222222222222222222222" as const;
const props = {
  connected: true,
  loading: false,
  decimals: 6,
  symbol: "USDC",
  hasMore: false,
  loadingMore: false,
  onLoadMore: vi.fn()
};
const row = { depositId: 1_099_511_627_776n, txHash: "0xaa" as const, blockNumber: 1, logIndex: 0 };
describe("NFT provider history", () => {
  afterEach(cleanup);
  it.each([
    { connected: false, loading: false },
    { connected: true, loading: true },
    { connected: true, loading: false, error: "RPC unavailable" }
  ])("does not invent cash when unavailable: %j", (state) => {
    render(<BankProviderLedgerPanel {...props} {...state} entries={[]} />);
    expect(screen.queryByText("0 USDC")).toBeNull();
  });
  it("keeps the payer distinct from the initial NFT owner", () => {
    render(
      <BankProviderLedgerPanel
        {...props}
        entries={[{ ...row, id: "d", action: "deposit", assets: 10_000_000n, payer, owner }]}
      />
    );
    expect(screen.getByText("10 USDC")).toBeTruthy();
    expect(screen.getByText(/earn.nft.payer: 0x2222/)).toHaveTextContent(
      "earn.nft.initialOwner: 0x1111"
    );
    expect(screen.getByText(/NFT #1099511627776/)).toBeTruthy();
  });
  it("treats NFT transfer as an ownership event, never USDC cash or profit", () => {
    render(
      <BankProviderLedgerPanel
        {...props}
        cashFlowComplete
        entries={[{ ...row, id: "t", action: "transfer", from: owner, to: payer }]}
      />
    );
    expect(screen.getByText("earn.nft.noCashFlow")).toBeTruthy();
    expect(screen.getByText(/0x1111.*→.*0x2222/)).toBeTruthy();
    expect(screen.queryByText(/USDC/)).toBeNull();
    expect(screen.queryByText(/netPnl/)).toBeNull();
  });
  it("shows partial coverage instead of a lifetime return", () => {
    render(<BankProviderLedgerPanel {...props} entries={[]} />);
    expect(screen.getByText("earn.nft.historyIncomplete")).toBeTruthy();
    expect(screen.queryByText(/netPnl/)).toBeNull();
  });
  it("identifies the owner receiving a withdrawal", () => {
    render(
      <BankProviderLedgerPanel
        {...props}
        entries={[
          {
            ...row,
            id: "w",
            action: "withdraw",
            assets: 5_000_000n,
            owner,
            percent: 500_000_000_000n
          }
        ]}
      />
    );
    expect(screen.getByText("5 USDC")).toBeTruthy();
    expect(screen.getByText(/earn.nft.receiver: 0x1111/)).toBeTruthy();
  });
});
