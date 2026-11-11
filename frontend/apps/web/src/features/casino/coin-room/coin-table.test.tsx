import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { CoinTable } from "./coin-table";

type Props = React.ComponentProps<typeof CoinTable>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    side: "HEADS",
    onSideChange: vi.fn(),
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
      <CoinTable {...p} />
    </NextIntlClientProvider>
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <CoinTable {...p} {...next} />
      </NextIntlClientProvider>
    );
  return { ...view, props: p, rerender };
}

type Side = "HEADS" | "TAILS";
const outcome = (chosen: Side, sides: Side[], playerOwed: bigint, stake: bigint) =>
  ({
    kind: "coin-toss",
    chosen,
    rolls: sides.map((value) => ({ value, won: value === chosen })),
    payoutGross: playerOwed,
    payoutNet: playerOwed,
    refundAmount: 0n,
    feeOnPayout: 0n,
    playerOwed,
    netResult: playerOwed - stake
  }) as Props["outcome"];

const spot = (name: "Heads" | "Tails") =>
  screen.getByRole("button", { name: `${name}, pays 1.96 times the stake` });

describe("CoinTable", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prints the win chance, what a match pays and the call as two spots", () => {
    renderTable();
    expect(screen.getByText("Win chance").parentElement?.textContent).toContain("50.0%");
    expect(screen.getByText("A match pays").parentElement?.textContent).toContain("1.96×");
    expect(screen.getByText(/less a 2% house edge/)).toBeDefined();
    const call = screen.getByRole("group", { name: "Your call" });
    expect(within(call).getAllByRole("button")).toHaveLength(2);
    expect(spot("Heads").getAttribute("aria-pressed")).toBe("true");
    expect(spot("Tails").getAttribute("aria-pressed")).toBe("false");
    expect(within(spot("Tails")).getByText("Pays 1.96×")).toBeDefined();
    // The coin: two faces and a reeded edge of stacked discs.
    expect(document.querySelectorAll('.table-coin [data-c="face"]')).toHaveLength(2);
    expect(document.querySelectorAll('.table-coin [data-c="edge"]')).toHaveLength(12);
    expect(screen.getByText("No flips yet")).toBeDefined();
  });

  it("moves your chip with the call, and locks the spots while a bet is out", () => {
    const { props: p, rerender } = renderTable();
    fireEvent.click(spot("Tails"));
    expect(p.onSideChange).toHaveBeenLastCalledWith("TAILS");

    rerender({ side: "TAILS", locked: true, phase: "waiting_vrf" });
    expect(spot("Tails").getAttribute("aria-pressed")).toBe("true");
    expect(spot("Heads").hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText("Waiting for the random number. The coin spins until it arrives.")
    ).toBeDefined();
  });

  it("lands on the drawn side, lights its spot and pays a net win beside your chip", () => {
    const { props: p, rerender } = renderTable({
      side: "TAILS",
      locked: true,
      phase: "waiting_vrf"
    });
    rerender({
      side: "TAILS",
      phase: "revealing",
      revealing: true,
      outcome: outcome("TAILS", ["TAILS"], 1_960_000n, 1_000_000n)
    });
    expect(p.onRolling).toHaveBeenCalled();
    expect(p.onLanded).toHaveBeenCalled();
    // The coin lies tails up, with no frame needed to get there.
    const coin = document.querySelector<HTMLElement>('.table-coin [data-c="coin"]')!;
    expect(coin.style.transform).toContain("rotateX(180.00deg)");
    expect(spot("Tails").hasAttribute("data-up")).toBe(true);
    expect(spot("Tails").hasAttribute("data-won")).toBe(true);
    expect(spot("Heads").hasAttribute("data-up")).toBe(false);
    expect(screen.getAllByText("Landed Tails. You called Tails.").length).toBeGreaterThan(0);
    expect(document.querySelector(".table-pay-glow")?.textContent).toBe("+0.96USDC");
    expect(document.querySelectorAll("i.table-chip").length).toBe(2);
    expect(spot("Tails").querySelector("[data-pay]")).not.toBeNull();
    const history = screen.getByRole("list", { name: "Last results" });
    expect(within(history).getByText("Tails, matched your call")).toBeDefined();
  });

  it("counts the matches over many flips and pays nothing for a net loss", () => {
    const { rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome("HEADS", ["HEADS", "TAILS", "TAILS"], 1_960_000n, 3_000_000n)
    });
    expect(
      screen.getAllByText("Last flip landed Tails. 1 of 3 flips matched your call.").length
    ).toBeGreaterThan(0);
    // The side that came up last lights its spot; your chip on heads does not turn.
    expect(spot("Tails").hasAttribute("data-up")).toBe(true);
    expect(spot("Tails").hasAttribute("data-won")).toBe(false);
    expect(spot("Heads").hasAttribute("data-won")).toBe(false);
    expect(document.querySelector(".table-pay-glow")).toBeNull();
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
    const history = screen.getByRole("list", { name: "Last results" });
    expect(within(history).getAllByRole("listitem")).toHaveLength(3);
    expect(within(history).getAllByText("Tails")).toHaveLength(2);
  });
});
