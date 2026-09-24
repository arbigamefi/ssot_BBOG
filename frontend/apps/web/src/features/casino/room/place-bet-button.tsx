import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { getBetErrorKind, isBetSubmissionUnconfirmed, type StepperDisplayError } from "./feedback";
import type { PoolAvailability } from "./hooks";

import type { CasinoRoundPhase } from "./casino-round";

export type GameRoomBetPanelState = {
  status: string;
  error?: StepperDisplayError;
  executionStage?: "approve" | "placeBet";
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
  hasAccount = true,
  isPending,
  winChance,
  state,
  manualSettleAvailable = false,
  manualRefundAvailable = false,
  amountUnavailable = false,
  riskInDisabled = false,
  poolAvailability = "ready",
  amountExceedsMax = false
}: {
  gameSlug: string;
  hasAccount?: boolean;
  isPending: boolean;
  winChance: number;
  state: GameRoomBetPanelState;
  manualSettleAvailable?: boolean;
  manualRefundAvailable?: boolean;
  amountUnavailable?: boolean;
  riskInDisabled?: boolean;
  poolAvailability?: PoolAvailability;
  amountExceedsMax?: boolean;
}) {
  // With no wallet the button reads "connect wallet" and its click handler
  // already opens the connect modal (`place-bet-action.ts`: `if (!account)
  // openConnectModal()`). Disabling it for a missing selection made that
  // branch unreachable for exactly the visitor it exists for: a first-timer
  // who has not picked a bet yet sees a greyed-out "connect wallet" and
  // reasonably concludes connecting is broken. Choosing a bet is not a
  // prerequisite for connecting.
  if (manualSettleAvailable || manualRefundAvailable) return false;
  if (riskInDisabled || poolAvailability !== "ready") return true;
  if (isBetSubmissionUnconfirmed(state.error)) return true;
  if (!hasAccount) return false;
  if (state.status === "failed")
    return amountUnavailable || amountExceedsMax || isSelectionMissing(gameSlug, winChance);
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
  amountExceedsMax,
  riskInDisabled,
  poolAvailability
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
  riskInDisabled?: boolean;
  poolAvailability?: PoolAvailability;
  amountExceedsMax?: boolean;
}) {
  if (riskInDisabled && !manualSettleAvailable && !manualRefundAvailable)
    return "casino.availability.title";
  if (manualRefundAvailable) return "casino.room.roundStatus.actions.refundStake";
  if (manualSettleAvailable) return "casino.room.roundStatus.actions.settleResult";
  if (isBetSubmissionUnconfirmed(state.error)) return "casino.room.feedback.pendingLabel";
  if (
    poolAvailability &&
    poolAvailability !== "ready" &&
    !isPending &&
    !["planning", "submitting", "mined", "reconciled"].includes(state.status)
  )
    return `casino.room.poolStatus.${poolAvailability}Label`;
  if (!hasAccount) return "casino.room.betPanel.placeBet.connectWallet";
  if (state.status === "failed") {
    if (amountExceedsMax) return "casino.room.betPanel.placeBet.reduceAmount";
    if (amountUnavailable) return "casino.room.shell.noCapacity";
    if (isSelectionMissing(gameSlug, winChance)) return "casino.room.betPanel.placeBet.selectToBet";
    return getBetErrorKind(state.error) === "canceled"
      ? "casino.room.feedback.tryAgain"
      : "casino.room.feedback.reviewAgain";
  }
  if (state.status === "planning") return "casino.room.betPanel.placeBet.preparing";
  if (state.status === "submitting")
    return state.executionStage === "approve"
      ? "casino.room.feedback.approving"
      : state.executionStage === "placeBet"
        ? "casino.room.feedback.placing"
        : "casino.room.betPanel.placeBet.signing";
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
  riskInDisabled = false,
  poolAvailability = "ready",
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
  riskInDisabled?: boolean;
  poolAvailability?: PoolAvailability;
  amountExceedsMax?: boolean;
  onClick: () => void;
  density?: "normal" | "compact";
}) {
  const t = useTranslations();
  const disabled = isPlaceBetButtonDisabled({
    hasAccount,
    gameSlug,
    isPending,
    winChance,
    state,
    manualSettleAvailable,
    manualRefundAvailable,
    amountUnavailable,
    amountExceedsMax,
    riskInDisabled,
    poolAvailability
  });
  const activeManualAction = manualSettleAvailable || manualRefundAvailable;
  const isFailed = state.status === "failed";
  const selectionMissing = isSelectionMissing(gameSlug, winChance);
  // Keep the locked look in step with the disabled state above. Without the
  // `hasAccount` guard the button would be clickable but rendered greyed out --
  // a worse signal than either state alone.
  const appearsLocked =
    (disabled && !activeManualAction) ||
    (hasAccount &&
      !isFailed &&
      !activeManualAction &&
      (isPending ||
        state.status === "reconciled" ||
        state.status === "submitting" ||
        state.status === "mined" ||
        state.status === "planning" ||
        amountUnavailable ||
        amountExceedsMax ||
        selectionMissing));

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
          : isFailed && getBetErrorKind(state.error) !== "canceled"
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
          amountExceedsMax,
          riskInDisabled,
          poolAvailability
        })
      )}
    </button>
  );
}

/** A full navigation resets transient game state when leaving the unavailable chain. */
export function CasinoTestnetLink() {
  const t = useTranslations("casino.availability");
  return (
    <a
      href="?chainId=84532"
      className="mt-2 flex min-h-11 items-center justify-center rounded-lg border border-brand/30 px-3 text-sm font-semibold text-brand hover:bg-brand-soft"
    >
      {t("tryTestnet")}
    </a>
  );
}
