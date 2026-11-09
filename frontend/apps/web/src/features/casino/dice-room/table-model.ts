import type { PlaceBetButtonPhase } from "../room/place-bet-button";

// The dice table's state, as data: how a net win is paid on the felt and what the printer's
// status light says (docs/design/02-voice-and-copy.md §11, 04-page-blueprints.md §4).

export type Celebration = {
  /** The net result, above zero. */
  net: bigint;
  /** Chips paid onto the bet: more for a bigger multiple of the stake. */
  chips: 2 | 3 | 5 | 7;
  /** 10x or more: the net amount pulses and the lamp warms further. */
  big: boolean;
};

/**
 * How the table pays a result: only a net win, in proportion to what came back over the stake.
 * A loss, a push or a payout below the stake gets nothing.
 */
export function celebrate(outcome: { netResult: bigint; playerOwed: bigint }): Celebration | null {
  const { netResult: net, playerOwed: back } = outcome;
  if (net <= 0n) return null;
  const stake = back - net;
  const chips =
    stake <= 0n || back >= 10n * stake ? 7 : back >= 5n * stake ? 5 : back >= 2n * stake ? 3 : 2;
  return { net, chips, big: chips === 7 };
}

/** The printer's status line: one light and its text. `null` leaves both off and blank. */
export type PrinterState = "ready" | "waiting" | "received" | "printing" | "printed" | null;

export function printerState({
  phase,
  revealing,
  receipt,
  printed
}: {
  phase: PlaceBetButtonPhase;
  /** The table is rolling the ball to the number. */
  revealing: boolean;
  /** The receipt is on the slip. */
  receipt: boolean;
  /** Its print has finished. */
  printed: boolean;
}): PrinterState {
  if (receipt) return printed ? "printed" : "printing";
  if (revealing || phase === "revealing") return "received";
  switch (phase) {
    case "idle":
    case "loading_quote":
    case "ready":
      return "ready";
    case "waiting_vrf":
    case "timeout_soft":
      return "waiting";
    case "settling":
    case "manual_settle_offered":
    case "settled":
      return "printing";
    default:
      return null;
  }
}

/** The ball rolls back and forth only while the random number is awaited. */
export function ballWaits(phase: PlaceBetButtonPhase) {
  return phase === "waiting_vrf" || phase === "timeout_soft";
}
