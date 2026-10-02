import type { Address, Hex, PublicClient } from "viem";
import { BANK_REDEMPTION_KEEPER_ABI } from "./abi.js";
export { BANK_REDEMPTION_KEEPER_ABI } from "./abi.js";
import { describeError } from "./errors.js";
import type { PocketDiscoveryHealth, PocketHealth, RedemptionHealth } from "./health.js";
import { splitBlockRange } from "./scan.js";

const POCKET_POLL_LIMIT = 50;

export type RedemptionDeps = {
  publicClient: Pick<PublicClient, "getBlock" | "readContract">;
  // Runtime serializes this simulate/write/receipt sequence with casino terminalization.
  activate: (bank: Address) => Promise<{ status: "success" | "reverted"; txHash: Hex }>;
};

/** Read the sole queued epoch at one numbered chain block. Historical holds never gate activation. */
export async function readRedemptionBank(
  bank: Address,
  publicClient: RedemptionDeps["publicClient"]
): Promise<RedemptionHealth> {
  const block = await publicClient.getBlock();
  if (block.number == null) throw new Error("Bank reconciliation requires a numbered chain block");
  const read = (functionName: string) =>
    publicClient.readContract({
      address: bank,
      abi: BANK_REDEMPTION_KEEPER_ABI,
      functionName,
      blockNumber: block.number!
    });
  const current = BigInt((await read("currentEpoch")) as bigint);
  if (current < 1n) throw new Error("Invalid Bank epoch");
  const batch = (await publicClient.readContract({
    address: bank,
    abi: BANK_REDEMPTION_KEEPER_ABI,
    functionName: "redeemBatch",
    args: [current],
    blockNumber: block.number
  })) as { cutoff: bigint; priced: boolean; shares: bigint };
  if (batch.priced) throw new Error("Current Bank epoch is already priced");
  const [activeHolds, maxHolds, minStake] = (await Promise.all([
    read("activeOpenHolds"),
    read("MAX_ACTIVE_HOLDS"),
    read("minStake")
  ])) as bigint[];
  const capacity = {
    bank,
    activeOpenHolds: activeHolds!.toString(),
    maxActiveHolds: maxHolds!.toString(),
    capacityHeadroom: (maxHolds! - activeHolds!).toString(),
    minStake: minStake!.toString(),
    observedBlock: block.number.toString()
  };
  if (batch.shares === 0n || batch.cutoff === 0n) return capacity;
  return {
    ...capacity,
    batchId: current.toString(),
    cutoff: batch.cutoff.toString(),
    activationDue: block.timestamp >= batch.cutoff,
    openHolds: BigInt((await read("openHolds")) as bigint).toString(),
    paused: (await read("riskInPaused")) as boolean
  };
}

export async function reconcileRedemptionBank(
  bank: Address,
  deps: RedemptionDeps
): Promise<RedemptionHealth> {
  let before: RedemptionHealth = { bank };
  try {
    before = await readRedemptionBank(bank, deps.publicClient);
    if (before.batchId == null || before.paused || !before.activationDue) return before;
    const progressed = (after: RedemptionHealth) => after.batchId !== before.batchId;
    try {
      const receipt = await deps.activate(bank);
      if (receipt.status !== "success") throw new Error("activateBatch transaction reverted");
      const after = await readRedemptionBank(bank, deps.publicClient);
      if (!progressed(after)) throw new Error("activateBatch mined without advancing its batch");
      return after;
    } catch (error) {
      // Another caller may activate, cancel, or pause between our read and simulation.
      const after = await readRedemptionBank(bank, deps.publicClient);
      if (progressed(after) || after.paused) return after;
      throw error;
    }
  } catch (error) {
    return { ...before, error: describeError(error) };
  }
}

type PocketClient = Pick<PublicClient, "getBlock" | "readContract" | "getContractEvents">;
type TrackedPocket = {
  health: PocketHealth;
  checked: boolean;
};

/** Memory-only discovery replays finalized blocks from release origin after every restart.
 * A persisted cursor without its full epoch set would silently drop older recovery rights.
 * State reads and terminal pruning use that same finalized block, so a pre-finality reorg
 * cannot hide an activation or retire a pocket whose terminal transaction disappears.
 */
