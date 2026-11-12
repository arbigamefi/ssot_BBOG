import type { CasinoRoundPhase } from "./casino-round";

/**
 * Where the room's bet stands, for the table and the slip: the round's phase, or revealing while
 * the table shows a result.
 */
export type PlaceBetButtonPhase = CasinoRoundPhase | "revealing";
export type StageRevealState = { betId: bigint; phase: "revealing" | "revealed" } | null;

export function derivePlaceBetButtonPhase({
  roundPhase,
  activeBetState,
  activeBetId,
  stageReveal,
  revealedBetId
}: {
  roundPhase: CasinoRoundPhase;
  activeBetState?: string;
  activeBetId?: bigint;
  stageReveal?: StageRevealState;
  revealedBetId?: bigint | null;
}): PlaceBetButtonPhase {
  const activeBetAwaitingReveal =
    activeBetState === "randomReady" &&
    activeBetId != null &&
    stageReveal?.phase !== "revealed" &&
    revealedBetId !== activeBetId;

  return stageReveal?.phase === "revealing" || activeBetAwaitingReveal ? "revealing" : roundPhase;
}
