import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BankrollPerformancePanel } from "./BankrollPerformancePanel";

// jsdom does not implement PointerEvent; the chart's hover handler is a
// PointerEvent listener (for touch support). Polyfill a minimal version that
// carries clientX so fireEvent.pointerMove reaches React's onPointerMove.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent !== "function") {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: MouseEventInit = {}) {
      super(type, params);
    }
  }
  (globalThis as { PointerEvent?: unknown }).PointerEvent = PointerEventPolyfill;
}

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

// Toggle the durable index between "has data" and "unavailable" per test.
let statsUnavailable = false;
const useCasinoTimeseriesMock = vi.fn();
const defaultPoints = [
  { date: "2026-05-28", turnover: "50000000", payout: "58800000", payoutGross: "60000000" },
  { date: "2026-05-29", turnover: "50000000", payout: "38220000", payoutGross: "39000000" }
];
let indexedPoints = defaultPoints;

vi.mock("../casino/useCasinoStats", () => ({
  useCasinoTimeseries: (args: unknown) => {
    useCasinoTimeseriesMock(args);
    return {
      data: statsUnavailable
        ? {
            source: "unavailable",
            asset: { address: "0xasset", decimals: 6, symbol: "USDC" },
            points: []
          }
        : {
            source: "postgres",
            asset: { address: "0xasset", decimals: 6, symbol: "USDC" },
            points: indexedPoints
          }
    };
  }
}));

const TRANSLATIONS: Record<string, string> = {
  "earn.performance.title": "Vault performance",
  "earn.performance.bestEffort": "Indexed · best-effort",
  "earn.performance.onChain": "On-chain verified",
  "earn.performance.lifetimeOnChain": "Lifetime · on-chain verified",
  "earn.performance.housePnl": "Gross gaming revenue",
  "earn.performance.hold": "Realized hold",
  "earn.performance.velocity": "Velocity",
  "earn.performance.grossAnnualized": "Gross annualized estimate",
  "earn.performance.wagered": "Total wagered",
  "earn.performance.payout": "Total payout",
  "earn.performance.bets": "Bets",
  "earn.performance.players": "Players",
  "earn.performance.activityTrend": "Daily vault activity",
  "earn.performance.equityTitle": "Cumulative gross gaming revenue",
  "earn.performance.peak": "Peak",
  "earn.performance.trough": "Trough",
  "earn.performance.maxDrawdown": "Max drawdown",
  "earn.performance.pnlTrend": "Daily gross gaming revenue",
  "earn.performance.volumeTrend": "Daily volume",
  "earn.performance.sharePriceReference": "Share price",
  "earn.performance.pending": "On-chain performance is not available yet.",
  "earn.performance.empty": "No vault activity yet on this chain.",
  "earn.performance.windowLabel": "Time range",
  "earn.performance.windows.d90": "90d",
  "earn.performance.windows.d1": "24h",
  "earn.performance.windows.d7": "7d",
  "earn.performance.windows.d30": "30d",
  "earn.performance.note": "Gross gaming revenue from indexed bets."
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => TRANSLATIONS[key] ?? key
}));

