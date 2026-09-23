import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbi, type PublicClient } from "viem";
import { loadEmbeddedRelease } from "@ssot/ssot/release";
import type { BetRow } from "@ssot/bet-index";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@ssot/bet-index", () => ({ createPostgresBetIndexStore: factory }));
import { clearRecentBetsCache, materializeBetReceipt, queryBetReceipt } from "./recent-bets";

const txHash = `0x${"aa".repeat(32)}` as const;
const asset = "0x4444444444444444444444444444444444444444";
const player = "0x2222222222222222222222222222222222222222";
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
let stored: BetRow;
let writeBetRows: ReturnType<typeof vi.fn>;
function clientWithTerminal(proof = terminal) {
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
      logs: [
        {
          address: release.release.contracts.gameHub,
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
    id: "84532:42",
    chainId: 84532,
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
  factory.mockReturnValue({ getBet: vi.fn(async () => stored), writeBetRows });
});
afterEach(() => {
  vi.unstubAllEnvs();
  clearRecentBetsCache();
  vi.clearAllMocks();
});

describe("receipt refund proof repair", () => {
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
  it("respects explicit RPC fallback disablement without inventing a refund", async () => {
    vi.stubEnv("BET_RECEIPT_RPC_FALLBACK_ENABLED", "false");
    const client = clientWithTerminal();
    const result = await queryBetReceipt({ betId: "42", chainId: 84532, client });
    expect(result.row?.refundAmount).toBeUndefined();
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
    expect(stored.refundAmount).toBe("100000");
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
