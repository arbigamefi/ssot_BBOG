import * as React from "react";
import { cn } from "@ssot/ui";

import type { CoinSide } from "./params";
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
  coinSide,
  hasAccount,
  isPending,
  winChance,
  state,
  onClick
}: {
  gameSlug: string;
  coinSide: CoinSide;
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
        "mt-8 w-full py-6 rounded-2xl text-white font-extrabold text-xl shadow-2xl transition-all border-b-[4px]",
        isPending ||
          state.status === "reconciled" ||
          state.status === "submitting" ||
          state.status === "mined" ||
          state.status === "planning"
          ? "bg-[#111] opacity-50 cursor-not-allowed border-black text-white/50 shadow-none hover:bg-[#111]"
          : state.status === "failed"
            ? "bg-red-600 border-red-800 text-white hover:bg-red-500"
            : gameSlug === "dice"
              ? "bg-purple-600 border-purple-800 text-white hover:bg-purple-500"
              : gameSlug === "roulette"
                ? "bg-emerald-600 border-emerald-800 text-white hover:bg-emerald-500"
                : gameSlug === "coin-toss"
                  ? coinSide === "HEADS"
                    ? "bg-amber-500 border-amber-700 text-amber-950 hover:bg-amber-400"
                    : "bg-indigo-600 border-indigo-800 text-white hover:bg-indigo-500"
                  : "bg-fuchsia-600 border-fuchsia-800 text-white hover:bg-fuchsia-500"
      )}
    >
      {getPlaceBetButtonLabel({ hasAccount, state, isPending })}
    </button>
  );
}
