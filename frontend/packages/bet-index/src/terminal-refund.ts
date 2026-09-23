import { parseAbi, type Address, type PublicClient } from "viem";
import type { BetIndexEvent } from "./index.js";

const TERMINAL_ABI = parseAbi([
  "function getBetTerminal(uint256 betId) view returns ((uint8 state, uint256 payoutGross, uint256 payoutNet, uint256 feeOnPayout, uint256 protocolFeeAccrual, uint256 refundAmount))"
]);

/** BetFinalized omits refunds. Bind its amounts to the authoritative terminal record. */
export async function readSettledBetRefund({
  client,
  gameHub,
  betId,
  args
}: {
  client: Pick<PublicClient, "readContract">;
  gameHub: Address;
  betId: bigint;
  args: Record<string, unknown>;
}): Promise<bigint> {
  const receipt = await client.readContract({
    address: gameHub,
    abi: TERMINAL_ABI,
    functionName: "getBetTerminal",
    args: [betId]
  });
  if (receipt.state !== 4 || typeof receipt.refundAmount !== "bigint") {
    throw new Error(`missing settled terminal refund for bet ${betId}`);
  }
  for (const key of ["payoutGross", "payoutNet", "feeOnPayout", "protocolFeeAccrual"] as const) {
    if (args[key] == null || BigInt(String(args[key])) !== receipt[key]) {
      throw new Error(`terminal ${key} mismatch for bet ${betId}`);
    }
  }
  return receipt.refundAmount;
}

/** Failure propagates so callers cannot checkpoint an incomplete index range. */
export async function enrichFinalizedBetEvents(
  client: Pick<PublicClient, "readContract">,
  events: readonly BetIndexEvent[]
): Promise<BetIndexEvent[]> {
  const result: BetIndexEvent[] = [];
  for (const event of events) {
    if (event.eventName !== "BetFinalized") {
      result.push(event);
      continue;
    }
    const rawBetId = event.args.positionId ?? event.args.betId;
    if (rawBetId == null) throw new Error("finalized event missing bet ID");
    const refundAmount = await readSettledBetRefund({
      client,
      gameHub: event.gameHub,
      betId: BigInt(String(rawBetId)),
      args: event.args
    });
    // This field is terminal-getter enrichment, not a BetFinalized ABI argument.
    result.push({ ...event, args: { ...event.args, refundAmount } });
  }
  return result;
}
