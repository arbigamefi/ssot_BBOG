import type { BetLifecycleState } from "@ssot/ssot/indexer";

/**
 * States after which a bet never changes. A void (ADR-0037 §7) ends a bet like a settlement or a
 * refund: the stake became a claimable player balance and nothing else will happen to the bet.
 */
export const TERMINAL_BET_STATES = ["finalized", "refunded", "voided"] as const;

export type TerminalBetState = (typeof TERMINAL_BET_STATES)[number] & BetLifecycleState;

export function isTerminalBetState(state: string | null | undefined): state is TerminalBetState {
  return (TERMINAL_BET_STATES as readonly string[]).includes(state ?? "");
}

/** GameHub events that end a bet, in the same order as the states above. */
export const TERMINAL_GAMEHUB_EVENTS = ["BetFinalized", "BetRefunded", "BetVoided"] as const;

export type TerminalGameHubEvent = (typeof TERMINAL_GAMEHUB_EVENTS)[number];

export function isTerminalGameHubEvent(
  eventName: string | undefined
): eventName is TerminalGameHubEvent {
  return (TERMINAL_GAMEHUB_EVENTS as readonly string[]).includes(eventName ?? "");
}
