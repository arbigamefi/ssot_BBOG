"use client";

import * as React from "react";
import type { DomainBet } from "@ssot/ssot";
import type { SSOTSDK } from "@ssot/ssot/sdk";

import { usePlaceBetStepper } from "../../betting/usePlaceBetStepper";
import type { GameMeta } from "./model";
import { executeGamePlaceBetAction } from "./place-bet-action";
import type { GameRoomRelease } from "./place-bet";
import type { CoinSide } from "./params";
import { useBetStepperFailureToast, useVrfTimeoutToast } from "./feedback";
import { useCasinoRoundWatcher, useCasinoVrfQuote, type CasinoRoundPhase } from "./casino-round";

export type UseCasinoRoundArgs = {
  sdk: SSOTSDK | undefined;
  release: (GameRoomRelease & { refundTimeoutSeconds?: number }) | undefined;
  game: GameMeta | null;
  winChance: number;
  openConnectModal: (() => void) | undefined;
  betAmount: number;
  betCount: number;
  stopGain: number;
  stopLoss: number;
  diceTarget: number;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  onRoundStart: () => void;
  onRoundTerminal: (bet: DomainBet) => void;
  onRoundReset: () => void;
};

export function useCasinoRound({
  sdk,
  release,
  game,
  winChance,
  openConnectModal,
  betAmount,
  betCount,
  stopGain,
  stopLoss,
  diceTarget,
  coinSide,
  rouletteSpots,
  kenoSpots,
  onRoundStart,
  onRoundTerminal,
  onRoundReset
}: UseCasinoRoundArgs) {
  const { planNow, executeNow, state, reset } = usePlaceBetStepper();
  const vrfQuote = useCasinoVrfQuote({ sdk, betCount });
  const roundWatcher = useCasinoRoundWatcher({
    sdk,
    betId: state.betId,
    active: state.status === "reconciled",
    refundTimeoutSeconds: release?.refundTimeoutSeconds,
    onTerminal: onRoundTerminal
  });

  const roundPhase = React.useMemo<CasinoRoundPhase>(() => {
    if (state.status === "planning") return "loading_quote";
    if (state.status === "submitting" || state.status === "mined") return "placing";
    if (roundWatcher.phase !== "idle") return roundWatcher.phase;
    return vrfQuote.phase === "loading_quote" ? "loading_quote" : "ready";
  }, [roundWatcher.phase, state.status, vrfQuote.phase]);

  const isRoundAnimating =
    state.status === "planning" ||
    state.status === "submitting" ||
    state.status === "mined" ||
    roundWatcher.isLive;

  useBetStepperFailureToast({ status: state.status, error: state.error });
  useVrfTimeoutToast(roundPhase === "timeout_soft");

  const placeBet = React.useCallback(() => {
    onRoundStart();
    if (!release || !game) return;
    return executeGamePlaceBetAction({
      account: sdk?.account,
      openConnectModal,
      release,
      game,
      winChance,
      state,
      reset,
      setShowResult: (visible) => {
        if (!visible) onRoundReset();
      },
      executeNow,
      planNow,
      betAmount,
      betCount,
      stopGain,
      stopLoss,
      diceTarget,
      coinSide,
      rouletteSpots,
      kenoSpots
    });
  }, [
    betAmount,
    betCount,
    coinSide,
    diceTarget,
    executeNow,
    game,
    kenoSpots,
    onRoundReset,
    onRoundStart,
    openConnectModal,
    planNow,
    release,
    reset,
    rouletteSpots,
    sdk?.account,
    state,
    stopGain,
    stopLoss,
    winChance
  ]);

  return {
    state,
    reset,
    placeBet,
    roundPhase,
    isRoundAnimating,
    vrfQuote: vrfQuote.quote,
    vrfQuoteError: vrfQuote.quoteError,
    activeBetId: state.betId,
    activeRequestId: roundWatcher.bet?.requestId,
    roundError: roundWatcher.error,
    manualSettleAvailable: roundWatcher.manualSettleAvailable,
    manualSettle: roundWatcher.manualSettle,
    manualRefundAvailable: roundWatcher.manualRefundAvailable,
    manualRefund: roundWatcher.manualRefund
  };
}
