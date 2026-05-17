"use client";

import * as React from "react";
import type { DomainBet } from "@ssot/ssot";
import type { SSOTSDK, TxResult } from "@ssot/ssot/sdk";

import { formatUnits } from "../../betting/model/units";

export const CASINO_ROUND_MANUAL_SETTLE_DELAY_MS = 30_000;
export const CASINO_ROUND_SOFT_VRF_TIMEOUT_MS = 60_000;

export type CasinoRoundPhase =
  | "idle"
  | "loading_quote"
  | "ready"
  | "placing"
  | "waiting_vrf"
  | "timeout_soft"
  | "settling"
  | "manual_settle_offered"
  | "settled"
  | "refundable"
  | "failed";

export type CasinoRoundSnapshot = {
  phase: CasinoRoundPhase;
  bet?: DomainBet;
  quote?: bigint;
  quoteError?: string;
  error?: string;
  randomReadyAt?: number;
  settleTx?: TxResult;
  refundTx?: TxResult;
};

export function formatNativeFee(value: bigint | undefined, symbol = "ETH") {
  if (value == null) return "—";
  const raw = formatUnits(value, 18);
  const [intPart = "0", fracPart = ""] = raw.split(".");
  const fraction = fracPart.slice(0, 8).replace(/0+$/, "");
  return `${intPart}${fraction ? `.${fraction}` : ""} ${symbol}`;
}

export function deriveCasinoRoundPhase({
  betState,
  placedAt,
  randomReadyAt,
  now,
  refundTimeoutSeconds,
  softVrfTimeoutMs = CASINO_ROUND_SOFT_VRF_TIMEOUT_MS,
  manualSettleDelayMs = CASINO_ROUND_MANUAL_SETTLE_DELAY_MS
}: {
  betState: DomainBet["state"] | undefined;
  placedAt?: number;
  randomReadyAt?: number;
  now: number;
  refundTimeoutSeconds?: number;
  softVrfTimeoutMs?: number;
  manualSettleDelayMs?: number;
}): CasinoRoundPhase {
  if (betState === "finalized") return "settled";
  if (betState === "refunded") return "refundable";
  if (betState === "randomReady") {
    if (randomReadyAt && now - randomReadyAt >= manualSettleDelayMs) {
      return "manual_settle_offered";
    }
    return "settling";
  }
  if (betState === "placed") {
    const placedAtMs = toUnixMs(placedAt);
    if (placedAtMs != null) {
      const elapsedMs = now - placedAtMs;
      if (refundTimeoutSeconds && elapsedMs >= refundTimeoutSeconds * 1_000) {
        return "refundable";
      }
      if (elapsedMs >= softVrfTimeoutMs) return "timeout_soft";
    }
    return "waiting_vrf";
  }
  return "idle";
}

function toUnixMs(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return undefined;
  return value > 1_000_000_000_000 ? value : value * 1_000;
}

