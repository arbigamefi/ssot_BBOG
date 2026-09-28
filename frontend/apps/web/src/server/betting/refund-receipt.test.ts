import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbi,
  type PublicClient
} from "viem";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

vi.mock("@ssot/ssot/release", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ssot/ssot/release")>();
  const { default: fixture } =
    await import("../../../../../packages/ssot/src/fixtures/release-v16.fixture.json");
  return {
    ...actual,
    loadEmbeddedRelease: (chainId: number) => ({
      ok: true,
      release: { ...fixture, chainId }
    })
  };
});
import type { BetRow } from "@ssot/bet-index";
import { HOUSE_EDGE_ALLOCATED_ABI } from "@ssot/bet-index/house-edge";
import { PLAYER_PAYMENT_ABI } from "@ssot/bet-index/player-payment";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@ssot/bet-index", () => ({ createPostgresBetIndexStore: factory }));
import { clearRecentBetsCache, materializeBetReceipt, queryBetReceipt } from "./recent-bets";

const txHash = `0x${"aa".repeat(32)}` as const;
const asset = "0x4444444444444444444444444444444444444444";
const player = "0x2222222222222222222222222222222222222222";
const bank = "0x5555555555555555555555555555555555555555";
const gameId = `0x${"11".repeat(32)}` as const;
const abi = parseAbi([
  "event BetFinalized(uint256 indexed positionId, uint256 payoutGross, uint256 payoutNet, uint256 feeOnPayout, uint256 protocolFeeAccrual)"
]);
const terminal = {
  state: 4,
  payoutGross: 200000n,
  payoutNet: 196000n,
  feeOnPayout: 4000n,
  protocolFeeAccrual: 2000n,
  refundAmount: 100000n
};
const activeRelease = loadEmbeddedRelease(84532);
if (!activeRelease.ok) throw new Error(activeRelease.error);
const activeHub = activeRelease.release.contracts.gameHub.toLowerCase() as `0x${string}`;
let stored: BetRow;
let getBet: ReturnType<typeof vi.fn>;
let writeBetRows: ReturnType<typeof vi.fn>;
let writeGameHubEvents: ReturnType<typeof vi.fn>;
// What a v1.6 GameHub emits in the same transaction, before BetFinalized.
function houseEdgeLog(address: string) {
  return {
    address,
    logIndex: 0,
    topics: encodeEventTopics({
      abi: HOUSE_EDGE_ALLOCATED_ABI,
      eventName: "HouseEdgeAllocated",
      args: { positionId: 42n }
    }),
    data: encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint16" },
        ...Array.from({ length: 8 }, () => ({ type: "uint256" as const }))
      ],
      [100000n, 200, 2000n, 1000n, 1000n, 300n, 200n, 400n, 100n, 0n]
    )
  };
}

function clientWithTerminal(proof = terminal, extraLogs: unknown[] = []) {
  const release = loadEmbeddedRelease(84532);
  if (!release.ok) throw new Error(release.error);
  return {
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1000n }),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === "getBetTerminal"
        ? proof
        : {
            asset,
            bank,
            player,
            gameId,
            pricingAffiliate: player,
            stake: 200000n,
            placedAt: 900n,
            requestId: 7n,
            randomHash: txHash
          }
    ),
    getTransactionReceipt: vi.fn().mockResolvedValue({
      blockNumber: 1000n,
      transactionHash: txHash,
      logs: [
        ...extraLogs,
        {
          address: release.release.contracts.gameHub,
          logIndex: 1,
          topics: encodeEventTopics({ abi, eventName: "BetFinalized", args: { positionId: 42n } }),
          data: encodeAbiParameters(
            [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
            [200000n, 196000n, 4000n, 2000n]
          )
        }
      ]
    })
  } as unknown as PublicClient;
}

beforeEach(() => {
  vi.stubEnv("BET_INDEX_DATABASE_URL", "postgres://unused/test");
  vi.stubEnv("BET_INDEX_READ_ENABLED", "true");
  vi.stubEnv("BET_RECEIPT_RPC_FALLBACK_ENABLED", "true");
  clearRecentBetsCache();
  stored = {
    id: `84532:${activeHub}:42`,
    chainId: 84532,
    gameHub: activeHub,
    betId: "42",
    state: "finalized",
    stake: "200000",
    payout: "196000",
    updatedAt: 1,
    updatedBlock: 1,
    lastTxHash: txHash,
    lastEventName: "BetFinalized"
  };
  writeBetRows = vi.fn(async (rows: BetRow[]) => {
    stored = rows[0]!;
  });
  getBet = vi.fn(async () => stored);
  writeGameHubEvents = vi.fn(async () => []);
  factory.mockReturnValue({ getBet, writeBetRows, writeGameHubEvents });
});
afterEach(() => {
  vi.unstubAllEnvs();
  clearRecentBetsCache();
  vi.clearAllMocks();
});

