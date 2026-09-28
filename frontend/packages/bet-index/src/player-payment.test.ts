import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex } from "viem";
import { extractPlayerPaymentProof, PLAYER_PAYMENT_ABI } from "./player-payment.js";

const bank = "0x0000000000000000000000000000000000000001" as const;
const asset = "0x0000000000000000000000000000000000000002" as const;
const player = "0x0000000000000000000000000000000000000003" as const;
const other = "0x0000000000000000000000000000000000000004" as const;
function log(
  eventName:
    | "BetReserveReleased"
    | "BetSettled"
    | "BetRefunded"
    | "PlayerPayableCreated"
    | "Transfer",
  amount = 296n,
  address: Address = bank,
  betId = 7n,
  who: Address = player
) {
  const transfer = eventName === "Transfer";
  const fields = eventName === "BetSettled" ? [300n, 196n, 100n, 104n, 0n, 0n, 0n, 0n] : [amount];
  return {
    address: transfer ? (address === bank ? asset : address) : address,
    topics: encodeEventTopics({
      abi: PLAYER_PAYMENT_ABI,
      eventName,
      args: transfer ? { from: bank, to: who } : { betId, player: who }
    } as any) as Hex[],
    data: encodeAbiParameters(
      fields.map(() => ({ type: "uint256" })),
      fields
    )
  };
}
const release = () => log("BetReserveReleased");
const settled = () => log("BetSettled");
function proof(logs: ReturnType<typeof log>[], amount = 296n) {
  return extractPlayerPaymentProof({ logs, bank, asset, player, betId: 7n, amount });
}

describe("terminal transaction player payment evidence", () => {
  it("proves the full cash transfer including the unused stake refund", () => {
    expect(proof([release(), log("Transfer"), settled()])).toEqual({
      status: "transferred",
      amount: "296"
    });
  });
  it("records a blocked payout as a historical payable instead of received cash", () => {
    expect(proof([release(), log("PlayerPayableCreated"), settled()])).toEqual({
      status: "payable",
      amount: "296"
    });
  });
  it.each(["Transfer", "PlayerPayableCreated"] as const)(
    "supports a timeout refund with %s evidence",
    (eventName) => {
      expect(proof([release(), log(eventName, 100n), log("BetRefunded", 100n)], 100n).status).toBe(
        eventName === "Transfer" ? "transferred" : "payable"
      );
    }
  );
  it("does not confuse no payout with unverified positive payout", () => {
    expect(proof([], 0n)).toEqual({ status: "none", amount: "0" });
    expect(proof([release(), settled()])).toEqual({ status: "unknown", amount: "296" });
  });
  it.each([
    () => log("PlayerPayableCreated", 296n, other),
    () => log("PlayerPayableCreated", 296n, bank, 8n),
    () => log("PlayerPayableCreated", 296n, bank, 7n, other),
    () => log("PlayerPayableCreated", 196n),
    () => log("Transfer", 296n, other),
    () => log("Transfer", 296n, asset, 7n, other),
    () => log("Transfer", 196n)
  ])("rejects an unrelated emitter, bet, player, asset or incomplete amount", (payment) => {
    expect(proof([release(), payment(), settled()]).status).toBe("unknown");
  });
  it("cannot attribute a later aggregate claim transfer to this bet", () => {
    expect(proof([release(), log("PlayerPayableCreated"), settled(), log("Transfer")])).toEqual({
      status: "payable",
      amount: "296"
    });
    expect(proof([log("Transfer"), release(), settled(), log("Transfer")]).status).toBe("unknown");
  });
  it("requires one matching reserve release, terminal event and exact transfer", () => {
    expect(proof([log("Transfer"), settled()]).status).toBe("unknown");
    expect(proof([release(), log("Transfer")]).status).toBe("unknown");
    expect(proof([release(), log("Transfer"), log("Transfer"), settled()]).status).toBe("unknown");
    expect(proof([release(), log("Transfer"), settled(), settled()]).status).toBe("unknown");
    expect(proof([release(), log("Transfer"), settled()], 196n).status).toBe("unknown");
  });
});
