import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { KenoTable } from "./keno-table";

type Props = React.ComponentProps<typeof KenoTable>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    picks: [1, 2, 3],
    onPicksChange: vi.fn(),
    houseEdgeBps: 200,
    houseEdgeRate: "2%",
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
      <KenoTable {...p} />
    </NextIntlClientProvider>
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <KenoTable {...p} {...next} />
      </NextIntlClientProvider>
    );
  return { ...view, props: p, rerender };
}

const outcome = (picked: number[], draws: number[][], playerOwed: bigint, stake: bigint) =>
  ({
    kind: "keno",
    pickedNumbers: picked,
    draws: draws.map((numbers) => ({
      numbers,
      hits: numbers.filter((n) => picked.includes(n)).length,
      won: true
    })),
    payoutGross: playerOwed,
    payoutNet: playerOwed,
    refundAmount: 0n,
    feeOnPayout: 0n,
    playerOwed,
    netResult: playerOwed - stake
  }) as Props["outcome"];

const spot = (n: number) => screen.getByRole("button", { name: new RegExp(`^${n}(, picked)?$`) });
const cells = (row: string) => [...document.querySelectorAll(`tr[data-row="${row}"] td`)];

describe("KenoTable", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prints what each number of hits pays and how often, after the house edge", () => {
    renderTable();
    expect(screen.getByRole("table", { name: "What each number of hits pays" })).toBeDefined();
    // Quotes round down; a pay below the stake is printed soft.
    expect(cells("pays").map((cell) => cell.textContent)).toEqual([
      "0.92×",
      "0.49×",
      "1.11×",
      "11.14×"
    ]);
    expect(cells("pays").map((cell) => cell.hasAttribute("data-under"))).toEqual([
      true,
      true,
      false,
      false
    ]);
    expect(cells("odds").map((cell) => cell.textContent)).toEqual([
      "26.4%",
      "49.5%",
      "22.0%",
      "2.2%"
    ]);
    expect(screen.getByText("Win chance").parentElement?.textContent).toContain("24.2%");
    expect(screen.getByText(/less a 2% house edge/)).toBeDefined();
    expect(document.querySelectorAll("[data-ball]")).toHaveLength(15);
  });

  it("picks numbers on the board and refuses a sixth", () => {
    const { props: p, rerender } = renderTable();
    expect(spot(2).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(spot(7));
    expect(p.onPicksChange).toHaveBeenLastCalledWith([1, 2, 3, 7]);
    fireEvent.click(spot(2));
    expect(p.onPicksChange).toHaveBeenLastCalledWith([1, 3]);

    rerender({ picks: [1, 2, 3, 4, 5] });
    const calls = vi.mocked(p.onPicksChange).mock.calls.length;
    fireEvent.click(spot(9));
    expect(vi.mocked(p.onPicksChange).mock.calls).toHaveLength(calls);
    expect(screen.getByText("Up to 5 numbers. Take one off to change.")).toBeDefined();
    expect(spot(9).hasAttribute("data-dim")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Clear picks" }));
    expect(p.onPicksChange).toHaveBeenLastCalledWith([]);
  });

  it("tumbles while the number is awaited", () => {
    renderTable({ locked: true, phase: "waiting_vrf" });
    expect(
      screen.getByText("Waiting for the random number. The balls tumble until it arrives.")
    ).toBeDefined();
    expect(spot(1).hasAttribute("disabled")).toBe(true);
  });

  it("marks the draw on the board, lights the hit column and pays a net win on the felt", () => {
    const { props: p, rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome([1, 2, 3], [[1, 2, 3, 9, 12]], 11_147_500n, 1_000_000n)
    });
    expect(p.onRolling).toHaveBeenCalled();
    expect(p.onLanded).toHaveBeenCalled();
    expect(spot(9).hasAttribute("data-drawn")).toBe(true);
    expect(spot(9).hasAttribute("data-hit")).toBe(false);
    expect(spot(2).hasAttribute("data-hit")).toBe(true);
    expect(spot(4).hasAttribute("data-drawn")).toBe(false);
    const lit = cells("pays")[3]!;
    expect(lit.hasAttribute("data-now")).toBe(true);
    expect(lit.hasAttribute("data-win")).toBe(true);
    expect(screen.getAllByText("Drew 1, 2, 3, 9, 12. 3 of 3 hit.").length).toBeGreaterThan(0);
    expect(document.querySelector(".table-pay-glow")?.textContent).toBe("+10.1475USDC");
    expect(document.querySelectorAll("i.table-chip").length).toBeGreaterThan(0);
    const history = screen.getByRole("list", { name: "Last results" });
    expect(within(history).getByText("3 of 3 hit")).toBeDefined();
  });

  it("pays nothing when the bet comes back below the stake", async () => {
    const { rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome(
        [1, 2, 3],
        [
          [1, 2, 8, 9, 10],
          [3, 7, 11, 12, 14]
        ],
        1_610_140n,
        2_000_000n
      )
    });
    // The later round follows a short pause.
    expect((await screen.findAllByText(/Hits by round: 2, 1\./)).length).toBeGreaterThan(0);
    const now = cells("pays")[1]!;
    expect(now.hasAttribute("data-now")).toBe(true);
    expect(now.hasAttribute("data-win")).toBe(false);
    expect(spot(3).hasAttribute("data-hit")).toBe(true);
    expect(spot(1).hasAttribute("data-drawn")).toBe(false);
    expect(document.querySelector(".table-pay-glow")).toBeNull();
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });
});
