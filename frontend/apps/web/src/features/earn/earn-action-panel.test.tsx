import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

import { EarnActionPanel, type EarnFlowState } from "./earn-action-panel";
import { requestWalletConnect } from "../../app-shell/wallet-connect-events";

vi.mock("../../app-shell/wallet-connect-events", () => ({ requestWalletConnect: vi.fn() }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key
}));

vi.mock("@ssot/ui", () => ({
  AssetSelector: ({ error, title }: { error?: string; title: string }) => (
    <div>
      <div>{title}</div>
      {error ? <div>{error}</div> : null}
    </div>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

const baseFlow: EarnFlowState = {
  status: "idle",
  steps: [],
  hasActivity: false,
  busy: false,
  reset: vi.fn()
};

function renderPanel(
  flow: EarnFlowState,
  overrides: Partial<React.ComponentProps<typeof EarnActionPanel>> = {}
) {
  return render(
    <EarnActionPanel
      tab="deposit"
      onTabChange={vi.fn()}
      amountMode="assets"
      onAmountModeChange={vi.fn()}
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
      {...overrides}
    />
  );
}

describe("EarnActionPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("offers wallet connection instead of a disabled deposit and never submits while disconnected", () => {
    const onSubmit = vi.fn();
    renderPanel(baseFlow, { connected: false, disabled: true, onSubmit });
    fireEvent.click(screen.getByRole("button", { name: "app.connectWalletButton" }));
    expect(requestWalletConnect).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves the connected transaction gate and freezes intent while busy", () => {
    const onSubmit = vi.fn();
    renderPanel({ ...baseFlow, busy: true }, { onSubmit });
    expect(
      screen.getByRole("textbox", { name: "earn.actions.amount" }).hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "earn.actions.tabs.withdraw.label" })
        .hasAttribute("disabled")
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "earn.actions.submit.executing" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

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

  it("uses the active-pool message when the selected asset cannot be written", () => {
    renderPanel(baseFlow, { unsupportedAsset: true });

    expect(screen.getByText("earn.errors.unsupportedWriteAsset")).toBeDefined();
  });
});
