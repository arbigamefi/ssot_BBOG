import type { Address, Hex, PublicClient } from "viem";
import { BANK_REDEMPTION_KEEPER_ABI } from "./abi.js";
import { describeError } from "./errors.js";
import type { PayableHealth } from "./health.js";
import { BANK_REORG_LOOKBACK } from "./redemption.js";
import { splitBlockRange } from "./scan.js";

const RETRY_BASE_MS = 5 * 60_000;
const RETRY_MAX_MS = 6 * 60 * 60_000;
const CLAIMS_PER_PASS = 20;

type PayableClient = Pick<PublicClient, "getBlock" | "readContract" | "getContractEvents">;

export type PayableClaim = (
  bank: Address,
  player: Address
) => Promise<{ status: "success" | "reverted"; txHash: Hex }>;

type TrackedPlayer = { player: Address; retryAt: number; failures: number };

/**
 * Pays player payables on the players' behalf. A payout the asset refused, or one a `finalize` caller made fail
 * by under-funding its gas, is recorded as a payable. `claimPlayerPayable` always pays the player itself, so the
 * keeper can complete it without any authority over the funds.
 *
 * Discovery is memory-only and replays from the release origin after a restart. Events only nominate players:
 * the on-chain balance decides whether a claim is sent. A claim the asset refuses (a blacklisted player, a
 * paused token) leaves the debt owed; it is retried with backoff and does not degrade the keeper.
 */
export function createPayableClaimer({
  bank,
  origin,
  chunkSize,
  maxChunks,
  now = Date.now
}: {
  bank: Address;
  origin?: bigint;
  chunkSize: bigint;
  maxChunks: number;
  now?: () => number;
}) {
  const players = new Map<string, TrackedPlayer>();
  let nextBlock = origin ?? 0n;
  let scannedThrough = origin == null ? undefined : origin - 1n;

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
      let head: bigint | undefined;
      try {
        const block = await client.getBlock();
        if (block.number == null)
          throw new Error("Payable reconciliation requires a numbered chain block");
        head = block.number;
        // Rescan the reorg window every pass: nominating a player twice is harmless.
        const from =
          nextBlock > origin + BANK_REORG_LOOKBACK ? nextBlock - BANK_REORG_LOOKBACK : origin;
        for (const range of splitBlockRange({
          fromBlock: from,
          toBlock: head,
          chunkSize,
          maxChunks
        })) {
          const logs = await client.getContractEvents({
            address: bank,
            abi: BANK_REDEMPTION_KEEPER_ABI,
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
      } catch (scanError) {
        error = describeError(scanError);
      }

      const due = [...players.values()]
        .filter((item) => item.retryAt <= now())
        .slice(0, CLAIMS_PER_PASS);
      for (const item of due) {
        try {
          const owed = (await client.readContract({
            address: bank,
            abi: BANK_REDEMPTION_KEEPER_ABI,
            functionName: "playerPayable",
            args: [item.player]
          })) as bigint;
          if (owed === 0n) {
            players.delete(item.player.toLowerCase());
            continue;
          }
          const receipt = await claim(bank, item.player);
          if (receipt.status !== "success")
            throw new Error("claimPlayerPayable transaction reverted");
          players.delete(item.player.toLowerCase());
        } catch (claimError) {
          item.failures += 1;
          item.retryAt = now() + Math.min(RETRY_BASE_MS * 2 ** (item.failures - 1), RETRY_MAX_MS);
          error ??= `${item.player}: ${describeError(claimError)}`;
        }
      }

      return {
        bank,
        scannedThrough: scannedThrough?.toString(),
        caughtUp: head != null && scannedThrough != null && scannedThrough >= head,
        pending: players.size,
        error
      };
    }
  };
}
