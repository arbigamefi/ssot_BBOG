import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import type { BaccaratHand, BaccaratOutcome } from "./baccarat-model";
import { BaccaratTable } from "./baccarat-table";

type Props = React.ComponentProps<typeof BaccaratTable>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    side: "player",
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
      <BaccaratTable {...p} />
    </NextIntlClientProvider>
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <BaccaratTable {...p} {...next} />
      </NextIntlClientProvider>
    );
  return { ...view, props: p, rerender };
}

const points = (rank: number) => (rank <= 8 ? rank + 1 : 0);
const total = (ranks: number[]) => ranks.reduce((a, r) => a + points(r), 0) % 10;

/** A hand from its cards' ranks (0 ace … 9 ten, 10 jack, 11 queen, 12 king). */
function hand(player: number[], banker: number[], side: BaccaratHand["outcome"]): BaccaratHand {
  const pt = total(player);
  const bt = total(banker);
  const outcome = pt > bt ? "player" : bt > pt ? "banker" : "tie";
  return {
    playerRanks: player,
    bankerRanks: banker,
    playerCards: player.map(points),
    bankerCards: banker.map(points),
    playerTotal: pt,
    bankerTotal: bt,
    outcome,
    factorBps: 0,
    won: outcome === side
  };
}

const outcome = (
  side: BaccaratHand["outcome"],
  hands: BaccaratHand[],
  playerOwed: bigint,
  stake: bigint
): BaccaratOutcome => ({
  kind: "baccarat",
  side,
  rolls: hands,
  payoutGross: playerOwed,
  payoutNet: playerOwed,
  refundAmount: 0n,
  feeOnPayout: 0n,
  playerOwed,
  netResult: playerOwed - stake
});

const spot = (name: string, m: string, chance: string) =>
  screen.getByRole("button", {
    name: `${name}, pays ${m} times the stake, wins ${chance}% of hands`
  });
const player = () => spot("Player", "2.19", "44.6");
const banker = () => spot("Banker", "2.13", "45.8");
const tie = () => spot("Tie", "10.26", "9.5");

const hands = () => document.querySelectorAll<HTMLElement>(".table-hand");
const cards = () => document.querySelectorAll<HTMLElement>(".table-card");

