import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encodeFunctionData, getAddress, keccak256, toBytes, type PublicClient } from "viem";
import { getContractAbis } from "@ssot/ssot/abis";
import {
  createPostgresBetIndexStore,
  GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
  type BetIndexStore
} from "@ssot/bet-index";

// The release names this run's timelock; it is set below, before any query.
const releaseTimelock = vi.hoisted(() => ({ address: "" }));
vi.mock("@ssot/ssot/release", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ssot/ssot/release")>();
  const { default: fixture } =
    await import("../../../../../packages/ssot/src/fixtures/release-v16.fixture.json");
  return {
    ...actual,
    loadEmbeddedRelease: (chainId: number) => ({
      ok: true,
      release: {
        ...fixture,
        chainId,
        contracts: { ...fixture.contracts, governanceTimelock: releaseTimelock.address }
      }
    })
  };
});

import {
  clearGovernanceQueueCache,
  queryGovernanceQueue,
  queryOpsGovernance
} from "./timelock-queue";

// The same disposable database the bet index and keeper suites use.
const url = process.env.KEEPER_TEST_POSTGRES_URL;
if (url && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("KEEPER_TEST_POSTGRES_URL must target a local disposable PostgreSQL instance");
}

const { PoolRegistryAbi, BankAbi, GovernanceTimelockAbi } = getContractAbis();
const chainId = 84532;
// A fresh timelock per run keeps rows apart from other suites sharing the database.
const timelock = getAddress(`0x${randomBytes(20).toString("hex")}`);
releaseTimelock.address = timelock;
const gameHub = getAddress("0x0000000000000000000000000000000000000064");
const registry = "0x0000000000000000000000000000000000000066";
const bank = "0x0000000000000000000000000000000000000002";
const delay = 259_200n;
const NOW_SECONDS = 2_000_000_000;
const tx = (n: number) =>
  `0x${(n + Number.parseInt(timelock.slice(2, 8), 16)).toString(16).padStart(64, "0")}` as const;
const id = (n: number) => `0x${n.toString(16).padStart(2, "0").repeat(32)}` as const;

function scheduled(
  block: number,
  logIndex: number,
  opId: `0x${string}`,
  index: number,
  target: string,
  data: `0x${string}`,
  scheduledAtSeconds: number
) {
  return {
    chainId,
    timelock,
    blockNumber: BigInt(block),
    blockTimestamp: scheduledAtSeconds * 1000,
    txHash: tx(block),
    logIndex,
    eventName: "CallScheduled" as const,
    args: {
      id: opId,
      index: BigInt(index),
      target,
      value: 0n,
      data,
      predecessor: `0x${"0".repeat(64)}`,
      delay
    }
  };
}

