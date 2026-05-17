import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoinTossStage } from "./coin-toss/stage";
import { DiceStage } from "./dice/stage";
import { KenoStage } from "./keno/stage";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    ({
      "casino.room.selection.dice.rollUnder": "Roll Under",
      "casino.room.selection.dice.rollOver": "Roll Over",
      "casino.room.selection.dice.targetRange": "Target Range",
      "casino.room.selection.dice.targetAria": "Dice target",
      "casino.room.selection.dice.target": "Target",
      "casino.room.selection.dice.multiplier": "Mult",
      "casino.room.selection.dice.winChance": "Win",
      "casino.room.selection.coin.heads": "HEADS",
      "casino.room.selection.coin.tails": "TAILS",
      "casino.room.stage.coin.awaitingSelection": "Awaiting Toss Selection",
      "casino.room.stage.coin.selected": `${values?.side} SELECTED`,
      "casino.room.stage.coin.waitingVrf": "Waiting for VRF Oracle..."
    })[key] ?? key
}));

describe("game room stages", () => {
  afterEach(() => cleanup());

  it("renders Dice stage controls and emits target changes", () => {
    const onDirectionChange = vi.fn();
    const onTargetChange = vi.fn();
    render(
      <DiceStage
        isPending={false}
        showResult={false}
        resultNum={null}
        diceDirection="under"
        diceTarget={50}
        multiplier={1.98}
        winChance={50}
        onDirectionChange={onDirectionChange}
        onTargetChange={onTargetChange}
      />
    );

    fireEvent.click(screen.getByText("Roll Over"));
    expect(onDirectionChange).toHaveBeenCalledWith("over");

    fireEvent.change(screen.getByRole("slider"), { target: { value: "60" } });
    expect(onTargetChange).toHaveBeenCalledWith(60);
  });

  it("renders Coin Toss stage selected side and pending state", () => {
    const { rerender } = render(
      <CoinTossStage isPending={false} showResult={false} resultNum={null} coinSide="HEADS" />
    );
    expect(screen.getByText("HEADS SELECTED")).toBeDefined();

    rerender(<CoinTossStage isPending showResult={false} resultNum={null} coinSide="TAILS" />);
    expect(screen.getByText("Waiting for VRF Oracle...")).toBeDefined();
  });

  it("renders Keno stage and toggles spots", () => {
    const onChange = vi.fn();
    const onResetResult = vi.fn();
    render(
      <KenoStage
        isPending={false}
        showResult={false}
        spots={[1, 2]}
        animatingSpots={[]}
        resultDrawn={[]}
        onChange={onChange}
        onResetResult={onResetResult}
      />
    );

    fireEvent.click(screen.getByText("3"));
    expect(onChange).toHaveBeenCalledWith([1, 2, 3]);
    expect(onResetResult).toHaveBeenCalledTimes(1);
  });
});
