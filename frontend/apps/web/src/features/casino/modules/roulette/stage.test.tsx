import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouletteStage } from "./stage";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "casino.room.selection.roulette.labels.firstDozen": "1st 12",
      "casino.room.selection.roulette.labels.secondDozen": "2nd 12",
      "casino.room.selection.roulette.labels.thirdDozen": "3rd 12",
      "casino.room.selection.roulette.bets": "Bets",
      "casino.room.selection.roulette.clearAll": "Clear All",
      "casino.room.selection.roulette.empty": "No bets placed. Click the felt to bet.",
      "casino.room.selection.roulette.labels.even": "EVEN",
      "casino.room.selection.roulette.labels.red": "RED",
      "casino.room.selection.roulette.labels.black": "BLACK",
      "casino.room.selection.roulette.labels.odd": "ODD",
      "casino.room.selection.roulette.labels.firstColumn": "Column 1 (2:1)",
      "casino.room.selection.roulette.labels.secondColumn": "Column 2 (2:1)",
      "casino.room.selection.roulette.labels.thirdColumn": "Column 3 (2:1)"
    })[key] ?? key
}));

describe("RouletteStage", () => {
  afterEach(() => cleanup());

  it("toggles straight and outside bets", () => {
    const onChange = vi.fn();
    render(
      <RouletteStage
        isPending={false}
        showResult={false}
        resultNum={null}
        spots={["RED"]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "0" })[0]!);
    expect(onChange).toHaveBeenCalledWith(["RED", "0"]);

    fireEvent.click(screen.getByRole("button", { name: "EVEN" }));
    expect(onChange).toHaveBeenCalledWith(["RED", "EVEN"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("toggles a column bet via the 2:1 chip", () => {
    const onChange = vi.fn();
    render(
      <RouletteStage
        isPending={false}
        showResult={false}
        resultNum={null}
        spots={[]}
        onChange={onChange}
      />
    );

    // Middle 2:1 chip (`rN=2`) sits next to the 2,5,8…35 row — column 2.
    const colTwo = screen.getByRole("button", { name: "Column 2 (2:1)" });
    fireEvent.click(colTwo);
    expect(onChange).toHaveBeenCalledWith(["col2"]);
  });

  it("highlights covered numbers when an outside bet is selected", () => {
    render(
      <RouletteStage
        isPending={false}
        showResult={false}
        resultNum={null}
        spots={["col1"]}
        onChange={vi.fn()}
      />
    );

    // Column 1 covers 1,4,7,…,34. Pick a representative number and check
    // its `aria-pressed` / class signals the covered state, not a direct
    // selection. We assert via the accent ring class added by `STATUS_RING.covered`.
    const four = screen.getByRole("button", { name: "4" });
    expect(four.className).toContain("ring-accent");
    // A number outside the column should still be idle.
    const five = screen.getByRole("button", { name: "5" });
    expect(five.className).toContain("ring-border-soft");
  });

  it("runs reveal before completing the wheel", () => {
    const onRevealComplete = vi.fn();
    vi.useFakeTimers();
    try {
      render(
        <RouletteStage
          isPending={false}
          isRevealing
          showResult
          resultNum={17}
          spots={["RED"]}
          onChange={vi.fn()}
          onRevealComplete={onRevealComplete}
        />
      );

      act(() => {
        vi.advanceTimersByTime(2_500);
      });
      expect(onRevealComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
