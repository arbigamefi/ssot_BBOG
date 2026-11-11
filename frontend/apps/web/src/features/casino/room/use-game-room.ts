"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DomainBet } from "@ssot/ssot";

import { requestWalletConnect } from "../../../app-shell/wallet-connect-events";
import { useCasinoPoolAssetSelection } from "../../assets/useCasinoPoolAssetSelection";
import { useRecentBets } from "../../betting/useRecentBets";
import { useReferralAffiliate } from "../../referral/useReferralAffiliate";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTRuntime } from "../../../ssot/runtime";
import { useSSOTSDK } from "../../../ssot/sdk";
import { useGameWalletBalance, usePlayerOpenHolds, usePoolSnapshot } from "./hooks";
import { toGameMeta } from "./model";
import { readCasinoOutcome, type CasinoOutcome } from "./outcome";
import {
  calculateGameWinChance,
  type BaccaratSide,
  type CoinSide,
  type PlinkoRisk,
  type ReserveSelection,
  type SicBoKind
} from "./params";
import { clampDiceTarget, type DiceDirection } from "./payouts";
import { derivePlaceBetButtonPhase } from "./place-bet-button";
import { deriveGameRoomLimits, deriveGameRoomPricing } from "./presentation";
import {
  buildCasinoRoundResult,
  useGameResolutionEffect,
  type CasinoRoundResult,
  type GameHistoryEntry
} from "./resolution";
import { useCasinoRound } from "./use-casino-round";
import { useStageReveal } from "./use-stage-reveal";

/** Splits the room's wallet-transaction lock from the stage's waiting animation. */
export function getCasinoRoomPendingStates({
  isLocalPending,
  isTransactionActive,
  isOutcomeTracking,
  hasStageReveal,
  hasCasinoOutcome,
  isResultVisible = false
}: {
  isLocalPending: boolean;
  isTransactionActive: boolean;
  isOutcomeTracking: boolean;
  hasStageReveal: boolean;
  hasCasinoOutcome: boolean;
  isResultVisible?: boolean;
}) {
  const isRoundInputLocked =
    isLocalPending || isTransactionActive || isOutcomeTracking || hasStageReveal || isResultVisible;

  return {
    isBetPanelPending: isRoundInputLocked,
    isStagePending: isOutcomeTracking && !hasStageReveal && !hasCasinoOutcome
  };
}

/**
 * One game room's controller: the selection, the round (quote, plan, place, watch, settle or
 * refund), the pool and its limits, the outcome read and the stage reveal. A room renders from it
 * and never changes the bet flow.
 */
