import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeFunctionData, getAddress, keccak256, toBytes, type PublicClient } from "viem";
import { getContractAbis } from "@ssot/ssot/abis";
import {
  GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
  type BetIndexStore,
  type GovernanceTimelockOperation
} from "@ssot/bet-index";

vi.mock("@ssot/ssot/release", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ssot/ssot/release")>();
  const { default: fixture } =
    await import("../../../../../packages/ssot/src/fixtures/release-v16.fixture.json");
  return {
    ...actual,
    loadEmbeddedRelease: (chainId: number) => ({ ok: true, release: { ...fixture, chainId } })
  };
});

import {
  clearGovernanceQueueCache,
  queryGovernanceQueue,
  queryOpsGovernance
} from "./timelock-queue";

const { PoolRegistryAbi, BankAbi, GovernanceTimelockAbi } = getContractAbis();
// The fixture release's contracts.governanceTimelock.
const TIMELOCK = getAddress("0x00000000000000000000000000000000000000aa");
const REGISTRY = "0x0000000000000000000000000000000000000066";
const GAME_HUB = "0x0000000000000000000000000000000000000064";
const BANK = "0x0000000000000000000000000000000000000002";
const NOW = 1_800_000_000_000;

function operation(
  overrides: Partial<GovernanceTimelockOperation> &
    Pick<GovernanceTimelockOperation, "target" | "data">
): GovernanceTimelockOperation {
  return {
    chainId: 84532,
    timelock: TIMELOCK.toLowerCase() as `0x${string}`,
    operationId: `0x${"01".repeat(32)}`,
    index: 0,
    value: "0",
    predecessor: `0x${"0".repeat(64)}`,
    salt: `0x${"0".repeat(64)}`,
    delay: "259200",
    scheduledBlock: 10,
    scheduledTxHash: `0x${"0a".repeat(32)}`,
    scheduledAt: NOW - 3_600_000,
    readyAt: String(Math.floor(NOW / 1000) + 255_600),
    state: "waiting",
    ...overrides
  };
}

function client(blockTimestampSeconds = BigInt(Math.floor(NOW / 1000) - 600)) {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(500n),
    getBlock: vi.fn().mockResolvedValue({ timestamp: blockTimestampSeconds }),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "governance") return TIMELOCK;
      throw new Error(`unexpected read ${functionName}`);
    })
  } as unknown as PublicClient;
}

function store(overrides: Partial<BetIndexStore> = {}) {
  return {
    getGovernanceTimelockOperations: vi.fn().mockResolvedValue([]),
    getCursor: vi.fn().mockResolvedValue(480n),
    getGameHubOperatorEvents: vi.fn().mockResolvedValue([]),
    ...overrides
  } as unknown as BetIndexStore;
}

beforeEach(() => clearGovernanceQueueCache());
afterEach(() => clearGovernanceQueueCache());

