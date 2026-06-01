import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import { EarnActionPanel, type EarnFlowState } from "./earn-action-panel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key
}));

vi.mock("@ssot/ui", () => ({
  AssetSelector: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorCallout: ({ title, message }: { title: string; message: string }) => (
    <div>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  ),
  TxStatusChip: ({ status }: { status: string }) => <span>{status}</span>,
  TxStepper: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <span>{title}</span>
      <span>{subtitle}</span>
    </div>
  )
}));

const baseFlow: EarnFlowState = {
  status: "idle",
  steps: [],
  hasActivity: false,
  busy: false,
  reset: vi.fn()
};

function renderPanel(flow: EarnFlowState) {
  return render(
    <EarnActionPanel
      tab="deposit"
      onTabChange={vi.fn()}
      assets={[
        {
          address: "0x0000000000000000000000000000000000000001",
          symbol: "USDC",
          decimals: 6,
          label: "USDC"
        }
      ]}
      asset="0x0000000000000000000000000000000000000001"
      onAssetChange={vi.fn()}
      amount="1"
      onAmountChange={vi.fn()}
      symbol="USDC"
      disabled={false}
      readOnly={false}
      unsupportedAsset={false}
      availableLabel="Wallet balance"
      availableValue="1.0000 USDC"
      canUseMax
      onUseMax={vi.fn()}
      flow={flow}
      explorerBaseUrl="https://basescan.org"
      onSubmit={vi.fn()}
      connected
    />
  );
}

describe("EarnActionPanel", () => {
  afterEach(() => cleanup());

  it("does not auto-open the transaction dialog during wallet preflight", () => {
    renderPanel({
      ...baseFlow,
      status: "planning",
      hasActivity: true,
      busy: true
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "earn.actions.trace.view" })).toBeDefined();
  });

  it("auto-opens the transaction dialog once a transaction hash exists", () => {
    renderPanel({
      ...baseFlow,
      status: "submitting",
      hasActivity: true,
      busy: true,
      txHash: "0xabc"
    });

    expect(screen.getByRole("dialog", { name: "earn.actions.trace.statusDialog" })).toBeDefined();
  });
});
