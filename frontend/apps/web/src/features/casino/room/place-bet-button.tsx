import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import type { CasinoRoundPhase } from "./casino-round";

export type GameRoomBetPanelState = {
  status: string;
  error?: { message?: string };
  plan?: { preview?: { needsApproval?: boolean } };
};

export type PlaceBetButtonPhase = CasinoRoundPhase | "revealing";
export type StageRevealState = { betId: bigint; phase: "revealing" | "revealed" } | null;

export function derivePlaceBetButtonPhase({
  roundPhase,
  activeBetState,
  activeBetId,
  stageReveal,
  revealedBetId
}: {
  roundPhase: CasinoRoundPhase;
  activeBetState?: string;
  activeBetId?: bigint;
  stageReveal?: StageRevealState;
  revealedBetId?: bigint | null;
}): PlaceBetButtonPhase {
  const activeBetAwaitingReveal =
    activeBetState === "randomReady" &&
    activeBetId != null &&
    stageReveal?.phase !== "revealed" &&
    revealedBetId !== activeBetId;

  return stageReveal?.phase === "revealing" || activeBetAwaitingReveal ? "revealing" : roundPhase;
}

export function isPlaceBetButtonDisabled({
  gameSlug,
  isPending,
  winChance,
  state,
  manualSettleAvailable = false,
  manualRefundAvailable = false,
  amountUnavailable = false,
  amountExceedsMax = false
}: {
  gameSlug: string;
  isPending: boolean;
  winChance: number;
  state: GameRoomBetPanelState;
  manualSettleAvailable?: boolean;
  manualRefundAvailable?: boolean;
  amountUnavailable?: boolean;
  amountExceedsMax?: boolean;
}) {
  if (manualSettleAvailable || manualRefundAvailable) return false;
  if (state.status === "failed") return false;
  return (
    amountUnavailable ||
    amountExceedsMax ||
    isPending ||
    state.status === "planning" ||
    state.status === "submitting" ||
    state.status === "mined" ||
    (gameSlug !== "dice" && winChance === 0)
  );
}

function isSelectionMissing(gameSlug: string, winChance: number) {
  return gameSlug !== "dice" && winChance === 0;
}

function getPlaceBetButtonLabelKey({
  gameSlug,
  hasAccount,
  state,
  isPending,
  roundPhase,
  winChance,
  manualSettleAvailable,
  manualRefundAvailable,
  amountUnavailable,
  amountExceedsMax
}: {
  gameSlug: string;
  hasAccount: boolean;
  state: GameRoomBetPanelState;
  isPending: boolean;
  roundPhase?: PlaceBetButtonPhase;
  winChance: number;
  manualSettleAvailable?: boolean;
  manualRefundAvailable?: boolean;
  amountUnavailable?: boolean;
  amountExceedsMax?: boolean;
}) {
  if (!hasAccount) return "casino.room.betPanel.placeBet.connectWallet";
  if (state.status === "failed") return "casino.room.betPanel.placeBet.failedRetry";
  if (manualRefundAvailable) return "casino.room.roundStatus.actions.refundStake";
  if (manualSettleAvailable) return "casino.room.roundStatus.actions.settleResult";
  if (state.status === "planning") return "casino.room.betPanel.placeBet.preparing";
  if (state.status === "submitting") return "casino.room.betPanel.placeBet.signing";
  if (roundPhase === "revealing") return "casino.room.betPanel.placeBet.revealing";
  if (roundPhase === "waiting_vrf" || roundPhase === "timeout_soft")
    return "casino.room.roundStatus.phases.waitingVrf.status";
  if (roundPhase === "settling") return "casino.room.roundStatus.phases.settling.status";
  if (roundPhase === "manual_settle_offered") return "casino.room.roundStatus.actions.settleResult";
  if (roundPhase === "refundable") return "casino.room.roundStatus.actions.refundStake";
  if (roundPhase === "loading_quote") return "casino.room.roundStatus.phases.loadingQuote.status";
  if (roundPhase === "failed") return "casino.room.betPanel.placeBet.failedRetry";
  if (state.status === "mined") return "casino.room.betPanel.placeBet.betMined";
  if (isPending || state.status === "reconciled")
    return "casino.room.betPanel.placeBet.roundInProgress";
  if (amountUnavailable) return "casino.room.shell.noCapacity";
  if (amountExceedsMax) return "casino.room.betPanel.placeBet.reduceAmount";
  if (isSelectionMissing(gameSlug, winChance)) return "casino.room.betPanel.placeBet.selectToBet";
  if (state.plan)
    return state.plan.preview?.needsApproval
      ? "casino.room.betPanel.placeBet.approveThenPlace"
      : "casino.room.betPanel.placeBet.placeBet";
  return "casino.room.betPanel.placeBet.placeBet";
}

export function PlaceBetButton({
  gameSlug,
  hasAccount,
  isPending,
  winChance,
  state,
  roundPhase,
  manualSettleAvailable = false,
  manualRefundAvailable = false,
  amountUnavailable = false,
  amountExceedsMax = false,
  onClick,
  density = "normal"
}: {
  gameSlug: string;
  hasAccount: boolean;
  isPending: boolean;
  winChance: number;
  state: GameRoomBetPanelState;
  roundPhase?: PlaceBetButtonPhase;
  manualSettleAvailable?: boolean;
  manualRefundAvailable?: boolean;
  amountUnavailable?: boolean;
  amountExceedsMax?: boolean;
  onClick: () => void;
  density?: "normal" | "compact";
}) {
  const t = useTranslations();
  const disabled = isPlaceBetButtonDisabled({
    gameSlug,
    isPending,
    winChance,
    state,
    manualSettleAvailable,
    manualRefundAvailable,
    amountUnavailable,
    amountExceedsMax
  });
  const activeManualAction = manualSettleAvailable || manualRefundAvailable;
  const isFailed = state.status === "failed";
  const selectionMissing = isSelectionMissing(gameSlug, winChance);
  const appearsLocked =
    !isFailed &&
    !activeManualAction &&
    (isPending ||
      state.status === "reconciled" ||
      state.status === "submitting" ||
      state.status === "mined" ||
      state.status === "planning" ||
      amountUnavailable ||
      amountExceedsMax ||
      selectionMissing);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border-b-[4px] font-extrabold transition-colors",
        density === "compact" ? "py-3 text-sm" : "py-4 text-lg",
        appearsLocked
          ? "cursor-not-allowed border-border bg-surface-3 text-fg-subtle opacity-50 shadow-none"
          : isFailed
            ? "border-danger bg-danger text-fg-inverse hover:bg-danger/90"
            : "border-brand-active bg-brand text-fg-inverse shadow-glow hover:bg-brand-hover"
      )}
    >
      {t(
        getPlaceBetButtonLabelKey({
          gameSlug,
          hasAccount,
          state,
          isPending,
          roundPhase,
          winChance,
          manualSettleAvailable,
          manualRefundAvailable,
          amountUnavailable,
          amountExceedsMax
        })
      )}
    </button>
  );
}
