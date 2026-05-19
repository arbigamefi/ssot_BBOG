import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoinTossStage } from "./coin-toss/stage";
import { DiceStage } from "./dice/stage";
import { KenoStage } from "./keno/stage";
import { PlinkoStage } from "./plinko/stage";
import { SlotsStage } from "./slots/stage";
import { BaccaratStage } from "./baccarat/stage";
import { SicBoStage } from "./sic-bo/stage";

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
      "casino.room.selection.keno.spotsLabel": "/ 10 Spots",
      "casino.room.selection.keno.autoPick": "Auto Pick",
      "casino.room.selection.keno.clear": "Clear",
      "casino.room.selection.keno.empty": "No spots selected. Click the grid to pick numbers.",
      "casino.room.selection.baccarat.player": "Player",
      "casino.room.selection.baccarat.banker": "Banker",
      "casino.room.selection.baccarat.tie": "Tie",
      "casino.room.selection.sicBo.kinds.small": "Small",
      "casino.room.selection.sicBo.kinds.big": "Big",
      "casino.room.selection.sicBo.kinds.anyTriple": "Any triple",
      "casino.room.selection.sicBo.kinds.specificTriple": "Specific triple",
      "casino.room.selection.sicBo.kinds.total": "Exact total",
      "casino.room.selection.sicBo.kinds.specificDouble": "Specific double",
      "casino.room.selection.sicBo.kinds.singleFace": "Single face",
      "casino.room.selection.plinko.low": "Low",
      "casino.room.selection.plinko.medium": "Medium",
      "casino.room.selection.plinko.high": "High",
      "casino.room.selection.plinko.riskProfile": "Risk Profile",
      "casino.room.stage.coin.awaitingSelection": "Awaiting Toss Selection",
      "casino.room.stage.coin.selected": `${values?.side} SELECTED`,
      "casino.room.stage.coin.waitingVrf": "Waiting for VRF Oracle...",
      "casino.room.stage.plinko.dropZone": "Set risk and drop",
      "casino.room.stage.plinko.waitingVrf": "Waiting for VRF Oracle...",
      "casino.room.stage.plinko.slot": `Slot ${values?.slot}`,
      "casino.room.stage.plinko.risk": `Risk: ${values?.risk}`,
      "casino.room.stage.slots.ready": "Match 3 symbols to win",
      "casino.room.stage.slots.spinning": "Waiting for VRF Oracle...",
      "casino.room.stage.slots.result": values?.symbols ?? "",
      "casino.room.stage.slots.classic": "Classic profile",
      "casino.room.stage.baccarat.ready": "Bet player, banker, or tie",
      "casino.room.stage.baccarat.dealing": "Waiting for VRF Oracle...",
      "casino.room.stage.baccarat.result": `${values?.side} wins`,
      "casino.room.stage.baccarat.selected": `Selected: ${values?.side}`,
      "casino.room.stage.sicBo.ready": "Choose a Sic Bo table bet",
      "casino.room.stage.sicBo.rolling": "Waiting for VRF Oracle...",
      "casino.room.stage.sicBo.opened": `Dice opened: ${values?.dice}`,
      "casino.room.stage.sicBo.total": "Total",
      "casino.room.stage.sicBo.triple": "Triple",
      "casino.room.stage.sicBo.result": "Result",
      "casino.room.result.outcomes.win.label": "Won bet",
      "casino.room.result.outcomes.loss.label": "Lost bet",
      "casino.room.selection.slots.yes": "Yes",
      "casino.room.selection.slots.no": "No",
      "casino.room.selection.slots.symbols.0": "Cherry",
      "casino.room.selection.slots.symbols.1": "Lemon",
      "casino.room.selection.slots.symbols.2": "Bell",
      "casino.room.selection.slots.symbols.3": "Diamond",
      "casino.room.selection.slots.symbols.4": "Crown",
      "casino.room.selection.slots.symbols.5": "Star",
      "casino.room.selection.slots.symbols.6": "Bar",
      "casino.room.selection.slots.symbols.7": "Seven"
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
    const onSideChange = vi.fn();
    const { rerender } = render(
      <CoinTossStage
        isPending={false}
        showResult={false}
        resultNum={null}
        coinSide="HEADS"
        onSideChange={onSideChange}
      />
    );
    expect(screen.getByText("HEADS SELECTED")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /TAILS/i }));
    expect(onSideChange).toHaveBeenCalledWith("TAILS");

    rerender(
      <CoinTossStage
        isPending
        showResult={false}
        resultNum={null}
        coinSide="TAILS"
        onSideChange={onSideChange}
      />
    );
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

    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith([]);
    expect(onResetResult).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText("Auto Pick"));
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([]));
    expect(onChange.mock.calls.at(-1)?.[0]).toHaveLength(10);
  });

  it("renders Plinko stage risk and highlighted result slot", () => {
    const onRiskChange = vi.fn();
    const { rerender } = render(
      <PlinkoStage
        isPending={false}
        showResult={false}
        risk="high"
        buckets={[]}
        onRiskChange={onRiskChange}
      />
    );

    expect(screen.getAllByText("Risk: High").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Low" }));
    expect(onRiskChange).toHaveBeenCalledWith("low");

    rerender(
      <PlinkoStage
        isPending={false}
        showResult
        risk="high"
        buckets={[8]}
        onRiskChange={onRiskChange}
      />
    );

    expect(screen.getByText("Slot 8")).toBeDefined();
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
  });

  it("renders Slots stage with revealed symbols", () => {
    render(<SlotsStage isPending={false} showResult symbols={[0, 7, 7]} />);

    expect(screen.getByText("Cherry / Seven / Seven")).toBeDefined();
    expect(screen.getByText("Classic profile")).toBeDefined();
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
  });

  it("renders Baccarat stage with opened cards and totals", () => {
    const onSideChange = vi.fn();
    render(
      <BaccaratStage
        isPending={false}
        showResult
        selectedSide="player"
        onSideChange={onSideChange}
        outcome={{
          kind: "baccarat",
          side: "player",
          payoutGross: 2_241_400n,
          payoutNet: 2_196_572n,
          refundAmount: 0n,
          feeOnPayout: 44_828n,
          playerOwed: 2_196_572n,
          netResult: 1_196_572n,
          rolls: [
            {
              playerCards: [5, 4],
              bankerCards: [8, 0],
              playerTotal: 9,
              bankerTotal: 8,
              outcome: "player",
              factorBps: 22414,
              won: true
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Player wins")).toBeDefined();
    expect(screen.getByText("Selected: Player")).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Banker/i }));
    expect(onSideChange).toHaveBeenCalledWith("banker");
  });

  it("renders Sic Bo stage with opened dice and total", () => {
    const onBetChange = vi.fn();
    render(
      <SicBoStage
        isPending={false}
        showResult
        betKind="total"
        betValue={9}
        onBetChange={onBetChange}
        outcome={{
          kind: "sic-bo",
          betKind: "total",
          betValue: 9,
          payoutGross: 8_640_000n,
          payoutNet: 8_467_200n,
          refundAmount: 0n,
          feeOnPayout: 172_800n,
          playerOwed: 8_467_200n,
          netResult: 7_467_200n,
          rolls: [
            {
              dice: [2, 3, 4],
              total: 9,
              triple: false,
              faceCount: 0,
              factorBps: 86_400,
              won: true
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Dice opened: 2 / 3 / 4")).toBeDefined();
    expect(screen.getByText("Exact total 9")).toBeDefined();
    expect(screen.getByText("Won bet")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "12" }));
    expect(onBetChange).toHaveBeenCalledWith("total", 12);
  });
});
