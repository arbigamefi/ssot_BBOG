import * as React from "react";
import { cn } from "@ssot/ui";

import type { GameRoomBetPanelState } from "./bet-panel-state";

export function getPlaceBetButtonLabel({
  hasAccount,
  state,
  isPending
}: {
  hasAccount: boolean;
  state: GameRoomBetPanelState;
  isPending: boolean;
}) {
  if (!hasAccount) return "CONNECT WALLET";
  if (state.status === "failed") return "TRANSACTION FAILED - RETRY";
  if (isPending || state.status === "reconciled") return "WAITING FOR VRF...";
  if (state.status === "mined" || state.status === "submitting") return "CONFIRM IN WALLET...";
  if (state.plan) return state.plan.preview?.needsApproval ? "APPROVE TICKET" : "CONFIRM TICKET";
  if (state.status === "planning") return "REVIEWING TICKET...";
  return "PLACE BET";
}

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
      {getPlaceBetButtonLabel({ hasAccount, state, isPending })}
    </button>
  );
}
