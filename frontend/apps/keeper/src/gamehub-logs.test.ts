import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";

import { fetchGameHubLogs, GAME_HUB_INDEX_EVENTS } from "./gamehub-logs.js";

const HUB = "0x1111111111111111111111111111111111111111" as Address;

function log(eventName: string, blockNumber: bigint, logIndex: number) {
  return { eventName, args: {}, blockNumber, logIndex, transactionHash: `0x${"ab".repeat(32)}` };
}

describe("fetchGameHubLogs", () => {
  it("reads all requested events with one eth_getLogs and groups them in chain order", async () => {
    const getLogs = vi
      .fn()
      .mockResolvedValue([
        log("BetPlaced", 10n, 0),
        log("BetRandomReady", 11n, 2),
        log("BetPlaced", 12n, 1),
        log("BetRefunded", 12n, 4)
      ]);

    const byEvent = await fetchGameHubLogs(
      { getLogs } as unknown as PublicClient,
      HUB,
      GAME_HUB_INDEX_EVENTS,
      { fromBlock: 10n, toBlock: 20n }
    );

    expect(getLogs).toHaveBeenCalledTimes(1);
    const [query] = getLogs.mock.calls[0]!;
    expect(query).toMatchObject({ address: HUB, fromBlock: 10n, toBlock: 20n });
    expect(query.events.map((event: { name: string }) => event.name)).toEqual([
      "BetPlaced",
      "BetRandomReady",
      "BetFinalized",
      "BetRefunded"
    ]);
    expect([...byEvent.keys()]).toEqual([...GAME_HUB_INDEX_EVENTS]);
    expect(byEvent.get("BetPlaced")!.map((entry) => entry.blockNumber)).toEqual([10n, 12n]);
    expect(byEvent.get("BetRandomReady")).toHaveLength(1);
    expect(byEvent.get("BetFinalized")).toEqual([]);
    expect(byEvent.get("BetRefunded")).toHaveLength(1);
  });

  it("asks only for the requested events and drops anything else", async () => {
    const getLogs = vi
      .fn()
      .mockResolvedValue([log("BetRandomReady", 11n, 0), log("BetPlaced", 11n, 1)]);

    const byEvent = await fetchGameHubLogs(
      { getLogs } as unknown as PublicClient,
      HUB,
      ["BetRandomReady"],
      { fromBlock: 10n, toBlock: 20n }
    );

    const [query] = getLogs.mock.calls[0]!;
    expect(query.events.map((event: { name: string }) => event.name)).toEqual(["BetRandomReady"]);
    expect([...byEvent.keys()]).toEqual(["BetRandomReady"]);
    expect(byEvent.get("BetRandomReady")).toHaveLength(1);
  });
});
