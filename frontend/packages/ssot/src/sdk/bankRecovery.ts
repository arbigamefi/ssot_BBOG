import { type Address, type PublicClient } from "viem";
import type { BankRecoveryCursor, DomainRecoveryPage, DomainRecoveryPosition } from "../domain";
import { bankReader, readRedeemBatch } from "./bankRedemption";

export async function readRecoveryPosition(
  client: PublicClient,
  bank: Address,
  epochId: bigint,
  controller: Address,
  blockNumber: bigint,
  timestamp: bigint
): Promise<DomainRecoveryPosition> {
  const read = bankReader(client, bank, blockNumber);
  const [position, epoch, batch] = (await Promise.all([
    read("getRecovery", [epochId, controller]),
    read("recoveryEpoch", [epochId]),
    readRedeemBatch(read, epochId)
  ])) as [
    {
      shares: bigint;
      claimableAssets: bigint;
      claimedAssets: bigint;
      pendingAssets: bigint;
      finalSynced: boolean;
    },
    { remainingHolds: bigint; remainingReserve: bigint },
    Awaited<ReturnType<typeof readRedeemBatch>>
  ];
  return {
    epochId,
    activatedAt: batch.activatedAt,
    ...position,
    remainingHolds: epoch.remainingHolds,
    remainingReserve: epoch.remainingReserve,
    updatedAtBlock: blockNumber,
    snapshotTimestamp: timestamp
  };
}

/** Epoch IDs are contiguous: only activation advances currentEpoch. One page reads at most 50 historical epochs. */
export async function readRecoveryPage(
  client: PublicClient,
  bank: Address,
  controller: Address,
  chainId: number,
  opts: { cursor?: BankRecoveryCursor; limit?: number; blockNumber?: bigint } = {}
): Promise<DomainRecoveryPage> {
  const limit = opts.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new RangeError("Recovery page limit must be between 1 and 50.");
  const cursor = opts.cursor;
  if (
    cursor &&
    (cursor.chainId !== chainId ||
      cursor.bank.toLowerCase() !== bank.toLowerCase() ||
      cursor.controller.toLowerCase() !== controller.toLowerCase() ||
      (opts.blockNumber !== undefined && opts.blockNumber !== cursor.blockNumber))
  )
    throw new Error("Recovery cursor belongs to a different snapshot or account.");
  const blockNumber = cursor?.blockNumber ?? opts.blockNumber ?? (await client.getBlockNumber());
  const block = await client.getBlock({ blockNumber });
  if (!block.hash || block.number !== blockNumber || (cursor && cursor.blockHash !== block.hash))
    throw new Error("Recovery snapshot changed; restart pagination.");
  const currentEpoch = (await bankReader(client, bank, blockNumber)("currentEpoch")) as bigint;
  const beforeEpoch = cursor?.beforeEpoch ?? currentEpoch;
  if (beforeEpoch < 1n || beforeEpoch > currentEpoch) throw new Error("Invalid recovery cursor.");
  const ids: bigint[] = [];
  for (let id = beforeEpoch - 1n; id > 0n && ids.length < limit; id--) ids.push(id);
  const positions = await Promise.all(
    ids.map((id) =>
      readRecoveryPosition(client, bank, id, controller, blockNumber, block.timestamp)
    )
  );
  if (positions.some((position) => position.activatedAt === 0n))
    throw new Error("Recovery activation no longer exists; restart pagination.");
  const last = ids.at(-1) ?? 1n;
  const nextCursor =
    last > 1n
      ? { bank, controller, chainId, blockNumber, blockHash: block.hash, beforeEpoch: last }
      : undefined;
  return {
    updatedAtBlock: blockNumber,
    snapshotTimestamp: block.timestamp,
    items: positions.filter((position) => position.shares > 0n),
    nextCursor,
    complete: nextCursor === undefined
  };
}