describe("BankrollPerformancePanel", () => {
  const chainPerformance = {
    totalTurnover: 100_000_000n,
    totalPayoutGross: 99_000_000n,
    totalBetsHeld: 1_200n
  } as any;

  beforeEach(() => {
    statsUnavailable = false;
    indexedPoints = defaultPoints;
    useCasinoTimeseriesMock.mockClear();
  });
  afterEach(() => cleanup());

  it("derives lifetime house P&L and realized hold from on-chain Bank performance", () => {
    render(
      <BankrollPerformancePanel
        assetDecimals={6}
        assetSymbol="USDC"
        chainPerformance={chainPerformance}
        sharePrice={1_012_300n}
        vaultAssets={1000000000n}
      />
    );
    // turnover 100 − payout 99 = 1 USDC house revenue; the same figure is also
    // the equity-curve peak, so it legitimately appears more than once.
    expect(screen.getAllByText("1 USDC").length).toBeGreaterThan(0); // House P&L headline + peak
    expect(screen.getByText("1.00%")).toBeDefined(); // realized hold
    expect(screen.getByText("0.10x")).toBeDefined(); // turnover / vault assets
    expect(screen.getByText("100 USDC")).toBeDefined(); // total wagered
    expect(screen.getByText("99 USDC")).toBeDefined(); // total payout
    expect(screen.getByText("1,200")).toBeDefined(); // total held bets
    // Equity chart: cumulative trajectory with peak/trough + the chain-read
    // share price surfaced as an honest stat (not an overlay on the data).
    expect(screen.getByText("Cumulative gross gaming revenue")).toBeDefined();
    expect(screen.getByText("Peak")).toBeDefined();
    expect(screen.getByText("Trough")).toBeDefined();
    // Share price is now a last-value tag on the chart (sharePriceReference),
    // not a duplicated bottom stat. 1_012_300 @ 6dp → 1.0123 USDC.
    expect(screen.getByText("Share price")).toBeDefined();
    expect(screen.getByText("1.0123 USDC")).toBeDefined();
    // Lifetime on-chain headline and indexed chart labels are distinct.
    expect(screen.getByText("Lifetime · on-chain verified")).toBeDefined();
    expect(screen.getAllByText("Indexed · best-effort").length).toBeGreaterThan(0);
  });

  it("offers a 24h/7d/30d/90d time-range selector defaulting to 30d", () => {
    render(
      <BankrollPerformancePanel
        assetDecimals={6}
        assetSymbol="USDC"
        chainPerformance={chainPerformance}
        vaultAssets={1000000000n}
      />
    );
    expect(screen.getByRole("tab", { name: "30d", selected: true })).toBeDefined();
    expect(useCasinoTimeseriesMock).toHaveBeenLastCalledWith({
      asset: undefined,
      enabled: true,
      days: 30
    });
    for (const name of ["24h", "7d", "90d"]) {
      expect(screen.getByRole("tab", { name })).toBeDefined();
    }
    fireEvent.click(screen.getByRole("tab", { name: "7d" }));
    expect(screen.getByRole("tab", { name: "7d", selected: true })).toBeDefined();
    expect(useCasinoTimeseriesMock).toHaveBeenLastCalledWith({
      asset: undefined,
      days: 7,
      enabled: true
    });
    fireEvent.click(screen.getByRole("tab", { name: "90d" }));
    expect(screen.getByRole("tab", { name: "90d", selected: true })).toBeDefined();
    expect(useCasinoTimeseriesMock).toHaveBeenLastCalledWith({
      asset: undefined,
      days: 90,
      enabled: true
    });
    expect(screen.queryByRole("tab", { name: "All" })).toBeNull();
  });

  it("uses gross awards for the chart and daily tooltip when net payouts differ", () => {
    indexedPoints = [
      { date: "2026-05-28", turnover: "100000000", payout: "196000000", payoutGross: "200000000" }
    ];
    render(
      <BankrollPerformancePanel
        assetDecimals={6}
        assetSymbol="USDC"
        chainPerformance={{ ...chainPerformance, totalPayoutGross: 200_000_000n }}
      />
    );
    // One wager: consumed stake 100, gross award 200, player receives 196.
    // Both the lifetime headline and indexed gross-revenue chart must show -100.
    expect(screen.getByText("Gross gaming revenue").parentElement).toHaveTextContent("−100 USDC");
    expect(screen.getByText("Peak").parentElement?.textContent).toBe("Peak0 USDC");
    expect(screen.getByText("Trough").parentElement).toHaveTextContent("−100 USDC");
    expect(screen.getByText("Max drawdown").parentElement).toHaveTextContent("−100 USDC");
    const captureLayer = screen.getByTestId("trend-chart-capture");
    captureLayer.getBoundingClientRect = () =>
      ({ left: 0, width: 100, top: 0, height: 100 }) as DOMRect;
    fireEvent.pointerMove(captureLayer, { clientX: 50 });
    expect(screen.getByText("Daily gross gaming revenue").parentElement).toHaveTextContent(
      "−100 USDC"
    );
    expect(screen.queryByText("−96 USDC")).toBeNull();
  });

  it.each([
    { revenue: [10, -30, 5], peak: "10 USDC", trough: "−20 USDC", drawdown: "−30 USDC" },
    { revenue: [10, 20], peak: "30 USDC", trough: "0 USDC", drawdown: "0 USDC" },
    { revenue: [-10, 5], peak: "0 USDC", trough: "−10 USDC", drawdown: "−10 USDC" }
  ])(
    "includes the initial zero in GGR statistics for $revenue",
    ({ revenue, peak, trough, drawdown }) => {
      indexedPoints = revenue.map((value, index) => ({
        date: `2026-05-${String(20 + index).padStart(2, "0")}`,
        turnover: "100000000",
        payout: String((100 - value) * 1_000_000),
        payoutGross: String((100 - value) * 1_000_000)
      }));
      render(
        <BankrollPerformancePanel
          assetDecimals={6}
          assetSymbol="USDC"
          chainPerformance={chainPerformance}
        />
      );
      expect(screen.getByText("Peak").parentElement?.textContent).toBe(`Peak${peak}`);
      expect(screen.getByText("Trough").parentElement?.textContent).toBe(`Trough${trough}`);
      expect(screen.getByText("Max drawdown").parentElement?.textContent).toBe(
        `Max drawdown${drawdown}`
      );
    }
  );

  it("scopes indexed performance reads to the selected asset", () => {
    const assetAddress = `0x${"12".repeat(20)}`;
    render(
      <BankrollPerformancePanel
        assetAddress={assetAddress}
        assetDecimals={6}
        assetSymbol="USDC"
        chainPerformance={chainPerformance}
        vaultAssets={1000000000n}
      />
    );

    expect(useCasinoTimeseriesMock).toHaveBeenLastCalledWith({
      asset: assetAddress,
      enabled: true,
      days: 30
    });
  });

  it("hides asset-level history while retaining the selected Bank totals", () => {
    render(
      <BankrollPerformancePanel
        assetDecimals={6}
        assetSymbol="USDC"
        chainPerformance={chainPerformance}
        vaultAssets={1000000000n}
        showIndexedHistory={false}
      />
    );
    expect(useCasinoTimeseriesMock).toHaveBeenLastCalledWith({
      asset: undefined,
      days: 30,
      enabled: false
    });
    expect(screen.queryByRole("tab", { name: "30d" })).toBeNull();
    expect(screen.getByText("earn.pools.historyUnavailable")).toBeDefined();
  });

  it("reveals a per-day tooltip when the equity chart is hovered", () => {
    render(
      <BankrollPerformancePanel
        assetDecimals={6}
        assetSymbol="USDC"
        chainPerformance={chainPerformance}
        vaultAssets={1000000000n}
      />
    );
    // The crosshair-capture layer is the last child of the chart frame; moving
    // the pointer over it should surface the hovered day's breakdown rows.
    const captureLayer = screen.getByTestId("trend-chart-capture") as HTMLElement;
    expect(captureLayer).toBeTruthy();
    // jsdom has no layout, so getBoundingClientRect width is 0 → guard returns
    // early and no tooltip. Stub a width so the hover index resolves.
    captureLayer.getBoundingClientRect = () =>
      ({ left: 0, width: 100, top: 0, height: 100 }) as DOMRect;
    fireEvent.pointerMove(captureLayer, { clientX: 100 });
    // Last day: turnover 50 − payout 39 = +11 daily P&L; volume row shows 50.
    expect(screen.getByText("Daily gross gaming revenue")).toBeDefined();
    expect(screen.getByText("Daily volume")).toBeDefined();
    expect(screen.getByText("11 USDC")).toBeDefined(); // hovered day's P&L
  });

  it("does not report missing chain data as zero activity", () => {
    statsUnavailable = true;
    render(<BankrollPerformancePanel assetDecimals={6} assetSymbol="USDC" />);
    expect(screen.getByText("On-chain performance is not available yet.")).toBeDefined();
    expect(screen.queryByText("No vault activity yet on this chain.")).toBeNull();
    expect(screen.queryByTitle("0 USDC")).toBeNull();
  });

  it("keeps the on-chain performance shell when the index is unavailable", () => {
    statsUnavailable = true;
    render(
      <BankrollPerformancePanel
        assetDecimals={6}
        assetSymbol="USDC"
        chainPerformance={chainPerformance}
        vaultAssets={1000000000n}
      />
    );
    expect(screen.getByText("Lifetime · on-chain verified")).toBeDefined();
    expect(screen.queryByText("Cumulative gross gaming revenue")).toBeNull();
    // The window toggle scopes only the daily chart, so it is absent when the
    // index is unavailable; the lifetime on-chain headline still stands.
    expect(screen.queryByRole("tab", { name: "30d" })).toBeNull();
    expect(screen.getByText("Gross gaming revenue")).toBeDefined();
  });
});
