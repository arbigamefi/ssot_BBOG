import { decodeEventLog, getAddress, parseAbi, type Address, type Hex } from "viem";
import type { BetIndexEvent } from "./index.js";

/** Emitted by GameHub.finalize before BetFinalized; refunds do not emit it. */
export const HOUSE_EDGE_ALLOCATED_ABI = parseAbi([
  "event HouseEdgeAllocated(uint256 indexed positionId, uint256 usedTurnover, uint16 effectiveHouseEdgeBps, uint256 edge, uint256 operatorShare, uint256 lpRetained, uint256 protocolFee, uint256 r0, uint256 r1, uint256 r2, uint256 markup)"
]);

/**
 * The settlement's HouseEdgeAllocated event from its transaction receipt, ready for
 * writeGameHubEvents, or null when the receipt has none for this bet and hub.
 */
export function decodeHouseEdgeLog({
  betId,
  blockTimestamp,
  chainId,
  gameHub,
  receipt
}: {
  betId: bigint;
  blockTimestamp?: number;
  chainId: number;
  gameHub: Address;
  receipt: {
    blockNumber?: bigint | null;
    logs: ReadonlyArray<{
      address?: Address;
      data: Hex;
      logIndex?: number | null;
      topics: readonly Hex[];
    }>;
    transactionHash: Hex;
  };
}): BetIndexEvent | null {
  if (receipt.blockNumber == null) return null;
  for (const log of receipt.logs) {
    if (log.address == null || getAddress(log.address) !== getAddress(gameHub)) continue;
    if (log.logIndex == null) continue;
    try {
      const decoded = decodeEventLog({
        abi: HOUSE_EDGE_ALLOCATED_ABI,
        data: log.data,
        eventName: "HouseEdgeAllocated",
        topics: log.topics as [Hex, ...Hex[]]
      });
      if (decoded.args.positionId !== betId) continue;
      return {
        args: decoded.args,
        blockNumber: receipt.blockNumber,
        ...(blockTimestamp == null ? {} : { blockTimestamp }),
        chainId,
        eventName: "HouseEdgeAllocated",
        gameHub,
        logIndex: log.logIndex,
        txHash: receipt.transactionHash
      };
    } catch {
      // Another event of the hub.
    }
  }
  return null;
}
