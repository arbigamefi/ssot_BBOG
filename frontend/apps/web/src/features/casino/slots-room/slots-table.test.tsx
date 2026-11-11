import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { SlotsTable } from "./slots-table";

type Props = React.ComponentProps<typeof SlotsTable>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    houseEdgeBps: 200,
    houseEdgeRate: "2%",
    returnRate: "98%",
    locked: false,
    phase: "ready",
    outcome: null,
    revealing: false,
    decimals: 6,
    symbol: "USDC",
    onRolling: vi.fn(),
    onLanded: vi.fn(),
    ...overrides
  };
}

function renderTable(overrides: Partial<Props> = {}) {
  const p = props(overrides);
  const view = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SlotsTable {...p} />
    </NextIntlClientProvider>
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <SlotsTable {...p} {...next} />
      </NextIntlClientProvider>
    );
  return { ...view, props: p, rerender };
}

type Roll = [symbols: [number, number, number], multiplier: 0 | 2 | 16 | 64];

const outcome = (rolls: Roll[], playerOwed: bigint, stake: bigint) =>
  ({
    kind: "slots",
    profile: "classic",
    rolls: rolls.map(([symbols, multiplier]) => ({
      symbols,
      multiplier,
      won: multiplier > 0,
      jackpot: multiplier === 64
    })),
    payoutGross: playerOwed,
    payoutNet: playerOwed,
    refundAmount: 0n,
    feeOnPayout: 0n,
    playerOwed,
    netResult: playerOwed - stake
  }) as Props["outcome"];

const row = (name: string) => screen.getByText(name).closest("tr")!;

describe("SlotsTable", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prints the pay table with each line's odds and pays, after the house edge", () => {
    renderTable();
    expect(screen.getByRole("table", { name: "What each line pays" })).toBeDefined();
    expect(within(row("Three sevens")).getAllByText("1 in 512").length).toBeGreaterThan(0);
    expect(row("Three sevens").textContent).toContain("62.72×");
    expect(within(row("Any other three alike")).getAllByText("7 in 512").length).toBeGreaterThan(0);
    expect(row("Any other three alike").textContent).toContain("15.68×");
    expect(within(row("Any two alike")).getAllByText("168 in 512").length).toBeGreaterThan(0);
    expect(row("Any two alike").textContent).toContain("1.96×");
    expect(
      screen.getByText(/less a 2% house edge: on average 98% of stakes come back/)
    ).toBeDefined();
    expect(screen.getByText("Set your stake on the slip, then place the bet.")).toBeDefined();
    expect(document.querySelectorAll(".table-reel")).toHaveLength(3);
  });

  it("spins while the number is awaited", () => {
    renderTable({ locked: true, phase: "waiting_vrf" });
    expect(
      screen.getByText("Waiting for the random number. The reels spin until it arrives.")
    ).toBeDefined();
  });

  it("stops on three sevens, lights the line and pays a net win on the felt", () => {
    const { props: p, rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome([[[7, 7, 7], 64]], 62_720_000n, 1_000_000n)
    });
    expect(p.onRolling).toHaveBeenCalled();
    expect(p.onLanded).toHaveBeenCalled();
    expect(screen.getAllByText("Came up seven, seven, seven.").length).toBeGreaterThan(0);
    expect(row("Three sevens").hasAttribute("data-hit")).toBe(true);
    expect(document.querySelectorAll(".table-reel[data-lit]")).toHaveLength(3);
    expect(document.querySelector(".table-pay-glow")?.textContent).toBe("+61.72USDC");
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(7);
  });

  it("lights only the two reels of a pair", () => {
    const { rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome([[[2, 5, 2], 2]], 1_960_000n, 1_000_000n)
    });
    expect(row("Any two alike").hasAttribute("data-hit")).toBe(true);
    const lit = [...document.querySelectorAll(".table-reel")].map((reel) =>
      reel.hasAttribute("data-lit")
    );
    expect(lit).toEqual([true, false, true]);
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(2);
  });

  it("pays nothing when the bet comes back below the stake", async () => {
    const { rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome(
        [
          [[0, 1, 2], 0],
          [[3, 3, 4], 2],
          [[5, 6, 7], 0]
        ],
        1_960_000n,
        3_000_000n
      )
    });
    // Each later round follows a short pause.
    expect(await screen.findByText(/1 of 3 paid\./)).toBeDefined();
    // The history reads each spin's symbols; the latest first.
    const spins = [...document.querySelectorAll("li .slot-trio")].map(
      (trio) => trio.querySelector(".sr-only")?.textContent
    );
    expect(spins).toEqual(["star, bar, seven", "diamond, diamond, crown", "cherry, lemon, bell"]);
    expect(document.querySelector(".table-pay-glow")).toBeNull();
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });
});
