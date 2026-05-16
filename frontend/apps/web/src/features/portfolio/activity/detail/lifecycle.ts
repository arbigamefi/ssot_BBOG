import type { DomainBet } from "@ssot/ssot";
import type { TxStatus, TxStepItem } from "@ssot/ui";

export function matchesBetId(argsJson: string, expectedBetId: string) {
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>;
    const raw = args.positionId ?? args.betId ?? args.id;
    if (typeof raw === "number") return BigInt(raw).toString() === expectedBetId;
    if (typeof raw === "string") {
      if (raw.startsWith("0x")) {
        try {
          return BigInt(raw).toString() === expectedBetId;
        } catch {
          return false;
        }
      }
      return raw === expectedBetId;
    }
    return false;
  } catch {
    return false;
  }
}

export function getStateLabel(state?: string | null, bet?: DomainBet | null) {
  if (state === "finalized" && bet?.payout != null) {
    return bet.payout > bet.stake ? "Won" : "Lost";
  }
  if (state === "randomReady") return "Random ready";
  if (state === "placed") return "Placed";
  if (state === "refunded") return "Refunded";
  if (!state) return "Pending";
  return `${state.charAt(0).toUpperCase()}${state.slice(1)}`;
}

export function buildLifecycleSteps(state?: string | null): TxStepItem[] {
  if (state === "refunded") {
    return [
      { title: "Placed", state: "done" },
      { title: "Refunded", description: "Stake returned to the player.", state: "done" }
    ];
  }

  const order = ["placed", "randomReady", "finalized"];
  const currentIndex = state ? order.indexOf(state) : -1;

  return [
    {
      title: "Placed",
      description: "GameHub accepted the ticket and locked stake.",
      state: stepState(currentIndex, 0)
    },
    {
      title: "Random ready",
      description: "VRF delivered randomness for settlement.",
      state: stepState(currentIndex, 1)
    },
    {
      title: "Finalized",
      description: "GameHub settled payout or loss.",
      state: stepState(currentIndex, 2)
    }
  ];
}

export function eventStatus(eventName: string): TxStatus {
  switch (eventName) {
    case "BetFinalized":
    case "BetRefunded":
      return "reconciled";
    case "BetRandomReady":
    case "BetPlaced":
      return "mined";
    default:
      return "planning";
  }
}

function stepState(currentIndex: number, targetIndex: number) {
  if (currentIndex > targetIndex) return "done";
  if (currentIndex === 2 && targetIndex === 2) return "done";
  if (currentIndex === targetIndex) return "active";
  return "todo";
}
