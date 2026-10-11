"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DomainBet } from "@ssot/ssot";

import { ProductStateCard } from "../../../../components/ProductStateCard";
import { PageTransition } from "../../../../components/PageTransition";

import { useRecentBets } from "../../../../features/betting/useRecentBets";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";
import { useSSOTRuntime } from "../../../../ssot/runtime";
import { isCasinoRiskInEnabledForChain } from "../../../../app-shell/casino-access";
import { requestWalletConnect } from "../../../../app-shell/wallet-connect-events";
import { useCasinoPoolAssetSelection } from "../../../../features/assets/useCasinoPoolAssetSelection";
import { toGameMeta, type GameMeta } from "../../../../features/casino/room/model";
import {
  calculateGameWinChance,
  type BaccaratSide,
  type PlinkoRisk,
  type SicBoKind
} from "../../../../features/casino/room/params";
import {
  deriveGameRoomLimits,
  deriveGameRoomPricing
} from "../../../../features/casino/room/presentation";
import { GameRoomBetPanel } from "../../../../features/casino/room/bet-panel";
import { GameClosedState } from "../../../../features/casino/room/game-closed";
import {
  useGameWalletBalance,
  useKenoStrobeSpots,
  usePlayerOpenHolds,
  usePoolSnapshot
} from "../../../../features/casino/room/hooks";
import {
  useGameResolutionEffect,
  buildCasinoRoundResult,
  type CasinoRoundResult,
  type GameHistoryEntry
} from "../../../../features/casino/room/resolution";
import { readCasinoOutcome, type CasinoOutcome } from "../../../../features/casino/room/outcome";
import { GameRoomRightPane } from "../../../../features/casino/room/right-pane";
import { GameRoomShell } from "../../../../features/casino/room/game-room-shell";
import { MobileCasinoActionBar } from "../../../../features/casino/room/mobile-action-bar";
import { derivePlaceBetButtonPhase } from "../../../../features/casino/room/place-bet-button";
import { useCasinoRound } from "../../../../features/casino/room/use-casino-round";
import { useStageReveal } from "../../../../features/casino/room/use-stage-reveal";
import { useReferralAffiliate } from "../../../../features/referral/useReferralAffiliate";
import {
  GameRoomAuditLedger,
  getCasinoRoomPendingStates,
  getLocalizedGameName
} from "./pageClient-helpers";

export { getCasinoRoomPendingStates } from "./pageClient-helpers";