describe("BaccaratTable", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("prints the chance and pays of your side, and the three spots with what each pays", () => {
    renderTable();
    expect(screen.getByText("Win chance").parentElement?.textContent).toContain("44.6%");
    expect(screen.getByText("A win pays").parentElement?.textContent).toContain("2.19×");
    expect(screen.getByText(/A tie loses Player and Banker bets/)).toBeDefined();
    const bets = screen.getByRole("group", { name: "Your bet" });
    const names = within(bets)
      .getAllByRole("button")
      .map((b) => b.querySelector("[data-name]")?.textContent);
    expect(names).toEqual(["Player", "Tie", "Banker"]);
    expect(player().getAttribute("aria-pressed")).toBe("true");
    expect(tie().textContent).toContain("Pays 10.26×");
    expect(hands()).toHaveLength(2);
    expect(cards()).toHaveLength(0);
    // The bead road: six rows of twelve, empty.
    expect(screen.getByRole("list", { name: "Last results" }).children).toHaveLength(72);
  });

  it("moves your chip with your side, and deals four blank cards face down while it waits", () => {
    const { props: p, rerender } = renderTable();
    fireEvent.click(banker());
    expect(p.onSideChange).toHaveBeenLastCalledWith("banker");

    rerender({ side: "banker", locked: true, phase: "waiting_vrf" });
    expect(banker().getAttribute("aria-pressed")).toBe("true");
    expect(player().hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText(
        "The cards are dealt face down. They turn over when the random number arrives."
      )
    ).toBeDefined();
    expect(cards()).toHaveLength(4);
    for (const card of cards()) {
      expect(card.hasAttribute("data-up")).toBe(false);
      // Blank: no rank yet.
      expect(card.querySelector('[data-c="idx"]')).toBeNull();
    }
  });

  it("turns the hand, lights the winner and pays a net win beside your chip", () => {
    const { props: p, rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    // Player 4 + 5 (9), Banker K + 8 (8): a natural, Player wins.
    const result = outcome("player", [hand([3, 4], [12, 7], "player")], 2_196_572n, 1_000_000n);
    rerender({ phase: "revealing", revealing: true, outcome: result });
    expect(p.onRolling).toHaveBeenCalled();
    expect(p.onLanded).toHaveBeenCalled();
    // Laid out face up with no frame or timer needed (reduced motion in tests).
    expect(cards()).toHaveLength(4);
    for (const card of cards()) expect(card.hasAttribute("data-up")).toBe(true);
    const [playerHand, bankerHand] = hands();
    expect(playerHand!.querySelector('[data-c="total"]')?.textContent).toBe("9");
    expect(bankerHand!.querySelector('[data-c="total"]')?.textContent).toBe("8");
    expect(playerHand!.hasAttribute("data-win")).toBe(true);
    expect(bankerHand!.hasAttribute("data-lose")).toBe(true);
    // The king shows its letter in a frame.
    expect(bankerHand!.querySelector('[data-c="frame"]')?.textContent).toBe("K");
    expect(player().hasAttribute("data-up")).toBe(true);
    expect(player().hasAttribute("data-won")).toBe(true);
    expect(screen.getAllByText("Player wins, 9 to 8. You backed Player.").length).toBeGreaterThan(
      0
    );
    expect(document.querySelector(".table-pay-glow")?.textContent).toBe("+1.196572USDC");
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(3);
    expect(player().querySelector("[data-pay]")).not.toBeNull();
    const road = screen.getByRole("list", { name: "Last results" });
    expect(within(road).getByText("Player")).toBeDefined();
    expect(road.querySelector("[data-new]")?.getAttribute("data-side")).toBe("player");
  });

  it("draws third cards sideways, and pays nothing when a tie loses your bet", () => {
    const { rerender } = renderTable({ side: "banker", locked: true, phase: "waiting_vrf" });
    // Player 2 + 2 draws a 5 (9); Banker A + 2 draws a 6 (9): a tie, and the Banker bet loses.
    const result = outcome("banker", [hand([1, 1, 4], [0, 1, 5], "banker")], 0n, 1_000_000n);
    rerender({ side: "banker", phase: "revealing", revealing: true, outcome: result });
    expect(cards()).toHaveLength(6);
    const thirds = document.querySelectorAll('[data-c="slot"][data-k="2"] .table-card');
    expect(thirds).toHaveLength(2);
    expect(document.querySelector(".table-hands")?.hasAttribute("data-tie")).toBe(true);
    expect(tie().hasAttribute("data-up")).toBe(true);
    expect(banker().hasAttribute("data-won")).toBe(false);
    expect(screen.getAllByText("Tie, 9 to 9. You backed Banker.").length).toBeGreaterThan(0);
    expect(document.querySelector(".table-pay-glow")).toBeNull();
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });

  it("counts the hands won over many, and fills the bead road in order", () => {
    const { rerender } = renderTable({ locked: true, phase: "waiting_vrf" });
    const result = outcome(
      "player",
      [
        hand([3, 4], [12, 7], "player"),
        hand([1, 1], [7, 0], "player"),
        hand([9, 10], [9, 11], "player")
      ],
      2_196_572n,
      3_000_000n
    );
    rerender({ phase: "revealing", revealing: true, outcome: result });
    expect(screen.getAllByText("Last hand: Tie, 0 to 0. 1 of 3 hands won.").length).toBeGreaterThan(
      0
    );
    const beads = [...screen.getByRole("list", { name: "Last results" }).children]
      .map((li) => li.getAttribute("data-side"))
      .filter((s) => s !== "none");
    expect(beads).toEqual(["player", "banker", "tie"]);
    expect(document.querySelectorAll("i.table-chip")).toHaveLength(0);
  });
});
