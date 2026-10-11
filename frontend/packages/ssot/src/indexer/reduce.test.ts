import { describe, it, expect } from "vitest";
import { applyGameHubEventToBet, reduceState, type GameHubEventNormalized } from "./reduce";

const HUB = "0x0000000000000000000000000000000000000001" as any;
const TX1 = "0x0000000000000000000000000000000000000000000000000000000000000001" as any;
const TX2 = "0x0000000000000000000000000000000000000000000000000000000000000002" as any;
const TX3 = "0x0000000000000000000000000000000000000000000000000000000000000003" as any;
const TX4 = "0x0000000000000000000000000000000000000000000000000000000000000004" as any;

function mk(
  eventName: GameHubEventNormalized["eventName"],
  blockNumber: number,
  txHash: any
): GameHubEventNormalized {
  return {
    chainId: 84532,
    gameHub: HUB,
    blockNumber,
    txHash,
    eventName,
    args: {
      positionId: 123n,
      gameId: "0x" + "11".repeat(32),
      asset: "0x0000000000000000000000000000000000000002",
      player: "0x0000000000000000000000000000000000000003",
      referrerL1: "0x0000000000000000000000000000000000000004",
      referrerL2: "0x0000000000000000000000000000000000000005"
    }
  };
}

describe("indexer reducer", () => {
  // ——— Lifecycle happy path ———
  it("applies lifecycle events and does not regress", () => {
    let bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.state).toBe("placed");
    bet = applyGameHubEventToBet(bet, mk("BetRandomReady", 11, TX2));
    expect(bet.state).toBe("randomReady");
    bet = applyGameHubEventToBet(bet, mk("BetFinalized", 12, TX3));
    expect(bet.state).toBe("finalized");

    // Do not regress finalized -> randomReady
    bet = applyGameHubEventToBet(bet, mk("BetRandomReady", 13, TX2));
    expect(bet.state).toBe("finalized");
  });

  it("refunded wins over finalized", () => {
    let bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    bet = applyGameHubEventToBet(bet, mk("BetFinalized", 12, TX3));
    bet = applyGameHubEventToBet(bet, mk("BetRefunded", 14, TX2));
    expect(bet.state).toBe("refunded");
  });

  // ——— BetPlaced enrichment ———
  it("enriches row with gameId, asset, player, and immutable referral payees on BetPlaced", () => {
    const bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.gameId).toBe("0x" + "11".repeat(32));
    expect(bet.asset).toBe("0x0000000000000000000000000000000000000002");
    expect(bet.player).toBe("0x0000000000000000000000000000000000000003");
    expect(bet.referrerL1).toBe("0x0000000000000000000000000000000000000004");
    expect(bet.referrerL2).toBe("0x0000000000000000000000000000000000000005");
    expect(bet.placedBlock).toBe(10);
  });

  it("constructs composite id from chainId:betId", () => {
    const bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.id).toBe("84532:123");
    expect(bet.chainId).toBe(84532);
    expect(bet.betId).toBe("123");
  });

  // ——— updatedBlock monotonic ———
  it("updatedBlock advances with later events", () => {
    let bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.updatedBlock).toBe(10);
    bet = applyGameHubEventToBet(bet, mk("BetRandomReady", 15, TX2));
    expect(bet.updatedBlock).toBe(15);
    // Earlier block should not regress updatedBlock
    bet = applyGameHubEventToBet(bet, mk("BetFinalized", 12, TX3));
    expect(bet.updatedBlock).toBe(15);
  });

  // ——— lastTxHash / lastEventName tracking ———
  it("tracks lastTxHash and lastEventName", () => {
    let bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    expect(bet.lastTxHash).toBe(TX1);
    expect(bet.lastEventName).toBe("BetPlaced");
    bet = applyGameHubEventToBet(bet, mk("BetRandomReady", 11, TX2));
    expect(bet.lastTxHash).toBe(TX2);
    expect(bet.lastEventName).toBe("BetRandomReady");
  });

  it("stores terminal economics for product-facing rows", () => {
    let bet = applyGameHubEventToBet(undefined, {
      ...mk("BetPlaced", 10, TX1),
      args: { ...mk("BetPlaced", 10, TX1).args, requestId: 99n, stake: 100n }
    });
    bet = applyGameHubEventToBet(bet, {
      ...mk("BetRandomReady", 11, TX2),
      args: { positionId: 123n, requestId: 99n, randomHash: "0x" + "55".repeat(32) }
    });
    bet = applyGameHubEventToBet(bet, {
      ...mk("BetFinalized", 12, TX3),
      args: { positionId: 123n, payoutGross: 200n, payoutNet: 196n }
    });

    expect(bet).toMatchObject({
      finalizedTxHash: TX3,
      payout: "196",
      payoutGross: "200",
      randomHash: "0x" + "55".repeat(32),
      requestId: "99",
      stake: "100",
      terminalTxHash: TX3
    });
  });

  it("ends a voided bet with its stake as the refund and never reopens it", () => {
    const caller = "0x0000000000000000000000000000000000000006";
    const prefix = "0x" + "08c379a0".padEnd(64, "0");
    let bet = applyGameHubEventToBet(undefined, {
      ...mk("BetPlaced", 10, TX1),
      args: { ...mk("BetPlaced", 10, TX1).args, stake: 100n }
    });
    // voidBet records the random first, so BetRandomReady precedes BetVoided in one transaction.
    bet = applyGameHubEventToBet(bet, mk("BetRandomReady", 20, TX4));
    bet = applyGameHubEventToBet(bet, {
      ...mk("BetVoided", 20, TX4),
      args: { positionId: 123n, caller, stake: 100n, settlementErrorPrefix: prefix }
    });
    expect(bet).toMatchObject({
      state: "voided",
      refundAmount: "100",
      payout: "100",
      terminalTxHash: TX4,
      voidedTxHash: TX4,
      voidCaller: caller,
      voidSettlementErrorPrefix: prefix,
      lastEventName: "BetVoided"
    });
    expect(bet.finalizedTxHash).toBeUndefined();
    expect(bet.payoutGross).toBeUndefined();
    bet = applyGameHubEventToBet(bet, mk("BetRandomReady", 21, TX2));
    expect(bet.state).toBe("voided");
    expect(reduceState("voided", "BetRandomReady")).toBe("voided");
  });

  it("records the issuing GameHub", () => {
    expect(applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1)).gameHub).toBe(HUB);
  });

  // ——— Refund from placed (skip finalized) ———
  it("placed -> refunded directly", () => {
    let bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    bet = applyGameHubEventToBet(bet, mk("BetRefunded", 11, TX2));
    expect(bet.state).toBe("refunded");
  });

  // ——— BetRandomReady does not regress from refunded ———
  it("does not regress refunded -> randomReady", () => {
    let bet = applyGameHubEventToBet(undefined, mk("BetPlaced", 10, TX1));
    bet = applyGameHubEventToBet(bet, mk("BetRefunded", 11, TX2));
    bet = applyGameHubEventToBet(bet, mk("BetRandomReady", 12, TX3));
    expect(bet.state).toBe("refunded");
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
