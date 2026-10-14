import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAddress, isAddress, isHash, type Address, type Hash } from "viem";
import { describeError } from "./errors.js";
import type { KeeperLogger } from "./types.js";

/**
 * What payable discovery has established through a finalized block: every `PlayerPayableCreated` from the release
 * origin through `scannedThrough` nominated one of `players`, or its player has since been read as paid at a
 * finalized block. `scannedThroughHash` ties the state to one chain, so a reset chain with the same id, Bank and
 * origin does not restore it.
 */
export type PayableState = {
  scannedThrough: bigint;
  scannedThroughHash: Hash;
  players: Address[];
};

export type PayableStateStore = {
  /** The saved state, or undefined when there is none or it is unreadable or for another chain, Bank or origin. */
  load(): Promise<PayableState | undefined>;
  save(state: PayableState): Promise<void>;
};

const SCHEMA_VERSION = 1;

/** Why a saved state cannot be used, or the state. */
function parse(
  saved: unknown,
  chainId: number,
  bank: Address,
  origin: bigint
): PayableState | string {
  if (typeof saved !== "object" || saved === null) return "not a JSON object";
  const state = saved as Record<string, unknown>;
  if (state.schemaVersion !== SCHEMA_VERSION)
    return `schemaVersion ${String(state.schemaVersion)} is not ${SCHEMA_VERSION}`;
  if (state.chainId !== chainId) return `chainId ${String(state.chainId)} is not ${chainId}`;
  if (typeof state.bank !== "string" || state.bank.toLowerCase() !== bank.toLowerCase())
    return `bank ${String(state.bank)} is not ${bank}`;
  if (state.origin !== origin.toString()) return `origin ${String(state.origin)} is not ${origin}`;
  const through = state.scannedThrough;
  if (typeof through !== "string" || !/^\d+$/.test(through) || BigInt(through) < origin)
    return `scannedThrough ${String(through)} is not a block at or after the origin`;
  if (typeof state.scannedThroughHash !== "string" || !isHash(state.scannedThroughHash))
    return "scannedThroughHash is not a block hash";
  const players = state.players;
  if (
    !Array.isArray(players) ||
    !players.every((player) => typeof player === "string" && isAddress(player, { strict: false }))
  )
    return "players is not a list of addresses";
  return {
    scannedThrough: BigInt(through),
    scannedThroughHash: state.scannedThroughHash,
    players: [...new Set((players as string[]).map((player) => getAddress(player)))]
  };
}

/**
 * One JSON file per chain and Bank in `stateDir`. A missing file means none was saved; an unreadable file, or one
 * for another chain, Bank or origin, is logged and ignored, so discovery replays from the origin and the next save
 * replaces it. Saves write a temporary file and rename it over the old one.
 */
export function createPayableStateFile({
  stateDir,
  chainId,
  bank,
  origin,
  logger
}: {
  stateDir: string;
  chainId: number;
  bank: Address;
  origin: bigint;
  logger?: KeeperLogger;
}): PayableStateStore {
  const path = join(stateDir, `payables-${chainId}-${bank.toLowerCase()}.json`);
  const ignore = (reason: string) => {
    logger?.warn("casino.keeper.payables_state_ignored", { bank, path, reason });
    return undefined;
  };
  return {
    async load() {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        return ignore(describeError(error));
      }
      let saved: unknown;
      try {
        saved = JSON.parse(text);
      } catch {
        return ignore("not JSON");
      }
      const state = parse(saved, chainId, bank, origin);
      return typeof state === "string" ? ignore(state) : state;
    },
    async save(state) {
      await mkdir(stateDir, { recursive: true });
      const tmpPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      const saved = {
        schemaVersion: SCHEMA_VERSION,
        chainId,
        bank,
        origin: origin.toString(),
        scannedThrough: state.scannedThrough.toString(),
        scannedThroughHash: state.scannedThroughHash,
        players: state.players
      };
      await writeFile(tmpPath, `${JSON.stringify(saved, null, 2)}\n`, "utf8");
      await rename(tmpPath, path);
    }
  };
}
