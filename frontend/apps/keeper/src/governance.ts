import {
  getAbiItem,
  getAddress,
  type AbiEvent,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import type { GovernanceTimelockEvent, GovernanceTimelockEventName } from "@ssot/bet-index";
import {
  BANK_KEEPER_ABI,
  GAME_HUB_KEEPER_ABI,
  GOVERNANCE_TIMELOCK_KEEPER_ABI,
  POOL_REGISTRY_KEEPER_ABI
} from "./abi.js";
import type { BlockRange } from "./scan.js";

/** GovernanceTimelock events the bet index stores, fetched with one eth_getLogs per range. */
export const GOVERNANCE_TIMELOCK_INDEX_EVENTS = [
  "CallScheduled",
  "CallSalt",
  "CallExecuted",
  "Cancelled",
  "MinDelayChange"
] as const satisfies readonly GovernanceTimelockEventName[];

const GOVERNANCE_TIMELOCK_EVENT_ABI = GOVERNANCE_TIMELOCK_INDEX_EVENTS.map(
  (name) => getAbiItem({ abi: GOVERNANCE_TIMELOCK_KEEPER_ABI, name }) as AbiEvent
);

/** PoolRegistry, GameHub and a release Bank disagree about their governance. */
export class GovernanceMismatchError extends Error {
  override name = "GovernanceMismatchError";
}

/**
 * ADR-0037 §2: one GovernanceTimelock governs PoolRegistry, GameHub and every Bank. The timelock is
 * PoolRegistry.governance(); indexing is refused unless GameHub and every release Bank report the same
 * address, so LPs never read the queue of a timelock that does not govern the release.
 */
export async function verifyGovernanceTimelock({
  client,
  poolRegistry,
  gameHub,
  banks
}: {
  client: Pick<PublicClient, "readContract">;
  poolRegistry: Address;
  gameHub: Address;
  banks: readonly Address[];
}): Promise<Address> {
  const governed = [
    { name: "PoolRegistry", address: poolRegistry, abi: POOL_REGISTRY_KEEPER_ABI },
    { name: "GameHub", address: gameHub, abi: GAME_HUB_KEEPER_ABI },
    ...banks.map((bank) => ({ name: "Bank", address: bank, abi: BANK_KEEPER_ABI }))
  ];
  const reported = await Promise.all(
    governed.map(async ({ name, address, abi }) => {
      const value = await client.readContract({ address, abi, functionName: "governance" });
      if (typeof value !== "string")
        throw new Error(`${name} ${address} governance() is unreadable`);
      return { name, address: getAddress(address), governance: getAddress(value) };
    })
  );
  const timelock = reported[0]!.governance;
  const foreign = reported.filter((item) => item.governance !== timelock);
  if (foreign.length > 0)
    throw new GovernanceMismatchError(
      `Governance timelock indexing refused: PoolRegistry ${getAddress(poolRegistry)} reports ` +
        `${timelock}, but ${foreign.map((item) => `${item.name} ${item.address} reports ${item.governance}`).join(", ")}`
    );
  return timelock;
}

type TimelockLog = {
  eventName: string;
  args?: Record<string, unknown>;
  blockNumber?: bigint | null;
  logIndex?: number | null;
  transactionHash?: Hex | null;
  removed?: boolean;
};

/**
 * The timelock's events in one range, with block timestamps: readyAt is the schedule block time plus
 * the delay. A log without its mined identity or block time fails the range, so the caller keeps its
 * cursor and retries it rather than storing a wrong row.
 */
export async function fetchGovernanceTimelockEvents({
  client,
  chainId,
  timelock,
  range
}: {
  client: Pick<PublicClient, "getLogs" | "getBlock">;
  chainId: number;
  timelock: Address;
  range: BlockRange;
}): Promise<GovernanceTimelockEvent[]> {
  const logs = (await client.getLogs({
    address: timelock,
    events: GOVERNANCE_TIMELOCK_EVENT_ABI,
    fromBlock: range.fromBlock,
    toBlock: range.toBlock
  })) as unknown as TimelockLog[];
  const timestamps = new Map<bigint, Promise<number>>();
  const timestampOf = (blockNumber: bigint) => {
    let timestamp = timestamps.get(blockNumber);
    if (!timestamp) {
      timestamp = client.getBlock({ blockNumber }).then((block) => Number(block.timestamp) * 1000);
      timestamps.set(blockNumber, timestamp);
    }
    return timestamp;
  };
  return Promise.all(
    logs
      .filter((log) => !log.removed)
      .map(async (log): Promise<GovernanceTimelockEvent> => {
        if (log.blockNumber == null || log.logIndex == null || !log.transactionHash)
          throw new Error("Governance timelock log is missing its mined identity");
        if (!(GOVERNANCE_TIMELOCK_INDEX_EVENTS as readonly string[]).includes(log.eventName))
          throw new Error(`Unexpected governance timelock event ${log.eventName}`);
        return {
          chainId,
          timelock,
          blockNumber: log.blockNumber,
          blockTimestamp: await timestampOf(log.blockNumber),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          eventName: log.eventName as GovernanceTimelockEventName,
          args: log.args ?? {}
        };
      })
  );
}
