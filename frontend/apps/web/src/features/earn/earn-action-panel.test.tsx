import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import { EarnActionPanel, type EarnFlowState } from "./earn-action-panel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key
}));

vi.mock("@ssot/ui", () => ({
  AssetSelector: ({ title }: { title: string }) => <div>{title}</div>
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
      onSubmit={vi.fn()}
      connected
    />
  );
}

describe("EarnActionPanel", () => {
  afterEach(() => cleanup());

  it("does not render transaction chrome during wallet preflight", () => {
    renderPanel({
      ...baseFlow,
      status: "planning",
      hasActivity: true,
      busy: true
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "earn.actions.trace.view" })).toBeNull();
  });

  it("keeps transaction feedback in toast-only mode once a transaction hash exists", () => {
    renderPanel({
      ...baseFlow,
      status: "submitting",
      hasActivity: true,
      busy: true,
      txHash: "0xabc"
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "earn.actions.trace.view" })).toBeNull();
  });
});
