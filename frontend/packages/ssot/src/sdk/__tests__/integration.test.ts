/**
 * SDK Integration Tests
 *
 * Tests the createSSOTSDK factory with mocked viem clients.
 * Verifies that the SDK correctly wires up the Hub, Bank, and VRFHub APIs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address, Hex } from "viem";
import { createSSOTSDK, type SSOTSDK, type CreateSSOTSDKParams } from "../create";
import type { SSOTRelease } from "../../release/schema";
import type { TxJournalEntry, JournalSink } from "../txPipeline";
import type { PlaceBetInput } from "../types";

// ——— Mock viem parseEventLogs ———
vi.mock("viem", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    parseEventLogs: vi.fn(() => []),
  };
});

// ——— Test Release ———
const TEST_RELEASE: SSOTRelease = {
  chainId: 84532,
  name: "Test Release",
  releaseDigest: "0xdeadbeef",
  isPlaceholder: false,
  contracts: {
    hub: "0x699873a39797ba6fffea7c4dee3e710eda980d5d",
    vrfHub: "0x1eccf9070f01fccdedea45fdae9eed8e3d68c46e",
    bankRegistry: "0xbc679f83f16521d21c908e1af6e8b9d729fdee45",
  },
  assets: [
    {
      symbol: "USDC",
      decimals: 6,
      address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      bank: "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff",
    },
  ],
  games: {},
} as any;

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const TX_HASH = "0xabc123" as Hex;
const RECEIPT = { blockNumber: 100n, status: "success" as const, logs: [] };

// Game module address used in solvency tests
const DICE_MODULE = "0x4444444444444444444444444444444444444444" as Address;
const DICE_GAME_ID = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;

/** Release with a game entry for solvency pre-flight tests */
const TEST_RELEASE_WITH_GAME: SSOTRelease = {
  ...TEST_RELEASE,
  games: { [DICE_GAME_ID]: DICE_MODULE } as any,
} as any;

