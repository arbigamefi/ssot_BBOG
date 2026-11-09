"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { toUnixMs } from "../room/casino-round";
import { isCasinoTerminalRoundResult } from "../room/resolution";
import type { GameRoom } from "../room/use-game-room";
import { printerState, type PrinterState } from "./table-model";

/** How long the receipt takes to print out of the slot (12-motion.md §3). */
const PRINT_MS = 1_500;

/** The time now, ticking each second while asked to. */
export function useNow(ticking: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);
  return now;
}

/**
 * The paper's side of a bet on the table. While the table shows the result (`rolling`) the
 * receipt is held; it prints once the ball is in, even when the bet settled sooner. Returns the
 * printer's state and the callbacks the table calls when it starts and stops showing a result.
 */
export function usePrinter(room: GameRoom, shownOutcome: unknown) {
  const revealing = room.stageReveal?.phase === "revealing";
  const { completeStageReveal } = room;
  const [rolling, setRolling] = React.useState(false);
  const onRolling = React.useCallback(() => setRolling(true), []);
  const onLanded = React.useCallback(() => {
    setRolling(false);
    if (revealing) completeStageReveal();
  }, [completeStageReveal, revealing]);
  React.useEffect(() => {
    if (!shownOutcome) setRolling(false);
  }, [shownOutcome]);

  const receipt = room.showResult && isCasinoTerminalRoundResult(room.resultProof) && !rolling;
  const [printed, setPrinted] = React.useState(false);
  React.useEffect(() => {
    setPrinted(false);
    if (!receipt) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    const timer = setTimeout(() => setPrinted(true), still ? 0 : PRINT_MS);
    return () => clearTimeout(timer);
  }, [receipt]);

  return {
    revealing,
    rolling,
    onRolling,
    onLanded,
    state: printerState({
      phase: room.placeBetButtonPhase,
      revealing: rolling || revealing,
      receipt,
      printed
    })
  };
}

/**
 * The printer is only its paper slot, level with the top of the felt, with one status light above
 * it. The slip's own live region says the same to a screen reader.
 */
export function Printer({
  state,
  placedAt,
  className
}: {
  state: PrinterState;
  placedAt: number | undefined;
  className: string;
}) {
  const t = useTranslations("casino.table.printer");
  const now = useNow(state === "waiting");
  const placedMs = toUnixMs(placedAt);
  const seconds = placedMs ? Math.max(0, Math.floor((now - placedMs) / 1000)) : 0;
  const lit = state != null && state !== "ready";
  return (
    <div aria-hidden="true" className={className}>
      <span className="mx-1 mb-2.5 flex min-h-[1.45em] items-center justify-end gap-2 text-note text-on-carbon-muted tabular-nums">
        <i
          data-lit={lit || undefined}
          className={`table-led size-[7px] ${
            state === "waiting"
              ? "motion-safe:animate-led-wait"
              : state === "printing"
                ? "motion-safe:animate-led-print"
                : ""
          }`}
        />
        <span>{state == null ? "" : t(state, { seconds })}</span>
      </span>
      <div className="print-slot mx-0.5 h-3" />
    </div>
  );
}
