import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { getReleaseScopedSSOTDb } from "./store";

it("isolates reused bet IDs and cursors across releases", async () => {
  const chainId = 84532;
  const first = getReleaseScopedSSOTDb({ chainId, releaseDigest: "0xaaaaaaaa" });
  const second = getReleaseScopedSSOTDb({ chainId, releaseDigest: "0xbbbbbbbb" });
  const txHash = `0x${"cc".repeat(32)}` as const;
  const hub = "0x0000000000000000000000000000000000000001" as const;
  try {
    await first.bets.put({
      id: `${chainId}:9`,
      betId: "9",
      chainId,
      gameHub: hub,
      state: "finalized",
      payout: "196000",
      updatedAt: 1,
      updatedBlock: 100,
      lastTxHash: txHash,
      lastEventName: "BetFinalized"
    });
    await first.cursors.put({
      id: `${chainId}:${hub}`,
      chainId,
      source: hub,
      lastProcessedBlock: 100,
      updatedAt: 1
    });
    expect(await second.bets.get(`${chainId}:9`)).toBeUndefined();
    expect(await second.cursors.count()).toBe(0);
    expect(getReleaseScopedSSOTDb({ chainId, releaseDigest: "0xAAAAAAAA" })).toBe(first);
  } finally {
    await Promise.all([first.delete(), second.delete()]);
  }
});
