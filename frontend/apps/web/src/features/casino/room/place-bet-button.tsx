import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

export type GameRoomBetPanelState = {
  status: string;
  error?: { message?: string };
  plan?: { preview?: { needsApproval?: boolean } };
};

export function isPlaceBetButtonDisabled({
  gameSlug,
  isPending,
  winChance,
  state
}: {
  gameSlug: string;
  isPending: boolean;
  winChance: number;
  state: GameRoomBetPanelState;
}) {
  return (
    isPending ||
    state.status === "planning" ||
    state.status === "submitting" ||
    state.status === "mined" ||
    (gameSlug !== "dice" && winChance === 0)
  );
}

function getPlaceBetButtonLabelKey({
  hasAccount,
  state,
  isPending
}: {
  hasAccount: boolean;
  state: GameRoomBetPanelState;
  isPending: boolean;
}) {
  if (!hasAccount) return "casino.room.betPanel.placeBet.connectWallet";
  if (state.status === "failed") return "casino.room.betPanel.placeBet.failedRetry";
  if (isPending || state.status === "reconciled")
    return "casino.room.betPanel.placeBet.roundInProgress";
  if (state.status === "mined") return "casino.room.betPanel.placeBet.betMined";
  if (state.status === "submitting") return "casino.room.betPanel.placeBet.signing";
  if (state.plan)
    return state.plan.preview?.needsApproval
      ? "casino.room.betPanel.placeBet.approveThenPlace"
      : "casino.room.betPanel.placeBet.placeBet";
  if (state.status === "planning") return "casino.room.betPanel.placeBet.preparing";
  return "casino.room.betPanel.placeBet.placeBet";
}

export function PlaceBetButton({
  gameSlug,
  hasAccount,
  isPending,
  winChance,
  state,
  onClick
}: {
  gameSlug: string;
  hasAccount: boolean;
  isPending: boolean;
  winChance: number;
  state: GameRoomBetPanelState;
  onClick: () => void;
}) {
  const t = useTranslations();
  const disabled = isPlaceBetButtonDisabled({ gameSlug, isPending, winChance, state });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "mt-8 w-full rounded-lg border-b-[4px] py-6 text-xl font-extrabold transition-colors",
        isPending ||
          state.status === "reconciled" ||
          state.status === "submitting" ||
          state.status === "mined" ||
          state.status === "planning"
          ? "cursor-not-allowed border-border bg-surface-3 text-fg-subtle opacity-50 shadow-none"
          : state.status === "failed"
            ? "border-danger bg-danger text-fg hover:bg-danger/90"
            : "border-brand-active bg-brand text-fg shadow-glow hover:bg-brand-hover"
      )}
    >
      {t(getPlaceBetButtonLabelKey({ hasAccount, state, isPending }))}
    </button>
  );
}