export function createPocketMonitor({
  bank,
  origin,
  chunkSize,
  maxChunks,
  pollLimit = POCKET_POLL_LIMIT
}: {
  bank: Address;
  origin?: bigint;
  chunkSize: bigint;
  maxChunks: number;
  pollLimit?: number;
}) {
  const epochs = new Map<string, TrackedPocket>();
  let nextBlock = origin ?? 0n;
  let scannedThrough = origin == null ? undefined : origin - 1n;
  let lastFinalizedBlock: bigint | undefined;
  let afterEpoch = 0n;
  let discovery: PocketDiscoveryHealth = { bank, caughtUp: false };
  const snapshot = () => ({ discovery, pockets: [...epochs.values()].map((item) => item.health) });
  return {
    async scan(client: PocketClient) {
      if (origin == null) {
        discovery = {
          bank,
          caughtUp: false,
          error: "Pocket discovery requires the release origin block"
        };
        return snapshot();
      }
      try {
        const latest = await client.getBlock();
        if (latest.number == null)
          throw new Error("Pocket reconciliation requires a numbered chain block");
        const block = await client.getBlock({ blockTag: "finalized" });
        if (block.number == null)
          throw new Error("Pocket discovery requires a numbered finalized block");
        const finalizedBlock = block.number;
        if (lastFinalizedBlock != null && finalizedBlock < lastFinalizedBlock)
          throw new Error(
            `Pocket finalized block regressed from ${lastFinalizedBlock} to ${finalizedBlock}`
          );
        lastFinalizedBlock = finalizedBlock;
        let scanError: string | undefined;
        try {
          const ranges = splitBlockRange({
            fromBlock: nextBlock,
            toBlock: finalizedBlock,
            chunkSize,
            maxChunks
          });
          for (const range of ranges) {
            const logs = await client.getContractEvents({
              address: bank,
              abi: BANK_REDEMPTION_KEEPER_ABI,
              eventName: "RedeemBatchActivated",
              strict: true,
              ...range
            });
            for (const log of logs) {
              if (log.removed) continue;
              const args = log.args as { batchId?: bigint };
              if (
                args.batchId == null ||
                log.blockNumber == null ||
                log.blockHash == null ||
                log.logIndex == null
              )
                throw new Error("Incomplete RedeemBatchActivated log");
              const id = args.batchId.toString();
              if (!epochs.has(id))
                epochs.set(id, { health: { bank, epochId: id }, checked: false });
            }
            nextBlock = range.toBlock + 1n;
            scannedThrough = range.toBlock;
          }
        } catch (error) {
          scanError = describeError(error);
        }

        const ids = [...epochs.keys()].map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const rotation = [
          ...ids.filter((id) => id > afterEpoch),
          ...ids.filter((id) => id <= afterEpoch)
        ].slice(0, pollLimit);
        for (const epoch of rotation) {
          const id = epoch.toString();
          const item = epochs.get(id)!;
          afterEpoch = epoch;
          try {
            const request = {
              address: bank,
              abi: BANK_REDEMPTION_KEEPER_ABI,
              args: [epoch],
              blockNumber: finalizedBlock
            } as const;
            const batch = (await client.readContract({
              ...request,
              functionName: "redeemBatch"
            })) as { priced: boolean; activatedAt: bigint };
            const pocket = (await client.readContract({
              ...request,
              functionName: "recoveryEpoch"
            })) as { snapshotSupply: bigint; remainingHolds: bigint; remainingReserve: bigint };
            if (!batch.priced || batch.activatedAt === 0n || pocket.snapshotSupply === 0n) {
              throw new Error("Finalized pocket activation disappeared");
            }
            if (batch.activatedAt > block.timestamp)
              throw new Error("Invalid pocket activation time");
            item.health = {
              bank,
              epochId: id,
              openedAt: batch.activatedAt.toString(),
              remainingHolds: pocket.remainingHolds.toString(),
              remainingReserve: pocket.remainingReserve.toString(),
              ageSeconds: Number(block.timestamp - batch.activatedAt)
            };
            item.checked = true;
            if (pocket.remainingHolds === 0n) epochs.delete(id);
          } catch (error) {
            item.health = { ...item.health, error: describeError(error) };
          }
        }
        // Unvisited epochs keep their errors and continue ageing; a successful page cannot clear them.
        for (const item of epochs.values())
          if (item.health.openedAt != null)
            item.health.ageSeconds = Number(block.timestamp - BigInt(item.health.openedAt));
        discovery = {
          bank,
          scannedThrough: scannedThrough?.toString(),
          finalizedBlock: finalizedBlock.toString(),
          headBlock: latest.number.toString(),
          caughtUp:
            nextBlock > finalizedBlock && [...epochs.values()].every((item) => item.checked),
          error: scanError
        };
      } catch (error) {
        discovery = { ...discovery, caughtUp: false, error: describeError(error) };
      }
      return snapshot();
    }
  };
}
