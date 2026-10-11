import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type Address,
  type Hex
} from "viem";
import { createSSOTSDK, type SSOTSDK } from "../create";
import { getContractAbis } from "../../abis/index.mjs";
import type { SSOTRelease } from "../../release/schema";
import type { JournalSink, TxJournalEntry } from "../txPipeline";
import type { PlaceBetInput, PlaceBetPlan } from "../types";
import { encodeStakeSpec } from "../../encoding/stakeSpec";
import { PLAYER_PAYMENT_ABI } from "@ssot/bet-index/player-payment";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const TX_HASH = "0xabc123" as Hex;
const GAME_ID = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
const ASSET = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" as Address;
const VAULT = "0x5555555555555555555555555555555555555555" as Address;
const BANK = "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff" as Address;

const TEST_RELEASE: SSOTRelease = {
  chainId: 84532,
  name: "Test Release",
  releaseDigest: "0xdeadbeef",
  isPlaceholder: false,
  contracts: {
    gameHub: "0x99c8c8b55803a566561b58188027fb9e46aca215",
    settlementRouter: "0xa6b00b5a7893045c7ce8443a3ced632e6dae9077",
    poolRegistry: "0x1f232208b4b6068d18b156f2914acfc8092942f3",
    vrfHub: "0x70f4b14e0aba0034685c0c269445c6d4c6aeb314",
    refRegistry: "0x52e0aac05f039f1be7fa42de7a2ccc5c8c722b15",
    refEngine: "0x0b77c28707a89f3988f9b38b64134b77050c32a5"
  },
  assets: [{ symbol: "USDC", decimals: 6, address: ASSET, bank: BANK, vault: VAULT }],
  games: { [GAME_ID]: "0x4444444444444444444444444444444444444444" },
  gamesMeta: [
    {
      gameId: GAME_ID,
      slug: "dice",
      label: "Dice",
      module: "0x4444444444444444444444444444444444444444",
      maxBetCount: 25,
      callbackGasLimit: 2_447_746
    }
  ],
  pools: [
    {
      poolId: 1,
      domainId: 1,
      domain: "Casino",
      active: true,
      asset: ASSET,
      bank: BANK,
      vault: VAULT,
      symbol: "USDC",
      decimals: 6
    }
  ],
  meta: {
    blockNumber: 100,
    schemaVersion: 2,
    architectureVersion: "v1.6-nft-liquidity",
    releaseLock: { schema: "SSOT_RELEASE_DIGEST_V16" }
  }
};

const RECEIPT = { blockNumber: 100n, status: "success" as const, logs: [] };

function gameRead(functionName: string): unknown {
  switch (functionName) {
    case "gameModule":
      return TEST_RELEASE.games[GAME_ID];
    case "defaultHouseEdgeBps":
      return 200;
    case "gameMaxBetCount":
      return 25;
    case "gameCallbackGasLimit":
      return 2_447_746;
    case "gameDisabled":
      return false;
    default:
      throw new Error(`Unexpected game read: ${functionName}`);
  }
}

function mockPublicClient(overrides?: Record<string, any>) {
  return {
    getGasPrice: vi.fn().mockResolvedValue(1n),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n }),
    getContractEvents: vi.fn().mockResolvedValue([]),
    getBlockNumber: vi.fn().mockResolvedValue(130n),
    getLogs: vi.fn().mockResolvedValue([]),
    getTransactionReceipt: vi.fn().mockResolvedValue(RECEIPT),
    readContract: vi
      .fn()
      .mockImplementation(async ({ functionName }: { functionName: string }) =>
        functionName === "quoteVRFFee" ? [1000n, 200000] : 0n
      ),
    simulateContract: vi.fn().mockResolvedValue({ request: { mock: true } }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue(RECEIPT),
    ...overrides
  } as any;
}

