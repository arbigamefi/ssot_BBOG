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
      "casino.room.selection.roulette.labels.odd": "ODD"
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