export function useGameRoom(slug: string) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { release, readOnlyReason, chainId } = useRelease();
  const { sdk, wrongNetwork, switchNetwork } = useSSOTSDK();
  const game = React.useMemo(() => {
    const found = release?.gamesMeta?.find((item: any) => item.slug === slug);
    return found ? toGameMeta(found) : null;
  }, [release?.gamesMeta, slug]);
  const assetSelection = useCasinoPoolAssetSelection();
  const casinoPoolAsset = assetSelection.selectedContext;

  const recentBetsQuery = useRecentBets({
    enabled: Boolean(game?.gameId),
    errorMessage: t("app.errors.recentBetsFailed"),
    gameId: game?.gameId,
    limit: 12
  });
  const refetchRecentBets = recentBetsQuery.refetch;
  const recentBets = recentBetsQuery.data ?? [];
  const recentBetsStatus: "loading" | "error" | "ready" = recentBetsQuery.isPending
    ? "loading"
    : recentBetsQuery.isError
      ? "error"
      : "ready";

  const [betAmount, setBetAmount] = React.useState("1");
  const [isPending, setIsPending] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
  const [terminalBet, setTerminalBet] = React.useState<DomainBet | null>(null);
  const [resultProof, setResultProof] = React.useState<CasinoRoundResult | null>(null);
  const [casinoOutcome, setCasinoOutcome] = React.useState<CasinoOutcome | null>(null);
  const { stageReveal, startStageReveal, completeStageReveal, clearStageReveal } = useStageReveal();
  const revealedBetIdRef = React.useRef<bigint | null>(null);
  const outcomeReadKeyRef = React.useRef<string | null>(null);

  React.useEffect(
    () => () => {
      outcomeReadKeyRef.current = null;
    },
    []
  );

  const [diceTarget, setDiceTarget] = React.useState<number>(50);
  const [diceDirection, setDiceDirection] = React.useState<DiceDirection>("under");
  const [coinSide, setCoinSide] = React.useState<CoinSide>("HEADS");
  // The roulette table opens with a chip on red, ready to play.
  const [rouletteSpots, setRouletteSpots] = React.useState<string[]>(["RED"]);
  const [kenoSpots, setKenoSpots] = React.useState<number[]>([]);
  const [plinkoRisk, setPlinkoRisk] = React.useState<PlinkoRisk>("medium");
  const [baccaratSide, setBaccaratSide] = React.useState<BaccaratSide>("player");
  const [sicBoKind, setSicBoKind] = React.useState<SicBoKind>("small");
  const [sicBoValue, setSicBoValue] = React.useState<number>(0);

  const [resultNum, setResultNum] = React.useState<number | null>(null);
  const [plinkoBuckets, setPlinkoBuckets] = React.useState<number[]>([]);

  const [gameHistory] = React.useState<GameHistoryEntry[]>([]);
  const [betCount, setBetCount] = React.useState<number>(1);
  const [stopGain, setStopGain] = React.useState<number>(0);
  const [stopLoss, setStopLoss] = React.useState<number>(0);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [walletBalanceRefreshKey, refreshWalletBalance] = React.useReducer((value) => value + 1, 0);

  const walletBalance = useGameWalletBalance({
    sdk,
    asset: casinoPoolAsset?.asset,
    refreshKey: walletBalanceRefreshKey
  });
  const poolRead = usePoolSnapshot({ sdk, poolId: assetSelection.poolId });
  const poolSnapshot = poolRead.snapshot;
  // ADR-0037 §5: at most two open bets per player and pool, checked before any wallet prompt.
  const openHolds = usePlayerOpenHolds({
    sdk,
    poolId: assetSelection.poolId,
    account: sdk?.account
  });
  const refreshOpenHolds = openHolds.refresh;
  const poolAvailability =
    poolRead.status === "ready" && openHolds.atLimit ? "playerLimit" : poolRead.status;
  const openBets = openHolds.holds ? Number(openHolds.holds.open) : undefined;
  const referrerParam = searchParams.get("ref");
  const referralAffiliate = useReferralAffiliate({
    referrer: referrerParam,
    account: sdk?.account
  });

  const openConnectModal = React.useCallback(() => requestWalletConnect(), []);
  const { db } = useSSOTRuntime();
  const handleRoundTerminal = React.useCallback(
    (bet: DomainBet) => {
      setIsPending(false);
      setTerminalBet(bet);
      refreshWalletBalance();
      poolRead.refresh();
      refreshOpenHolds();
      void refetchRecentBets?.();
    },
    [refetchRecentBets, refreshWalletBalance, poolRead.refresh, refreshOpenHolds]
  );
  const handleRoundStart = React.useCallback(() => {
    clearStageReveal();
    revealedBetIdRef.current = null;
    outcomeReadKeyRef.current = null;
    setTerminalBet(null);
    setResultProof(null);
    setCasinoOutcome(null);
    setPlinkoBuckets([]);
  }, [clearStageReveal]);
  const handleRoundReset = React.useCallback(() => {
    clearStageReveal();
    revealedBetIdRef.current = null;
    outcomeReadKeyRef.current = null;
    setShowResult(false);
    setTerminalBet(null);
    setResultProof(null);
    setCasinoOutcome(null);
    setPlinkoBuckets([]);
  }, [clearStageReveal]);
  const handleResultClose = React.useCallback(() => {
    clearStageReveal();
    setShowResult(false);
    setResultProof(null);
    setCasinoOutcome(null);
  }, [clearStageReveal]);

  const selection: ReserveSelection = {
    slug: game?.slug ?? slug,
    diceTarget,
    diceDirection,
    rouletteSpots,
    kenoSpots,
    plinkoRisk,
    baccaratSide,
    sicBoKind,
    sicBoValue
  };
  // B2: Accurate win-chance using proper math per game module
  const winChance = game ? calculateGameWinChance(selection) : 0;

  const changeSicBo = React.useCallback((kind: SicBoKind, value: number) => {
    setSicBoKind(kind);
    setSicBoValue(value);
  }, []);
  const changeDiceDirection = React.useCallback((direction: DiceDirection) => {
    setDiceDirection(direction);
    setDiceTarget((target) => clampDiceTarget(direction, target));
  }, []);
  const changeDiceTarget = React.useCallback(
    (target: number) => setDiceTarget(clampDiceTarget(diceDirection, target)),
    [diceDirection]
  );

  const casinoRound = useCasinoRound({
    poolAvailability,
    openBets,
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
    poolId: assetSelection.poolId,
    affiliate: referralAffiliate,
    onRoundStart: handleRoundStart,
    onRoundTerminal: handleRoundTerminal,
    onRoundReset: handleRoundReset
  });
  const { state, reset, placeBet } = casinoRound;

  React.useEffect(() => {
    if (state.status === "mined" || state.status === "reconciled") {
      refreshWalletBalance();
      refreshOpenHolds();
    }
  }, [refreshOpenHolds, refreshWalletBalance, state.status]);
  // Another tab or room may have filled the cap since the last read.
  const stepperErrorCode = state.error?.code;
  React.useEffect(() => {
    if (stepperErrorCode === "PLAYER_OPEN_HOLD_LIMIT") refreshOpenHolds();
  }, [refreshOpenHolds, stepperErrorCode]);

  const { isBetPanelPending, isStagePending } = getCasinoRoomPendingStates({
    isLocalPending: isPending,
    isTransactionActive: casinoRound.isTransactionActive,
    isOutcomeTracking: casinoRound.isRoundAnimating,
    hasStageReveal: Boolean(stageReveal),
    hasCasinoOutcome: Boolean(casinoOutcome),
    isResultVisible: showResult
  });

  useGameResolutionEffect({
    terminalBet:
      stageReveal?.phase === "revealing" && terminalBet?.betId === stageReveal.betId
        ? null
        : terminalBet,
    recentBets,
    db,
    gameHub: sdk?.gameHub,
    setIsPending,
    setShowResult,
    setResultProof,
    reset
  });

  // "Play again": by the time the result is shown the stepper has already been reset to idle
  // (useGameResolutionEffect resets it when the terminal bet arrives), so we fully re-initialise the
  // round UI (clears terminalBet, the reveal/outcome refs, stage state) and place one fresh bet. This
  // is a single synchronous action with no pending flag, so it cannot re-fire on the next
  // settlement. If the stepper were somehow still settled, placeBet() would instead just reset to a
  // ready round — never an unintended auto-bet.
  const handleResultPlayAgain = React.useCallback(() => {
    handleRoundReset();
    void placeBet();
  }, [handleRoundReset, placeBet]);

  React.useEffect(() => {
    const activeBet = casinoRound.activeBet;
    const bet =
      terminalBet ??
      (activeBet?.state === "randomReady" || activeBet?.state === "finalized" ? activeBet : null);

    if (!bet || !game) {
      if (!terminalBet) setCasinoOutcome(null);
      return;
    }

    const outcomeReadKey = `${game.slug}:${bet.betId.toString()}`;
    if (outcomeReadKeyRef.current === outcomeReadKey) return;
    outcomeReadKeyRef.current = outcomeReadKey;

    void readCasinoOutcome({
      gameHub: sdk?.gameHub,
      bet,
      gameSlug: game.slug
    }).then((outcome) => {
      if (outcomeReadKeyRef.current !== outcomeReadKey) return;
      if (!outcome) {
        outcomeReadKeyRef.current = null;
        return;
      }
      setCasinoOutcome(outcome);

      if (outcome?.kind === "dice") setResultNum(outcome.rolls.at(-1)?.value ?? null);
      if (outcome?.kind === "coin-toss") {
        setResultNum(outcome.rolls.at(-1)?.value === "HEADS" ? 1 : 0);
      }
      if (outcome?.kind === "roulette") setResultNum(outcome.rolls.at(-1)?.value ?? null);
      if (outcome?.kind === "plinko") {
        setResultNum(outcome.rolls.at(-1)?.bucket ?? null);
        setPlinkoBuckets(outcome.rolls.map((roll) => roll.bucket));
      }
      if (outcome?.kind === "sic-bo") setResultNum(outcome.rolls.at(-1)?.total ?? null);

      if (bet.state === "randomReady" && revealedBetIdRef.current !== bet.betId) {
        revealedBetIdRef.current = bet.betId;
        setIsPending(false);
        setResultProof(buildCasinoRoundResult({ bet }));
        startStageReveal(bet.betId, game.slug, bet.betCount);
      }
    });
  }, [casinoRound.activeBet, game, sdk?.gameHub, startStageReveal, terminalBet]);

  const houseEdgeBps = casinoRound.houseEdgeBps;
  const assetDecimals = casinoPoolAsset?.asset.decimals ?? 0;
  const assetSymbol = casinoPoolAsset?.asset.symbol ?? "";
  const pricing = deriveGameRoomPricing({ selection, houseEdgeBps, betAmount });
  // Live limits derived from the selected pool's free liquidity (chain-read, verifiable).
  const limits = deriveGameRoomLimits({
    poolSnapshot,
    reserveRatio: pricing.reserveRatio,
    betCount,
    assetDecimals,
    assetSymbol
  });
  const placeBetButtonPhase = derivePlaceBetButtonPhase({
    roundPhase: casinoRound.roundPhase,
    activeBetState: casinoRound.activeBet?.state,
    activeBetId: casinoRound.activeBet?.betId,
    stageReveal,
    revealedBetId: revealedBetIdRef.current
  });

  return {
    game,
    release,
    readOnlyReason,
    chainId,
    sdk,
    wrongNetwork,
    switchNetwork,
    assetSelection,
    casinoPoolAsset,
    assetDecimals,
    assetSymbol,
    recentBets,
    recentBetsStatus,
    walletBalance,
    poolSnapshot,
    openBets,
    refreshPool: () => {
      poolRead.refresh();
      refreshOpenHolds();
      casinoRound.refreshGame();
    },
    betAmount,
    setBetAmount,
    betCount,
    setBetCount,
    stopGain,
    setStopGain,
    stopLoss,
    setStopLoss,
    advancedOpen,
    setAdvancedOpen,
    diceTarget,
    diceDirection,
    changeDiceTarget,
    changeDiceDirection,
    coinSide,
    setCoinSide,
    rouletteSpots,
    setRouletteSpots,
    kenoSpots,
    setKenoSpots,
    plinkoRisk,
    setPlinkoRisk,
    baccaratSide,
    setBaccaratSide,
    sicBoKind,
    sicBoValue,
    changeSicBo,
    winChance,
    casinoRound,
    houseEdgeBps,
    pricing,
    limits,
    placeBetButtonPhase,
    isBetPanelPending,
    isStagePending,
    stageReveal,
    completeStageReveal,
    showResult,
    terminalBet,
    resultProof,
    casinoOutcome,
    resultNum,
    plinkoBuckets,
    gameHistory,
    handleResultClose,
    handleResultPlayAgain
  };
}

export type GameRoom = ReturnType<typeof useGameRoom>;
