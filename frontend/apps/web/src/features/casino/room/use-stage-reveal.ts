"use client";

import * as React from "react";

/** How long each game's stage animates a result before the reveal counts as done without its callback. */
const REVEAL_DURATION_MS: Record<string, number> = {
  dice: 2_000,
  "coin-toss": 1_600,
  roulette: 3_000,
  plinko: 6_000,
  slots: 3_400,
  keno: 4_000,
  baccarat: 4_200,
  "sic-bo": 2_100
};

export type StageReveal = { betId: bigint; phase: "revealing" | "revealed" };

/**
 * The stage's reveal of a terminal bet: "revealing" while the game's animation runs, then "revealed". The
 * animation's completion callback or the per-game fallback timer ends it, whichever comes first.
 */
export function useStageReveal() {
  const [stageReveal, setStageReveal] = React.useState<StageReveal | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>();

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const startStageReveal = React.useCallback(
    (betId: bigint, gameSlug: string) => {
      clearTimer();
      const durationMs = REVEAL_DURATION_MS[gameSlug] ?? 0;
      if (durationMs === 0) {
        setStageReveal({ betId, phase: "revealed" });
        return;
      }
      setStageReveal({ betId, phase: "revealing" });
      timerRef.current = setTimeout(() => {
        setStageReveal((current) =>
          current?.betId === betId ? { betId, phase: "revealed" } : current
        );
        timerRef.current = undefined;
      }, durationMs);
    },
    [clearTimer]
  );

  const completeStageReveal = React.useCallback(() => {
    clearTimer();
    setStageReveal((current) =>
      current?.phase === "revealing" ? { betId: current.betId, phase: "revealed" } : current
    );
  }, [clearTimer]);

  /** Ends any reveal at once: a new round, a reset or a closed result. */
  const clearStageReveal = React.useCallback(() => {
    clearTimer();
    setStageReveal(null);
  }, [clearTimer]);

  React.useEffect(() => clearTimer, [clearTimer]);

  return { stageReveal, startStageReveal, completeStageReveal, clearStageReveal };
}
