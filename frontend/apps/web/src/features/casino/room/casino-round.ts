"use client";

import * as React from "react";
import type { DomainBet } from "@ssot/ssot";
import type { GameConfig, Hex, SSOTSDK, TxResult } from "@ssot/ssot/sdk";

import { resolvePublicWsRpcUrl } from "../../../app-shell/rpc";
import { isTerminalBetState } from "../../betting/bet-state";
import { formatUnits } from "../../betting/model/units";
import { isContractRevert } from "./feedback";

export const CASINO_ROUND_MANUAL_SETTLE_DELAY_MS = 30_000;
export const CASINO_ROUND_SOFT_VRF_TIMEOUT_MS = 60_000;
export const CASINO_ROUND_READ_RETRY_GRACE_MS = 15_000;
export const CASINO_ROUND_EVENT_FALLBACK_POLL_INTERVAL_MS = 10_000;
/** How often a PendingVRF bet past the soft timeout rereads whether its VRF result was received. */
export const CASINO_ROUND_VRF_RESULT_CHECK_MS = 30_000;

type RoundEventWatcher = (typeof import("@ssot/ssot/sdk"))["watchGameHubRoundEvents"];

async function loadRoundEventWatcher(): Promise<RoundEventWatcher> {
  const sdk = await import("@ssot/ssot/sdk");
  return sdk.watchGameHubRoundEvents;
}

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
  /**
   * The VRF result was received but cannot be booked: a PendingVRF bet whose request is Received, or a
   * RandomReady bet whose settlement the contract reverted. It settles or is voided later (ADR-0037 §7).
   */
  | "result_unbooked"
  | "voided"
  | "failed";

/**
 * A PendingVRF bet's VRF request as last read: "received" means the seed is stored but not booked, so
 * GameHub.refund reverts (InvalidRandomReceipt); "awaiting" means the timeout refund may apply.
 */
export type CasinoRoundVrfResult = "awaiting" | "received";

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
  refundDeadline,
  vrfResult,
  settlementReverted = false,
  softVrfTimeoutMs = CASINO_ROUND_SOFT_VRF_TIMEOUT_MS,
  manualSettleDelayMs = CASINO_ROUND_MANUAL_SETTLE_DELAY_MS
}: {
  betState: DomainBet["state"] | undefined;
  placedAt?: number;
  randomReadyAt?: number;
  now: number;
  refundDeadline?: number;
  /** Unread until the watcher checks it; the refund is offered only after a read says "awaiting". */
  vrfResult?: CasinoRoundVrfResult;
  /** The contract reverted a manual settlement of this RandomReady bet. */
  settlementReverted?: boolean;
  softVrfTimeoutMs?: number;
  manualSettleDelayMs?: number;
}): CasinoRoundPhase {
  if (betState === "finalized") return "settled";
  if (betState === "refunded") return "refundable";
  if (betState === "voided") return "voided";
  if (betState === "randomReady") {
    if (settlementReverted) return "result_unbooked";
    if (randomReadyAt && now - randomReadyAt >= manualSettleDelayMs) {
      return "manual_settle_offered";
    }
    return "settling";
  }
  if (betState === "placed") {
    if (vrfResult === "received") return "result_unbooked";
    const placedAtMs = toUnixMs(placedAt);
    if (placedAtMs != null) {
      const elapsedMs = now - placedAtMs;
      if (refundDeadline && now >= refundDeadline * 1_000 && vrfResult === "awaiting") {
        return "refundable";
      }
      if (elapsedMs >= softVrfTimeoutMs) return "timeout_soft";
    }
    return "waiting_vrf";
  }
  return "idle";
}

