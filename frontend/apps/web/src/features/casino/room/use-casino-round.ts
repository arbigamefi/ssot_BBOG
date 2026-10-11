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
import type { PoolAvailability } from "./hooks";
import { useBetStepperFailureToast, useVrfTimeoutToast } from "./feedback";
import { useCasinoRoundWatcher, useCasinoVrfQuote, type CasinoRoundPhase } from "./casino-round";

const NO_BET_IDS: readonly bigint[] = [];

export type UseCasinoRoundArgs = {
  sdk: SSOTSDK | undefined;
  release: GameRoomRelease | undefined;
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
  poolAvailability?: PoolAvailability;
  /** The player's open bets in this pool, named when the per-player cap blocks a bet. */
  openBets?: number;
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
  poolAvailability = "ready",
  openBets,
  onRoundStart,
  onRoundTerminal,
  onRoundReset
}: UseCasinoRoundArgs) {
  const t = useTranslations();
  const vrfQuote = useCasinoVrfQuote({
    sdk,
    gameId: game?.gameId,
    betCount,
    quoteErrorMessage: t("casino.room.errors.quoteFailed")
  });
  const intentKey = JSON.stringify([
    vrfQuote.config?.houseEdgeBps,
    release?.chainId,
    poolId,
    sdk?.account,
    game?.gameId,
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
    affiliate
  ]);
  const latestIntent = React.useRef({ sdk, intentKey });
  latestIntent.current = { sdk, intentKey };
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const submissionInFlight = React.useRef(false);
  const { planNow, executeNow, state, reset, reconcileNow, reconciling } = usePlaceBetStepper({
    sdkNotReady: t("casino.room.errors.sdkNotReady"),
    transactionFailed: t("casino.room.errors.transactionFailedShort"),
    reconcileFailed: t("casino.room.errors.reconcileFailed"),
    bindFailed: t("casino.room.errors.bindFailed")
  });
  const gameAvailability: PoolAvailability = !vrfQuote.config
    ? vrfQuote.quoteError
      ? "gameUnavailable"
      : "loading"
    : betCount < 1 || betCount > vrfQuote.config.maxBetCount
      ? "invalidCount"
      : vrfQuote.quoteError || vrfQuote.quote == null
        ? "gameUnavailable"
        : "ready";
  const availability = poolAvailability === "ready" ? gameAvailability : poolAvailability;
  const roundWatcher = useCasinoRoundWatcher({
    sdk,
    betId: state.betId,
    active: state.status === "reconciled",
    onTerminal: onRoundTerminal,
    readErrorMessage: t("casino.room.errors.readRoundFailed"),
    betNotFoundErrorMessage: t("casino.room.errors.roundNotFound"),
    manualSettleErrorMessage: t("casino.room.errors.manualSettleFailed"),
    refundErrorMessage: t("casino.room.errors.refundFailed")
  });

  // A received result that cannot be booked settles or is voided 24 hours to 7 days later (ADR-0037
  // §7). The room hands it to a notice, clears its stage (a RandomReady bet may have been revealed) and
  // stays open for new bets; the per-player cap still applies.
  const pendingScope = `${release?.chainId ?? ""}:${sdk?.account?.toLowerCase() ?? ""}`;
  const [pendingSettlement, setPendingSettlement] = React.useState<{
    scope: string;
    betIds: readonly bigint[];
  }>({ scope: pendingScope, betIds: NO_BET_IDS });
  const unbookedBetId =
    roundWatcher.phase === "result_unbooked" ? roundWatcher.bet?.betId : undefined;
  React.useEffect(() => {
    if (unbookedBetId === undefined) return;
    setPendingSettlement((current) => {
      const betIds = current.scope === pendingScope ? current.betIds : NO_BET_IDS;
      return {
        scope: pendingScope,
        betIds: betIds.includes(unbookedBetId) ? betIds : [...betIds, unbookedBetId]
      };
    });
    reset();
    onRoundReset();
  }, [onRoundReset, pendingScope, reset, unbookedBetId]);
  const pendingSettlementBetIds =
    pendingSettlement.scope === pendingScope ? pendingSettlement.betIds : NO_BET_IDS;

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
    fallbackMessage: t("casino.room.errors.transactionFailed"),
    translate: t
  });
  useVrfTimeoutToast(roundPhase === "timeout_soft", t("casino.room.warnings.vrfTimeout"));

  const placeBet = React.useCallback(async () => {
    if (!release || !game || submissionInFlight.current) return;
    submissionInFlight.current = true;
    try {
      await executeGamePlaceBetAction({
        poolAvailability: availability,
        maxHouseEdgeBps: vrfQuote.config?.houseEdgeBps,
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
        executeNow: (plan) =>
          executeNow(
            plan,
            () =>
              mounted.current &&
              latestIntent.current.sdk === sdk &&
              latestIntent.current.intentKey === intentKey
          ),
        isCurrent: () =>
          mounted.current &&
          latestIntent.current.sdk === sdk &&
          latestIntent.current.intentKey === intentKey,
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
          unexpectedError: t("casino.room.feedback.unknown"),
          contextChanged: t("casino.room.feedback.contextChanged"),
          houseEdgeUnavailable: t("casino.room.poolStatus.gameUnavailable"),
          poolUnavailable: t(
            `casino.room.poolStatus.${availability === "ready" ? "unavailable" : availability}`,
            {
              symbol: release.pools?.find((pool) => pool.poolId === poolId)?.symbol ?? "",
              count: openBets ?? 0
            }
          )
        }
      });
    } finally {
      submissionInFlight.current = false;
    }
  }, [
    intentKey,
    vrfQuote.config?.houseEdgeBps,
    sdk,
    availability,
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
    openBets,
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
    checkTransaction:
      state.result?.placeBetTx.txHash &&
      state.result.placeBetTx.txHash !== "0x0" &&
      (state.error?.details?.action === "PLACE_BET" || state.status === "mined")
        ? reconcileNow
        : undefined,
    checkingTransaction: reconciling,
    placeBet,
    roundPhase,
    isTransactionActive,
    isRoundAnimating,
    houseEdgeBps: vrfQuote.config?.houseEdgeBps,
    /** Disabled for good: the room shows a closed state and takes no bet (ADR-0037 §6). */
    gameDisabled: vrfQuote.config?.disabled === true,
    maxBetCount: vrfQuote.config?.maxBetCount,
    callbackGasLimit: vrfQuote.config?.callbackGasLimit,
    availability,
    refreshGame: vrfQuote.refresh,
    vrfQuote: vrfQuote.quote,
    vrfQuoteError: vrfQuote.quoteError,
    activeBetId: state.betId,
    activeBet: roundWatcher.bet,
    /** Bets this session handed to a notice: their result arrived but never settled. */
    pendingSettlementBetIds,
    activeRequestId: roundWatcher.bet?.requestId,
    roundError: roundWatcher.error,
    manualSettleAvailable: roundWatcher.manualSettleAvailable,
    manualSettle: roundWatcher.manualSettle,
    manualRefundAvailable: roundWatcher.manualRefundAvailable,
    manualRefund: roundWatcher.manualRefund
  };
}