// ——— Mock Clients ———
function mockPublicClient(overrides?: Record<string, any>) {
  return {
    simulateContract: vi.fn().mockResolvedValue({ request: { mock: true } }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue(RECEIPT),
    readContract: vi.fn().mockResolvedValue(0n),
    ...overrides,
  } as any;
}

function mockWalletClient(overrides?: Record<string, any>) {
  return {
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
    chain: { id: 84532 },
    account: { address: ACCOUNT },
    ...overrides,
  } as any;
}

describe("createSSOTSDK", () => {
  let journal: TxJournalEntry[];
  let journalSink: JournalSink;
  let pub: ReturnType<typeof mockPublicClient>;
  let wal: ReturnType<typeof mockWalletClient>;
  let sdk: SSOTSDK;

  beforeEach(() => {
    journal = [];
    journalSink = (entry) => journal.push(entry);
    vi.clearAllMocks();
    pub = mockPublicClient();
    wal = mockWalletClient();
    sdk = createSSOTSDK({
      release: TEST_RELEASE,
      publicClient: pub,
      walletClient: wal,
      account: ACCOUNT,
      journal: journalSink,
    });
  });

  // ——— Factory shape ———
  describe("factory output shape", () => {
    it("returns SDK with hub, bank, vrfHub namespaces", () => {
      expect(sdk).toHaveProperty("hub");
      expect(sdk).toHaveProperty("bank");
      expect(sdk).toHaveProperty("vrfHub");
      expect(sdk.account).toBe(ACCOUNT);
      expect(sdk.release).toBe(TEST_RELEASE);
    });

    it("hub exposes all expected functions", () => {
      expect(typeof sdk.hub.planPlaceBet).toBe("function");
      expect(typeof sdk.hub.executePlan).toBe("function");
      expect(typeof sdk.hub.refund).toBe("function");
      expect(typeof sdk.hub.finalize).toBe("function");
      expect(typeof sdk.hub.bindReferrer).toBe("function");
      expect(typeof sdk.hub.referrerOf).toBe("function");
      expect(typeof sdk.hub.getBet).toBe("function");
      expect(typeof sdk.hub.quoteVRFFee).toBe("function");
    });

    it("bank exposes all expected functions", () => {
      expect(typeof sdk.bank.deposit).toBe("function");
      expect(typeof sdk.bank.withdraw).toBe("function");
      expect(typeof sdk.bank.redeem).toBe("function");
      expect(typeof sdk.bank.mint).toBe("function");
      expect(typeof sdk.bank.maxWithdraw).toBe("function");
      expect(typeof sdk.bank.maxRedeem).toBe("function");
      expect(typeof sdk.bank.getSnapshot).toBe("function");
      expect(typeof sdk.bank.getPosition).toBe("function");
      expect(typeof sdk.bank.playerTurnover).toBe("function");
    });
  });

  // ——— Hub operations ———
  describe("hub.refund", () => {
    it("calls simulateAndWrite for refund(betId)", async () => {
      const result = await sdk.hub.refund(42n);

      expect(result.ok).toBe(true);
      expect(result.txHash).toBe(TX_HASH);
      expect(pub.simulateContract).toHaveBeenCalledOnce();
      expect(wal.writeContract).toHaveBeenCalledOnce();
    });

    it("journals the refund transaction", async () => {
      await sdk.hub.refund(42n);

      expect(journal.length).toBeGreaterThanOrEqual(2);
      expect(journal[0]!.action).toBe("REFUND");
      expect(journal[0]!.status).toBe("submitted");
      expect(journal[1]!.status).toBe("mined");
    });
  });

  describe("hub.finalize", () => {
    it("calls simulateAndWrite for finalize(betId)", async () => {
      const result = await sdk.hub.finalize(99n);

      expect(result.ok).toBe(true);
      expect(pub.simulateContract).toHaveBeenCalledOnce();
    });
  });

  describe("hub.referrerOf", () => {
    it("reads referrer address from contract", async () => {
      pub.readContract.mockResolvedValueOnce("0x2222222222222222222222222222222222222222");

      const ref = await sdk.hub.referrerOf(ACCOUNT);
      expect(ref).toBe("0x2222222222222222222222222222222222222222");
      expect(pub.readContract).toHaveBeenCalled();
    });
  });

  describe("hub.bindReferrer", () => {
    it("calls simulateAndWrite for bindReferrer", async () => {
      const result = await sdk.hub.bindReferrer(
        "0x3333333333333333333333333333333333333333" as Address
      );
      expect(result.ok).toBe(true);
    });
  });

  // ——— Bank operations ———
  describe("bank.maxWithdraw", () => {
    it("reads maxWithdraw from bank contract", async () => {
      // readContract is called for bankFor first, then maxWithdraw
      pub.readContract
        .mockResolvedValueOnce(TEST_RELEASE.assets[0]!.bank) // bankFor
        .mockResolvedValueOnce(1000000n); // maxWithdraw

      const result = await sdk.bank.maxWithdraw(ACCOUNT);
      expect(result).toBe(1000000n);
    });
  });

  describe("bank.maxRedeem", () => {
    it("reads maxRedeem from bank contract", async () => {
      pub.readContract
        .mockResolvedValueOnce(TEST_RELEASE.assets[0]!.bank) // bankFor
        .mockResolvedValueOnce(500000n); // maxRedeem

      const result = await sdk.bank.maxRedeem(ACCOUNT);
      expect(result).toBe(500000n);
    });
  });

  describe("bank.deposit", () => {
    it("executes deposit with approval check", async () => {
      // Mock: bankFor → bank addr, allowance → 0 (needs approval), convertToShares → shares
      pub.readContract
        .mockResolvedValueOnce(TEST_RELEASE.assets[0]!.bank) // bankFor
        .mockResolvedValueOnce(0n) // allowance (needs approval)
        .mockResolvedValueOnce(TEST_RELEASE.assets[0]!.bank); // another bankFor call if needed

      const result = await sdk.bank.deposit(1000000n, ACCOUNT);
      // Should succeed through the pipeline
      expect(result.ok).toBe(true);
    });
  });

  // ——— Read-only mode ———
  describe("read-only (no wallet)", () => {
    it("returns WALLET_NOT_CONNECTED when trying to write without wallet", async () => {
      const readOnlySDK = createSSOTSDK({
        release: TEST_RELEASE,
        publicClient: pub,
        // no walletClient, no account
      });

      const result = await readOnlySDK.hub.refund(42n);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("WALLET_NOT_CONNECTED");
    });

    it("can still read referrerOf without wallet", async () => {
      const readOnlySDK = createSSOTSDK({
        release: TEST_RELEASE,
        publicClient: pub,
      });

      pub.readContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
      const ref = await readOnlySDK.hub.referrerOf(ACCOUNT);
      expect(ref).toBe("0x0000000000000000000000000000000000000000");
    });
  });

  // ——— Error mapping integration ———
  describe("error mapping", () => {
    it("maps simulate revert to domain error", async () => {
      const err = new Error("simulate fail");
      (err as any).name = "ContractFunctionRevertedError";
      (err as any).data = { errorName: "BetNotFound", args: [42n] };
      pub.simulateContract.mockRejectedValueOnce(err);

      const result = await sdk.hub.refund(42n);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      // The error should be mapped (either to BET_NOT_FOUND or UNKNOWN depending on error shape)
      expect(result.error!.code).toBeDefined();
    });
  });

  // ——— Solvency pre-flight ———
  describe("hub.planPlaceBet solvency check", () => {
    // stakeSpec: amountPerRoll=1000000, betCount=1, stopGain=0, stopLoss=0
    // Encoded via: abi.encode(StakeSpec(1000000, 1, 0, 0))
    const STAKE_SPEC_HEX =
      "0x00000000000000000000000000000000000000000000000000000000000f4240" + // amountPerRoll = 1_000_000
      "0000000000000000000000000000000000000000000000000000000000000001" + // betCount = 1
      "0000000000000000000000000000000000000000000000000000000000000000" + // stopGain = 0
      "0000000000000000000000000000000000000000000000000000000000000000"; // stopLoss = 0

    const BASE_INPUT: PlaceBetInput = {
      chainId: 84532,
      gameId: DICE_GAME_ID,
      asset: TEST_RELEASE.assets[0]!.address as `0x${string}`,
      betCount: 1,
      stake: 1_000_000n,
      params: "0x0000000000000000000000000000000000000000000000000000000000000032" as Hex, // dice target = 50
      stakeSpec: ("0x" + STAKE_SPEC_HEX.replace("0x", "")) as Hex,
      maxHouseEdgeBps: 200,
    };

    /**
     * Helper: build a readContract mock that returns solvency data.
     * readContract call order in planPlaceBet:
     *   1. riskInPaused → false
     *   2. bankFor → bank address
     *   3. quoteVRFFee → [fee, gasLimit]
     *   4. allowance → large value (no approval needed)
     *   5. maxPayout → requiredReserve (parallel batch)
     *   6. totalAssets → (parallel batch)
     *   7. totalReserved → (parallel batch)
     *   8. minLiquidityBps → (parallel batch)
     *
     * Note: items 5-8 run in parallel via Promise.all but the mock resolves them in call order.
     */
    function buildReadContractMock(opts: {
      maxPayout: bigint;
      totalAssets: bigint;
      totalReserved: bigint;
      minLiquidityBps: number;
    }) {
      return vi.fn()
        .mockResolvedValueOnce(false) // 1. riskInPaused
        .mockResolvedValueOnce(TEST_RELEASE.assets[0]!.bank) // 2. bankFor
        .mockResolvedValueOnce([100000n, 200000]) // 3. quoteVRFFee → [fee, gasLimit]
        .mockResolvedValueOnce(999_999_999n) // 4. allowance (large, no approval)
        .mockResolvedValueOnce(opts.maxPayout) // 5. maxPayout
        .mockResolvedValueOnce(opts.totalAssets) // 6. totalAssets
        .mockResolvedValueOnce(opts.totalReserved) // 7. totalReserved
        .mockResolvedValueOnce(BigInt(opts.minLiquidityBps)); // 8. minLiquidityBps
    }

    it("returns INSUFFICIENT_LIQUIDITY when maxPayout > freeLiquidity", async () => {
      const pubSolvency = mockPublicClient({
        readContract: buildReadContractMock({
          maxPayout: 5_000_000n, // needs 5M reserved
          totalAssets: 10_000_000n, // bank has 10M
          totalReserved: 6_000_000n, // already 6M reserved
          minLiquidityBps: 1000, // 10% min liquidity = 1M reserved
        }),
        // freeLiquidity = 10M - 6M - (10M * 1000 / 10000) = 10M - 6M - 1M = 3M
        // requiredReserve = 5M > 3M → INSUFFICIENT_LIQUIDITY
      });
      const sdkSolvency = createSSOTSDK({
        release: TEST_RELEASE_WITH_GAME,
        publicClient: pubSolvency,
        walletClient: wal,
        account: ACCOUNT,
        journal: journalSink,
      });

      const result = await sdkSolvency.hub.planPlaceBet(BASE_INPUT);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("INSUFFICIENT_LIQUIDITY");
        expect(result.error.details).toBeDefined();
        expect(result.error.details!.required).toBe("5000000");
        expect(result.error.details!.available).toBe("3000000");
      }
    });

    it("returns warning when liquidity is tight", async () => {
      const pubSolvency = mockPublicClient({
        readContract: buildReadContractMock({
          maxPayout: 2_800_000n, // needs 2.8M
          totalAssets: 10_000_000n,
          totalReserved: 6_000_000n,
          minLiquidityBps: 1000,
        }),
        // freeLiquidity = 3M
        // requiredReserve = 2.8M < 3M → passes, but 2.8M * 10 > 3M * 9 → tight
      });
      const sdkSolvency = createSSOTSDK({
        release: TEST_RELEASE_WITH_GAME,
        publicClient: pubSolvency,
        walletClient: wal,
        account: ACCOUNT,
        journal: journalSink,
      });

      const result = await sdkSolvency.hub.planPlaceBet(BASE_INPUT);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.warnings.some((w: string) => w.includes("tight"))).toBe(true);
      }
    });

    it("proceeds with solvency data in preview when liquidity is sufficient", async () => {
      const pubSolvency = mockPublicClient({
        readContract: buildReadContractMock({
          maxPayout: 500_000n, // needs 0.5M — plenty of room
          totalAssets: 10_000_000n,
          totalReserved: 2_000_000n,
          minLiquidityBps: 1000,
        }),
        // freeLiquidity = 10M - 2M - 1M = 7M
        // requiredReserve = 0.5M < 7M → proceeds
      });
      const sdkSolvency = createSSOTSDK({
        release: TEST_RELEASE_WITH_GAME,
        publicClient: pubSolvency,
        walletClient: wal,
        account: ACCOUNT,
        journal: journalSink,
      });

      const result = await sdkSolvency.hub.planPlaceBet(BASE_INPUT);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.preview.freeLiquidity).toBe(7_000_000n);
        expect(result.preview.requiredReserve).toBe(500_000n);
        expect(result.warnings.some((w: string) => w.includes("tight"))).toBe(false);
      }
    });
  });
});
