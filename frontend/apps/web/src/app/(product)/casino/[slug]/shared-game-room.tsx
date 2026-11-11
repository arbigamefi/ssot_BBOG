"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ProductStateCard } from "../../../../components/ProductStateCard";
import { PageTransition } from "../../../../components/PageTransition";
import {
  getCasinoAccess,
  isCasinoRiskInEnabledForChain
} from "../../../../app-shell/casino-access";
import { GameRoomBetPanel } from "../../../../features/casino/room/bet-panel";
import { GameRoomRightPane } from "../../../../features/casino/room/right-pane";
import { GameRoomShell } from "../../../../features/casino/room/game-room-shell";
import { MobileCasinoActionBar } from "../../../../features/casino/room/mobile-action-bar";
import type { GameRoom } from "../../../../features/casino/room/use-game-room";
import { GameRoomAuditLedger, getLocalizedGameName } from "./pageClient-helpers";

/** The room shell the games that have not moved to Carbon copy still share. */
export function SharedGameRoom({ slug, room }: { slug: string; room: GameRoom }) {
  const t = useTranslations();
  const {
    game,
    casinoPoolAsset,
    casinoRound,
    chainId,
    sdk,
    assetSelection,
    poolSnapshot,
    limits,
    pricing,
    houseEdgeBps
  } = room;
  if (!game || !casinoPoolAsset) return null;
  const { assetDecimals, assetSymbol } = room;
  const { maxBet, maxBetRaw, maxTotal, maxBetState, maxPayout, maxPayoutState } = limits;
  const maxBetLabel =
    maxBetState === "pending-selection"
      ? t("casino.room.shell.selectBetFirst")
      : maxBetState === "no-capacity"
        ? t("casino.room.shell.noCapacity")
        : t("casino.room.betPanel.maxSummary", { perRound: maxBet, total: maxTotal });
  const maxPayoutLabel =
    maxPayoutState === "no-capacity" ? t("casino.room.shell.noCapacity") : maxPayout;

  const actionProps = {
    betAmount: room.betAmount,
    maxBetRaw: houseEdgeBps == null ? undefined : maxBetRaw,
    minBetRaw: poolSnapshot?.minBetAmount ?? 0n,
    onBetAmountChange: room.setBetAmount,
    hasAccount: Boolean(sdk?.account),
    isPending: room.isBetPanelPending,
    riskInDisabled: !isCasinoRiskInEnabledForChain(chainId),
    poolAvailability: casinoRound.availability,
    openBets: room.openBets,
    pendingSettlementBetIds: casinoRound.pendingSettlementBetIds,
    onRefreshPool: room.refreshPool,
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
      walletBalance={room.walletBalance}
      assetDecimals={assetDecimals}
      assetSymbol={assetSymbol}
      assetOptions={assetSelection.assetOptions}
      selectedAsset={assetSelection.selectedAsset}
      onAssetChange={assetSelection.setSelectedAsset}
      maxBetLabel={maxBetLabel}
      maxBetIsHint={maxBetState !== "value"}
      maxPayoutLabel={maxPayoutLabel}
      maxPayoutIsHint={maxPayoutState !== "value"}
      betCount={room.betCount}
      maxBetCount={casinoRound.maxBetCount}
      onBetCountChange={room.setBetCount}
      stopGain={room.stopGain}
      onStopGainChange={room.setStopGain}
      stopLoss={room.stopLoss}
      onStopLossChange={room.setStopLoss}
      advancedOpen={room.advancedOpen}
      onAdvancedOpenChange={room.setAdvancedOpen}
      state={casinoRound.state}
      winChance={room.winChance}
      multiplier={pricing.multiplier}
      expectedPayout={pricing.expectedPayout}
      vrfQuote={casinoRound.vrfQuote}
      activeBetId={casinoRound.activeBetId}
      activeRequestId={casinoRound.activeRequestId}
      roundPhase={casinoRound.roundPhase}
      ctaPhase={room.placeBetButtonPhase}
      hideMobileAction
    />
  );

  const MobileAction = (
    <MobileCasinoActionBar
      {...actionProps}
      chainId={chainId}
      betCount={room.betCount}
      vrfQuote={casinoRound.vrfQuote}
      game={game}
      assetSymbol={assetSymbol}
      assetDecimals={assetDecimals}
      walletBalanceRaw={room.walletBalance?.raw ?? null}
      winChance={room.winChance}
      state={casinoRound.state}
      roundPhase={room.placeBetButtonPhase}
    />
  );

  const stageHouseEdgeBps =
    room.terminalBet?.houseEdgeBps ?? casinoRound.activeBet?.houseEdgeBps ?? houseEdgeBps;
  const RightPane =
    stageHouseEdgeBps == null ? (
      <ProductStateCard
        title={t("casino.room.poolStatus.gameUnavailable")}
        description={t("casino.room.errors.quoteFailed")}
      />
    ) : (
      <GameRoomRightPane
        gameSlug={game.slug}
        gameHistory={room.gameHistory}
        recentBets={room.recentBets}
        isPending={room.isStagePending}
        controlsLocked={room.isBetPanelPending}
        isRevealing={room.stageReveal?.phase === "revealing"}
        showResult={Boolean(room.stageReveal || room.showResult)}
        houseEdgeBps={stageHouseEdgeBps}
        baccaratSide={room.baccaratSide}
        sicBoKind={room.sicBoKind}
        sicBoValue={room.sicBoValue}
        casinoOutcome={room.casinoOutcome}
        resultProof={room.resultProof}
        chainId={chainId}
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
        onResultClose={room.handleResultClose}
        onResultPlayAgain={room.handleResultPlayAgain}
        onSicBoRevealComplete={room.completeStageReveal}
        onBaccaratRevealComplete={room.completeStageReveal}
        onBaccaratSideChange={room.setBaccaratSide}
        onSicBoChange={room.changeSicBo}
      />
    );

  const AuditLedger = (
    <GameRoomAuditLedger
      game={game}
      recentBets={room.recentBets}
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
        access={getCasinoAccess(chainId)}
        leftPaneContent={LeftPane}
        rightPaneContent={RightPane}
        auditLedgerContent={AuditLedger}
        mobileActionContent={MobileAction}
      />
    </PageTransition>
  );
}
