import type { BetStateName } from "./types.js";

export function mapBetState(state: number): BetStateName {
  switch (state) {
    case 0:
      return "none";
    case 1:
      return "held";
    case 2:
      return "pendingVrf";
    case 3:
      return "randomReady";
    case 4:
      return "settled";
    case 5:
      return "refunded";
    default:
      return "none";
  }
}

export function shouldFinalize(state: BetStateName) {
  return state === "randomReady";
}

export function isTerminalState(state: BetStateName) {
  return state === "settled" || state === "refunded";
}
