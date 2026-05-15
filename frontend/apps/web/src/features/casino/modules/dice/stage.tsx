import * as React from "react";

import { DiceCubeDisplay } from "../../room/dice-cube-display";
import { DiceRangeControl } from "../../room/dice-range-control";
import type { DiceDirection } from "../../room/params";

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
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--brand)/0.05)_0%,transparent_60%)]" />
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