/** The watcher's knowledge when it concerns `betId`, otherwise a fresh record for it. */
function ownKnowledge<T extends { betId?: bigint; checkedAt: number }>(known: T, betId: bigint) {
  return known.betId === betId ? known : { betId, checkedAt: 0 };
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
  gameId,
  betCount,
  quoteErrorMessage = "—"
}: {
  sdk: SSOTSDK | undefined;
  gameId: Hex | undefined;
  betCount: number;
  quoteErrorMessage?: string;
}) {
  const [revision, refresh] = React.useReducer((n: number) => n + 1, 0);
  const [read, setRead] = React.useState<{
    sdk: SSOTSDK;
    gameId: Hex;
    betCount: number;
    revision: number;
    result: CasinoRoundSnapshot & { config?: GameConfig };
  }>();
  React.useEffect(() => {
    if (!sdk || !gameId) return;
    let cancelled = false;
    let reading = false;
    const update = (result: CasinoRoundSnapshot & { config?: GameConfig }) => {
      if (!cancelled) setRead({ sdk, gameId, betCount, revision, result });
    };
    const run = async () => {
      if (reading) return;
      reading = true;
      let config: GameConfig | undefined;
      try {
        config = await sdk.gameHub.getGameConfig(gameId);
        // GameHub refuses quotes for a disabled game (ADR-0037 §6); the room shows it closed.
        if (config.disabled) {
          update({ phase: "ready", config });
          return;
        }
        if (!Number.isInteger(betCount) || betCount < 1 || betCount > config.maxBetCount)
          throw new Error("Game round limit");
        const quote = await sdk.gameHub.quoteVRFFee(gameId, betCount);
        update({ phase: "ready", config, quote });
      } catch {
        update({ phase: "ready", config, quoteError: quoteErrorMessage });
      } finally {
        reading = false;
      }
    };
    void run();
    const timer = setInterval(run, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sdk, gameId, betCount, quoteErrorMessage, revision]);
  // A quote from another wallet/game/count is never usable during the render before the next effect.
  const current =
    read &&
    read.sdk === sdk &&
    read.gameId === gameId &&
    read.betCount === betCount &&
    read.revision === revision
      ? read.result
      : undefined;
  return {
    ...(current ?? { phase: sdk && gameId ? ("loading_quote" as const) : ("idle" as const) }),
    refresh
  };
}

export function useCasinoRoundWatcher({
  sdk,
  betId,
  active,
  onTerminal,
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
  // What the watcher learned beyond getBet, shared by the poll and the manual actions, which can learn
  // first that a result was received or that its settlement reverts.
  const knownRef = React.useRef<{
    betId?: bigint;
    result?: CasinoRoundVrfResult;
    checkedAt: number;
    settlementReverted?: boolean;
  }>({ checkedAt: 0 });

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
    knownRef.current = { betId, checkedAt: 0 };
    const stopPolling = () => {
      terminalReached = true;
      if (interval) {
        window.clearInterval(interval);
        interval = undefined;
      }
      unwatchEvents?.();
      unwatchEvents = undefined;
    };

    // A PendingVRF bet past the soft timeout may hold a received but unbooked result, which the timeout
    // refund cannot take. Read it before offering the refund, and again while it is not received.
    const checkVrfResult = async (bet: DomainBet) => {
      const known = knownRef.current;
      const now = Date.now();
      const placedAtMs = toUnixMs(bet.placedAt);
      const overdue =
        (placedAtMs != null && now - placedAtMs >= softVrfTimeoutMs) ||
        (bet.refundDeadline > 0 && now >= bet.refundDeadline * 1_000);
      if (
        bet.state !== "placed" ||
        !overdue ||
        known.result === "received" ||
        now - known.checkedAt < CASINO_ROUND_VRF_RESULT_CHECK_MS
      )
        return;
      knownRef.current = { ...known, checkedAt: now };
      try {
        const status = await sdk.gameHub.getVoidStatus(betId);
        if (knownRef.current.betId !== betId) return;
        knownRef.current = {
          ...knownRef.current,
          result: status.resultReceived ? "received" : "awaiting",
          checkedAt: now
        };
      } catch {
        // Unknown: the refund stays hidden until a read says the request still awaits its result.
      }
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
        await checkVrfResult(bet);
        if (cancelled || terminalReached) return;
        const known = knownRef.current.betId === betId ? knownRef.current : undefined;

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
              refundDeadline: bet.refundDeadline,
              vrfResult: known?.result,
              settlementReverted: known?.settlementReverted,
              randomReadyAt,
              now: Date.now(),
              softVrfTimeoutMs,
              manualSettleDelayMs
            }),
            error: undefined
          };
        });

        if (isTerminalBetState(bet.state) && terminalBetIdRef.current !== bet.betId) {
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
      void loadRoundEventWatcher()
        .then((watchGameHubRoundEvents) => {
          if (cancelled || terminalReached) return;
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
        })
        .catch(() => {
          unwatchEvents = undefined;
        });
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
    softVrfTimeoutMs,
    manualSettleDelayMs
  ]);

  const manualSettle = React.useCallback(async () => {
    if (!sdk || betId === undefined) return;
    setSnapshot((current) => ({ ...current, phase: "settling", error: undefined }));
    const manualSettleTx = await sdk.gameHub.finalize(betId);
    // The contract refused to settle: retrying cannot help, the result waits for a void (ADR-0037 §7).
    // A wallet cancellation or a connection problem keeps the retry.
    if (!manualSettleTx.ok && isContractRevert(manualSettleTx.error)) {
      knownRef.current = { ...ownKnowledge(knownRef.current, betId), settlementReverted: true };
      setSnapshot((current) => ({
        ...current,
        settleTx: manualSettleTx,
        phase: "result_unbooked",
        error: undefined
      }));
      return;
    }
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
    // The result arrived after the last read: the refund can never apply, the bet settles or voids.
    if (!refundTx.ok && refundTx.error?.code === "REVERT_InvalidRandomReceipt") {
      knownRef.current = {
        ...ownKnowledge(knownRef.current, betId),
        result: "received",
        checkedAt: Date.now()
      };
      setSnapshot((current) => ({
        ...current,
        refundTx,
        phase: "result_unbooked",
        error: undefined
      }));
      return;
    }
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
