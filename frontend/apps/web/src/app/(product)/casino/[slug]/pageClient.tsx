"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DomainBet } from "@ssot/ssot";

import { ProductStateCard } from "../../../../components/ProductStateCard";
import { PageTransition } from "../../../../components/PageTransition";

import { useRecentBets } from "../../../../features/betting/useRecentBets";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";
import { useSSOTRuntime } from "../../../../ssot/runtime";
import { useConnectModal } from "../../../../app-shell/WalletButton";
import { toGameMeta, type GameMeta } from "../../../../features/casino/room/model";
import {
  baccaratMultiplier,
  calculateGameWinChance,
  plinkoMaxMultiplier,
  sicBoMultiplier,
  slotsMaxMultiplier,
  type BaccaratSide,
  type PlinkoRisk,
  type SicBoKind
} from "../../../../features/casino/room/params";
import {
  formatGameMaxPayout,
  formatHouseEdge
} from "../../../../features/casino/room/presentation";
import { GameRoomBetPanel } from "../../../../features/casino/room/bet-panel";
import { useGameWalletBalance, useKenoStrobeSpots } from "../../../../features/casino/room/hooks";
import {
  useGameResolutionEffect,
  buildCasinoRoundResult,
  type CasinoRoundResult,
  type GameHistoryEntry
} from "../../../../features/casino/room/resolution";
import { readCasinoOutcome, type CasinoOutcome } from "../../../../features/casino/room/outcome";
import { GameRoomRightPane } from "../../../../features/casino/room/right-pane";
import { GameRoomShell } from "../../../../features/casino/room/game-room-shell";
import { useCasinoRound } from "../../../../features/casino/room/use-casino-round";
import { normalizeReferralAddress } from "../../../../features/referral/referral-link";

function AuditLedgerLoading() {
  const t = useTranslations();

  return (
    <div className="rounded-lg border border-border bg-surface-1 p-6 text-sm font-bold uppercase tracking-[0.18em] text-fg-subtle">
      {t("casino.room.audit.loading")}
    </div>
  );
}

function getLocalizedGameName(t: (key: string) => string, game: GameMeta) {
  switch (game.slug) {
    case "dice":
      return t("casino.room.names.dice");
    case "roulette":
      return t("casino.room.names.roulette");
    case "coin-toss":
      return t("casino.room.names.coinToss");
    case "keno":
      return t("casino.room.names.keno");
    case "plinko":
      return t("casino.room.names.plinko");
    case "slots":
      return t("casino.room.names.slots");
    case "baccarat":
      return t("casino.room.names.baccarat");
    case "sic-bo":
      return t("casino.room.names.sicBo");
    default:
      return game.label;
  }
}

const GameRoomAuditLedger = dynamic(
  () =>
    import("../../../../features/casino/room/audit-ledger").then((mod) => mod.GameRoomAuditLedger),
  {
    loading: () => <AuditLedgerLoading />,
    ssr: false
  }
);

/* ─── Main Logic ─── */

