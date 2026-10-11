import { getAddress, type Address, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  fetchGovernanceTimelockEvents,
  GovernanceMismatchError,
  verifyGovernanceTimelock
} from "./governance.js";

const registry = "0x0000000000000000000000000000000000000066" as Address;
const hub = "0x0000000000000000000000000000000000000064" as Address;
const bankA = "0x00000000000000000000000000000000000000b1" as Address;
const bankB = "0x00000000000000000000000000000000000000b2" as Address;
const timelock = "0x00000000000000000000000000000000000000ee" as Address;
const deployer = "0x00000000000000000000000000000000000000d0" as Address;
const tx = `0x${"ab".repeat(32)}` as const;

function governedBy(governance: Record<string, Address>) {
  return {
    readContract: vi.fn(
      async ({ address, functionName }: { address: Address; functionName: string }) => {
        expect(functionName).toBe("governance");
        return governance[address.toLowerCase()];
      }
    )
  } as unknown as Pick<PublicClient, "readContract">;
}

describe("verifyGovernanceTimelock", () => {
  it("returns PoolRegistry.governance() when GameHub and every release Bank agree", async () => {
    const client = governedBy({
      [registry]: timelock,
      [hub]: timelock,
      [bankA]: timelock,
      [bankB]: timelock
    });
    await expect(
      verifyGovernanceTimelock({
        client,
        poolRegistry: registry,
        gameHub: hub,
        banks: [bankA, bankB]
      })
    ).resolves.toBe(getAddress(timelock));
  });

  it("refuses a release whose Bank is still governed by someone else", async () => {
    const client = governedBy({
      [registry]: timelock,
      [hub]: timelock,
      [bankA]: timelock,
      [bankB]: deployer
    });
    const verification = verifyGovernanceTimelock({
      client,
      poolRegistry: registry,
      gameHub: hub,
      banks: [bankA, bankB]
    });
    await expect(verification).rejects.toThrow(GovernanceMismatchError);
    await expect(verification).rejects.toThrow(
      `Bank ${getAddress(bankB)} reports ${getAddress(deployer)}`
    );
  });

  it("refuses a GameHub under another governance", async () => {
    const client = governedBy({ [registry]: timelock, [hub]: deployer });
    await expect(
      verifyGovernanceTimelock({ client, poolRegistry: registry, gameHub: hub, banks: [] })
    ).rejects.toThrow(/GameHub .* reports/);
  });
});

describe("fetchGovernanceTimelockEvents", () => {
  const range = { fromBlock: 100n, toBlock: 199n };
  const scheduled = {
    eventName: "CallScheduled",
    args: { id: `0x${"01".repeat(32)}`, index: 0n },
    blockNumber: 120n,
    logIndex: 3,
    transactionHash: tx
  };

  it("reads the five timelock events in one query and stamps their block time", async () => {
    const getLogs = vi.fn(async (_query: { events: Array<{ name: string }> }) => [
      scheduled,
      { ...scheduled, eventName: "CallSalt", logIndex: 4 },
      { ...scheduled, eventName: "Cancelled", blockNumber: 150n, logIndex: 0, removed: true }
    ]);
    const getBlock = vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
      timestamp: blockNumber * 2n
    }));
    const events = await fetchGovernanceTimelockEvents({
      client: { getLogs, getBlock } as unknown as Pick<PublicClient, "getLogs" | "getBlock">,
      chainId: 8453,
      timelock,
      range
    });
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(getLogs.mock.calls[0]![0]).toMatchObject({ address: timelock, ...range });
    expect(getLogs.mock.calls[0]![0].events.map((e) => e.name)).toEqual([
      "CallScheduled",
      "CallSalt",
      "CallExecuted",
      "Cancelled",
      "MinDelayChange"
    ]);
    // One block read for the two logs of block 120; the removed log is dropped.
    expect(getBlock).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      {
        chainId: 8453,
        timelock,
        blockNumber: 120n,
        blockTimestamp: 240_000,
        txHash: tx,
        logIndex: 3,
        eventName: "CallScheduled",
        args: scheduled.args
      },
      expect.objectContaining({ eventName: "CallSalt", logIndex: 4, blockTimestamp: 240_000 })
    ]);
  });

  it.each([
    ["mined identity", { ...scheduled, transactionHash: null }, /mined identity/],
    ["block time", scheduled, /header not found/]
  ])("fails the range when a log lacks its %s", async (_name, log, error) => {
    const getBlock = vi.fn(async () => {
      throw new Error("header not found");
    });
    await expect(
      fetchGovernanceTimelockEvents({
        client: { getLogs: vi.fn(async () => [log]), getBlock } as unknown as Pick<
          PublicClient,
          "getLogs" | "getBlock"
        >,
        chainId: 8453,
        timelock,
        range
      })
    ).rejects.toThrow(error);
  });
});
