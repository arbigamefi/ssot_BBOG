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
  randomReadyAt,
  now,
  manualSettleDelayMs = CASINO_ROUND_MANUAL_SETTLE_DELAY_MS
}: {
  betState: DomainBet["state"] | undefined;
  randomReadyAt?: number;
  now: number;
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
  if (betState === "placed") return "waiting_vrf";
  return "idle";
}

export function useCasinoVrfQuote({
  sdk,
  betCount
}: {
  sdk: SSOTSDK | undefined;
  betCount: number;
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
            quoteError: (error as Error)?.message ?? "Unable to estimate VRF fee."
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sdk, betCount]);

  return snapshot;
}

export function useCasinoRoundWatcher({
  sdk,
  betId,
  active,
  onTerminal,
  pollIntervalMs = 2_000,
  manualSettleDelayMs = CASINO_ROUND_MANUAL_SETTLE_DELAY_MS
}: {
  sdk: SSOTSDK | undefined;
  betId: bigint | undefined;
  active: boolean;
  onTerminal?: (bet: DomainBet) => void;
  pollIntervalMs?: number;
  manualSettleDelayMs?: number;
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
              randomReadyAt,
              now: Date.now(),
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
            error: (error as Error)?.message ?? "Unable to read the live round state."
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
  }, [sdk, active, betId, onTerminal, pollIntervalMs, manualSettleDelayMs]);

  const manualSettle = React.useCallback(async () => {
    if (!sdk || betId === undefined) return;
    setSnapshot((current) => ({ ...current, phase: "settling", error: undefined }));
    const settleTx = await sdk.gameHub.finalize(betId);
    setSnapshot((current) => ({
      ...current,
      settleTx,
      phase: settleTx.ok ? "settling" : "manual_settle_offered",
      error: settleTx.ok ? undefined : (settleTx.error?.message ?? "Manual settlement failed.")
    }));
  }, [sdk, betId]);

  return {
    ...snapshot,
    manualSettle,
    manualSettleAvailable: snapshot.phase === "manual_settle_offered",
    isLive:
      active &&
      (snapshot.phase === "waiting_vrf" ||
        snapshot.phase === "settling" ||
        snapshot.phase === "manual_settle_offered")
  };
}
