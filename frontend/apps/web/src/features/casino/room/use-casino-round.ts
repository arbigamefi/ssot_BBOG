"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { DomainBet } from "@ssot/ssot";
import type { Address, SSOTSDK } from "@ssot/ssot/sdk";

import { usePlaceBetStepper } from "../../betting/usePlaceBetStepper";
import type { GameMeta } from "./model";
import { executeGamePlaceBetAction } from "./place-bet-action";
import type { GameRoomRelease } from "./place-bet";
import type { BaccaratSide, CoinSide, DiceDirection, PlinkoRisk, SicBoKind } from "./params";
import { useBetStepperFailureToast, useVrfTimeoutToast } from "./feedback";
import { useCasinoRoundWatcher, useCasinoVrfQuote, type CasinoRoundPhase } from "./casino-round";

export type UseCasinoRoundArgs = {
  sdk: SSOTSDK | undefined;
  release: (GameRoomRelease & { refundTimeoutSeconds?: number }) | undefined;
  game: GameMeta | null;
  winChance: number;
  openConnectModal: (() => void) | undefined;
  betAmount: string;
  betCount: number;
  stopGain: number;
  stopLoss: number;
  diceTarget: number;
  diceDirection: DiceDirection;
  coinSide: CoinSide;
  rouletteSpots: readonly string[];
  kenoSpots: readonly number[];
  plinkoRisk: PlinkoRisk;
  baccaratSide: BaccaratSide;
  sicBoKind: SicBoKind;
  sicBoValue: number;
  affiliate?: Address;
  /** Selected casino pool id (multi-asset). Defaults to the default pool when omitted. */
  poolId?: number;
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
  plinkoRisk,
  baccaratSide,
  sicBoKind,
  sicBoValue,
  affiliate,
  poolId,
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

  const isTransactionActive =
    state.status === "planning" || state.status === "submitting" || state.status === "mined";
  const isRoundAnimating = roundWatcher.isLive;

  useBetStepperFailureToast({
    status: state.status,
    error: state.error,
    fallbackMessage: t("casino.room.errors.transactionFailed")
  });
  useVrfTimeoutToast(roundPhase === "timeout_soft", t("casino.room.warnings.vrfTimeout"));

  const placeBet = React.useCallback(() => {
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
      onBeforeExecute: onRoundStart,
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
      messages: {
        rouletteSelectionRequired: t("casino.room.errors.rouletteSelectionRequired"),
        kenoSelectionRequired: t("casino.room.errors.kenoSelectionRequired"),
        kenoSelectionInvalid: t("casino.room.errors.kenoSelectionInvalid"),
        mainnetRiskInDisabled: t("casino.room.errors.mainnetRiskInDisabled"),
        invalidCasinoPool: t("casino.room.errors.invalidCasinoPool"),
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
    affiliate,
    baccaratSide,
    game,
    kenoSpots,
    onRoundReset,
    onRoundStart,
    openConnectModal,
    plinkoRisk,
    poolId,
    sicBoKind,
    sicBoValue,
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
    isTransactionActive,
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
