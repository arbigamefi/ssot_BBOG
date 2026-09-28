import { describe, expect, it } from "vitest";
import {
  createMemoryBetIndexStore,
  type BetIndexEvent,
  type BankProviderLedgerRow
} from "./index.js";

const HUB = "0x1111111111111111111111111111111111111111" as const;
const OTHER_HUB = "0x2222222222222222222222222222222222222222" as const;
const BANK = "0x3333333333333333333333333333333333333333" as const;
const OTHER_BANK = "0x4444444444444444444444444444444444444444" as const;
const OWNER = "0x5555555555555555555555555555555555555555" as const;

function event(id: bigint, name: BetIndexEvent["eventName"], index: number): BetIndexEvent {
  return {
    chainId: 84532,
    gameHub: HUB,
    eventName: name,
    blockNumber: 100n + BigInt(index),
    txHash: `0x${index.toString(16).padStart(64, "0")}`,
    logIndex: index,
    args: { betId: id, player: OWNER, stake: 1n, payoutNet: 0n, refundAmount: 1n }
  };
}

describe("casino recovery and Bank deployment identity", () => {
  it("recovers PendingVRF as well as RandomReady with numeric pages, replay and terminal exclusion", async () => {
    const store = createMemoryBetIndexStore();
    const query = { chainId: 84532, gameHub: HUB, afterBetId: 0n, limit: 2 };
    const input = [
      event(2n ** 255n, "BetPlaced", 1),
      event(10n, "BetPlaced", 2),
      event(2n, "BetPlaced", 3),
      event(10n, "BetRandomReady", 4),
      event(3n, "BetPlaced", 5),
      event(3n, "BetRefunded", 6),
      event(4n, "BetPlaced", 7),
      event(4n, "BetFinalized", 8),
      { ...event(1n, "BetPlaced", 9), gameHub: OTHER_HUB },
      { ...event(1n, "BetPlaced", 10), chainId: 8453 }
    ];
    await store.writeGameHubEvents(input);
    await store.writeGameHubEvents(input);
    expect(await store.getUnresolvedBetIds(query)).toEqual([2n, 10n]);
    expect(await store.getUnresolvedBetIds({ ...query, afterBetId: 10n })).toEqual([2n ** 255n]);
    expect(await store.getRandomReadyBetIds(query)).toEqual([10n]);
    await store.writeGameHubEvents([event(2n, "BetRefunded", 11)]);
    expect(await store.getUnresolvedBetIds(query)).toEqual([10n, 2n ** 255n]);
  });

  it("scopes LP cash flows to the actual Bank across reused pool IDs and Bank aliases", async () => {
    const store = createMemoryBetIndexStore();
    const row: BankProviderLedgerRow = {
      chainId: 84532,
      poolId: "1",
      owner: OWNER,
      bank: BANK,
      asset: OWNER,
      id: "unused",
      action: "withdraw",
      assets: "10",
      shares: "10",
      txHash: "0xaa",
      blockNumber: 20,
      logIndex: 1,
      updatedAt: 0
    };
    await store.writeBankProviderLedgerRows([
      row,
      { ...row, txHash: "0xbb", bank: OTHER_BANK, blockNumber: 21, assets: "999" },
      { ...row, txHash: "0xcc", poolId: "9", blockNumber: 22, assets: "20" },
      { ...row, txHash: "0xdd", chainId: 8453, blockNumber: 23 }
    ]);
    const query = { chainId: 84532, owner: OWNER, bank: BANK, limit: 10 };
    expect((await store.getBankProviderLedger(query)).map((entry) => entry.assets)).toEqual([
      "20",
      "10"
    ]);
    expect(
      (await store.getBankProviderLedger({ ...query, beforeBlock: 22, beforeLogIndex: 1 })).map(
        (entry) => entry.assets
      )
    ).toEqual(["10"]);
  });
});
