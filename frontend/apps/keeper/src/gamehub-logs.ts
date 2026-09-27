import {
  decodeEventLog,
  getAddress,
  type AbiEvent,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import type { BetIndexEvent } from "@ssot/bet-index";

import { GAME_HUB_KEEPER_ABI } from "./abi.js";

/**
 * GameHub events written to the bet index, in the order the keeper writes them. HouseEdgeAllocated
 * annotates a settled bet (v1.6) and does not change its lifecycle, so its order does not matter.
 */
export const GAME_HUB_INDEX_EVENTS = [
  "BetPlaced",
  "BetRandomReady",
  "BetFinalized",
  "BetRefunded",
  "HouseEdgeAllocated"
] as const;

export type GameHubIndexEventName = (typeof GAME_HUB_INDEX_EVENTS)[number];

export type GameHubLog = {
  eventName: GameHubIndexEventName;
  args?: Record<string, unknown>;
  blockNumber?: bigint;
  blockTimestamp?: bigint | number;
  logIndex?: number;
  transactionHash?: Hex;
};

function gameHubEvent(name: GameHubIndexEventName): AbiEvent {
  const item = GAME_HUB_KEEPER_ABI.find((entry) => entry.type === "event" && entry.name === name);
  if (!item) throw new Error(`GameHub keeper ABI has no ${name} event`);
  return item as AbiEvent;
}

const GAME_HUB_EVENT_ABI = Object.fromEntries(
  GAME_HUB_INDEX_EVENTS.map((name) => [name, gameHubEvent(name)])
) as Record<GameHubIndexEventName, AbiEvent>;

/**
 * Fetches several GameHub events over one block range with a single eth_getLogs,
 * grouped by event name in chain order.
 *
 * Providers bill eth_getLogs per call, not per event. Querying each event
 * separately cost four calls per range for the bet index plus a fifth for
 * finalization.
 */
export async function fetchGameHubLogs(
  publicClient: Pick<PublicClient, "getLogs">,
  gameHub: Address,
  eventNames: readonly GameHubIndexEventName[],
  range: { fromBlock: bigint; toBlock: bigint }
): Promise<Map<GameHubIndexEventName, GameHubLog[]>> {
  const logs = (await publicClient.getLogs({
    address: gameHub,
    events: eventNames.map((name) => GAME_HUB_EVENT_ABI[name]),
    fromBlock: range.fromBlock,
    toBlock: range.toBlock
  })) as unknown as GameHubLog[];
  const byEvent = new Map<GameHubIndexEventName, GameHubLog[]>(
    eventNames.map((name) => [name, []])
  );
  for (const log of logs) byEvent.get(log.eventName)?.push(log);
  return byEvent;
}
