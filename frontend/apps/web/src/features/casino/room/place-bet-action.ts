import type { PlaceBetInput, PlaceBetPlan } from "@ssot/ssot";
import { toast } from "@ssot/ui";

import type { GameMeta } from "./model";
import { buildGamePlaceBetInput, type GameRoomRelease } from "./place-bet";
import type { CoinSide } from "./params";

export type GamePlaceBetStepperState = {
  status: string;
  plan?: unknown;
};

export function shouldBlockGamePlaceBet(gameSlug: string, winChance: number) {
  return gameSlug !== "dice" && winChance === 0;
}

export function shouldResetGamePlaceBet(status: string) {
  return status === "reconciled" || status === "failed";
}

export async function executeGamePlaceBetAction({
  account,
  openConnectModal,
  release,
  game,
  winChance,
  state,
  reset,
  setShowResult,
  executeNow,
  planNow,
  betAmount,
  betCount,
  stopGain,
  stopLoss,
  diceTarget,
  coinSide,
  rouletteSpots,
  kenoSpots,
  messages
}: {
  account: string | undefined;
  openConnectModal: (() => void) | undefined;
  release: GameRoomRelease;
  game: GameMeta;
  winChance: number;
  state: GamePlaceBetStepperState;
  reset: () => void;
  setShowResult: (visible: boolean) => void;
  executeNow: (planOverride?: PlaceBetPlan) => Promise<void>;
  planNow: (input: PlaceBetInput) => Promise<PlaceBetPlan | undefined>;
  betAmount: number;
  betCount: number;
  stopGain: number;
  stopLoss: number;
  diceTarget: number;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  messages?: {
    rouletteSelectionRequired?: string;
    kenoSelectionRequired?: string;
    noActiveCasinoPool?: string;
    unexpectedError?: string;
  };
}) {
  if (!account) {
    openConnectModal?.();
    return;
  }

  if (shouldBlockGamePlaceBet(game.slug, winChance)) return;

  if (shouldResetGamePlaceBet(state.status)) {
    reset();
    setShowResult(false);
    return;
  }

  if (state.plan) {
    await executeNow();
    return;
  }

  try {
    const placeBet = buildGamePlaceBetInput({
      release,
      game,
      betAmount,
      betCount,
      stopGain,
      stopLoss,
      diceTarget,
      coinSide,
      rouletteSpots,
      kenoSpots,
      messages
    });
    if (!placeBet.ok) {
      toast.error(placeBet.message);
      return;
    }

    const plan = await planNow(placeBet.input);
    if (plan) {
      await executeNow(plan);
    }
  } catch (error) {
    toast.error(messages?.unexpectedError ?? "—");
    console.error(error);
  }
}