export function GamePageClient({ slug }: { slug: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { release, readOnlyReason, chainId } = useRelease();
  const { sdk } = useSSOTSDK();
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

  const [betAmount, setBetAmount] = React.useState("10");
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
  const [diceDirection, setDiceDirection] = React.useState<"under" | "over">("under");
  const [coinSide, setCoinSide] = React.useState<"HEADS" | "TAILS">("HEADS");
  const [rouletteSpots, setRouletteSpots] = React.useState<string[]>([]);
  const [kenoSpots, setKenoSpots] = React.useState<number[]>([]);
  const [plinkoRisk, setPlinkoRisk] = React.useState<PlinkoRisk>("medium");
  const [baccaratSide, setBaccaratSide] = React.useState<BaccaratSide>("player");
  const [sicBoKind, setSicBoKind] = React.useState<SicBoKind>("small");
  const [sicBoValue, setSicBoValue] = React.useState<number>(0);

  const [resultNum, setResultNum] = React.useState<number | null>(null);
  const [kenoResultDrawn, setKenoResultDrawn] = React.useState<number[]>([]);
  const [plinkoBuckets, setPlinkoBuckets] = React.useState<number[]>([]);
  const [slotsSymbols, setSlotsSymbols] = React.useState<number[]>([]);

  const [gameHistory, setGameHistory] = React.useState<GameHistoryEntry[]>([]);
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
    setSlotsSymbols([]);
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
    setSlotsSymbols([]);
  }, [clearStageReveal]);
  const handleResultClose = React.useCallback(() => {
    clearStageReveal();
    setShowResult(false);
    setResultProof(null);
    setCasinoOutcome(null);
  }, [clearStageReveal]);

  // B2: Accurate win-chance using proper math per game module
  const winChance = game
    ? calculateGameWinChance({
        slug: game.slug,
        diceTarget,
        diceDirection,
        rouletteSpots,
        kenoSpots,
        plinkoRisk,
        baccaratSide,
        sicBoKind,
        sicBoValue
      })
    : 0;

  const handleSicBoChange = React.useCallback((kind: SicBoKind, value: number) => {
    setSicBoKind(kind);
    setSicBoValue(value);
  }, []);

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
  const animatingKenoSpots = useKenoStrobeSpots({
    isPending: isStagePending,
    gameSlug: game?.slug
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

  // "Play again": by the time the result modal is shown the stepper has already
  // been reset to idle (useGameResolutionEffect resets it when the terminal bet
  // arrives), so we fully re-initialise the round UI (clears terminalBet, the
  // reveal/outcome refs, stage state) and place one fresh bet. This is a single
  // synchronous action with no pending flag, so it cannot re-fire on the next
  // settlement. If the stepper were somehow still settled, placeBet() would
  // instead just reset to a ready round — never an unintended auto-bet.
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
      if (outcome?.kind === "keno") setKenoResultDrawn(outcome.draws.at(-1)?.numbers ?? []);
      if (outcome?.kind === "plinko") {
        setResultNum(outcome.rolls.at(-1)?.bucket ?? null);
        setPlinkoBuckets(outcome.rolls.map((roll) => roll.bucket));
      }
      if (outcome?.kind === "slots") {
        const lastRoll = outcome.rolls.at(-1);
        setResultNum(lastRoll?.multiplier ?? null);
        setSlotsSymbols(lastRoll ? [...lastRoll.symbols] : []);
      }
      if (outcome?.kind === "sic-bo") setResultNum(outcome.rolls.at(-1)?.total ?? null);

      if (bet.state === "randomReady" && revealedBetIdRef.current !== bet.betId) {
        revealedBetIdRef.current = bet.betId;
        setIsPending(false);
        setResultProof(buildCasinoRoundResult({ bet }));
        startStageReveal(bet.betId, game.slug);
      }
    });
  }, [casinoRound.activeBet, game, sdk?.gameHub, startStageReveal, terminalBet]);

  if (!release || !game)
    return (
      <ProductStateCard
        title={t("casino.room.empty.moduleNotFound")}
        description={readOnlyReason ?? t("casino.room.empty.gameNotFound")}
      />
    );
  if (!casinoPoolAsset)
    return (
      <ProductStateCard
        title={t("casino.room.empty.moduleNotFound")}
        description={readOnlyReason ?? t("casino.room.empty.gameNotFound")}
      />
    );
  // No bet panel for a disabled game: it takes no new bets, but accepted ones still settle.
  if (casinoRound.gameDisabled)
    return (
      <PageTransition pageKey={`game-${slug}-closed`}>
        <GameClosedState gameName={getLocalizedGameName(t, game)} />
      </PageTransition>
    );

  const { decimals: assetDecimals, symbol: assetSymbol } = casinoPoolAsset.asset;

  const houseEdgeBps = casinoRound.houseEdgeBps;
  const { reserveRatio, multiplier, expectedPayout } = deriveGameRoomPricing({
    selection: {
      slug: game.slug,
      diceTarget,
      diceDirection,
      rouletteSpots,
      kenoSpots,
      plinkoRisk,
      baccaratSide,
      sicBoKind,
      sicBoValue
    },
    houseEdgeBps,
    betAmount
  });

  // Live header limits derived from the selected pool's free liquidity (chain-read, verifiable).
  const { maxBet, maxBetRaw, maxTotal, maxBetState, maxPayout, maxPayoutState } =
    deriveGameRoomLimits({
      poolSnapshot,
      reserveRatio,
      betCount,
      assetDecimals,
      assetSymbol
    });
  const maxBetLabel =
    maxBetState === "pending-selection"
      ? t("casino.room.shell.selectBetFirst")
      : maxBetState === "no-capacity"
        ? t("casino.room.shell.noCapacity")
        : t("casino.room.betPanel.maxSummary", { perRound: maxBet, total: maxTotal });
  const maxPayoutLabel =
    maxPayoutState === "no-capacity" ? t("casino.room.shell.noCapacity") : maxPayout;
  const placeBetButtonPhase = derivePlaceBetButtonPhase({
    roundPhase: casinoRound.roundPhase,
    activeBetState: casinoRound.activeBet?.state,
    activeBetId: casinoRound.activeBet?.betId,
    stageReveal,
    revealedBetId: revealedBetIdRef.current
  });

  const actionProps = {
    betAmount,
    maxBetRaw: houseEdgeBps == null ? undefined : maxBetRaw,
    minBetRaw: poolSnapshot?.minBetAmount ?? 0n,
    onBetAmountChange: setBetAmount,
    hasAccount: Boolean(sdk?.account),
    isPending: isBetPanelPending,
    riskInDisabled: !isCasinoRiskInEnabledForChain(chainId),
    poolAvailability: casinoRound.availability,
    openBets,
    pendingSettlementBetIds: casinoRound.pendingSettlementBetIds,
    onRefreshPool: () => {
      poolRead.refresh();
      refreshOpenHolds();
      casinoRound.refreshGame();
    },
    onCheckTransaction: casinoRound.checkTransaction,
    checkingTransaction: casinoRound.checkingTransaction,
    manualSettleAvailable: casinoRound.manualSettleAvailable,
    onManualSettle: casinoRound.manualSettle,
    manualRefundAvailable: casinoRound.manualRefundAvailable,
    onManualRefund: casinoRound.manualRefund,
    onPlaceBet: casinoRound.placeBet
  };

  const LeftPane = (
    <GameRoomBetPanel
      {...actionProps}
      game={game}
      walletBalance={walletBalance}
      assetDecimals={assetDecimals}
      assetSymbol={assetSymbol}
      assetOptions={assetSelection.assetOptions}
      selectedAsset={assetSelection.selectedAsset}
      onAssetChange={assetSelection.setSelectedAsset}
      maxBetLabel={maxBetLabel}
      maxBetIsHint={maxBetState !== "value"}
      maxPayoutLabel={maxPayoutLabel}
      maxPayoutIsHint={maxPayoutState !== "value"}
      betCount={betCount}
      maxBetCount={casinoRound.maxBetCount}
      onBetCountChange={setBetCount}
      stopGain={stopGain}
      onStopGainChange={setStopGain}
      stopLoss={stopLoss}
      onStopLossChange={setStopLoss}
      advancedOpen={advancedOpen}
      onAdvancedOpenChange={setAdvancedOpen}
      state={state}
      winChance={winChance}
      multiplier={multiplier}
      expectedPayout={expectedPayout}
      vrfQuote={casinoRound.vrfQuote}
      activeBetId={casinoRound.activeBetId}
      activeRequestId={casinoRound.activeRequestId}
      roundPhase={casinoRound.roundPhase}
      ctaPhase={placeBetButtonPhase}
      hideMobileAction
    />
  );

  const MobileAction = (
    <MobileCasinoActionBar
      {...actionProps}
      chainId={chainId}
      betCount={betCount}
      vrfQuote={casinoRound.vrfQuote}
      game={game}
      assetSymbol={assetSymbol}
      assetDecimals={assetDecimals}
      walletBalanceRaw={walletBalance?.raw ?? null}
      winChance={winChance}
      state={state}
      roundPhase={placeBetButtonPhase}
    />
  );

  const stageShowResult = Boolean(stageReveal || showResult);
  const stageIsRevealing = stageReveal?.phase === "revealing";

  const stageHouseEdgeBps =
    terminalBet?.houseEdgeBps ?? casinoRound.activeBet?.houseEdgeBps ?? houseEdgeBps;
  const RightPane =
    stageHouseEdgeBps == null ? (
      <ProductStateCard
        title={t("casino.room.poolStatus.gameUnavailable")}
        description={t("casino.room.errors.quoteFailed")}
      />
    ) : (
      <GameRoomRightPane
        gameSlug={game.slug}
        coinSide={coinSide}
        gameHistory={gameHistory}
        recentBets={recentBets}
        isPending={isStagePending}
        controlsLocked={isBetPanelPending}
        isRevealing={stageIsRevealing}
        showResult={stageShowResult}
        resultNum={resultNum}
        diceDirection={diceDirection}
        diceTarget={diceTarget}
        houseEdgeBps={stageHouseEdgeBps}
        rouletteSpots={rouletteSpots}
        kenoSpots={kenoSpots}
        plinkoRisk={plinkoRisk}
        baccaratSide={baccaratSide}
        sicBoKind={sicBoKind}
        sicBoValue={sicBoValue}
        plinkoBuckets={plinkoBuckets}
        slotsSymbols={slotsSymbols}
        animatingKenoSpots={animatingKenoSpots}
        kenoResultDrawn={kenoResultDrawn}
        casinoOutcome={casinoOutcome}
        resultProof={resultProof}
        chainId={chainId}
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
        onResultClose={handleResultClose}
        onResultPlayAgain={handleResultPlayAgain}
        onDiceRevealComplete={completeStageReveal}
        onCoinRevealComplete={completeStageReveal}
        onRouletteRevealComplete={completeStageReveal}
        onDiceDirectionChange={setDiceDirection}
        onDiceTargetChange={setDiceTarget}
        onCoinSideChange={setCoinSide}
        onRouletteChange={setRouletteSpots}
        onKenoChange={setKenoSpots}
        onKenoResetResult={() => setKenoResultDrawn([])}
        onKenoRevealComplete={completeStageReveal}
        onPlinkoRiskChange={setPlinkoRisk}
        onPlinkoRevealComplete={completeStageReveal}
        onSlotsRevealComplete={completeStageReveal}
        onSicBoRevealComplete={completeStageReveal}
        onBaccaratRevealComplete={completeStageReveal}
        onBaccaratSideChange={setBaccaratSide}
        onSicBoChange={handleSicBoChange}
      />
    );

  const AuditLedger = (
    <GameRoomAuditLedger
      game={game}
      recentBets={recentBets}
      playerAddress={sdk?.account}
      assetAddress={casinoPoolAsset.asset.address}
      assetSymbol={assetSymbol}
      assetDecimals={assetDecimals}
      assetContexts={assetSelection.contexts}
      chainId={chainId}
      houseEdgeBps={houseEdgeBps}
    />
  );

  return (
    <PageTransition pageKey={`game-${slug}`}>
      <GameRoomShell
        gameName={getLocalizedGameName(t, game)}
        maxBet={maxBetLabel}
        maxBetIsHint={maxBetState !== "value"}
        maxPayout={maxPayoutLabel}
        maxPayoutIsHint={maxPayoutState !== "value"}
        isInteractive={true}
        leftPaneContent={LeftPane}
        rightPaneContent={RightPane}
        auditLedgerContent={AuditLedger}
        mobileActionContent={MobileAction}
      />
    </PageTransition>
  );
}
