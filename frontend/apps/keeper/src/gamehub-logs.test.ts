import { describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import { createMemoryBetIndexStore } from "@ssot/bet-index";
import { decodeHouseEdgeLog } from "@ssot/bet-index/house-edge";

import { GAME_HUB_KEEPER_ABI } from "./abi.js";
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
      "BetRefunded",
      "HouseEdgeAllocated"
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

describe("decodeHouseEdgeLog", () => {
  const txHash = `0x${"cd".repeat(32)}` as Hex;
  const amounts = [1_000_000n, 200, 20_000n, 10_000n, 10_000n, 3_000n, 2_000n, 4_000n, 1_000n, 0n];
  function allocationLog(address: Address, positionId: bigint, logIndex: number) {
    return {
      address,
      logIndex,
      topics: encodeEventTopics({
        abi: GAME_HUB_KEEPER_ABI,
        eventName: "HouseEdgeAllocated",
        args: { positionId }
      }) as Hex[],
      data: encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "uint16" },
          ...Array.from({ length: 8 }, () => ({ type: "uint256" as const }))
        ],
        amounts as never
      )
    };
  }

  it("takes the settled bet's allocation from its hub and indexes it", async () => {
    const other = "0x2222222222222222222222222222222222222222" as Address;
    const receipt = {
      blockNumber: 42n,
      transactionHash: txHash,
      logs: [allocationLog(other, 7n, 0), allocationLog(HUB, 8n, 1), allocationLog(HUB, 7n, 2)]
    };
    const event = decodeHouseEdgeLog({
      betId: 7n,
      blockTimestamp: 1_000,
      chainId: 84532,
      gameHub: HUB,
      receipt
    });
    expect(event).toMatchObject({ logIndex: 2, blockNumber: 42n, txHash });

    const store = createMemoryBetIndexStore();
    await store.writeGameHubEvents([
      {
        chainId: 84532,
        gameHub: HUB,
        blockNumber: 40n,
        txHash: `0x${"ef".repeat(32)}`,
        logIndex: 0,
        eventName: "BetPlaced",
        args: { positionId: 7n, stake: 1_000_000n }
      }
    ]);
    await store.writeGameHubEvents([event!]);
    expect((await store.getBet({ chainId: 84532, gameHub: HUB, betId: 7n }))?.houseEdge).toEqual({
      usedTurnover: "1000000",
      effectiveHouseEdgeBps: 200,
      edge: "20000",
      operatorShare: "10000",
      lpRetained: "10000",
      protocolFee: "3000",
      r0: "2000",
      r1: "4000",
      r2: "1000",
      markup: "0"
    });
  });

  it("finds nothing when the receipt has no allocation or is a refund", () => {
    expect(
      decodeHouseEdgeLog({
        betId: 7n,
        blockTimestamp: 1_000,
        chainId: 84532,
        gameHub: HUB,
        receipt: { blockNumber: 42n, transactionHash: txHash, logs: [] }
      })
    ).toBeNull();
  });
});
