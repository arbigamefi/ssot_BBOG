"use client";

import * as React from "react";
import type { DomainBet } from "@ssot/ssot";
import { watchGameHubRoundEvents, type SSOTSDK, type TxResult } from "@ssot/ssot/sdk";

import { resolvePublicWsRpcUrl } from "../../../app-shell/rpc";
import { formatUnits } from "../../betting/model/units";

export const CASINO_ROUND_MANUAL_SETTLE_DELAY_MS = 30_000;
export const CASINO_ROUND_SOFT_VRF_TIMEOUT_MS = 60_000;
export const CASINO_ROUND_READ_RETRY_GRACE_MS = 15_000;
export const CASINO_ROUND_EVENT_FALLBACK_POLL_INTERVAL_MS = 10_000;

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

export function isBetNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\bBetNotFound\b/.test(message);
}

export function getCasinoRoundReadErrorMessage({
  error,
  fallback,
  betNotFoundFallback
}: {
  error: unknown;
  fallback: string;
  betNotFoundFallback?: string;
}) {
  return isBetNotFoundError(error) ? (betNotFoundFallback ?? fallback) : fallback;
}

export function shouldDeferCasinoRoundReadError({
  error,
  startedAt,
  now,
  graceMs = CASINO_ROUND_READ_RETRY_GRACE_MS
}: {
  error: unknown;
  startedAt: number;
  now: number;
  graceMs?: number;
}) {
  return isBetNotFoundError(error) && now - startedAt < graceMs;
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
      .catch(() => {
        if (!cancelled) {
          setSnapshot({
            phase: "ready",
            quoteError: quoteErrorMessage
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
  betNotFoundErrorMessage,
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
  betNotFoundErrorMessage?: string;
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
    let terminalReached = false;
    let interval: number | undefined;
    let unwatchEvents: (() => void) | undefined;
    let pollInFlight = false;
    let pollQueued = false;
    const startedAt = Date.now();
    const stopPolling = () => {
      terminalReached = true;
      if (interval) {
        window.clearInterval(interval);
        interval = undefined;
      }
      unwatchEvents?.();
      unwatchEvents = undefined;
    };

    const poll = async () => {
      if (terminalReached) return;
      if (pollInFlight) {
        pollQueued = true;
        return;
      }
      pollInFlight = true;
      try {
        const bet = await sdk.gameHub.getBet(betId);
        if (cancelled || terminalReached) return;

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
          stopPolling();
        }
      } catch (error) {
        if (!cancelled && !terminalReached) {
          const now = Date.now();
          const deferReadError = shouldDeferCasinoRoundReadError({ error, startedAt, now });
          setSnapshot((current) => {
            const keepCurrentRound = Boolean(current.bet) || deferReadError;
            const phase = keepCurrentRound
              ? current.phase === "idle" || current.phase === "failed"
                ? "waiting_vrf"
                : current.phase
              : "failed";
            return {
              ...current,
              phase,
              error: keepCurrentRound
                ? undefined
                : getCasinoRoundReadErrorMessage({
                    error,
                    fallback: readErrorMessage,
                    betNotFoundFallback: betNotFoundErrorMessage
                  })
            };
          });
        }
      } finally {
        pollInFlight = false;
        if (pollQueued && !cancelled && !terminalReached) {
          pollQueued = false;
          void poll();
        }
      }
    };

    const wsRpcUrl = resolvePublicWsRpcUrl(sdk.release.chainId);
    if (wsRpcUrl) {
      try {
        unwatchEvents = watchGameHubRoundEvents({
          release: sdk.release,
          wsUrl: wsRpcUrl,
          betId,
          onRoundEvent: () => void poll(),
          onError: () => {
            // WebSocket events are a latency optimization; HTTP polling remains the fallback.
          }
        });
      } catch {
        unwatchEvents = undefined;
      }
    }

    void poll();
    const fallbackPollIntervalMs = wsRpcUrl
      ? Math.max(pollIntervalMs, CASINO_ROUND_EVENT_FALLBACK_POLL_INTERVAL_MS)
      : pollIntervalMs;
    interval = window.setInterval(() => void poll(), fallbackPollIntervalMs);
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      unwatchEvents?.();
    };
  }, [
    sdk,
    active,
    betId,
    onTerminal,
    pollIntervalMs,
    betNotFoundErrorMessage,
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
      error: manualSettleTx.ok ? undefined : manualSettleErrorMessage
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
      error: refundTx.ok ? undefined : refundErrorMessage
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
