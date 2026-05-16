import * as React from "react";
import { cn } from "@ssot/ui";

import { formatNativeFee, type CasinoRoundPhase } from "./casino-round";

function getPhaseCopy(phase: CasinoRoundPhase) {
  switch (phase) {
    case "loading_quote":
      return {
        label: "Estimating VRF fee",
        detail: "Reading the current randomness fee before you place a round."
      };
    case "waiting_vrf":
      return {
        label: "Rolling",
        detail: "PlaceBet is mined. Waiting for verifiable randomness."
      };
    case "placing":
      return {
        label: "Placing bet",
        detail:
          "Approve if needed, then sign PlaceBet. The round starts once the transaction is mined."
      };
    case "settling":
      return {
        label: "Settling result",
        detail: "Randomness is ready. Keeper settlement should complete automatically."
      };
    case "manual_settle_offered":
      return {
        label: "Keeper delay",
        detail: "Settlement is delayed. You can manually settle this result as a fallback."
      };
    case "settled":
      return {
        label: "Round settled",
        detail: "Settlement is confirmed on-chain. Indexing proof for the result modal."
      };
    case "refundable":
      return {
        label: "Refund path available",
        detail: "VRF did not complete in time. The refund path can return the stake."
      };
    case "failed":
      return {
        label: "Round monitor failed",
        detail: "Unable to read the latest round state from the RPC provider."
      };
    default:
      return {
        label: "Ready",
        detail: "One click will approve if needed, place the bet, and watch settlement."
      };
  }
}

export function CasinoRoundStatusPanel({
  phase,
  quote,
  quoteError,
  betId,
  requestId,
  error,
  manualSettleAvailable,
  onManualSettle
}: {
  phase: CasinoRoundPhase;
  quote?: bigint;
  quoteError?: string;
  betId?: bigint;
  requestId?: bigint;
  error?: string;
  manualSettleAvailable?: boolean;
  onManualSettle?: () => void;
}) {
  const copy = getPhaseCopy(phase);
  const active =
    phase === "waiting_vrf" ||
    phase === "placing" ||
    phase === "settling" ||
    phase === "manual_settle_offered" ||
    phase === "loading_quote";

  return (
    <div
      className={cn(
        "mb-4 rounded-lg border bg-surface-1 p-4 text-sm shadow-inner-e1",
        active ? "border-brand/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-fg-subtle">
            Round status
          </p>
          <p className="mt-1 font-bold text-fg">{copy.label}</p>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            {error ?? quoteError ?? copy.detail}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
            active
              ? "border-brand/30 bg-brand-soft text-brand"
              : "border-border bg-surface-2 text-fg-subtle"
          )}
        >
          {phase.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <p className="text-fg-subtle">VRF estimate</p>
          <p className="mt-1 font-mono font-bold text-fg">{formatNativeFee(quote)}</p>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <p className="text-fg-subtle">Bet ID</p>
          <p className="mt-1 truncate font-mono font-bold text-fg">
            {betId == null ? "—" : betId.toString()}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-2">
          <p className="text-fg-subtle">VRF request</p>
          <p className="mt-1 truncate font-mono font-bold text-fg">
            {requestId == null || requestId === 0n ? "—" : requestId.toString()}
          </p>
        </div>
      </div>

      {manualSettleAvailable && (
        <button
          type="button"
          onClick={onManualSettle}
          className="mt-4 w-full rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-warn transition-colors hover:bg-warn/15"
        >
          Settle result
        </button>
      )}
    </div>
  );
}