function mockWalletClient(overrides?: Record<string, any>) {
  return {
    account: { address: ACCOUNT },
    chain: { id: 84532 },
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
    ...overrides
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
      journal: journalSink
    });
  });

  it("recognizes a confirmed revert during read-only reconciliation", async () => {
    pub.getTransactionReceipt.mockResolvedValue({ ...RECEIPT, status: "reverted" });
    const result = await sdk.gameHub.reconcilePlaceBetTx(TX_HASH);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "TX_REVERTED", details: { txHash: TX_HASH, chainId: 84532 } }
    });
    expect(wal.writeContract).not.toHaveBeenCalled();
  });

  it("returns the current SDK namespaces", () => {
    expect(sdk).toHaveProperty("gameHub");
    expect(sdk).toHaveProperty("bank");
    expect(sdk).toHaveProperty("vault");
    expect(sdk).toHaveProperty("vrfHub");
  });

  it.each([
    "ready",
    "readFailure",
    "laggingSimulation",
    "persistentLag",
    "noApproval",
    "walletFailure",
    "capacityChanged",
    "feeChanged",
    "minimumChanged",
    "houseEdgeChanged"
  ])("continues safely from mined approval (%s)", async (scenario) => {
    const readFailure = scenario === "readFailure";
    if (scenario === "laggingSimulation" || scenario === "persistentLag") {
      const staleAllowance = new BaseError("wrapped", {
        cause: Object.assign(new Error("reverted"), {
          name: "ContractFunctionRevertedError",
          data: { errorName: "Error", args: ["ERC20: transfer amount exceeds allowance"] }
        })
      });
      pub.simulateContract
        .mockResolvedValueOnce({ request: { functionName: "approve" } })
        .mockRejectedValueOnce(staleAllowance);
      if (scenario === "persistentLag") pub.simulateContract.mockRejectedValue(staleAllowance);
    }
    pub.readContract.mockResolvedValue(1_000_000n);
    if (readFailure)
      pub.readContract.mockRejectedValueOnce(
        new BaseError("offline", { name: "HttpRequestError" })
      );
    const plan: PlaceBetPlan = {
      chainId: 84532,
      releaseDigest: TEST_RELEASE.releaseDigest,
      warnings: [],
      steps: [
        {
          type: "approve",
          token: ASSET,
          spender: getAddress(TEST_RELEASE.contracts.gameHub),
          amount: 1_000_000n
        },
        {
          type: "placeBet",
          to: getAddress(TEST_RELEASE.contracts.gameHub),
          value: 100_000n,
          call: {
            contract: "GameHub",
            fn: "placeBet",
            argsSummary: {
              gameId: GAME_ID,
              poolId: 1,
              betCount: 1,
              stake: 1_000_000n
            }
          }
        }
      ],
      payload: {
        gameId: GAME_ID,
        poolId: 1,
        params: "0x0000000000000000000000000000000000000000000000000000000000000032",
        stakeSpec: {
          amountPerRoll: 1_000_000n,
          betCount: 1,
          stopGain: 0n,
          stopLoss: 0n
        },
        affiliate: "0x0000000000000000000000000000000000000000",
        maxHouseEdgeBps: 3000
      },
      preview: {
        vrfFee: 100_000n,
        gasPrice: 1n,
        quoteBlockNumber: 130n,
        stake: 1_000_000n,
        allowance: 0n,
        needsApproval: true,
        approveAmount: 1_000_000n,
        asset: ASSET,
        bank: BANK
      }
    };

    if (scenario === "noApproval") {
      plan.steps = plan.steps.filter((step) => step.type !== "approve");
      pub.simulateContract.mockRejectedValue(
        new BaseError("wrapped", {
          cause: Object.assign(new Error("reverted"), {
            name: "ContractFunctionRevertedError",
            data: { errorName: "ERC20InsufficientAllowance", args: [] }
          })
        })
      );
    }
    if (scenario === "walletFailure") {
      wal.writeContract
        .mockResolvedValueOnce(TX_HASH)
        .mockRejectedValueOnce(
          new BaseError("wallet response lost", { name: "TransactionExecutionError" })
        );
    }
    const changedError = {
      capacityChanged: "OpenHoldLimit",
      feeChanged: "InsufficientVRFFee",
      minimumChanged: "BetAmountBelowMinimum",
      houseEdgeChanged: "HouseEdgeTooHigh"
    }[scenario];
    if (scenario === "houseEdgeChanged") plan.payload.maxHouseEdgeBps = 200;
    if (changedError) {
      const abis = getContractAbis();
      const abi = [...abis.GameHubAbi, ...abis.BankAbi.filter((entry) => entry.type === "error")];
      const data = encodeErrorResult({
        abi,
        errorName: changedError,
        args:
          changedError === "OpenHoldLimit"
            ? []
            : changedError === "HouseEdgeTooHigh"
              ? [300, 200]
              : [1_000_000n, 2_000_000n]
      });
      pub.simulateContract
        .mockResolvedValueOnce({ request: { functionName: "approve" } })
        .mockRejectedValueOnce(
          new BaseError("wrapped", {
            cause: new ContractFunctionRevertedError({ abi, data, functionName: "placeBet" })
          })
        );
    }
    const result = await sdk.gameHub.executePlan(plan);
    if (changedError) {
      expect(result.placeBetTx.ok).toBe(false);
      expect(wal.writeContract).toHaveBeenCalledTimes(1); // Approval only, no stake transaction.
      expect(result.placeBetTx.error?.code).toBe(
        {
          capacityChanged: "OPEN_HOLD_LIMIT",
          feeChanged: "INSUFFICIENT_VRF_FEE",
          minimumChanged: "STAKE_BELOW_MINIMUM",
          houseEdgeChanged: "HOUSE_EDGE_TOO_HIGH"
        }[scenario]
      );
      expect(pub.simulateContract).toHaveBeenLastCalledWith(
        expect.objectContaining({
          functionName: "placeBet",
          gasPrice: 1n,
          value: 100_000n
        })
      );
      return;
    }
    expect(result.placeBetTx.ok).toBe(
      !["persistentLag", "noApproval", "walletFailure"].includes(scenario)
    );
    expect(wal.writeContract).toHaveBeenCalledTimes(
      scenario === "noApproval" ? 0 : scenario === "persistentLag" ? 1 : 2
    );
    if (scenario === "walletFailure")
      expect(result.placeBetTx.error?.code).toBe("TX_STATUS_UNKNOWN");
    if (scenario === "persistentLag")
      expect(result.placeBetTx.error?.code).toBe("ALLOWANCE_NOT_CONFIRMED");
    if (scenario === "noApproval") {
      expect(pub.simulateContract).toHaveBeenCalledOnce();
      expect(result.placeBetTx.error?.code).toBe("INSUFFICIENT_ALLOWANCE");
      return;
    }
    if (scenario === "laggingSimulation" || scenario === "persistentLag")
      expect(pub.simulateContract).toHaveBeenCalledTimes(3);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(ASSET),
        functionName: "allowance",
        args: [ACCOUNT, getAddress(TEST_RELEASE.contracts.gameHub)]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(ASSET),
        functionName: "approve",
        args: [getAddress(TEST_RELEASE.contracts.gameHub), 1_000_000n]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.gameHub),
        functionName: "placeBet",
        gasPrice: 1n,
        value: 100_000n
      })
    );
  });

  it.each([false, true])(
    "stops before betting when allowance stays unavailable (read failure=%s)",
    async (readFailure) => {
      pub.readContract.mockResolvedValue(0n);
      if (readFailure)
        pub.readContract.mockRejectedValue(new BaseError("offline", { name: "HttpRequestError" }));
      const plan: PlaceBetPlan = {
        chainId: 84532,
        releaseDigest: TEST_RELEASE.releaseDigest,
        warnings: [],
        steps: [
          {
            type: "approve",
            token: ASSET,
            spender: getAddress(TEST_RELEASE.contracts.gameHub),
            amount: 1_000_000n
          },
          {
            type: "placeBet",
            to: getAddress(TEST_RELEASE.contracts.gameHub),
            value: 100_000n,
            call: {
              contract: "GameHub",
              fn: "placeBet",
              argsSummary: {
                gameId: GAME_ID,
                poolId: 1,
                betCount: 1,
                stake: 1_000_000n
              }
            }
          }
        ],
        payload: {
          gameId: GAME_ID,
          poolId: 1,
          params: "0x0000000000000000000000000000000000000000000000000000000000000032",
          stakeSpec: {
            amountPerRoll: 1_000_000n,
            betCount: 1,
            stopGain: 0n,
            stopLoss: 0n
          },
          affiliate: "0x0000000000000000000000000000000000000000",
          maxHouseEdgeBps: 3000
        },
        preview: {
          vrfFee: 100_000n,
          gasPrice: 1n,
          quoteBlockNumber: 130n,
          stake: 1_000_000n,
          allowance: 0n,
          needsApproval: true,
          approveAmount: 1_000_000n,
          asset: ASSET,
          bank: BANK
        }
      };

      const result = await sdk.gameHub.executePlan(plan);

      expect(result.approveTx?.ok).toBe(true);
      expect(result.placeBetTx.ok).toBe(false);
      expect(result.placeBetTx.error?.code).toBe("ALLOWANCE_NOT_CONFIRMED");
      expect(result.placeBetTx.txHash).toBe("0x0");
      expect(result.placeBetTx.error?.details).toMatchObject({
        approvalTxHash: TX_HASH,
        transactionSubmitted: false
      });
      expect(wal.writeContract).toHaveBeenCalledOnce();
      expect(pub.simulateContract).not.toHaveBeenCalledWith(
        expect.objectContaining({
          address: getAddress(TEST_RELEASE.contracts.gameHub),
          functionName: "placeBet"
        })
      );
    }
  );

  it("propagates failure to read the required terminal record", async () => {
    pub.readContract.mockRejectedValueOnce(new Error("RPC unavailable"));
    await expect(sdk.gameHub.getTerminalProof(7n)).rejects.toThrow("RPC unavailable");
    expect(pub.getContractEvents).not.toHaveBeenCalled();
  });

  it.each([0n, 100_000n])(
    "preserves a settled terminal refund of %s with the transaction hash",
    async (refundAmount) => {
      const settlementTx =
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as Hex;
      pub.readContract.mockResolvedValueOnce({
        state: 4,
        payoutGross: 2_000_000n,
        payoutNet: 1_960_000n,
        feeOnPayout: 40_000n,
        protocolFeeAccrual: 20_000n,
        refundAmount
      });
      pub.getContractEvents
        .mockResolvedValueOnce([
          {
            args: {
              positionId: 7n,
              payoutGross: 0n,
              payoutNet: 0n,
              feeOnPayout: 0n,
              protocolFeeAccrual: 0n
            },
            transactionHash: settlementTx,
            blockNumber: 123n,
            logIndex: 4
          }
        ])
        .mockResolvedValueOnce([]);

      const proof = await sdk.gameHub.getTerminalProof(7n);

      expect(pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: getAddress(TEST_RELEASE.contracts.gameHub),
          functionName: "getBetTerminal",
          args: [7n]
        })
      );
      expect(pub.getContractEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "BetFinalized",
          args: { positionId: 7n }
        })
      );
      expect(proof).toEqual({
        kind: "settled",
        settlement: {
          txHash: settlementTx,
          blockNumber: 123n,
          payoutGross: 2_000_000n,
          payoutNet: 1_960_000n,
          feeOnPayout: 40_000n,
          protocolFeeAccrual: 20_000n,
          refundAmount,
          payment:
            refundAmount == null
              ? { status: "unknown" }
              : { status: "unknown", amount: (1_960_000n + refundAmount).toString() }
        }
      });
    }
  );

  it("retains partial refunds when terminal log lookup fails", async () => {
    pub.readContract.mockResolvedValueOnce({
      state: 4,
      payoutGross: 200_000n,
      payoutNet: 196_000n,
      feeOnPayout: 4_000n,
      protocolFeeAccrual: 2_000n,
      refundAmount: 100_000n
    });
    pub.getBlockNumber.mockRejectedValueOnce(new Error("RPC unavailable"));

    expect(await sdk.gameHub.getTerminalProof(9n)).toEqual({
      kind: "settled",
      settlement: {
        payoutGross: 200_000n,
        payoutNet: 196_000n,
        feeOnPayout: 4_000n,
        protocolFeeAccrual: 2_000n,
        refundAmount: 100_000n,
        payment: { status: "unknown", amount: "296000" }
      }
    });
  });

  it("scans recent GameHub terminal proof ranges backwards in RPC-safe chunks", async () => {
    pub.readContract.mockResolvedValueOnce({
      state: 4,
      payoutGross: 1_000_000n,
      payoutNet: 980_000n,
      refundAmount: 0n,
      feeOnPayout: 20_000n,
      protocolFeeAccrual: 10_000n
    });
    const settlementTx =
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as Hex;
    pub.getContractEvents.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        args: {
          positionId: 8n,
          payoutGross: 1_000_000n,
          payoutNet: 980_000n,
          feeOnPayout: 20_000n,
          protocolFeeAccrual: 10_000n
        },
        transactionHash: settlementTx,
        blockNumber: 119n,
        logIndex: 2
      }
    ]);

    const proof = await sdk.gameHub.getTerminalProof(8n);

    // Storage names the terminal kind, so each chunk costs one log query for that event only.
    expect(pub.getContractEvents).toHaveBeenCalledTimes(2);
    expect(pub.getContractEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventName: "BetFinalized",
        args: { positionId: 8n },
        fromBlock: 121n,
        toBlock: 130n
      })
    );
    expect(pub.getContractEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventName: "BetFinalized",
        args: { positionId: 8n },
        fromBlock: 111n,
        toBlock: 120n
      })
    );
    expect(proof).toEqual({
      kind: "settled",
      settlement: {
        txHash: settlementTx,
        blockNumber: 119n,
        payoutGross: 1_000_000n,
        payoutNet: 980_000n,
        feeOnPayout: 20_000n,
        protocolFeeAccrual: 10_000n,
        refundAmount: 0n,
        payment: { status: "unknown", amount: "980000" }
      }
    });
  });

  it.each([
    ["settled", "transferred"],
    ["settled", "payable"],
    ["refunded", "transferred"],
    ["refunded", "payable"]
  ] as const)("proves %s player payment as %s using the terminal receipt", async (kind, status) => {
    const isSettlement = kind === "settled";
    pub.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "getBet") return { bank: BANK, asset: ASSET, player: ACCOUNT };
      if (functionName === "getBetTerminal")
        return {
          state: isSettlement ? 4 : 5,
          payoutGross: 20n,
          payoutNet: 19n,
          refundAmount: isSettlement ? 5n : 24n,
          feeOnPayout: 1n,
          protocolFeeAccrual: 0n
        };
      throw new Error(`unexpected ${functionName}`);
    });
    pub.getContractEvents.mockImplementation(async ({ eventName }: { eventName: string }) =>
      eventName === (isSettlement ? "BetFinalized" : "BetRefunded")
        ? [{ args: { positionId: 7n }, transactionHash: TX_HASH, blockNumber: 123n, logIndex: 4 }]
        : []
    );
    const words = (...amounts: bigint[]) =>
      encodeAbiParameters(
        amounts.map(() => ({ type: "uint256" })),
        amounts
      );
    const logs = [
      {
        address: BANK,
        topics: encodeEventTopics({
          abi: PLAYER_PAYMENT_ABI,
          eventName: "BetReserveReleased",
          args: { betId: 7n, player: ACCOUNT }
        }),
        data: words(100n)
      },
      status === "payable"
        ? {
            address: BANK,
            topics: encodeEventTopics({
              abi: PLAYER_PAYMENT_ABI,
              eventName: "PlayerPayableCreated",
              args: { betId: 7n, player: ACCOUNT }
            }),
            data: words(24n)
          }
        : {
            address: ASSET,
            topics: encodeEventTopics({
              abi: PLAYER_PAYMENT_ABI,
              eventName: "Transfer",
              args: { from: BANK, to: ACCOUNT }
            }),
            data: words(24n)
          },
      isSettlement
        ? {
            address: BANK,
            topics: encodeEventTopics({
              abi: PLAYER_PAYMENT_ABI,
              eventName: "BetSettled",
              args: { betId: 7n, player: ACCOUNT }
            }),
            data: words(20n, 19n, 5n, 1n, 0n, 0n, 0n, 0n)
          }
        : {
            address: BANK,
            topics: encodeEventTopics({
              abi: PLAYER_PAYMENT_ABI,
              eventName: "BetRefunded",
              args: { betId: 7n, player: ACCOUNT }
            }),
            data: words(24n)
          }
    ];
    pub.getTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 123n, logs });
    const proof = await sdk.gameHub.getTerminalProof(7n);
    expect(proof?.kind === "settled" ? proof.settlement.payment : proof?.refund.payment).toEqual({
      status,
      amount: "24"
    });
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getBet", args: [7n], blockNumber: 123n })
    );
    // Subsequent aggregate debt changes are not consulted when presenting historical payment evidence.
    expect(
      pub.readContract.mock.calls.some(
        ([call]: [{ functionName: string }]) => call.functionName === "playerPayable"
      )
    ).toBe(false);
  });

  it("executes GameHub refund through the current GameHub address", async () => {
    const result = await sdk.gameHub.refund(42n);

    expect(result.ok).toBe(true);
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.gameHub),
        functionName: "refund"
      })
    );
  });

  it("reads current fee and game admission from the same block, never the release fee", async () => {
    pub.readContract.mockImplementation(async ({ functionName }: { functionName: string }) =>
      gameRead(functionName)
    );
    expect(await sdk.gameHub.getGameConfig(GAME_ID)).toMatchObject({
      houseEdgeBps: 200,
      maxBetCount: 25
    });
    for (const call of pub.readContract.mock.calls) expect(call[0].blockNumber).toBe(130n);
    pub.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "defaultHouseEdgeBps") throw new Error("fee RPC failed");
      return gameRead(functionName);
    });
    await expect(sdk.gameHub.getGameConfig(GAME_ID)).rejects.toThrow("fee RPC failed");
  });
  it("builds pool-aware placeBet plans", async () => {
    pub.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "riskInPaused":
          return false;
        case "quoteVRFFee":
          return [100000n, 2_447_746];
        case "allowance":
          return 999999999n;
        case "maxPayout":
          return 1000000n;
        case "getSSOT":
          return { G: 10000000n, L: 10000000n, R: 0n, riskReserveBps: 0n, accountingValid: true };
        case "openHolds":
          return 0n;
        case "MAX_OPEN_HOLDS":
          return 128n;
        case "openHoldsOf":
          return 0n;
        case "MAX_OPEN_HOLDS_PER_PLAYER":
          return 2n;
        case "minBetAmount":
          return 1n;
        default:
          return gameRead(functionName);
      }
    });

    const input: PlaceBetInput = {
      chainId: 84532,
      gameId: GAME_ID,
      poolId: 1,
      betCount: 1,
      stake: 1000000n,
      params: "0x0000000000000000000000000000000000000000000000000000000000000032",
      stakeSpec: encodeStakeSpec({
        amountPerRoll: 1000000n,
        betCount: 1,
        stopGain: 0n,
        stopLoss: 0n
      }),
      maxHouseEdgeBps: 3000
    };

    const result = await sdk.gameHub.planPlaceBet(input);

    if ("error" in result) throw new Error(`${result.error.code}: ${result.error.message}`);
    expect(result.payload.poolId).toBe(1);
    expect(result.preview.asset).toBe(getAddress(ASSET));
    expect(result.preview.bank).toBe(getAddress(BANK));
    const placeBetStep = result.steps.find((step) => step.type === "placeBet");
    expect(placeBetStep?.call.contract).toBe("GameHub");
  });

  it("preflights casino liquidity against the Bank post-stake solvency rule", async () => {
    // Existing free liquidity is 900_000, but Bank checks solvency after receiving stake.
    pub.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "riskInPaused":
          return false;
        case "quoteVRFFee":
          return [1000n, 2_447_746];
        case "allowance":
          return 999999999n;
        case "maxPayout":
          return 1_636_000n;
        case "getSSOT":
          return {
            G: 1_000_000n,
            L: 1_000_000n,
            R: 0n,
            riskReserveBps: 1000n,
            accountingValid: true
          };
        case "openHolds":
          return 0n;
        case "MAX_OPEN_HOLDS":
          return 128n;
        case "openHoldsOf":
          return 0n;
        case "MAX_OPEN_HOLDS_PER_PLAYER":
          return 2n;
        case "minBetAmount":
          return 1n;
        default:
          return gameRead(functionName);
      }
    });

    const input: PlaceBetInput = {
      chainId: 84532,
      gameId: GAME_ID,
      poolId: 1,
      betCount: 1,
      stake: 818_000n,
      params: "0x0000000000000000000000000000000000000000000000000000000000000032",
      stakeSpec: encodeStakeSpec({
        amountPerRoll: 818_000n,
        betCount: 1,
        stopGain: 0n,
        stopLoss: 0n
      }),
      maxHouseEdgeBps: 3000
    };

    const result = await sdk.gameHub.planPlaceBet(input);

    if ("error" in result) throw new Error(`${result.error.code}: ${result.error.message}`);
    expect(result.preview.freeLiquidity).toBe(900_000n);
    expect(result.preview.requiredReserve).toBe(1_636_000n);
    expect(result.warnings).toContain(
      "Bank liquidity is tight — your bet may revert if another bet is placed first."
    );
  });

  it.each(["amount", "count"])(
    "rejects inconsistent %s before reading chain state",
    async (field) => {
      const result = await sdk.gameHub.planPlaceBet({
        chainId: 84532,
        gameId: GAME_ID,
        poolId: 1,
        betCount: field === "count" ? 2 : 1,
        stake: field === "amount" ? 1n : 10n,
        params: "0x",
        maxHouseEdgeBps: 3000,
        stakeSpec: encodeStakeSpec({ amountPerRoll: 10n, betCount: 1, stopGain: 0n, stopLoss: 0n })
      });
      expect(result).toMatchObject({ error: { code: "STAKE_SPEC_MISMATCH" } });
      expect(pub.readContract).not.toHaveBeenCalled();
    }
  );

  it.each([127n, 128n])("preflights open position capacity at %s of 128", async (holds) => {
    pub.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "riskInPaused":
          return false;
        case "quoteVRFFee":
          return [1000n, 200000];
        case "maxPayout":
          return 20n;
        case "getSSOT":
          return { G: 100n, L: 100n, R: 0n, riskReserveBps: 0n, accountingValid: true };
        case "allowance":
          return 0n;
        case "minBetAmount":
          return 1n;
        case "openHolds":
          return holds;
        case "MAX_OPEN_HOLDS":
          return 128n;
        case "openHoldsOf":
          return 0n;
        case "MAX_OPEN_HOLDS_PER_PLAYER":
          return 2n;
        default:
          return gameRead(functionName);
      }
    });
    const result = await sdk.gameHub.planPlaceBet({
      chainId: 84532,
      gameId: GAME_ID,
      poolId: 1,
      betCount: 1,
      stake: 10n,
      params: "0x",
      maxHouseEdgeBps: 3000,
      stakeSpec: encodeStakeSpec({ amountPerRoll: 10n, betCount: 1, stopGain: 0n, stopLoss: 0n })
    });
    if (holds === 128n) expect(result).toMatchObject({ error: { code: "POOL_CAPACITY_FULL" } });
    else {
      expect(result).not.toHaveProperty("error");
      for (const functionName of [
        "riskInPaused",
        "quoteVRFFee",
        "allowance",
        "getSSOT",
        "openHolds",
        "MAX_OPEN_HOLDS"
      ]) {
        expect(pub.readContract).toHaveBeenCalledWith(
          expect.objectContaining({ functionName, blockNumber: 130n })
        );
      }
    }
    expect(wal.writeContract).not.toHaveBeenCalled();
  });

  it("returns WALLET_NOT_CONNECTED for writes without a wallet", async () => {
    const readOnlySDK = createSSOTSDK({ release: TEST_RELEASE, publicClient: pub });

    const result = await readOnlySDK.gameHub.refund(42n);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("WALLET_NOT_CONNECTED");
  });

  describe("launch-candidate gates before any wallet prompt", () => {
    const planInput: PlaceBetInput = {
      chainId: 84532,
      gameId: GAME_ID,
      poolId: 1,
      betCount: 1,
      stake: 10n,
      params: "0x",
      maxHouseEdgeBps: 3000,
      stakeSpec: encodeStakeSpec({ amountPerRoll: 10n, betCount: 1, stopGain: 0n, stopLoss: 0n })
    };
    function planReads(overrides: Record<string, unknown> = {}) {
      pub.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
        if (functionName in overrides) return overrides[functionName];
        switch (functionName) {
          case "riskInPaused":
            return false;
          case "quoteVRFFee":
            return [1000n, 200000];
          case "maxPayout":
            return 20n;
          case "getSSOT":
            return { G: 100n, L: 100n, R: 0n, riskReserveBps: 0n, accountingValid: true };
          case "allowance":
            return 0n;
          case "minBetAmount":
            return 1n;
          case "openHolds":
            return 0n;
          case "MAX_OPEN_HOLDS":
            return 128n;
          case "openHoldsOf":
            return 0n;
          case "MAX_OPEN_HOLDS_PER_PLAYER":
            return 2n;
          default:
            return gameRead(functionName);
        }
      });
    }

    it("reports a disabled game in its config and refuses to plan a bet on it", async () => {
      planReads({ gameDisabled: true });
      expect(await sdk.gameHub.getGameConfig(GAME_ID)).toMatchObject({ disabled: true });
      expect(await sdk.gameHub.isGameDisabled(GAME_ID)).toBe(true);
      expect(await sdk.gameHub.planPlaceBet(planInput)).toEqual({
        error: {
          code: "GAME_DISABLED",
          message: expect.any(String),
          severity: "warning",
          details: { gameId: GAME_ID }
        }
      });
      expect(pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "gameDisabled",
          args: [GAME_ID],
          blockNumber: 130n
        })
      );
      // GameHub would revert the quote as well, so planning stops before it.
      expect(
        pub.readContract.mock.calls.some(
          ([call]: [{ functionName: string }]) => call.functionName === "quoteVRFFee"
        )
      ).toBe(false);
      expect(wal.writeContract).not.toHaveBeenCalled();
    });

    it.each([1n, 2n])("plans a bet with %s of 2 open holds for this player", async (open) => {
      planReads({ openHoldsOf: open });
      const result = await sdk.gameHub.planPlaceBet(planInput);
      if (open === 2n) {
        expect(result).toEqual({
          error: {
            code: "PLAYER_OPEN_HOLD_LIMIT",
            message: expect.any(String),
            severity: "warning",
            retryable: true,
            details: { player: ACCOUNT, open: "2", max: "2" }
          }
        });
      } else {
        expect(result).not.toHaveProperty("error");
      }
      for (const functionName of ["openHoldsOf", "MAX_OPEN_HOLDS_PER_PLAYER"])
        expect(pub.readContract).toHaveBeenCalledWith(
          expect.objectContaining({ address: getAddress(BANK), functionName, blockNumber: 130n })
        );
      expect(pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "openHoldsOf", args: [ACCOUNT] })
      );
      expect(wal.writeContract).not.toHaveBeenCalled();
    });

    it("reads a player's open holds and the per-player cap at one block", async () => {
      planReads({ openHoldsOf: 1n });
      expect(await sdk.bank.getOpenHolds(1, ACCOUNT)).toEqual({ open: 1n, max: 2n });
      expect(pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: getAddress(BANK),
          functionName: "openHoldsOf",
          args: [ACCOUNT],
          blockNumber: 130n
        })
      );
    });
  });

  describe("ReferralRegistry", () => {
    const REFERRER = "0x3333333333333333333333333333333333333333" as Address;
    const REGISTRY = getAddress(TEST_RELEASE.contracts.refRegistry);

    it("binds the connected wallet's referrer on ReferralRegistry, not GameHub", async () => {
      expect(await sdk.referral.bind(REFERRER)).toMatchObject({ ok: true, txHash: TX_HASH });
      expect(pub.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: REGISTRY,
          functionName: "bind",
          args: [ACCOUNT, REFERRER],
          account: ACCOUNT
        })
      );
      expect(journal.map((entry) => entry.action)).toContain("BIND_REFERRER");
      // The GameHub forwarders are gone, with no aliases (ADR-0037 §10).
      expect(sdk.gameHub).not.toHaveProperty("bindReferrer");
      expect(sdk.gameHub).not.toHaveProperty("referrerOf");
    });

    it("reads the referrer from ReferralRegistry", async () => {
      pub.readContract.mockResolvedValueOnce(REFERRER);
      expect(await sdk.referral.referrerOf(ACCOUNT)).toBe(REFERRER);
      expect(pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ address: REGISTRY, functionName: "referrerOf", args: [ACCOUNT] })
      );
    });

    it("decodes a refused bind from real revert bytes before any wallet prompt", async () => {
      const abi = getContractAbis().ReferralRegistryAbi;
      pub.simulateContract.mockRejectedValueOnce(
        new BaseError("wrapped", {
          cause: new ContractFunctionRevertedError({
            abi,
            data: encodeErrorResult({ abi, errorName: "InvalidConfig" }),
            functionName: "bind"
          })
        })
      );
      expect(await sdk.referral.bind(REFERRER)).toMatchObject({
        ok: false,
        error: { code: "INVALID_CONFIG", details: { transactionSubmitted: false } }
      });
      expect(wal.writeContract).not.toHaveBeenCalled();
    });
  });

  describe("governance timelock", () => {
    const TIMELOCK = "0x7777777777777777777777777777777777777777" as Address;
    function governanceOf(registry: Address, hub: Address) {
      pub.readContract.mockImplementation(async ({ address }: { address: Address }) => {
        if (address === getAddress(TEST_RELEASE.contracts.poolRegistry)) return registry;
        if (address === getAddress(TEST_RELEASE.contracts.gameHub)) return hub;
        throw new Error(`Unexpected governance read at ${address}`);
      });
    }

    it("returns PoolRegistry.governance() when GameHub reports the same at that block", async () => {
      governanceOf(TIMELOCK.toLowerCase() as Address, TIMELOCK);
      expect(await sdk.governance.getTimelock()).toBe(getAddress(TIMELOCK));
      for (const contract of ["poolRegistry", "gameHub"] as const)
        expect(pub.readContract).toHaveBeenCalledWith(
          expect.objectContaining({
            address: getAddress(TEST_RELEASE.contracts[contract]),
            functionName: "governance",
            blockNumber: 130n
          })
        );
    });

    it("refuses a GameHub governed by anything else", async () => {
      governanceOf(TIMELOCK, ACCOUNT);
      await expect(sdk.governance.getTimelock()).rejects.toThrow("different governance");
    });
  });
});