describe("receipt refund proof repair", () => {
  it.each(["payable", "transferred"] as const)(
    "distinguishes terminal %s evidence from the economic payout",
    async (status) => {
      stored = { ...stored, refundAmount: "100000" };
      const paymentLog =
        status === "payable"
          ? {
              address: bank,
              topics: encodeEventTopics({
                abi: PLAYER_PAYMENT_ABI,
                eventName: "PlayerPayableCreated",
                args: { betId: 42n, player }
              }),
              data: encodeAbiParameters([{ type: "uint256" }], [296000n])
            }
          : {
              address: asset,
              topics: encodeEventTopics({
                abi: PLAYER_PAYMENT_ABI,
                eventName: "Transfer",
                args: { from: bank, to: player }
              }),
              data: encodeAbiParameters([{ type: "uint256" }], [296000n])
            };
      const logs = [
        {
          address: bank,
          topics: encodeEventTopics({
            abi: PLAYER_PAYMENT_ABI,
            eventName: "BetReserveReleased",
            args: { betId: 42n, player }
          }),
          data: encodeAbiParameters([{ type: "uint256" }], [400000n])
        },
        paymentLog,
        {
          address: bank,
          topics: encodeEventTopics({
            abi: PLAYER_PAYMENT_ABI,
            eventName: "BetSettled",
            args: { betId: 42n, player }
          }),
          data: encodeAbiParameters(
            Array.from({ length: 8 }, () => ({ type: "uint256" as const })),
            [200000n, 196000n, 100000n, 4000n, 2000n, 0n, 0n, 0n]
          )
        }
      ];
      const result = await queryBetReceipt({
        betId: "42",
        chainId: 84532,
        client: clientWithTerminal(terminal, logs)
      });
      expect(result.payment).toEqual({ status, amount: "296000" });
      expect(result.row).toMatchObject({ payout: "196000", refundAmount: "100000" });
      expect(writeBetRows).not.toHaveBeenCalled();
    }
  );

  it("repairs an old durable receipt for reading without claiming the RPC result is indexed", async () => {
    const result = await queryBetReceipt({
      betId: "42",
      chainId: 84532,
      client: clientWithTerminal()
    });
    expect(result).toMatchObject({
      source: "rpc-window",
      row: { payout: "196000", refundAmount: "100000", stake: "200000" }
    });
    expect(writeBetRows).not.toHaveBeenCalled();
    expect(stored.refundAmount).toBeUndefined();
  });
  it("reads an earlier deployment's receipt from the index and never from the chain", async () => {
    const earlierHub = getAddress("0x00000000000000000000000000000000000000e1");
    stored = { ...stored, gameHub: earlierHub, id: `84532:${earlierHub.toLowerCase()}:42` };
    const client = clientWithTerminal();
    const result = await queryBetReceipt({
      betId: "42",
      chainId: 84532,
      client,
      gameHub: earlierHub
    });
    expect(getBet).toHaveBeenCalledWith({ betId: "42", chainId: 84532, gameHub: earlierHub });
    // The chain fallbacks read the active release's hub, which issued a different bet 42.
    expect(client.readContract).not.toHaveBeenCalled();
    expect(result).toMatchObject({ source: "postgres", row: { gameHub: earlierHub } });
  });
  it("reads the active release's hub when the receipt names none", async () => {
    await queryBetReceipt({ betId: "42", chainId: 84532, client: clientWithTerminal() });
    expect(getBet).toHaveBeenCalledWith({
      betId: "42",
      chainId: 84532,
      gameHub: getAddress(activeHub)
    });
  });
  it("respects explicit RPC fallback disablement without inventing a refund", async () => {
    vi.stubEnv("BET_RECEIPT_RPC_FALLBACK_ENABLED", "false");
    const client = clientWithTerminal();
    const result = await queryBetReceipt({ betId: "42", chainId: 84532, client });
    expect(result.row?.refundAmount).toBeUndefined();
    expect(result.payment).toBeUndefined();
    expect(client.readContract).not.toHaveBeenCalled();
  });
  it("materializes the verified refund even when an incomplete terminal row already exists", async () => {
    const result = await materializeBetReceipt({
      betId: "42",
      chainId: 84532,
      terminalTxHash: txHash,
      client: clientWithTerminal()
    });
    expect(result).toMatchObject({ source: "postgres", row: { refundAmount: "100000" } });
    expect(writeBetRows).toHaveBeenCalledOnce();
    expect(writeBetRows.mock.calls[0]![0][0]).toMatchObject({ gameHub: getAddress(activeHub) });
    expect(stored.refundAmount).toBe("100000");
  });
  it("stores the settlement's house-edge allocation with the hydrated receipt", async () => {
    const hub = activeRelease.release.contracts.gameHub;
    const result = await materializeBetReceipt({
      betId: "42",
      chainId: 84532,
      terminalTxHash: txHash,
      // Another contract's look-alike log must not count.
      client: clientWithTerminal(terminal, [
        { ...houseEdgeLog("0x00000000000000000000000000000000000000e1"), logIndex: 5 },
        houseEdgeLog(hub)
      ])
    });
    expect(result.row).not.toBeNull();
    expect(writeGameHubEvents).toHaveBeenCalledOnce();
    expect(writeGameHubEvents.mock.calls[0]![0]).toMatchObject([
      { eventName: "HouseEdgeAllocated", logIndex: 0, txHash, blockNumber: 1000n }
    ]);
    // The durable read is the mock's stored row; the proof itself carries the split.
    expect(writeBetRows.mock.calls[0]![0][0].houseEdge).toMatchObject({
      edge: "2000",
      lpRetained: "1000",
      r1: "400",
      effectiveHouseEdgeBps: 200
    });
    expect(result.source).toBe("postgres");
  });
  it("does not materialize a getter receipt whose settlement amounts disagree with the event", async () => {
    const result = await materializeBetReceipt({
      betId: "42",
      chainId: 84532,
      terminalTxHash: txHash,
      client: clientWithTerminal({ ...terminal, payoutNet: 195000n })
    });
    expect(result.row).toBeNull();
    expect(writeBetRows).not.toHaveBeenCalled();
  });
  it("keeps failed persistence identified as an RPC receipt", async () => {
    writeBetRows.mockRejectedValue(new Error("database unavailable"));
    const result = await materializeBetReceipt({
      betId: "42",
      chainId: 84532,
      terminalTxHash: txHash,
      client: clientWithTerminal()
    });
    expect(result).toMatchObject({ source: "rpc-window", row: { refundAmount: "100000" } });
  });
});
