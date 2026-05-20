"use client";

import * as React from "react";
import type { SportsTicketRow } from "@ssot/bet-index";

import type { BetSlipReceipt, BetSlipState } from "./useBetSlip";

export type SportsRoundKind =
  | "idle"
  | "ready"
  | "quoting"
  | "planning"
  | "signing"
  | "mining"
  | "tracking"
  | "settled"
  | "refunded"
  | "voided"
  | "failed";

export interface SportsRoundState {
  kind: SportsRoundKind;
  ticketId?: string;
  txHash?: string;
}

export function deriveSportsRoundState({
  error,
  receipt,
  slipState,
  ticket
}: {
  error?: string;
  receipt?: BetSlipReceipt;
  slipState: BetSlipState;
  ticket?: SportsTicketRow;
}): SportsRoundState {
  const ticketId = ticket?.ticketId ?? receipt?.ticketId?.toString();
  const txHash = ticket?.terminalTxHash ?? ticket?.lastTxHash ?? receipt?.txHash;

  if (ticket?.state === "settled") return { kind: "settled", ticketId, txHash };
  if (ticket?.state === "refunded") return { kind: "refunded", ticketId, txHash };
  if (ticket?.state === "voided") return { kind: "voided", ticketId, txHash };
  if (error || slipState === "error") return { kind: "failed", ticketId, txHash };
  if (receipt?.ticketId || ticket?.state === "held") return { kind: "tracking", ticketId, txHash };

  if (slipState === "ready") return { kind: "ready" };
  if (slipState === "fetchingOdds") return { kind: "quoting" };
  if (slipState === "planning") return { kind: "planning" };
  if (slipState === "signing") return { kind: "signing" };
  if (slipState === "mining") return { kind: "mining" };
  return { kind: "idle" };
}

export function useSportsRound({
  error,
  receipt,
  slipState,
  ticket
}: {
  error?: string;
  receipt?: BetSlipReceipt;
  slipState: BetSlipState;
  ticket?: SportsTicketRow;
}) {
  return React.useMemo(
    () => deriveSportsRoundState({ error, receipt, slipState, ticket }),
    [error, receipt, slipState, ticket]
  );
}
