import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoinSideSelector, KenoSelectionPanel, RouletteSelectionPanel } from "./controls";

vi.mock("@ssot/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ssot/ui")>();
  return {
    ...actual,
    cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "casino.room.selection.roulette.bets": "Bets",
      "casino.room.selection.roulette.clearAll": "Clear All",
      "casino.room.selection.roulette.empty": "No bets placed. Click the felt to bet.",
      "casino.room.selection.coin.selectFace": "Select Face",
      "casino.room.selection.coin.heads": "Heads",
      "casino.room.selection.coin.tails": "Tails",
      "casino.room.selection.keno.spotsLabel": "/ 10 Spots",
      "casino.room.selection.keno.autoPick": "Auto Pick",
      "casino.room.selection.keno.clear": "Clear",
      "casino.room.selection.keno.empty": "No spots selected. Click the grid to pick numbers."
    })[key] ?? key
}));

describe("game room controls", () => {
  afterEach(() => cleanup());

  it("renders Roulette selections and clears them", () => {
    const onClear = vi.fn();
    render(<RouletteSelectionPanel spots={["RED", "17"]} onClear={onClear} />);

    expect(screen.getByText("RED")).toBeDefined();
    expect(screen.getByText("17")).toBeDefined();
    fireEvent.click(screen.getByText("Clear All"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders the Roulette empty state", () => {
    render(<RouletteSelectionPanel spots={[]} onClear={vi.fn()} />);
    expect(screen.getByText("No bets placed. Click the felt to bet.")).toBeDefined();
  });

  it("changes coin side through the selector", () => {
    const onChange = vi.fn();
    render(<CoinSideSelector coinSide="HEADS" onChange={onChange} />);

    fireEvent.click(screen.getByText("Tails"));
    expect(onChange).toHaveBeenCalledWith("TAILS");
  });

  it("renders sorted Keno spots and clears the result", () => {
    const onChange = vi.fn();
    const onResetResult = vi.fn();
    render(
      <KenoSelectionPanel spots={[9, 1, 5]} onChange={onChange} onResetResult={onResetResult} />
    );

    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();

    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith([]);
    expect(onResetResult).toHaveBeenCalledTimes(1);
  });

  it("auto-picks ten Keno spots", () => {
    const onChange = vi.fn();
    const onResetResult = vi.fn();
    render(<KenoSelectionPanel spots={[]} onChange={onChange} onResetResult={onResetResult} />);

    fireEvent.click(screen.getByText("Auto Pick"));
    expect(onChange.mock.calls[0]?.[0]).toHaveLength(10);
    expect(new Set(onChange.mock.calls[0]?.[0]).size).toBe(10);
    expect(onResetResult).toHaveBeenCalledTimes(1);
  });
});