export function useCasinoVrfQuote({
  sdk,
  betCount,
  quoteErrorMessage = "—"
}: {
  sdk: SSOTSDK | undefined;
  betCount: number;
  quoteErrorMessage?: string;
}) {
  const [snapshot, setSnapshot] = React.useState<CasinoRoundSnapshot>({ phase: "idle" });

  React.useEffect(() => {
    let cancelled = false;
    const count = Math.max(1, Math.floor(betCount));

    if (!sdk) {
      setSnapshot((current) => (current.phase === "idle" ? current : { phase: "idle" }));
      return;
    }

    setSnapshot((current) => ({ ...current, phase: "loading_quote", quoteError: undefined }));

    sdk.gameHub
      .quoteVRFFee(count)
      .then((quote) => {
        if (!cancelled) setSnapshot({ phase: "ready", quote });
      })
      .catch((error) => {
        if (!cancelled) {
          setSnapshot({
            phase: "ready",
            quoteError: (error as Error)?.message ?? quoteErrorMessage
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sdk, betCount, quoteErrorMessage]);

  return snapshot;
}

export function useCasinoRoundWatcher({
  sdk,
  betId,
  active,
  onTerminal,
  refundTimeoutSeconds,
  pollIntervalMs = 2_000,
  softVrfTimeoutMs = CASINO_ROUND_SOFT_VRF_TIMEOUT_MS,
  manualSettleDelayMs = CASINO_ROUND_MANUAL_SETTLE_DELAY_MS,
  readErrorMessage = "—",
  manualSettleErrorMessage = "—",
  refundErrorMessage = "—"
}: {
  sdk: SSOTSDK | undefined;
  betId: bigint | undefined;
  active: boolean;
  onTerminal?: (bet: DomainBet) => void;
  refundTimeoutSeconds?: number;
  pollIntervalMs?: number;
  softVrfTimeoutMs?: number;
  manualSettleDelayMs?: number;
  readErrorMessage?: string;
  manualSettleErrorMessage?: string;
  refundErrorMessage?: string;
}) {
  const [snapshot, setSnapshot] = React.useState<CasinoRoundSnapshot>({ phase: "idle" });
  const terminalBetIdRef = React.useRef<bigint | undefined>();

  React.useEffect(() => {
    if (!sdk || !active || betId === undefined) {
      setSnapshot((current) => (current.phase === "idle" ? current : { phase: "idle" }));
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const bet = await sdk.gameHub.getBet(betId);
        if (cancelled) return;

        setSnapshot((current) => {
          const randomReadyAt =
            bet.state === "randomReady"
              ? (current.randomReadyAt ?? Date.now())
              : current.randomReadyAt;
          return {
            ...current,
            bet,
            randomReadyAt,
            phase: deriveCasinoRoundPhase({
              betState: bet.state,
              placedAt: bet.placedAt,
              randomReadyAt,
              now: Date.now(),
              refundTimeoutSeconds,
              softVrfTimeoutMs,
              manualSettleDelayMs
            }),
            error: undefined
          };
        });

        if (
          (bet.state === "finalized" || bet.state === "refunded") &&
          terminalBetIdRef.current !== bet.betId
        ) {
          terminalBetIdRef.current = bet.betId;
          onTerminal?.(bet);
        }
      } catch (error) {
        if (!cancelled) {
          setSnapshot((current) => ({
            ...current,
            phase: "failed",
            error: (error as Error)?.message ?? readErrorMessage
          }));
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    sdk,
    active,
    betId,
    onTerminal,
    pollIntervalMs,
    readErrorMessage,
    refundTimeoutSeconds,
    softVrfTimeoutMs,
    manualSettleDelayMs
  ]);

  const manualSettle = React.useCallback(async () => {
    if (!sdk || betId === undefined) return;
    setSnapshot((current) => ({ ...current, phase: "settling", error: undefined }));
    const manualSettleTx = await sdk.gameHub.finalize(betId);
    setSnapshot((current) => ({
      ...current,
      settleTx: manualSettleTx,
      phase: manualSettleTx.ok ? "settling" : "manual_settle_offered",
      error: manualSettleTx.ok
        ? undefined
        : (manualSettleTx.error?.message ?? manualSettleErrorMessage)
    }));
  }, [sdk, betId, manualSettleErrorMessage]);

  const manualRefund = React.useCallback(async () => {
    if (!sdk || betId === undefined) return;
    setSnapshot((current) => ({ ...current, phase: "refundable", error: undefined }));
    const refundTx = await sdk.gameHub.refund(betId);
    setSnapshot((current) => ({
      ...current,
      refundTx,
      phase: "refundable",
      error: refundTx.ok ? undefined : (refundTx.error?.message ?? refundErrorMessage)
    }));
  }, [sdk, betId, refundErrorMessage]);

  return {
    ...snapshot,
    manualSettle,
    manualRefund,
    manualSettleAvailable: snapshot.phase === "manual_settle_offered",
    manualRefundAvailable: snapshot.phase === "refundable" && snapshot.bet?.state === "placed",
    isLive:
      active &&
      (snapshot.phase === "waiting_vrf" ||
        snapshot.phase === "timeout_soft" ||
        snapshot.phase === "settling" ||
        snapshot.phase === "manual_settle_offered")
  };
}
