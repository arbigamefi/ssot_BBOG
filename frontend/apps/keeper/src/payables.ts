import type { Address, Hash, Hex, PublicClient } from "viem";
import { BANK_KEEPER_ABI } from "./abi.js";
import { UnknownBlockGrace } from "./block-grace.js";
import { describeError } from "./errors.js";
import { HeadMonitor } from "./head-monitor.js";
import type { PayableHealth } from "./health.js";
import type { PayableState, PayableStateStore } from "./payables-state.js";
import { splitBlockRange } from "./scan.js";
import type { KeeperLogger } from "./types.js";

const RETRY_BASE_MS = 5 * 60_000;
const RETRY_MAX_MS = 6 * 60 * 60_000;
const CLAIMS_PER_PASS = 20;

type PayableClient = Pick<PublicClient, "getBlock" | "readContract" | "getContractEvents">;

export type PayableClaim = (
  bank: Address,
  player: Address
) => Promise<
  | { status: "success" | "reverted"; txHash: Hex; blockNumber: bigint }
  | { status: "refused"; reason: string }
>;

type TrackedPlayer = {
  player: Address;
  retryAt: number;
  failures: number;
  zeroObservedAt?: bigint;
  error?: string;
  claimError?: string;
  readError?: string;
  /** A block-pinned read reached a node without that block; it becomes `readError` after five minutes. */
  transientReadError?: string;
};

/**
 * Pays player payables on the players' behalf. A payout the asset refused, or one a `finalize` caller made fail
 * by under-funding its gas, is recorded as a payable. `claimPlayerPayable` always pays the player itself, so the
 * keeper can complete it without any authority over the funds.
 *
 * Discovery reads finalized blocks only, so new debts wait for chain finality before automatic discovery. With a
 * state store it saves its cursor and tracked players after each pass that changes them, and after a restart
 * resumes from the saved block once that block's hash matches the chain; without one, or when the hash differs,
 * it replays from the release origin. A monotonic finalized cursor preserves coverage even when a small scan
 * budget takes many passes to catch up. A finalized read below the cursor scans nothing and is reported as
 * `finalizedBehindBy`, not as an error; a finalized head that has not advanced for `finalizedStallMs` is
 * reported as `finalizedStalledSince`. Events only nominate players: the on-chain balance decides whether a
 * claim is sent. An explicitly recognized token refusal leaves the debt owed and retries with backoff.
 * Unrecognized failures require operational attention.
 */
