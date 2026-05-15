import type { BetRow } from "@ssot/ssot/indexer";

import { formatUnits } from "../../betting/model/units";
import type { BetStatusFilter, BetStatusGroup } from "./types";

export const BET_STATUS_TABS: Array<{ key: BetStatusFilter; label: string; detail: string }> = [
  { key: "all", label: "All", detail: "Every indexed ticket." },
  { key: "open", label: "Open", detail: "Placed or waiting for VRF." },
  { key: "won", label: "Won", detail: "Positive settled tickets." },
  { key: "lost", label: "Lost", detail: "Loss, refund, or failure states." }
];

export function shortHex(value?: string | null) {
  if (!value) return "Pending";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function getBigIntField(row: BetRow, key: "stake" | "payout") {
  const value = (row as unknown as Record<string, unknown>)[key];
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function mapBetState(state?: string, payout?: bigint, stake?: bigint): BetStatusGroup {
  if (!state) return "pending";
  const normalized = state.toLowerCase();
  if (
    normalized.includes("final") ||
    normalized.includes("settled") ||
    normalized.includes("resolved")
  ) {
    if (payout !== undefined && stake !== undefined) {
      return payout > stake ? "won" : "lost";
    }
    return "settled";
  }
  if (normalized.includes("won") || normalized.includes("win")) return "won";
  if (normalized.includes("lost") || normalized.includes("lose")) return "lost";
  if (normalized.includes("placed")) return "placed";
  if (normalized.includes("refund")) return "refunded";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("random")) return "pending_vrf";
  return "pending";
}

export function isOpenStatus(status: BetStatusGroup) {
  return status === "pending" || status === "placed" || status === "pending_vrf";
}

export function isLossStatus(status: BetStatusGroup) {
  return status === "lost" || status === "refunded" || status === "failed";
}

export function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return "Pending";
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatTokenAmount(value: bigint | undefined, decimals: number, symbol?: string) {
  if (value == null) return "Pending";
  const raw = formatUnits(value, decimals);
  const negative = raw.startsWith("-");
  const normalized = negative ? raw.slice(1) : raw;
  const [intPart = "0", fracPart = ""] = normalized.split(".");
  const integer = BigInt(intPart || "0").toLocaleString("en-US");
  const fraction = fracPart.slice(0, 4).replace(/0+$/, "");
  const body = `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
  return symbol ? `${body} ${symbol}` : body;
}

export function formatOutcome({
  status,
  stake,
  payout,
  decimals,
  symbol
}: {
  status: BetStatusGroup;
  stake: bigint;
  payout?: bigint;
  decimals: number;
  symbol: string;
}) {
  if (status === "won" && payout != null) {
    return `+${formatTokenAmount(payout, decimals, symbol)}`;
  }
  if (isLossStatus(status)) {
    return `-${formatTokenAmount(stake, decimals, symbol)}`;
  }
  if (status === "settled" && payout != null) {
    return formatTokenAmount(payout, decimals, symbol);
  }
  return "Pending";
}
