import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
    expect(screen.getAllByText("—")).toHaveLength(5);
  });

  it("does not calculate net P&L before the current position is known", () => {
    render(
      <BankProviderLedgerPanel connected loading={false} decimals={6} entries={[]} symbol="USDC" />
    );
    expect(screen.getAllByText("0 USDC")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
