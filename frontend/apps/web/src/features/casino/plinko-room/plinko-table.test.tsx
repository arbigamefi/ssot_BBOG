import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { PlinkoTable } from "./plinko-table";

type Props = React.ComponentProps<typeof PlinkoTable>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    risk: "medium",
    onRiskChange: vi.fn(),
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
      <PlinkoTable {...p} />
    </NextIntlClientProvider>
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <PlinkoTable {...p} {...next} />
      </NextIntlClientProvider>
    );
  return { ...view, props: p, rerender };
}

type Path = Array<"L" | "R">;
const outcome = (paths: Path[], playerOwed: bigint, stake: bigint) =>
  ({
    kind: "plinko",
    risk: "medium",
    rolls: paths.map((path) => ({
      bucket: path.filter((step) => step === "R").length,
      path,
      factorBps: 0,
      won: true
    })),
    payoutGross: playerOwed,
    payoutNet: playerOwed,
    refundAmount: 0n,
    feeOnPayout: 0n,
    playerOwed,
    netResult: playerOwed - stake
  }) as Props["outcome"];

const cells = (row: string) => [...document.querySelectorAll(`tr[data-row="${row}"] td`)];
const cup = (k: number) => document.querySelector(`[data-b="cup"]:nth-of-type(${k + 1})`)!;
const all = (step: "L" | "R"): Path => Array(8).fill(step);

describe("PlinkoTable", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prints what each cup pays and how often, after the house edge", () => {
    renderTable();
    expect(
      screen.getByRole("table", { name: "What each cup pays, and how often a ball lands there" })
    ).toBeDefined();
    // Quotes round down; a pay below the stake is printed soft.
    expect(cells("pays").map((cell) => cell.textContent)).toEqual([
      "8.10×",
      "3.37×",
      "1.62×",
      "0.67×",
      "0.20×",
      "0.67×",
      "1.62×",
      "3.37×",
      "8.10×"
    ]);
    expect(cells("pays").map((cell) => cell.hasAttribute("data-under"))).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      false,
      false,
      false
    ]);
    expect(cells("odds").map((cell) => cell.textContent)).toEqual([
      "0.4%",
      "3.1%",
      "10.9%",
      "21.9%",
      "27.3%",
      "21.9%",
      "10.9%",
      "3.1%",
      "0.4%"
    ]);
    expect(screen.getByText("Win chance").parentElement?.textContent).toContain("28.9%");
    expect(screen.getByText("Outer cups").parentElement?.textContent).toContain("8.10×");
    expect(screen.getByText("Middle cup").parentElement?.textContent).toContain("0.20×");
    expect(screen.getByText(/less a 2% house edge/)).toBeDefined();
    // Eight rows of pins over nine cups, the outer pins making the triangle.
    expect(document.querySelectorAll('[data-b="cup"]')).toHaveLength(9);
    expect(document.querySelectorAll('[data-b="pin"]').length).toBeGreaterThan(36);
  });

  it("chooses the risk on paper tabs, locked while a bet is out", () => {
    const { props: p, rerender } = renderTable();
    const tab = (name: string) => screen.getByRole("button", { name: `${name} risk` });
    expect(tab("Medium").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tab("High"));
    expect(p.onRiskChange).toHaveBeenLastCalledWith("high");

    rerender({ risk: "high" });
    expect(screen.getByText("Outer cups").parentElement?.textContent).toContain("24.12×");
    expect(cells("pays")[0]!.textContent).toBe("24.1×");

    rerender({ locked: true, phase: "waiting_vrf" });
    expect(tab("Low").hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText(
        "Waiting for the random number. The ball rocks in its cradle until it arrives."
      )
    ).toBeDefined();
  });

  it("drops the ball into its cup, lights it and pays a net win on the felt", () => {
    const { props: p, rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome([all("L")], 8_105_972n, 1_000_000n)
    });
    expect(p.onRolling).toHaveBeenCalled();
    expect(p.onLanded).toHaveBeenCalled();
    const lit = cells("pays")[0]!;
    expect(lit.hasAttribute("data-now")).toBe(true);
    expect(lit.hasAttribute("data-win")).toBe(true);
    expect(cup(0).hasAttribute("data-win")).toBe(true);
    expect(
      screen.getAllByText(
        "Bounced left, left, left, left, left, left, left, left into the 8.10× cup."
      ).length
    ).toBeGreaterThan(0);
    expect(document.querySelectorAll(".plinko-path i")).toHaveLength(8);
    expect(document.querySelector(".table-pay-glow")?.textContent).toBe("+7.105972USDC");
    expect(document.querySelectorAll("i.table-chip").length).toBeGreaterThan(0);
    const history = screen.getByRole("list", { name: "Last results" });
    expect(within(history).getByText("8.10× cup")).toBeDefined();
  });

  it("counts the balls in a cup and pays nothing when the bet comes back below the stake", () => {
    const { rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    const middle: Path = ["L", "R", "L", "R", "L", "R", "L", "R"];
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome([middle, [...middle].reverse()], 404_000n, 2_000_000n)
    });
    expect(screen.getAllByText(/Cups by ball: 0\.20×, 0\.20×\./).length).toBeGreaterThan(0);
    const now = cells("pays")[4]!;
    expect(now.hasAttribute("data-now")).toBe(true);
    expect(now.hasAttribute("data-win")).toBe(false);
    expect(document.querySelectorAll('[data-b="tally"]')[4]!.textContent).toBe("×2");
    expect(document.querySelector(".table-pay-glow")).toBeNull();
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });
});
