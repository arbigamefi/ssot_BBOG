import * as React from "react";

import type { DiceDirection } from "../../room/params";
import { DiceCubeDisplay } from "./dice-cube-display";
import { DiceRangeControl } from "./dice-range-control";

export function DiceStage({
  isPending,
  showResult,
  resultNum,
  diceDirection,
  diceTarget,
  multiplier,
  winChance,
  onDirectionChange,
  onTargetChange
}: {
  isPending: boolean;
  showResult: boolean;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  multiplier: number;
  winChance: number;
  onDirectionChange: (direction: DiceDirection) => void;
  onTargetChange: (target: number) => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-8 pt-12 md:pt-16">
      <DiceCubeDisplay isPending={isPending} showResult={showResult} resultNum={resultNum} />
      <DiceRangeControl
        isPending={isPending}
        diceDirection={diceDirection}
        diceTarget={diceTarget}
        multiplier={multiplier}
        winChance={winChance}
        onDirectionChange={onDirectionChange}
        onTargetChange={onTargetChange}
      />
    </div>
  );
}
