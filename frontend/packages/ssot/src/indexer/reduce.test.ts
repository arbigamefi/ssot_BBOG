import { describe, it, expect } from "vitest";
import { applyHubEventToBet, reduceState, type HubEventNormalized } from "./reduce";

const HUB = "0x0000000000000000000000000000000000000001" as any;
const TX1 = "0x0000000000000000000000000000000000000000000000000000000000000001" as any;
const TX2 = "0x0000000000000000000000000000000000000000000000000000000000000002" as any;
const TX3 = "0x0000000000000000000000000000000000000000000000000000000000000003" as any;
const TX4 = "0x0000000000000000000000000000000000000000000000000000000000000004" as any;

function mk(eventName: HubEventNormalized["eventName"], blockNumber: number, txHash: any): HubEventNormalized {
  return {
    chainId: 84532,
    hub: HUB,
    blockNumber,
    txHash,
    eventName,
    args: {
      betId: 123n,
      gameId: "0x" + "11".repeat(32),
      asset: "0x0000000000000000000000000000000000000002",
      player: "0x0000000000000000000000000000000000000003"
    }
  };
}

describe("indexer reducer", () => {
  // ——— Lifecycle happy path ———
  it("applies lifecycle events and does not regress", () => {
    let bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.state).toBe("placed");
    bet = applyHubEventToBet(bet, mk("BetRandomReady", 11, TX2));
    expect(bet.state).toBe("randomReady");
    bet = applyHubEventToBet(bet, mk("BetFinalized", 12, TX3));
    expect(bet.state).toBe("finalized");

    // Do not regress finalized -> randomReady
    bet = applyHubEventToBet(bet, mk("BetRandomReady", 13, TX2));
    expect(bet.state).toBe("finalized");
  });

  it("refunded wins over finalized", () => {
    let bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    bet = applyHubEventToBet(bet, mk("BetFinalized", 12, TX3));
    bet = applyHubEventToBet(bet, mk("BetRefunded", 14, TX2));
    expect(bet.state).toBe("refunded");
  });

  // ——— BetPlaced enrichment ———
  it("enriches row with gameId, asset, player on BetPlaced", () => {
    const bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.gameId).toBe("0x" + "11".repeat(32));
    expect(bet.asset).toBe("0x0000000000000000000000000000000000000002");
    expect(bet.player).toBe("0x0000000000000000000000000000000000000003");
    expect(bet.placedBlock).toBe(10);
  });

  it("constructs composite id from chainId:betId", () => {
    const bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.id).toBe("84532:123");
    expect(bet.chainId).toBe(84532);
    expect(bet.betId).toBe("123");
  });

  // ——— updatedBlock monotonic ———
  it("updatedBlock advances with later events", () => {
    let bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.updatedBlock).toBe(10);
    bet = applyHubEventToBet(bet, mk("BetRandomReady", 15, TX2));
    expect(bet.updatedBlock).toBe(15);
    // Earlier block should not regress updatedBlock
    bet = applyHubEventToBet(bet, mk("BetFinalized", 12, TX3));
    expect(bet.updatedBlock).toBe(15);
  });

  // ——— lastTxHash / lastEventName tracking ———
  it("tracks lastTxHash and lastEventName", () => {
    let bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.lastTxHash).toBe(TX1);
    expect(bet.lastEventName).toBe("BetPlaced");
    bet = applyHubEventToBet(bet, mk("BetRandomReady", 11, TX2));
    expect(bet.lastTxHash).toBe(TX2);
    expect(bet.lastEventName).toBe("BetRandomReady");
  });

  // ——— Refund from placed (skip finalized) ———
  it("placed -> refunded directly", () => {
    let bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    bet = applyHubEventToBet(bet, mk("BetRefunded", 11, TX2));
    expect(bet.state).toBe("refunded");
  });

  // ——— BetRandomReady does not regress from refunded ———
  it("does not regress refunded -> randomReady", () => {
    let bet = applyHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    bet = applyHubEventToBet(bet, mk("BetRefunded", 11, TX2));
    bet = applyHubEventToBet(bet, mk("BetRandomReady", 12, TX3));
    expect(bet.state).toBe("refunded");
  });

  // ——— user field fallback ———
  it("falls back to args.user when args.player is absent", () => {
    const ev: HubEventNormalized = {
      chainId: 84532,
      hub: HUB,
      blockNumber: 10,
      txHash: TX1,
      eventName: "BetPlaced",
      args: {
        betId: 456n,
        gameId: "0x" + "22".repeat(32),
        asset: "0x0000000000000000000000000000000000000005",
        user: "0x0000000000000000000000000000000000000006"
      }
    };
    const bet = applyHubEventToBet(undefined, ev);
    expect(bet.player).toBe("0x0000000000000000000000000000000000000006");
  });
});

describe("reduceState (pure)", () => {
  it("BetPlaced does not change existing state", () => {
    expect(reduceState("placed", "BetPlaced")).toBe("placed");
    expect(reduceState("randomReady", "BetPlaced")).toBe("randomReady");
    expect(reduceState("finalized", "BetPlaced")).toBe("finalized");
  });

  it("BetRandomReady promotes from placed", () => {
    expect(reduceState("placed", "BetRandomReady")).toBe("randomReady");
  });

  it("BetRandomReady does not regress from finalized or refunded", () => {
    expect(reduceState("finalized", "BetRandomReady")).toBe("finalized");
    expect(reduceState("refunded", "BetRandomReady")).toBe("refunded");
  });

  it("BetFinalized promotes from any non-refunded state", () => {
    expect(reduceState("placed", "BetFinalized")).toBe("finalized");
    expect(reduceState("randomReady", "BetFinalized")).toBe("finalized");
  });

  it("BetRefunded always wins", () => {
    expect(reduceState("placed", "BetRefunded")).toBe("refunded");
    expect(reduceState("randomReady", "BetRefunded")).toBe("refunded");
    expect(reduceState("finalized", "BetRefunded")).toBe("refunded");
    expect(reduceState("refunded", "BetRefunded")).toBe("refunded");
  });
});
