import * as React from "react";

import type { DiceDirection } from "../../room/params";
import { DiceCubeDisplay } from "./dice-cube-display";
import { DiceRangeControl } from "./dice-range-control";

export function DiceStage({
  isPending,
  isRevealing,
  showResult,
  resultNum,
  diceDirection,
  diceTarget,
  multiplier,
  winChance,
  onDirectionChange,
  onTargetChange,
  onRevealComplete
}: {
  isPending: boolean;
  isRevealing?: boolean;
  showResult: boolean;
  resultNum: number | null;
  diceDirection: DiceDirection;
  diceTarget: number;
  multiplier: number;
  winChance: number;
  onDirectionChange: (direction: DiceDirection) => void;
  onTargetChange: (target: number) => void;
  onRevealComplete?: () => void;
}) {
  React.useEffect(() => {
    if (!isRevealing || resultNum == null) return;
    const timeout = window.setTimeout(() => onRevealComplete?.(), 1_600);
    return () => window.clearTimeout(timeout);
  }, [isRevealing, onRevealComplete, resultNum]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden px-6 pb-8 pt-12 md:pt-16">
      <DiceCubeDisplay
        isPending={isPending || Boolean(isRevealing)}
        showResult={showResult && !isRevealing}
        resultNum={resultNum}
      />
      <DiceRangeControl
        isPending={isPending || Boolean(isRevealing)}
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
