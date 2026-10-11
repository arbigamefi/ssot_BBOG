import type { BetStateName, RequestStateName } from "./types.js";

const BET_STATES = [
  "none",
  "held",
  "pendingVrf",
  "randomReady",
  "settled",
  "refunded",
  "voided"
] as const satisfies readonly BetStateName[];

const REQUEST_STATES = [
  "none",
  "awaiting",
  "received",
  "terminal",
  "cancelled",
  "voided"
] as const satisfies readonly RequestStateName[];

/** SSOTTypes.BetState. A value this keeper does not know means a contract it was not built for. */
export function mapBetState(state: number): BetStateName {
  const name = BET_STATES[state];
  if (!name) throw new Error(`Unknown GameHub bet state ${state}`);
  return name;
}

export function shouldFinalize(state: BetStateName) {
  return state === "randomReady";
}

export function isTerminalState(state: BetStateName) {
  return state === "settled" || state === "refunded" || state === "voided";
}

export function mapRequestState(state: number): RequestStateName {
  const name = REQUEST_STATES[state];
  if (!name) throw new Error(`Unknown canonical VRF request state ${state}`);
  return name;
}
