import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { DiceTable } from "./dice-table";

type Props = React.ComponentProps<typeof DiceTable>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    direction: "under",
    line: 50,
    houseEdgeBps: 200,
    houseEdgeRate: "2%",
    locked: false,
    phase: "ready",
    outcome: null,
    revealing: false,
    decimals: 6,
    symbol: "USDC",
    onDirectionChange: vi.fn(),
    onLineChange: vi.fn(),
    onRolling: vi.fn(),
    onLanded: vi.fn(),
    ...overrides
  };
}

function renderTable(overrides: Partial<Props> = {}) {
  const p = props(overrides);
  const view = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DiceTable {...p} />
    </NextIntlClientProvider>
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <DiceTable {...p} {...next} />
      </NextIntlClientProvider>
    );
  return { ...view, props: p, rerender };
}

const outcome = (rolls: Array<[number, boolean]>, playerOwed: bigint, stake: bigint) =>
  ({
    kind: "dice",
    direction: "under",
    target: 50,
    rolls: rolls.map(([value, won]) => ({ value, won })),
    payoutGross: playerOwed,
    payoutNet: playerOwed,
    refundAmount: 0n,
    feeOnPayout: 0n,
    playerOwed,
    netResult: playerOwed - stake
  }) as Props["outcome"];

describe("DiceTable", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prints the odds, the line and both betting spots on the felt", () => {
    const { props: p } = renderTable();
    expect(screen.getByText("50%")).toBeDefined();
    expect(screen.getByText("Roll under")).toBeDefined();
    expect(screen.getByText("1 to 50")).toBeDefined();
    expect(screen.getByText("51 to 100")).toBeDefined();
    expect(screen.getByText(/Pays 100 ÷ the winning numbers, less a 2% house edge/)).toBeDefined();
    expect(screen.getByText("Drag the line, then pick a side.")).toBeDefined();
    const line = screen.getByRole("slider", { name: "Line" });
    expect(line.getAttribute("aria-valuetext")).toBe(
      "Win on 1 to 50. 50% chance, pays 1.96 times the stake."
    );
    fireEvent.change(line, { target: { value: "30" } });
    expect(p.onLineChange).toHaveBeenCalledWith(30);
    fireEvent.click(screen.getByRole("radio", { name: /Roll over/ }));
    expect(p.onDirectionChange).toHaveBeenCalledWith("over");
  });

  it("keeps the line and the side fixed while a bet is open", () => {
    renderTable({ locked: true, phase: "waiting_vrf" });
    expect(screen.getByRole("slider", { name: "Line" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: /Roll over/ }).matches(":disabled")).toBe(true);
    expect(
      screen.getByText("Waiting for the random number. The ball rolls until it arrives.")
    ).toBeDefined();
  });

  it("stops the ball on the roll, then pays a net win on the felt", () => {
    const { props: p, rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      outcome: outcome([[23, true]], 1_960_000n, 1_000_000n),
      revealing: true
    });
    expect(p.onRolling).toHaveBeenCalled();
    expect(p.onLanded).toHaveBeenCalled();
    expect(screen.getByText("Rolled 23.")).toBeDefined();
    expect(document.querySelector("[data-landed]")?.textContent).toBe("23");
    expect(document.querySelector(".table-pay-glow")?.textContent).toBe("+0.96USDC");
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(2);
  });

  it("pays nothing for a loss or a payout below the stake", async () => {
    const { rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    rerender({
      phase: "revealing",
      revealing: true,
      outcome: outcome(
        [
          [12, true],
          [80, false],
          [77, false]
        ],
        1_960_000n,
        3_000_000n
      )
    });
    // Each later round follows a short pause.
    expect(await screen.findByText("Rolled 12, 80, and 77. 1 of 3 won.")).toBeDefined();
    expect(document.querySelector(".table-pay-glow")).toBeNull();
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });

  it("keeps sound off until it is turned on, and remembers the choice", () => {
    renderTable();
    const sound = screen.getByRole("button", { name: "Sound off" });
    expect(sound.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(sound);
    expect(screen.getByRole("button", { name: "Sound on" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(window.localStorage.getItem("agf-table-sound")).toBe("on");
  });
});
