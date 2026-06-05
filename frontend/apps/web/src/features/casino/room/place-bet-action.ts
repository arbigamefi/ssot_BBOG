import type { PlaceBetInput, PlaceBetPlan } from "@ssot/ssot";
import type { Address } from "@ssot/ssot/sdk";
import { toast } from "@ssot/ui";

import { getAppChain } from "../../../app-shell/chain-registry";
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

export function isCasinoRiskInEnabledForChain(chainId: number) {
  // Testnets (and unknown chains) always allow risk-in; any mainnet requires the
  // explicit opt-in flag. Driven by the chain registry rather than a hardcoded
  // Base-mainnet id, so it covers every mainnet (Base, Arbitrum, …) uniformly.
  if (getAppChain(chainId)?.environment !== "mainnet") return true;
  return process.env.NEXT_PUBLIC_CASINO_RISK_IN_ENABLED === "true";
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
  poolId,
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
  /** Selected casino pool id (multi-asset). Defaults to the default pool when omitted. */
  poolId?: number;
  messages?: {
    rouletteSelectionRequired?: string;
    kenoSelectionRequired?: string;
    kenoSelectionInvalid?: string;
    mainnetRiskInDisabled?: string;
    noActiveCasinoPool?: string;
    invalidCasinoPool?: string;
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

  if (!isCasinoRiskInEnabledForChain(release.chainId)) {
    toast.error(messages?.mainnetRiskInDisabled ?? "Casino mainnet risk-in is disabled.");
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
      poolId,
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
