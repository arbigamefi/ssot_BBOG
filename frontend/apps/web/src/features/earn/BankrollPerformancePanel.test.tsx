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
const useCasinoStatsMock = vi.fn();
const useCasinoTimeseriesMock = vi.fn();

vi.mock("../casino/useCasinoStats", () => ({
  useCasinoStats: (args: unknown) => {
    useCasinoStatsMock(args);
    return {
      data: statsUnavailable
        ? { source: "unavailable", asset: { address: "0xasset", decimals: 6, symbol: "USDC" } }
        : {
            source: "postgres",
            asset: { address: "0xasset", decimals: 6, symbol: "USDC" },
            stats: {
              betCount: 1200,
              settledCount: 1000,
              wonCount: 480,
              uniquePlayers: 180,
              // turnover 100, payout 99 → house revenue 1 USDC, hold 1.00%.
              turnover: "100000000",
              payout: "99000000",
              payoutGross: "0"
            }
          }
    };
  },
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
            points: [
              // Day the players won (red): payout > turnover → negative P&L.
              { date: "2026-05-28", turnover: "50000000", payout: "60000000" },
              // Day the house won (green): turnover > payout → positive P&L.
              { date: "2026-05-29", turnover: "50000000", payout: "39000000" }
            ]
          }
    };
  }
}));

const TRANSLATIONS: Record<string, string> = {
  "earn.performance.title": "Vault performance",
  "earn.performance.bestEffort": "Indexed · best-effort",
  "earn.performance.housePnl": "House P&L",
  "earn.performance.hold": "Realized hold",
  "earn.performance.velocity": "Velocity",
  "earn.performance.grossAnnualized": "Gross annualized estimate",
  "earn.performance.wagered": "Total wagered",
  "earn.performance.payout": "Total payout",
  "earn.performance.bets": "Bets",
  "earn.performance.players": "Players",
  "earn.performance.activityTrend": "Daily vault activity",
  "earn.performance.equityTitle": "Cumulative house P&L",
  "earn.performance.peak": "Peak",
  "earn.performance.trough": "Trough",
  "earn.performance.pnlTrend": "Daily house P&L",
  "earn.performance.volumeTrend": "Daily volume",
  "earn.performance.sharePriceReference": "Share price",
  "earn.performance.empty": "No vault activity yet on this chain.",
  "earn.performance.windowLabel": "Time range",
  "earn.performance.windows.all": "All",
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
  beforeEach(() => {
    statsUnavailable = false;
    useCasinoStatsMock.mockClear();
    useCasinoTimeseriesMock.mockClear();
  });
  afterEach(() => cleanup());

  it("derives house P&L and realized hold from the indexed aggregate", () => {
    render(<BankrollPerformancePanel sharePrice={1_012_300n} vaultAssets={1000000000n} />);
    // turnover 100 − payout 99 = 1 USDC house revenue; the same figure is also
    // the equity-curve peak, so it legitimately appears more than once.
    expect(screen.getAllByText("1 USDC").length).toBeGreaterThan(0); // House P&L headline + peak
    expect(screen.getByText("1.00%")).toBeDefined(); // realized hold
    expect(screen.getByText("0.10x")).toBeDefined(); // turnover / vault assets
    expect(screen.getByText("1.21%")).toBeDefined(); // gross annualized estimate over 30d
    expect(screen.getByText("100 USDC")).toBeDefined(); // total wagered
    expect(screen.getByText("99 USDC")).toBeDefined(); // total payout
    expect(screen.getByText("180")).toBeDefined(); // players
    // Equity chart: cumulative trajectory with peak/trough + the chain-read
    // share price surfaced as an honest stat (not an overlay on the data).
    expect(screen.getByText("Cumulative house P&L")).toBeDefined();
    expect(screen.getByText("Peak")).toBeDefined();
    expect(screen.getByText("Trough")).toBeDefined();
    // Share price is now a last-value tag on the chart (sharePriceReference),
    // not a duplicated bottom stat. 1_012_300 @ 6dp → 1.0123 USDC.
    expect(screen.getByText("Share price")).toBeDefined();
    expect(screen.getByText("1.0123 USDC")).toBeDefined();
    // Best-effort honesty label is present (never claims "verifiable").
    expect(screen.getAllByText("Indexed · best-effort").length).toBeGreaterThan(0);
  });

  it("offers a 24h/7d/30d/All time-range selector defaulting to 30d", () => {
    render(<BankrollPerformancePanel vaultAssets={1000000000n} />);
    expect(screen.getByRole("tab", { name: "30d", selected: true })).toBeDefined();
    expect(useCasinoStatsMock).toHaveBeenLastCalledWith({ windowDays: 30 });
    expect(useCasinoTimeseriesMock).toHaveBeenLastCalledWith({ days: 30 });
    for (const name of ["24h", "7d", "All"]) {
      expect(screen.getByRole("tab", { name })).toBeDefined();
    }
    fireEvent.click(screen.getByRole("tab", { name: "7d" }));
    expect(screen.getByRole("tab", { name: "7d", selected: true })).toBeDefined();
    expect(useCasinoStatsMock).toHaveBeenLastCalledWith({ windowDays: 7 });
  });

  it("reveals a per-day tooltip when the equity chart is hovered", () => {
    render(<BankrollPerformancePanel vaultAssets={1000000000n} />);
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
    expect(screen.getByText("Daily house P&L")).toBeDefined();
    expect(screen.getByText("Daily volume")).toBeDefined();
    expect(screen.getByText("11 USDC")).toBeDefined(); // hovered day's P&L
  });

  it("shows an empty state but keeps the toggle when the index is unavailable", () => {
    statsUnavailable = true;
    render(<BankrollPerformancePanel vaultAssets={1000000000n} />);
    expect(screen.getByText("No vault activity yet on this chain.")).toBeDefined();
    // Toggle stays mounted so a provider can switch back to a populated scope.
    expect(screen.getByRole("tab", { name: "30d" })).toBeDefined();
  });
});
