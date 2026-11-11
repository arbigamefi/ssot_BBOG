"use client";

import * as React from "react";

/** How long each game's stage animates a result before the reveal counts as done without its callback. */
const REVEAL_DURATION_MS: Record<string, number> = {
  "sic-bo": 2_100
};

/**
 * The dice ball is on the first roll 4 s after the number arrives and on each later one 2.42 s
 * after the last (dice-room/ball-motion.ts); the roulette ball is in its first pocket 4.83 s after
 * the number and in each later one 4.38 s after the last (roulette-room/wheel-motion.ts); the slot
 * reels are on their symbols 4.99 s after the number at the latest, and each later round 3.11 s
 * after the last (slots-room/reel-motion.ts); keno's fifth ball is in the rack 4.5 s after the
 * number, and each later round's 0.65 s + 2.7 s after the last (keno-room/blower-motion.ts); the
 * first plinko ball is in its cup 3.58 s after the number and each later one 0.54 s after the last
 * (plinko-room/drop-motion.ts); the coin lies flat on its first flip 2.4 s after the number and on
 * each later one 1.45 s after the last (coin-room/flip-motion.ts); baccarat's first hand is marked
 * 5.13 s after the number at the latest, and each later one 3.82 s after the last
 * (baccarat-room/deal-motion.ts). All hold frames or not; the fallback leaves each some room.
 */
function revealDurationMs(gameSlug: string, rounds: number) {
  const later = Math.max(1, rounds) - 1;
  if (gameSlug === "dice") return 4_500 + later * 2_500;
  if (gameSlug === "roulette") return 5_400 + later * 4_400;
  if (gameSlug === "slots") return 5_500 + later * 3_400;
  if (gameSlug === "keno") return 5_000 + later * 3_800;
  if (gameSlug === "plinko") return 4_200 + later * 600;
  if (gameSlug === "coin-toss") return 2_900 + later * 1_500;
  if (gameSlug === "baccarat") return 5_500 + later * 3_900;
  return REVEAL_DURATION_MS[gameSlug] ?? 0;
}

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
    (betId: bigint, gameSlug: string, rounds = 1) => {
      clearTimer();
      const durationMs = revealDurationMs(gameSlug, rounds);
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
