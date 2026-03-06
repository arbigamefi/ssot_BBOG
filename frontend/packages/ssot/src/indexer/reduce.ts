import type { Address, Hex } from "viem";
import type { BetLifecycleState, BetRow } from "./store";

export type HubEventName = "BetPlaced" | "BetRandomReady" | "BetFinalized" | "BetRefunded";

export interface HubEventNormalized {
  chainId: number;
  hub: Address;
  blockNumber: number;
  logIndex?: number;
  txHash: Hex;
  eventName: HubEventName;
  args: Record<string, unknown>;
}

/**
 * Pure reducer: applies one Hub event to the derived Bet row.
 *
 * - All bigint-like values must be provided as bigint or bigint-string; we store strings.
 */
export function applyHubEventToBet(prev: BetRow | undefined, ev: HubEventNormalized): BetRow {
  const betIdRaw = ev.args.betId ?? ev.args.id;
  const betId = toBigintString(betIdRaw);
  const id = `${ev.chainId}:${betId}`;

  const next: BetRow = prev
    ? { ...prev }
    : {
        id,
        chainId: ev.chainId,
        betId,
        state: "placed",
        updatedBlock: ev.blockNumber,
        lastTxHash: ev.txHash,
        lastEventName: ev.eventName,
        updatedAt: Date.now()
      };

  // best-effort enrich on BetPlaced
  if (ev.eventName === "BetPlaced") {
    if (ev.args.gameId) next.gameId = ev.args.gameId as Hex;
    if (ev.args.asset) next.asset = ev.args.asset as Address;
    if (ev.args.player) next.player = ev.args.player as Address;
    if (ev.args.user && !next.player) next.player = ev.args.user as Address;
    next.placedBlock = ev.blockNumber;
    next.state = "placed";
  }

  // state transitions
  next.state = reduceState(next.state, ev.eventName);
  next.updatedBlock = Math.max(next.updatedBlock, ev.blockNumber);
  next.lastTxHash = ev.txHash;
  next.lastEventName = ev.eventName;
  next.updatedAt = Date.now();

  return next;
}

export function reduceState(prev: BetLifecycleState, eventName: HubEventName): BetLifecycleState {
  if (eventName === "BetRefunded") return "refunded";
  if (eventName === "BetFinalized") return "finalized";
  if (eventName === "BetRandomReady") {
    // Do not regress from finalized/refunded.
    if (prev === "finalized" || prev === "refunded") return prev;
    return "randomReady";
  }
  // BetPlaced
  return prev;
}

function toBigintString(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return BigInt(v).toString();
  if (typeof v === "string") {
    if (v.startsWith("0x")) {
      try {
        return BigInt(v).toString();
      } catch {
        // fallthrough
      }
    }
    if (/^\d+$/.test(v)) return v;
  }
  // fallback to stringification for unknown shapes
  return String(v ?? "0");
}
