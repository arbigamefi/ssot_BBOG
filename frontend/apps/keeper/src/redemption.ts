import type { Address, Hex, PublicClient } from "viem";
import { BANK_REDEMPTION_KEEPER_ABI } from "./abi.js";
export { BANK_REDEMPTION_KEEPER_ABI } from "./abi.js";
import { describeError } from "./errors.js";
import type { PocketDiscoveryHealth, PocketHealth, RedemptionHealth } from "./health.js";
import { splitBlockRange } from "./scan.js";

export const BANK_REORG_LOOKBACK = 24n;
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
  const read = (functionName: "currentEpoch" | "openHolds" | "riskInPaused") =>
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
  if (batch.shares === 0n || batch.cutoff === 0n) return { bank };
  return {
    bank,
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
  blockNumber: bigint;
  identity: string;
  health: PocketHealth;
  checked: boolean;
  terminalAt?: bigint;
};

/** Memory-only discovery deliberately replays from release origin after every restart.
 * A persisted cursor without its full epoch set would silently drop older recovery rights.
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
        const block = await client.getBlock();
        if (block.number == null)
          throw new Error("Pocket reconciliation requires a numbered chain block");
        const head = block.number;
        let scanError: string | undefined;
        // Preserve progress within an overlap cycle even when its 24 blocks exceed one pass.
        // Restarting the rewind on every tick would starve forward discovery with small chunks.
        if (nextBlock > head + 1n)
          nextBlock = head > BANK_REORG_LOOKBACK ? head - BANK_REORG_LOOKBACK : origin;
        if (nextBlock < origin) nextBlock = origin;
        for (const [id, item] of epochs) if (item.blockNumber > head) epochs.delete(id);
        try {
          const ranges = splitBlockRange({
            fromBlock: nextBlock,
            toBlock: head,
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
            const canonical = new Map<string, { blockNumber: bigint; identity: string }>();
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
              canonical.set(args.batchId.toString(), {
                blockNumber: log.blockNumber,
                identity: `${log.blockHash}:${log.logIndex}`
              });
            }
            // Replace this canonical range, including empty pages, to remove orphan activations.
            for (const [id, item] of epochs)
              if (
                item.blockNumber >= range.fromBlock &&
                item.blockNumber <= range.toBlock &&
                !canonical.has(id)
              )
                epochs.delete(id);
            for (const [id, event] of canonical) {
              if (epochs.get(id)?.identity === event.identity) continue;
              epochs.set(id, { ...event, health: { bank, epochId: id }, checked: false });
            }
            nextBlock = range.toBlock + 1n;
            scannedThrough =
              scannedThrough == null || range.toBlock > scannedThrough
                ? range.toBlock
                : scannedThrough;
          }
          if (nextBlock > head)
            nextBlock =
              head >= origin + BANK_REORG_LOOKBACK - 1n ? head - BANK_REORG_LOOKBACK + 1n : origin;
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
              blockNumber: head
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
              // A fresh canonical read can also expose an orphan outside this pass's log page.
              epochs.delete(id);
              nextBlock = nextBlock < item.blockNumber ? nextBlock : item.blockNumber;
              scannedThrough = item.blockNumber - 1n;
              scanError = "Pocket activation disappeared; discovery is being replayed";
              continue;
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
            if (pocket.remainingHolds === 0n) {
              item.terminalAt ??= head;
              // Keep recent terminal observations so a shallow reorg can reopen an older pocket.
              if (head >= item.terminalAt + BANK_REORG_LOOKBACK) epochs.delete(id);
            } else item.terminalAt = undefined;
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
          caughtUp:
            scannedThrough != null &&
            scannedThrough >= head &&
            [...epochs.values()].every((item) => item.checked),
          error: scanError
        };
      } catch (error) {
        discovery = { ...discovery, caughtUp: false, error: describeError(error) };
      }
      return snapshot();
    }
  };
}
