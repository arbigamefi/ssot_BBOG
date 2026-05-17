"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { DomainBet } from "@ssot/ssot";

import { ProductStateCard } from "../../../../components/ProductStateCard";
import { PageTransition } from "../../../../components/PageTransition";

import { useRecentBets } from "../../../../features/betting/useRecentBets";
import { useIndexer } from "../../../../features/ops/useIndexer";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";
import { useSSOTRuntime } from "../../../../ssot/runtime";
import { useConnectModal } from "../../../../app-shell/WalletButton";
import { toGameMeta, type GameMeta } from "../../../../features/casino/room/model";
import { calculateGameWinChance } from "../../../../features/casino/room/params";
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
  const { release, readOnlyReason, chainId } = useRelease();
  const { sdk } = useSSOTSDK();
  const { indexerStatus } = useIndexer();

  const isSynced =
    indexerStatus?.latestBlock &&
    indexerStatus?.lastSyncedBlock &&
    indexerStatus.latestBlock <= indexerStatus.lastSyncedBlock;

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
  const revealedBetIdRef = React.useRef<bigint | null>(null);

  // Game-specific params
  const [diceTarget, setDiceTarget] = React.useState<number>(50);
  const [diceDirection, setDiceDirection] = React.useState<"under" | "over">("under");
  const [coinSide, setCoinSide] = React.useState<"HEADS" | "TAILS">("HEADS");
  const [rouletteSpots, setRouletteSpots] = React.useState<string[]>([]);
  const [kenoSpots, setKenoSpots] = React.useState<number[]>([]);

  // Simulation state
  const [flipCount, setFlipCount] = React.useState(0);
  const [resultNum, setResultNum] = React.useState<number | null>(null);
  const [kenoResultDrawn, setKenoResultDrawn] = React.useState<number[]>([]);

  // History state for widgets
  const [gameHistory, setGameHistory] = React.useState<GameHistoryEntry[]>([]);
  // C1: Multi-roll controls
  const [betCount, setBetCount] = React.useState<number>(1);
  const [stopGain, setStopGain] = React.useState<number>(0); // 0 = disabled
  const [stopLoss, setStopLoss] = React.useState<number>(0); // 0 = disabled
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const walletBalance = useGameWalletBalance({ sdk, assets: release?.assets });

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
  const handleRoundStart = React.useCallback(() => {
    revealedBetIdRef.current = null;
    setTerminalBet(null);
    setResultProof(null);
    setCasinoOutcome(null);
  }, []);
  const handleRoundReset = React.useCallback(() => {
    revealedBetIdRef.current = null;
    setShowResult(false);
    setTerminalBet(null);
    setResultProof(null);
    setCasinoOutcome(null);
  }, []);
  const handleResultClose = React.useCallback(() => {
    setShowResult(false);
    setResultProof(null);
    setCasinoOutcome(null);
  }, []);

  // B2: Accurate win-chance using proper math per game module
  const winChance = game
    ? calculateGameWinChance({
        slug: game.slug,
        diceTarget,
        diceDirection,
        rouletteSpots,
        kenoSpots
      })
    : 0;

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
    terminalBet,
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

      if (bet.state === "randomReady" && revealedBetIdRef.current !== bet.betId) {
        revealedBetIdRef.current = bet.betId;
        setIsPending(false);
        setResultProof(buildCasinoRoundResult({ bet }));
        setShowResult(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [casinoRound.activeBet, game, sdk?.gameHub, terminalBet]);

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

  const multiplier = winChance === 0 ? 0 : 99 / winChance;
  const expectedPayout = betAmount * multiplier;

  const LeftPane = (
    <GameRoomBetPanel
      game={game}
      walletBalance={walletBalance}
      isSynced={Boolean(isSynced)}
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
      coinSide={coinSide}
      onCoinSideChange={setCoinSide}
      rouletteSpots={rouletteSpots}
      onRouletteClear={() => setRouletteSpots([])}
      kenoSpots={kenoSpots}
      onKenoChange={setKenoSpots}
      onKenoResetResult={() => setKenoResultDrawn([])}
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

  const RightPane = (
    <GameRoomRightPane
      gameSlug={game.slug}
      coinSide={coinSide}
      flipCount={flipCount}
      gameHistory={gameHistory}
      recentBets={recentBets}
      isPending={isRoundAnimating}
      showResult={showResult}
      resultNum={resultNum}
      diceDirection={diceDirection}
      diceTarget={diceTarget}
      multiplier={multiplier}
      winChance={winChance}
      rouletteSpots={rouletteSpots}
      kenoSpots={kenoSpots}
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
      onRouletteChange={setRouletteSpots}
      onKenoChange={setKenoSpots}
      onKenoResetResult={() => setKenoResultDrawn([])}
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
