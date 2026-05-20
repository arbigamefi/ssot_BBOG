import type { PlaceBetInput, PlaceBetPlan } from "@ssot/ssot";
import type { Address } from "@ssot/ssot/sdk";
import { toast } from "@ssot/ui";

import type { GameMeta } from "./model";
import { buildGamePlaceBetInput, type GameRoomRelease } from "./place-bet";
import type { BaccaratSide, CoinSide, PlinkoRisk, SicBoKind } from "./params";

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
  onBeforeExecute,
  betAmount,
  betCount,
  stopGain,
  stopLoss,
  diceTarget,
  diceDirection,
  coinSide,
  rouletteSpots,
  kenoSpots,
  plinkoRisk,
  baccaratSide,
  sicBoKind,
  sicBoValue,
  affiliate,
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
  onBeforeExecute?: () => void;
  betAmount: number;
  betCount: number;
  stopGain: number;
  stopLoss: number;
  diceTarget: number;
  diceDirection: "under" | "over";
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide?: BaccaratSide;
  sicBoKind?: SicBoKind;
  sicBoValue?: number;
  affiliate?: Address;
  messages?: {
    rouletteSelectionRequired?: string;
    kenoSelectionRequired?: string;
    kenoSelectionInvalid?: string;
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
    onBeforeExecute?.();
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
      diceDirection,
      coinSide,
      rouletteSpots,
      kenoSpots,
      plinkoRisk,
      baccaratSide,
      sicBoKind,
      sicBoValue,
      affiliate,
      messages
    });
    if (!placeBet.ok) {
      toast.error(placeBet.message);
      return;
    }

    const plan = await planNow(placeBet.input);
    if (plan) {
      onBeforeExecute?.();
      await executeNow(plan);
    }
  } catch (error) {
    toast.error(messages?.unexpectedError ?? "—");
    console.error(error);
  }
}
