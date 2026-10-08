import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { EarnNftPanel, parseWithdrawalPercent } from "./earn-nft-panel";
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en"
}));
afterEach(cleanup);
const position = {
  poolId: 1,
  bank: "0x1",
  vault: "0x2",
  asset: "0x3",
  owner: "0x4",
  depositId: 1n,
  assets: 2_000_000n,
  withdrawAfter: 1700000000n,
  maxPercent: 500_000_000_000n,
  maxAssets: 1_000_000n,
  status: "ready",
  updatedAtBlock: 10n,
  snapshotTimestamp: 1700000001n
} as const;
function mount(overrides: Partial<React.ComponentProps<typeof EarnNftPanel>> = {}) {
  const props = {
    items: [position],
    selectedId: 1n,
    onSelect: vi.fn(),
    percent: "100",
    onPercentChange: vi.fn(),
    quote: {
      position,
      percent: 1_000_000_000_000n,
      assets: 2_000_000n,
      executable: false,
      closeOnly: false,
      reason: "insufficientFreeCapital" as const
    },
    quotePending: false,
    error: false,
    connected: true,
    loading: false,
    hasMore: false,
    loadingMore: false,
    onLoadMore: vi.fn(),
    onWithdraw: vi.fn(),
    disabled: false,
    busy: false,
    decimals: 6,
    symbol: "USDC",
    ...overrides
  };
  render(<EarnNftPanel {...props} />);
  return props;
}
it("uses exact protocol percentage units", () => {
  expect(parseWithdrawalPercent("100")).toBe(1_000_000_000_000n);
  expect(parseWithdrawalPercent("0.0000000001")).toBe(1n);
  expect(parseWithdrawalPercent("0")).toBeUndefined();
  expect(parseWithdrawalPercent("100.0001")).toBeUndefined();
});
it("uses the executable max percentage rather than the NFT count or total capital", () => {
  const p = mount();
  expect(screen.getByRole("button", { name: "earn.nft.withdraw" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "earn.actions.balance.useMax" }));
  expect(p.onPercentChange).toHaveBeenCalledWith("50");
});
it("permits closing a mature zero-value NFT only when the SDK quote permits it", () => {
  const empty = { ...position, assets: 0n, maxPercent: 1_000_000_000_000n, maxAssets: 0n };
  const p = mount({
    items: [empty],
    quote: {
      position: empty,
      percent: 1_000_000_000_000n,
      assets: 0n,
      executable: true,
      closeOnly: true
    }
  });
  const button = screen.getByRole("button", { name: "earn.nft.close" });
  expect(button).not.toBeDisabled();
  fireEvent.click(button);
  expect(p.onWithdraw).toHaveBeenCalledOnce();
});
it.each(["coolingDown", "unbookedResult", "unavailable"] as const)(
  "shows %s and blocks a stale ready quote while reading fails",
  (status) => {
    const p = { ...position, status };
    mount({
      items: [p],
      quote: {
        position: p,
        percent: 1n,
        assets: 0n,
        executable: false,
        closeOnly: false,
        reason: status
      }
    });
    expect(screen.getAllByText(`earn.nft.status.${status}`).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "earn.nft.withdraw" })).toBeDisabled();
  }
);
