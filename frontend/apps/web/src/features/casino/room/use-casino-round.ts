"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { DomainBet } from "@ssot/ssot";
import type { SSOTSDK } from "@ssot/ssot/sdk";

import { usePlaceBetStepper } from "../../betting/usePlaceBetStepper";
import type { GameMeta } from "./model";
import { executeGamePlaceBetAction } from "./place-bet-action";
import type { GameRoomRelease } from "./place-bet";
import type { CoinSide, DiceDirection } from "./params";
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
  diceDirection: DiceDirection;
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
  diceDirection,
  coinSide,
  rouletteSpots,
  kenoSpots,
  onRoundStart,
  onRoundTerminal,
  onRoundReset
}: UseCasinoRoundArgs) {
  const t = useTranslations();
  const { planNow, executeNow, state, reset } = usePlaceBetStepper({
    sdkNotReady: t("casino.room.errors.sdkNotReady"),
    transactionFailed: t("casino.room.errors.transactionFailedShort"),
    reconcileFailed: t("casino.room.errors.reconcileFailed"),
    bindFailed: t("casino.room.errors.bindFailed")
  });
  const vrfQuote = useCasinoVrfQuote({
    sdk,
    betCount,
    quoteErrorMessage: t("casino.room.errors.quoteFailed")
  });
  const roundWatcher = useCasinoRoundWatcher({
    sdk,
    betId: state.betId,
    active: state.status === "reconciled",
    refundTimeoutSeconds: release?.refundTimeoutSeconds,
    onTerminal: onRoundTerminal,
    readErrorMessage: t("casino.room.errors.readRoundFailed"),
    betNotFoundErrorMessage: t("casino.room.errors.roundNotFound"),
    manualSettleErrorMessage: t("casino.room.errors.manualSettleFailed"),
    refundErrorMessage: t("casino.room.errors.refundFailed")
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

  useBetStepperFailureToast({
    status: state.status,
    error: state.error,
    fallbackMessage: t("casino.room.errors.transactionFailed")
  });
  useVrfTimeoutToast(roundPhase === "timeout_soft", t("casino.room.warnings.vrfTimeout"));

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
      diceDirection,
      coinSide,
      rouletteSpots,
      kenoSpots,
      messages: {
        rouletteSelectionRequired: t("casino.room.errors.rouletteSelectionRequired"),
        kenoSelectionRequired: t("casino.room.errors.kenoSelectionRequired"),
        noActiveCasinoPool: t("casino.room.errors.noActiveCasinoPool"),
        unexpectedError: t("casino.room.errors.unexpected")
      }
    });
  }, [
    betAmount,
    betCount,
    coinSide,
    diceDirection,
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
    t,
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
    activeBet: roundWatcher.bet,
    activeRequestId: roundWatcher.bet?.requestId,
    roundError: roundWatcher.error,
    manualSettleAvailable: roundWatcher.manualSettleAvailable,
    manualSettle: roundWatcher.manualSettle,
    manualRefundAvailable: roundWatcher.manualRefundAvailable,
    manualRefund: roundWatcher.manualRefund
  };
}
