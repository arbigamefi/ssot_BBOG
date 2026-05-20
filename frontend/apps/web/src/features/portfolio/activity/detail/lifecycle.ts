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

export function getStateLabel(
  state?: string | null,
  bet?: DomainBet | null,
  labels: {
    won: string;
    lost: string;
    randomReady: string;
    placed: string;
    refunded: string;
    pending: string;
  } = {
    won: "—",
    lost: "—",
    randomReady: "—",
    placed: "—",
    refunded: "—",
    pending: "—"
  }
) {
  if (state === "finalized" && bet?.payout != null) {
    return bet.payout > bet.stake ? labels.won : labels.lost;
  }
  if (state === "randomReady") return labels.randomReady;
  if (state === "placed") return labels.placed;
  if (state === "refunded") return labels.refunded;
  if (!state) return labels.pending;
  return `${state.charAt(0).toUpperCase()}${state.slice(1)}`;
}

export function buildLifecycleSteps(
  state?: string | null,
  labels: {
    placed: string;
    refunded: string;
    refundedDescription: string;
    placedDescription: string;
    randomReady: string;
    randomReadyDescription: string;
    finalized: string;
    finalizedDescription: string;
  } = {
    placed: "—",
    refunded: "—",
    refundedDescription: "—",
    placedDescription: "—",
    randomReady: "—",
    randomReadyDescription: "—",
    finalized: "—",
    finalizedDescription: "—"
  }
): TxStepItem[] {
  if (state === "refunded") {
    return [
      { title: labels.placed, state: "done" },
      { title: labels.refunded, description: labels.refundedDescription, state: "done" }
    ];
  }

  const order = ["placed", "randomReady", "finalized"];
  const currentIndex = state ? order.indexOf(state) : -1;

  return [
    {
      title: labels.placed,
      description: labels.placedDescription,
      state: stepState(currentIndex, 0)
    },
    {
      title: labels.randomReady,
      description: labels.randomReadyDescription,
      state: stepState(currentIndex, 1)
    },
    {
      title: labels.finalized,
      description: labels.finalizedDescription,
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
