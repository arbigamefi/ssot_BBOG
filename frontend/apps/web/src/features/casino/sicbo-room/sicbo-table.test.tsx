import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { factorOf, type Area, type SicBoOutcome } from "./sicbo-model";
import { SicBoTable } from "./sicbo-table";

type Props = React.ComponentProps<typeof SicBoTable>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    area: { kind: "small", value: 0 },
    onAreaChange: vi.fn(),
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
      <SicBoTable {...p} />
    </NextIntlClientProvider>
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <SicBoTable {...p} {...next} />
      </NextIntlClientProvider>
    );
  return { ...view, props: p, rerender };
}

type Throw = [number, number, number];

const outcome = (area: Area, throws: Throw[], playerOwed: bigint, stake: bigint): SicBoOutcome => ({
  kind: "sic-bo",
  betKind: area.kind,
  betValue: area.value,
  rolls: throws.map((dice) => {
    const factorBps = factorOf(area, dice);
    return {
      dice,
      total: dice[0] + dice[1] + dice[2],
      triple: dice[0] === dice[1] && dice[1] === dice[2],
      faceCount: dice.filter((n) => n === area.value).length,
      factorBps,
      won: factorBps > 0
    };
  }),
  payoutGross: playerOwed,
  payoutNet: playerOwed,
  refundAmount: 0n,
  feeOnPayout: 0n,
  playerOwed,
  netResult: playerOwed - stake
});

const cell = (kind: string, value: number) =>
  document.querySelector<HTMLButtonElement>(
    `.table-area[data-kind="${kind}"][data-value="${value}"]`
  )!;
const lit = () =>
  [...document.querySelectorAll<HTMLElement>(".table-area[data-hit]")].map(
    (b) => `${b.dataset.kind}:${b.dataset.value}`
  );
const BIG: Area = { kind: "big", value: 0 };

describe("SicBoTable", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prints the layout in four rows, each area with its pays, and your bet beside the dish", () => {
    renderTable();
    const layout = screen.getByRole("group", { name: "The layout: pick one area" });
    const rows = layout.querySelectorAll("[data-row]");
    expect([...rows].map((row) => row.children.length)).toEqual([3, 12, 14, 6]);
    expect(within(layout).getAllByRole("button")).toHaveLength(35);
    const small = screen.getByRole("button", {
      name: "Small, pays 2.01 times the stake, wins 48.6% of rolls"
    });
    expect(small.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", {
        name: "Triple 4s, pays 211.68 times the stake, wins 0.46% of rolls"
      })
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: "Total 4, pays 70.56 times the stake, wins 1.4% of rolls"
      })
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: "Single 3, pays 1.96 times the stake for each die that shows it, wins 42.1% of rolls"
      })
    ).toBeDefined();
    expect(screen.getByText("Win chance").parentElement?.textContent).toContain("48.6%");
    expect(screen.getByText("A win pays").parentElement?.textContent).toContain("2.01×");
    expect(screen.getByText(/1.96× for one, 3.92× for two, 5.88× for three/)).toBeDefined();
    expect(document.querySelectorAll('.table-dish [data-c="die"]')).toHaveLength(3);
    expect(screen.getByText("No rolls yet")).toBeDefined();
  });

  it("shows a single face's pays per die, and moves your chip to the area you pick", () => {
    const { props: p, rerender } = renderTable({ area: { kind: "singleFace", value: 5 } });
    expect(screen.getByText("A win pays").parentElement?.textContent).toContain("1.96× a die");
    fireEvent.click(cell("total", 9));
    expect(p.onAreaChange).toHaveBeenLastCalledWith({ kind: "total", value: 9 });
    rerender({ area: { kind: "total", value: 9 } });
    expect(cell("total", 9).getAttribute("aria-pressed")).toBe("true");
    expect(cell("total", 9).querySelector("[data-pay]")).not.toBeNull();
    expect(cell("singleFace", 5).querySelector("[data-pay]")).toBeNull();
  });

  it("puts the dome down while the number is awaited, and locks the layout", () => {
    const { rerender } = renderTable();
    const dome = document.querySelector('.table-dish [data-c="dome"]')!;
    expect(dome.hasAttribute("data-open")).toBe(true);
    rerender({ locked: true, phase: "waiting_vrf" });
    expect(dome.hasAttribute("data-open")).toBe(false);
    expect(cell("big", 0).hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText("The dome is shaking. The dice settle when the random number arrives.")
    ).toBeDefined();
  });

  it("lifts the dome on the dice, lights every true area and pays a net win on your chip", () => {
    const { props: p, rerender } = renderTable({
      area: BIG,
      locked: true,
      phase: "waiting_vrf"
    });
    const result = outcome(BIG, [[3, 5, 6]], 2_015_958n, 1_000_000n);
    rerender({ area: BIG, phase: "revealing", revealing: true, outcome: result });
    expect(p.onRolling).toHaveBeenCalled();
    expect(p.onLanded).toHaveBeenCalled();
    expect(document.querySelector('[data-c="dome"]')?.hasAttribute("data-open")).toBe(true);
    expect(lit().sort()).toEqual(
      ["big:0", "total:14", "singleFace:3", "singleFace:5", "singleFace:6"].sort()
    );
    expect(cell("big", 0).hasAttribute("data-won")).toBe(true);
    expect(screen.getAllByText("Total 14. You bet Big.").length).toBeGreaterThan(0);
    expect(document.querySelector(".table-pay-glow")?.textContent).toBe("+1.015958USDC");
    expect(document.querySelectorAll("i.table-chip").length).toBeGreaterThan(0);
    const history = screen.getByRole("list", { name: "Last results" });
    expect(within(history).getByText("Rolled 3, 5, 6, paid")).toBeDefined();
  });

  it("lights a triple's areas but pays nothing when Big loses on it", () => {
    const { rerender } = renderTable({ area: BIG, locked: true, phase: "waiting_vrf" });
    const result = outcome(BIG, [[5, 5, 5]], 0n, 1_000_000n);
    rerender({ area: BIG, phase: "revealing", revealing: true, outcome: result });
    expect(lit().sort()).toEqual(
      ["anyTriple:0", "specificTriple:5", "specificDouble:5", "total:15", "singleFace:5"].sort()
    );
    expect(cell("big", 0).hasAttribute("data-hit")).toBe(false);
    expect(cell("big", 0).hasAttribute("data-won")).toBe(false);
    expect(document.querySelector(".table-pay-glow")).toBeNull();
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });

  it("counts the rolls paid over many, and keeps each roll in the history, newest first", () => {
    const { rerender } = renderTable({ area: BIG, locked: true, phase: "waiting_vrf" });
    const result = outcome(
      BIG,
      [
        [1, 2, 3],
        [4, 6, 6],
        [2, 2, 2]
      ],
      2_015_958n,
      3_000_000n
    );
    rerender({ area: BIG, phase: "revealing", revealing: true, outcome: result });
    expect(screen.getAllByText("Last roll, total 6. 1 of 3 rolls paid.").length).toBeGreaterThan(0);
    const tiles = [...screen.getByRole("list", { name: "Last results" }).children].map(
      (li) => li.textContent
    );
    expect(tiles).toEqual(["Rolled 2, 2, 2", "Rolled 4, 6, 6, paid", "Rolled 1, 2, 3"]);
    // A net loss over the bet: nothing paid on the table.
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });
});