export function GamePageClient({ slug }: { slug: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { release, readOnlyReason, chainId } = useRelease();
  const { sdk } = useSSOTSDK();
  const game = React.useMemo(() => {
    const found = release?.gamesMeta?.find((item: any) => item.slug === slug);
    return found ? toGameMeta(found) : null;
  }, [release?.gamesMeta, slug]);

  const recentBetsQuery = useRecentBets({
    enabled: Boolean(game?.gameId),
    errorMessage: t("app.errors.recentBetsFailed"),
    gameId: game?.gameId,
    limit: 12
  });
  const refetchRecentBets = recentBetsQuery.refetch;
  const recentBets = recentBetsQuery.data ?? [];

  // Local State
  const [betAmount, setBetAmount] = React.useState<number>(10);
  const [isPending, setIsPending] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
  const [terminalBet, setTerminalBet] = React.useState<DomainBet | null>(null);
  const [resultProof, setResultProof] = React.useState<CasinoRoundResult | null>(null);
  const [casinoOutcome, setCasinoOutcome] = React.useState<CasinoOutcome | null>(null);
  const [stageReveal, setStageReveal] = React.useState<{
    betId: bigint;
    phase: "revealing" | "revealed";
  } | null>(null);
  const revealedBetIdRef = React.useRef<bigint | null>(null);
  const revealTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>();

  // Game-specific params
  const [diceTarget, setDiceTarget] = React.useState<number>(50);
  const [diceDirection, setDiceDirection] = React.useState<"under" | "over">("under");
  const [coinSide, setCoinSide] = React.useState<"HEADS" | "TAILS">("HEADS");
  const [rouletteSpots, setRouletteSpots] = React.useState<string[]>([]);
  const [kenoSpots, setKenoSpots] = React.useState<number[]>([]);
  const [plinkoRisk, setPlinkoRisk] = React.useState<PlinkoRisk>("medium");
  const [baccaratSide, setBaccaratSide] = React.useState<BaccaratSide>("player");
  const [sicBoKind, setSicBoKind] = React.useState<SicBoKind>("small");
  const [sicBoValue, setSicBoValue] = React.useState<number>(0);

  // Simulation state
  const [resultNum, setResultNum] = React.useState<number | null>(null);
  const [kenoResultDrawn, setKenoResultDrawn] = React.useState<number[]>([]);
  const [plinkoBuckets, setPlinkoBuckets] = React.useState<number[]>([]);
  const [slotsSymbols, setSlotsSymbols] = React.useState<number[]>([]);

  // History state for widgets
  const [gameHistory, setGameHistory] = React.useState<GameHistoryEntry[]>([]);
  // C1: Multi-roll controls
  const [betCount, setBetCount] = React.useState<number>(1);
  const [stopGain, setStopGain] = React.useState<number>(0); // 0 = disabled
  const [stopLoss, setStopLoss] = React.useState<number>(0); // 0 = disabled
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const walletBalance = useGameWalletBalance({ sdk, assets: release?.assets });
  const referrerParam = searchParams.get("ref");
  const referralAffiliate = React.useMemo(
    () => normalizeReferralAddress(referrerParam, sdk?.account),
    [referrerParam, sdk?.account]
  );

  const { openConnectModal } = useConnectModal();
  const { db } = useSSOTRuntime();
  const handleRoundTerminal = React.useCallback(
    (bet: DomainBet) => {
      setIsPending(false);
      setTerminalBet(bet);
      void refetchRecentBets?.();
    },
    [refetchRecentBets]
  );
  const clearStageRevealTimer = React.useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = undefined;
    }
  }, []);
  const startStageReveal = React.useCallback(
    (betId: bigint, gameSlug: string) => {
      clearStageRevealTimer();
      const durationMs =
        gameSlug === "plinko"
          ? 6_000
          : gameSlug === "slots"
            ? 3_400
            : gameSlug === "keno"
              ? 4_000
              : gameSlug === "sic-bo"
                ? 2_100
                : 0;

      if (durationMs === 0) {
        setStageReveal({ betId, phase: "revealed" });
        return;
      }

      setStageReveal({ betId, phase: "revealing" });
      revealTimerRef.current = setTimeout(() => {
        setStageReveal((current) =>
          current?.betId === betId ? { betId, phase: "revealed" } : current
        );
        revealTimerRef.current = undefined;
      }, durationMs);
    },
    [clearStageRevealTimer]
  );
  const handleStageRevealComplete = React.useCallback(() => {
    clearStageRevealTimer();
    setStageReveal((current) =>
      current?.phase === "revealing" ? { betId: current.betId, phase: "revealed" } : current
    );
  }, [clearStageRevealTimer]);
  const handleRoundStart = React.useCallback(() => {
    clearStageRevealTimer();
    revealedBetIdRef.current = null;
    setTerminalBet(null);
    setResultProof(null);
    setCasinoOutcome(null);
    setStageReveal(null);
    setPlinkoBuckets([]);
    setSlotsSymbols([]);
  }, [clearStageRevealTimer]);
  const handleRoundReset = React.useCallback(() => {
    clearStageRevealTimer();
    revealedBetIdRef.current = null;
    setShowResult(false);
    setTerminalBet(null);
    setResultProof(null);
    setCasinoOutcome(null);
    setStageReveal(null);
    setPlinkoBuckets([]);
    setSlotsSymbols([]);
  }, [clearStageRevealTimer]);
  const handleResultClose = React.useCallback(() => {
    setShowResult(false);
    setResultProof(null);
    setCasinoOutcome(null);
  }, []);

  React.useEffect(() => () => clearStageRevealTimer(), [clearStageRevealTimer]);

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
    affiliate: referralAffiliate,
    onRoundStart: handleRoundStart,
    onRoundTerminal: handleRoundTerminal,
    onRoundReset: handleRoundReset
  });
  const { state, reset } = casinoRound;

  const isRoundAnimating = isPending || casinoRound.isRoundAnimating;
  const animatingKenoSpots = useKenoStrobeSpots({
    isPending: isRoundAnimating,
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

  React.useEffect(() => {
    let cancelled = false;
    const activeBet = casinoRound.activeBet;
    const bet =
      terminalBet ??
      (activeBet?.state === "randomReady" || activeBet?.state === "finalized" ? activeBet : null);

    if (!bet || !game) {
      if (!terminalBet) setCasinoOutcome(null);
      return;
    }

    void readCasinoOutcome({
      gameHub: sdk?.gameHub,
      bet,
      gameSlug: game.slug
    }).then((outcome) => {
      if (cancelled) return;
      if (!outcome) return;
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

    return () => {
      cancelled = true;
    };
  }, [casinoRound.activeBet, game, sdk?.gameHub, startStageReveal, terminalBet]);

  if (!release || !game)
    return (
      <ProductStateCard
        title={t("casino.room.empty.moduleNotFound")}
        description={readOnlyReason ?? t("casino.room.empty.gameNotFound")}
      />
    );

  // A5: Live houseEdge and maxPayout from release gamesMeta
  const gameMeta = release?.gamesMeta?.find((m: any) => m.slug === game.slug);
  const houseEdge = formatHouseEdge(gameMeta, game.slug);
  const usdcDecimals = release?.assets?.find((a: any) => a.symbol === "USDC")?.decimals ?? 6;
  const maxPayout = formatGameMaxPayout({ gameMeta, slug: game.slug, usdcDecimals });

  const multiplier =
    game.slug === "plinko"
      ? plinkoMaxMultiplier(plinkoRisk)
      : game.slug === "slots"
        ? slotsMaxMultiplier()
        : game.slug === "baccarat"
          ? baccaratMultiplier(baccaratSide)
          : game.slug === "sic-bo"
            ? sicBoMultiplier(sicBoKind, sicBoValue)
            : winChance === 0
              ? 0
              : 99 / winChance;
  const expectedPayout = betAmount * multiplier;

  const LeftPane = (
    <GameRoomBetPanel
      game={game}
      walletBalance={walletBalance}
      betAmount={betAmount}
      onBetAmountChange={setBetAmount}
      betCount={betCount}
      onBetCountChange={setBetCount}
      stopGain={stopGain}
      onStopGainChange={setStopGain}
      stopLoss={stopLoss}
      onStopLossChange={setStopLoss}
      advancedOpen={advancedOpen}
      onAdvancedOpenChange={setAdvancedOpen}
      isPending={isRoundAnimating}
      state={state}
      hasAccount={Boolean(sdk?.account)}
      winChance={winChance}
      multiplier={multiplier}
      expectedPayout={expectedPayout}
      roundPhase={casinoRound.roundPhase}
      vrfQuote={casinoRound.vrfQuote}
      vrfQuoteError={casinoRound.vrfQuoteError}
      activeBetId={casinoRound.activeBetId}
      activeRequestId={casinoRound.activeRequestId}
      roundError={casinoRound.roundError}
      manualSettleAvailable={casinoRound.manualSettleAvailable}
      onManualSettle={casinoRound.manualSettle}
      manualRefundAvailable={casinoRound.manualRefundAvailable}
      onManualRefund={casinoRound.manualRefund}
      onPlaceBet={casinoRound.placeBet}
    />
  );

  const stageShowResult = Boolean(stageReveal || showResult);
  const stageIsRevealing = stageReveal?.phase === "revealing";
  const stageIsPending = isRoundAnimating && !stageReveal && !casinoOutcome;

  const RightPane = (
    <GameRoomRightPane
      gameSlug={game.slug}
      coinSide={coinSide}
      gameHistory={gameHistory}
      recentBets={recentBets}
      isPending={stageIsPending}
      isRevealing={stageIsRevealing}
      showResult={stageShowResult}
      resultNum={resultNum}
      diceDirection={diceDirection}
      diceTarget={diceTarget}
      multiplier={multiplier}
      winChance={winChance}
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
      assetSymbol="USDC"
      assetDecimals={usdcDecimals}
      onResultClose={handleResultClose}
      onDiceDirectionChange={setDiceDirection}
      onDiceTargetChange={setDiceTarget}
      onCoinSideChange={setCoinSide}
      onRouletteChange={setRouletteSpots}
      onKenoChange={setKenoSpots}
      onKenoResetResult={() => setKenoResultDrawn([])}
      onKenoRevealComplete={handleStageRevealComplete}
      onPlinkoRiskChange={setPlinkoRisk}
      onPlinkoRevealComplete={handleStageRevealComplete}
      onSlotsRevealComplete={handleStageRevealComplete}
      onSicBoRevealComplete={handleStageRevealComplete}
      onBaccaratSideChange={setBaccaratSide}
      onSicBoChange={handleSicBoChange}
    />
  );

  const AuditLedger = (
    <GameRoomAuditLedger game={game} betAmount={betAmount} recentBets={recentBets} />
  );

  return (
    <PageTransition pageKey={`game-${slug}`}>
      <GameRoomShell
        gameName={getLocalizedGameName(t, game)}
        houseEdge={houseEdge}
        maxPayout={maxPayout}
        isInteractive={true}
        leftPaneContent={LeftPane}
        rightPaneContent={RightPane}
        auditLedgerContent={AuditLedger}
      />
    </PageTransition>
  );
}