describe.skipIf(!url)("governance queue over the PostgreSQL bet index", () => {
  let store: BetIndexStore;
  const client = {
    getBlockNumber: vi.fn().mockResolvedValue(900n),
    getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(NOW_SECONDS - 300) }),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "governance") return timelock;
      throw new Error(`unexpected read ${functionName}`);
    })
  } as unknown as PublicClient;

  beforeAll(async () => {
    store = createPostgresBetIndexStore({ connectionString: url! });
    await store.initializeSchema();
    const unpause = encodeFunctionData({
      abi: BankAbi,
      functionName: "setRiskInPaused",
      args: [false]
    });
    const activate = encodeFunctionData({
      abi: PoolRegistryAbi,
      functionName: "setPoolActive",
      args: [1n, true]
    });
    const grant = encodeFunctionData({
      abi: GovernanceTimelockAbi,
      functionName: "grantRole",
      args: [keccak256(toBytes("CANCELLER_ROLE")), "0x00000000000000000000000000000000000000cc"]
    });
    await store.writeGovernanceTimelockEvents([
      // Waiting: scheduled an hour ago.
      scheduled(100, 0, id(1), 0, bank, unpause, NOW_SECONDS - 3_600),
      // Ready: a two-call batch scheduled four days ago.
      scheduled(101, 0, id(2), 0, registry, activate, NOW_SECONDS - 4 * 86_400),
      scheduled(101, 1, id(2), 1, timelock, grant, NOW_SECONDS - 4 * 86_400),
      // Cancelled by the guardian while waiting.
      scheduled(
        102,
        0,
        id(3),
        0,
        "0x00000000000000000000000000000000000000dd",
        "0xdeadbeef",
        NOW_SECONDS - 7_200
      ),
      {
        chainId,
        timelock,
        blockNumber: 103n,
        blockTimestamp: (NOW_SECONDS - 7_000) * 1000,
        txHash: tx(103),
        logIndex: 0,
        eventName: "Cancelled",
        args: { id: id(3) }
      },
      // Executed after its delay.
      scheduled(104, 0, id(4), 0, bank, unpause, NOW_SECONDS - 5 * 86_400),
      {
        chainId,
        timelock,
        blockNumber: 105n,
        blockTimestamp: (NOW_SECONDS - 86_400) * 1000,
        txHash: tx(105),
        logIndex: 0,
        eventName: "CallExecuted",
        args: { id: id(4), index: 0n, target: bank, value: 0n, data: unpause }
      }
    ]);
    await store.writeGameHubEvents([
      {
        chainId,
        gameHub,
        blockNumber: 106n,
        blockTimestamp: (NOW_SECONDS - 600) * 1000,
        txHash: tx(106),
        logIndex: 0,
        eventName: "VoidWindowOpened",
        args: {
          poolId: 1n,
          bank,
          cohortEnd: BigInt(NOW_SECONDS - 600),
          caller: "0x00000000000000000000000000000000000000ee"
        }
      },
      {
        chainId,
        gameHub,
        blockNumber: 107n,
        txHash: tx(107),
        logIndex: 0,
        eventName: "GameDisabled",
        args: {
          gameId: `0x${"ab".repeat(32)}`,
          caller: "0x00000000000000000000000000000000000000ee"
        }
      }
    ]);
    await store.setCursor({
      chainId,
      source: GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
      cursorKey: timelock,
      blockNumber: 120n
    });
  });

  afterAll(async () => {
    clearGovernanceQueueCache();
    await store?.close?.();
  });

  it("gives LPs the waiting and ready calls, decoded and marked by state", async () => {
    clearGovernanceQueueCache();
    const response = await queryGovernanceQueue({
      chainId,
      client,
      store,
      now: () => NOW_SECONDS * 1000
    });
    expect(response).toMatchObject({
      source: "postgres",
      timelock,
      coverage: { indexedThroughBlock: 120, stale: false }
    });
    expect(response.operations.map((op) => [op.operationId, op.index, op.state])).toEqual([
      [id(1), 0, "waiting"],
      [id(2), 0, "ready"],
      [id(2), 1, "ready"]
    ]);
    expect(response.operations[0]?.call).toMatchObject({
      contract: { name: "Bank", poolId: 1 },
      function: { name: "setRiskInPaused" }
    });
    expect(response.operations[1]?.call).toMatchObject({
      contract: { name: "PoolRegistry" },
      function: { name: "setPoolActive" }
    });
    expect(response.operations[2]?.call).toMatchObject({
      contract: { name: "GovernanceTimelock" },
      roleName: "CANCELLER_ROLE"
    });
    expect(response.operations[0]?.readyAt).toBe(NOW_SECONDS - 3_600 + Number(delay));
  });

  it("gives the Ops page the whole history with void windows and disabled games", async () => {
    clearGovernanceQueueCache();
    const response = await queryOpsGovernance({
      chainId,
      client,
      store,
      now: () => NOW_SECONDS * 1000
    });
    const states = Object.fromEntries(
      response.operations.map((op) => [`${op.operationId}:${op.index}`, op.state])
    );
    expect(states).toMatchObject({ [`${id(3)}:0`]: "cancelled", [`${id(4)}:0`]: "executed" });
    expect(response.operations.find((op) => op.operationId === id(3))?.call).toMatchObject({
      contract: { name: "unknown" },
      selector: "0xdeadbeef"
    });
    expect(response.voidWindows).toContainEqual(
      expect.objectContaining({ poolId: 1, cohortEnd: NOW_SECONDS - 600, txHash: tx(106) })
    );
    expect(response.disabledGames).toContainEqual(
      expect.objectContaining({ gameId: `0x${"ab".repeat(32)}`, txHash: tx(107) })
    );
  });
});