export function createPayableClaimer({
  bank,
  origin,
  chunkSize,
  maxChunks,
  logger,
  finalizedStallMs,
  state,
  now = Date.now
}: {
  bank: Address;
  origin?: bigint;
  chunkSize: bigint;
  maxChunks: number;
  logger?: KeeperLogger;
  finalizedStallMs?: number;
  state?: PayableStateStore;
  now?: () => number;
}) {
  const players = new Map<string, TrackedPlayer>();
  const stateKey = (through: bigint, tracked: readonly Address[]) =>
    `${through}:${tracked
      .map((player) => player.toLowerCase())
      .sort()
      .join(",")}`;
  let nextBlock = origin ?? 0n;
  let scannedThrough = origin == null ? undefined : origin - 1n;
  let stateLoaded = state == null;
  /** Loaded, not yet checked against the chain: nothing is scanned until it is. */
  let restoring: PayableState | undefined;
  /** The cursor and players of the last save; a pass that changes neither saves nothing. */
  let savedKey: string | undefined;
  let stateError: string | undefined;
  const finality = new HeadMonitor({
    scanner: `payables:${bank}`,
    head: "finalized",
    logger,
    now,
    stallMs: finalizedStallMs
  });
  const grace = new UnknownBlockGrace(now);
  /** Pinned reads go to whichever node answers: hold its unknown-block failures for five minutes. */
  const recordReadFailure = (item: TrackedPlayer, key: string, failure: unknown) => {
    const description = describeError(failure);
    const persistent = grace.report(key, failure);
    item.readError = persistent ? description : undefined;
    item.transientReadError = persistent ? undefined : description;
  };

  return {
    async run(client: PayableClient, claim: PayableClaim): Promise<PayableHealth> {
      if (origin == null) {
        return {
          bank,
          caughtUp: false,
          pending: 0,
          error: "Payable discovery requires the release origin block"
        };
      }
      let error: string | undefined;
      let readError: string | undefined;
      let head: bigint | undefined;
      let finalizedBlock: bigint | undefined;
      let finalizedBehindBy: bigint | undefined;
      let finalizedStalledSince: string | undefined;
      let caughtUp = false;
      let finalizedRead: { number: bigint; hash: Hash | null } | undefined;
      try {
        if (!stateLoaded) {
          restoring = await state!.load();
          stateLoaded = true;
        }
        if (restoring) {
          const saved = restoring;
          const block = await client.getBlock({ blockNumber: saved.scannedThrough });
          if (block.hash === saved.scannedThroughHash) {
            nextBlock = saved.scannedThrough + 1n;
            scannedThrough = saved.scannedThrough;
            for (const player of saved.players)
              players.set(player.toLowerCase(), { player, retryAt: 0, failures: 0 });
            finality.seed(saved.scannedThrough);
            savedKey = stateKey(saved.scannedThrough, saved.players);
            logger?.info("casino.keeper.payables_state_restored", {
              bank,
              scannedThrough: saved.scannedThrough.toString(),
              players: saved.players.length
            });
          } else
            logger?.warn("casino.keeper.payables_state_ignored", {
              bank,
              reason: `block ${saved.scannedThrough} is ${block.hash} on this chain, not ${saved.scannedThroughHash}`
            });
          restoring = undefined;
        }
        const block = await client.getBlock();
        if (block.number == null)
          throw new Error("Payable reconciliation requires a numbered chain block");
        head = block.number;
        const finalized = await client.getBlock({ blockTag: "finalized" });
        if (finalized.number == null)
          throw new Error("Payable discovery requires a numbered finalized block");
        finalizedRead = { number: finalized.number, hash: finalized.hash };
        const observed = finality.observe(finalized.number);
        finalizedBlock = observed.target;
        finalizedBehindBy = observed.behindBy;
        if (observed.stalledSince != null)
          finalizedStalledSince = new Date(observed.stalledSince).toISOString();
        for (const range of splitBlockRange({
          fromBlock: nextBlock,
          toBlock: finalizedBlock,
          chunkSize,
          maxChunks
        })) {
          const logs = await client.getContractEvents({
            address: bank,
            abi: BANK_KEEPER_ABI,
            eventName: "PlayerPayableCreated",
            strict: true,
            ...range
          });
          for (const log of logs) {
            if (log.removed) continue;
            const player = (log.args as { player?: Address }).player;
            if (player && !players.has(player.toLowerCase()))
              players.set(player.toLowerCase(), { player, retryAt: 0, failures: 0 });
          }
          nextBlock = range.toBlock + 1n;
          scannedThrough = range.toBlock;
        }
        caughtUp = nextBlock > finalizedBlock;
      } catch (scanError) {
        error = describeError(scanError);
        readError = error;
      }

      const due = [...players.values()]
        .filter((item) => item.retryAt <= now())
        .slice(0, CLAIMS_PER_PASS);
      for (const item of due) {
        // Rotate both debtors and finality watchers so the bounded pass cannot starve later players.
        players.delete(item.player.toLowerCase());
        players.set(item.player.toLowerCase(), item);
        const key = item.player.toLowerCase();
        let owed: bigint;
        try {
          owed = (await client.readContract({
            address: bank,
            abi: BANK_KEEPER_ABI,
            functionName: "playerPayable",
            args: [item.player],
            ...(head != null ? { blockNumber: head } : {})
          })) as bigint;
          grace.succeed(`head:${key}`);
          item.readError = undefined;
          item.transientReadError = undefined;
        } catch (failure) {
          recordReadFailure(item, `head:${key}`, failure);
          continue;
        }
        try {
          if (owed > 0n) {
            item.zeroObservedAt = undefined;
            const receipt = await claim(bank, item.player);
            if (receipt.status === "refused") {
              item.failures += 1;
              item.retryAt =
                now() + Math.min(RETRY_BASE_MS * 2 ** (item.failures - 1), RETRY_MAX_MS);
              item.error = `${item.player}: ${receipt.reason}`;
              // A simulation refusal does not prove an earlier send/receipt failure recovered.
              continue;
            }
            if (receipt.status !== "success")
              throw new Error("claimPlayerPayable transaction reverted");
            item.zeroObservedAt = receipt.blockNumber;
          } else item.zeroObservedAt ??= head;
          item.failures = 0;
          item.retryAt = 0;
          item.error = undefined;
          item.claimError = undefined;
        } catch (claimError) {
          item.failures += 1;
          item.retryAt = now() + Math.min(RETRY_BASE_MS * 2 ** (item.failures - 1), RETRY_MAX_MS);
          item.error = `${item.player}: ${describeError(claimError)}`;
          item.claimError = item.error;
          continue;
        }
        try {
          // The creation may be years old. Keep its player until a finalized zero proves a recent
          // successful claim (ours or someone else's) cannot disappear in a shallow reorg.
          if (
            item.zeroObservedAt == null ||
            finalizedBlock == null ||
            readError != null ||
            finalizedBlock < item.zeroObservedAt
          )
            continue;
          const finalizedOwed = (await client.readContract({
            address: bank,
            abi: BANK_KEEPER_ABI,
            functionName: "playerPayable",
            args: [item.player],
            blockNumber: finalizedBlock
          })) as bigint;
          grace.succeed(`finalized:${key}`);
          if (finalizedOwed === 0n) players.delete(key);
        } catch (failure) {
          recordReadFailure(item, `finalized:${key}`, failure);
        }
      }

      if (state && scannedThrough != null && scannedThrough >= origin) {
        const through = scannedThrough;
        const tracked = [...players.values()].map((item) => item.player);
        const key = stateKey(through, tracked);
        if (key !== savedKey) {
          try {
            const hash =
              through === finalizedRead?.number
                ? finalizedRead.hash
                : (await client.getBlock({ blockNumber: through })).hash;
            if (hash == null) throw new Error(`block ${through} has no hash`);
            await state.save({
              scannedThrough: through,
              scannedThroughHash: hash,
              players: tracked
            });
            savedKey = key;
            stateError = undefined;
          } catch (failure) {
            stateError = `payable state not saved: ${describeError(failure)}`;
            logger?.warn("casino.keeper.payables_state_save_failed", { bank, error: stateError });
          }
        }
      }

      const tracked = [...players.values()];
      readError ??= tracked.find((item) => item.readError)?.readError;
      const claimError = tracked.find((item) => item.claimError)?.claimError;
      const transientReadError = tracked.find(
        (item) => item.transientReadError
      )?.transientReadError;
      return {
        bank,
        scannedThrough: scannedThrough?.toString(),
        finalizedBlock: finalizedBlock?.toString(),
        ...(finalizedBehindBy == null ? {} : { finalizedBehindBy: finalizedBehindBy.toString() }),
        ...(finalizedStalledSince ? { finalizedStalledSince } : {}),
        headBlock: head?.toString(),
        caughtUp,
        pending: tracked.filter((item) => item.zeroObservedAt == null).length,
        error: error ?? claimError ?? stateError ?? tracked.find((item) => item.error)?.error,
        ...(claimError ? { claimError } : {}),
        ...(stateError ? { stateError } : {}),
        ...(readError ? { readError } : {}),
        ...(transientReadError ? { transientReadError } : {})
      };
    }
  };
}
