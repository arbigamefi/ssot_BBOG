import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrendChart, formatDayLabel, type TrendChartPoint } from "./TrendChart";

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

const value = (v: bigint) => `${v} u`;
const date = (d: string) => formatDayLabel(d, "en");

function hover(clientX: number) {
  const capture = screen.getByTestId("trend-chart-capture") as HTMLElement;
  expect(capture).toBeTruthy();
  // jsdom has no layout, so getBoundingClientRect width is 0 → the guard returns
  // early. Stub a width so the hovered index resolves.
  capture.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 100 }) as DOMRect;
  fireEvent.pointerMove(capture, { clientX });
  return capture;
}

describe("TrendChart", () => {
  afterEach(() => cleanup());

  it("renders nothing when there are no points", () => {
    const { container } = render(
      <TrendChart points={[]} ariaLabel="Trend" formatValue={value} formatDate={date} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("draws a labeled SVG figure with peak/trough axis labels and date ends", () => {
    const points: TrendChartPoint[] = [
      { date: "2026-05-28", value: 10n },
      { date: "2026-05-29", value: 40n },
      { date: "2026-05-30", value: 25n }
    ];
    render(<TrendChart points={points} ariaLabel="Volume" formatValue={value} formatDate={date} />);
    expect(screen.getByRole("img", { name: "Volume" })).toBeDefined();
    // Peak (40) and trough (10) surface as left-axis labels.
    expect(screen.getByText("40 u")).toBeDefined();
    expect(screen.getByText("10 u")).toBeDefined();
    // Date axis prints first + last day.
    expect(screen.getByText(formatDayLabel("2026-05-28", "en"))).toBeDefined();
    expect(screen.getByText(formatDayLabel("2026-05-30", "en"))).toBeDefined();
  });

  it("reveals custom tooltip rows for the hovered day", () => {
    const points: TrendChartPoint[] = [
      { date: "2026-05-28", value: 10n },
      { date: "2026-05-30", value: 25n }
    ];
    render(
      <TrendChart
        points={points}
        ariaLabel="Volume"
        formatValue={value}
        formatDate={date}
        tooltipRows={(point) => [{ label: "Turnover", value: `${point.value} USDC` }]}
      />
    );
    hover(100); // far right → last point (value 25)
    expect(screen.getByText("Turnover")).toBeDefined();
    expect(screen.getByText("25 USDC")).toBeDefined();
    // Tooltip heading is the hovered day's formatted date — it also appears as
    // the date-axis end label, so both instances are expected.
    expect(screen.getAllByText(formatDayLabel("2026-05-30", "en")).length).toBeGreaterThan(1);
  });

  it("pins a last-value tag at the curve edge and hides it while hovering", () => {
    const points: TrendChartPoint[] = [
      { date: "2026-05-28", value: 10n },
      { date: "2026-05-30", value: 25n }
    ];
    render(
      <TrendChart
        points={points}
        ariaLabel="Equity"
        formatValue={value}
        formatDate={date}
        lastValueTag={{ label: "Share price", value: "1.0123 USDC" }}
      />
    );
    expect(screen.getByText("Share price")).toBeDefined();
    expect(screen.getByText("1.0123 USDC")).toBeDefined();
    // While hovering the tag yields to the crosshair tooltip.
    hover(100);
    expect(screen.queryByText("Share price")).toBeNull();
  });
});