describe("governance timelock queue", () => {
  it("reads pending operations of the timelock that governs the release and decodes them", async () => {
    const unpause = operation({
      target: BANK,
      data: encodeFunctionData({ abi: BankAbi, functionName: "setRiskInPaused", args: [false] })
    });
    const grant = operation({
      operationId: `0x${"02".repeat(32)}`,
      target: TIMELOCK.toLowerCase() as `0x${string}`,
      data: encodeFunctionData({
        abi: GovernanceTimelockAbi,
        functionName: "grantRole",
        args: [keccak256(toBytes("PROPOSER_ROLE")), "0x00000000000000000000000000000000000000bb"]
      }),
      readyAt: String(Math.floor(NOW / 1000) - 60),
      state: "ready"
    });
    const index = store({
      getGovernanceTimelockOperations: vi.fn().mockResolvedValue([unpause, grant])
    });
    const chain = client();

    const response = await queryGovernanceQueue({
      chainId: 84532,
      client: chain,
      store: index,
      now: () => NOW
    });

    expect(chain.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: getAddress(REGISTRY), functionName: "governance" })
    );
    expect(chain.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: getAddress(GAME_HUB), functionName: "governance" })
    );
    expect(index.getGovernanceTimelockOperations).toHaveBeenCalledWith({
      chainId: 84532,
      timelock: TIMELOCK,
      pendingOnly: true,
      now: NOW
    });
    expect(index.getCursor).toHaveBeenCalledWith(
      84532,
      GOVERNANCE_TIMELOCK_CURSOR_SOURCE,
      TIMELOCK
    );
    expect(response).toMatchObject({
      source: "postgres",
      timelock: TIMELOCK,
      coverage: { indexedThroughBlock: 480, stale: false }
    });
    expect(response.operations[0]).toMatchObject({
      state: "waiting",
      readyAt: Math.floor(NOW / 1000) + 255_600,
      call: {
        contract: { name: "Bank", poolId: 1 },
        function: {
          name: "setRiskInPaused",
          args: [{ name: "paused_", type: "bool", value: false }]
        }
      }
    });
    expect(response.operations[1]).toMatchObject({
      state: "ready",
      call: { contract: { name: "GovernanceTimelock" }, roleName: "PROPOSER_ROLE" }
    });
    // JSON-safe: uint arguments travel as decimal strings.
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });

  it("names an unknown target and its selector without decoding", async () => {
    const index = store({
      getGovernanceTimelockOperations: vi
        .fn()
        .mockResolvedValue([
          operation({ target: "0x00000000000000000000000000000000000000cc", data: "0xdeadbeef00" })
        ])
    });
    const response = await queryGovernanceQueue({
      chainId: 84532,
      client: client(),
      store: index,
      now: () => NOW
    });
    expect(response.operations[0]?.call).toEqual({
      target: getAddress("0x00000000000000000000000000000000000000cc"),
      contract: { name: "unknown" },
      selector: "0xdeadbeef"
    });
  });

  it("marks the list incomplete when the index has fallen behind or never read the timelock", async () => {
    const old = await queryGovernanceQueue({
      chainId: 84532,
      client: client(BigInt(Math.floor(NOW / 1000) - 7_200)),
      store: store(),
      now: () => NOW
    });
    expect(old.coverage).toMatchObject({ indexedThroughBlock: 480, stale: true });
    clearGovernanceQueueCache();
    const never = await queryGovernanceQueue({
      chainId: 84532,
      client: client(),
      store: store({ getCursor: vi.fn().mockResolvedValue(null) }),
      now: () => NOW
    });
    expect(never.coverage).toEqual({
      indexedThroughBlock: null,
      indexedThroughAt: null,
      stale: true
    });
  });

  it("reports unavailable, never an empty queue, when the index or the chain cannot be read", async () => {
    expect(
      await queryGovernanceQueue({ chainId: 84532, client: client(), store: null, now: () => NOW })
    ).toMatchObject({ source: "unavailable", operations: [], timelock: null });
    clearGovernanceQueueCache();
    const offline = client();
    (offline.readContract as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("RPC offline"));
    expect(
      await queryGovernanceQueue({
        chainId: 84532,
        client: offline,
        store: store(),
        now: () => NOW
      })
    ).toMatchObject({ source: "unavailable", operations: [] });
    clearGovernanceQueueCache();
    expect(
      await queryGovernanceQueue({
        chainId: 84532,
        client: client(),
        store: store({
          getGovernanceTimelockOperations: vi.fn().mockRejectedValue(new Error("db down"))
        }),
        now: () => NOW
      })
    ).toMatchObject({ source: "unavailable" });
  });

  it.each([
    ["GameHub", TIMELOCK, "0x00000000000000000000000000000000000000dd"],
    [
      "PoolRegistry and GameHub",
      "0x00000000000000000000000000000000000000dd",
      "0x00000000000000000000000000000000000000dd"
    ]
  ])(
    "reports unavailable when the governance of %s is not the release timelock",
    async (_, registryGovernance, hubGovernance) => {
      const foreign = client();
      (foreign.readContract as ReturnType<typeof vi.fn>).mockImplementation(
        async ({ address }: { address: string }) =>
          address.toLowerCase() === REGISTRY ? registryGovernance : hubGovernance
      );
      const index = store();
      expect(
        await queryGovernanceQueue({
          chainId: 84532,
          client: foreign,
          store: index,
          now: () => NOW
        })
      ).toMatchObject({ source: "unavailable", timelock: null, operations: [] });
      expect(index.getGovernanceTimelockOperations).not.toHaveBeenCalled();
    }
  );

  it("gives the Ops page every operation with void windows and disabled games", async () => {
    const executed = operation({
      target: REGISTRY,
      data: encodeFunctionData({
        abi: PoolRegistryAbi,
        functionName: "setPoolActive",
        args: [1n, true]
      }),
      state: "executed",
      executedBlock: 20,
      executedTxHash: `0x${"0e".repeat(32)}`
    });
    const index = store({
      getGovernanceTimelockOperations: vi.fn().mockResolvedValue([executed]),
      getGameHubOperatorEvents: vi.fn().mockResolvedValue([
        {
          eventName: "VoidWindowOpened",
          chainId: 84532,
          gameHub: GAME_HUB,
          blockNumber: 30,
          blockTimestamp: NOW - 1000,
          txHash: `0x${"0f".repeat(32)}`,
          logIndex: 1,
          caller: "0x00000000000000000000000000000000000000ee",
          poolId: "1",
          bank: BANK,
          cohortEnd: "1799999000"
        },
        {
          eventName: "GameDisabled",
          chainId: 84532,
          gameHub: GAME_HUB,
          blockNumber: 31,
          txHash: `0x${"1f".repeat(32)}`,
          logIndex: 0,
          caller: "0x00000000000000000000000000000000000000ee",
          gameId: `0x${"ab".repeat(32)}`
        }
      ])
    });

    const response = await queryOpsGovernance({
      chainId: 84532,
      client: client(),
      store: index,
      now: () => NOW
    });

    expect(index.getGovernanceTimelockOperations).toHaveBeenCalledWith(
      expect.objectContaining({ pendingOnly: false })
    );
    expect(index.getGameHubOperatorEvents).toHaveBeenCalledWith({
      chainId: 84532,
      gameHub: getAddress(GAME_HUB),
      limit: 200
    });
    expect(response.operations[0]).toMatchObject({ state: "executed" });
    expect(response.voidWindows).toEqual([
      {
        poolId: 1,
        bank: getAddress(BANK),
        cohortEnd: 1_799_999_000,
        caller: getAddress("0x00000000000000000000000000000000000000ee"),
        blockNumber: 30,
        blockTimestamp: NOW - 1000,
        txHash: `0x${"0f".repeat(32)}`
      }
    ]);
    expect(response.disabledGames).toEqual([
      {
        gameId: `0x${"ab".repeat(32)}`,
        caller: getAddress("0x00000000000000000000000000000000000000ee"),
        blockNumber: 31,
        txHash: `0x${"1f".repeat(32)}`
      }
    ]);
  });
});
