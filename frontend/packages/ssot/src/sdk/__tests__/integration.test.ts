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
import type {
  PlaceBetInput,
  PlaceBetPlan,
  PlaceSportsTicketInput,
  PlaceSportsTicketPlan
} from "../types";
import { encodeStakeSpec } from "../../encoding/stakeSpec";
import { PLAYER_PAYMENT_ABI } from "@ssot/bet-index/player-payment";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const TX_HASH = "0xabc123" as Hex;
const GAME_ID = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
const ASSET = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" as Address;
const VAULT = "0x5555555555555555555555555555555555555555" as Address;
const BANK = "0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff" as Address;
const SPORTS_RISK_HASH =
  "0x0707ba776912152fe0028608c2b31e2ac864f24ed79351eaa10ea012303793e6" as Hex;
const ODDS_TICKET_HASH = "0x9999ba776912152fe0028608c2b31e2ac864f24ed79351eaa10ea0123037999" as Hex;
const SPORTS_SIGNATURE = `0x${"11".repeat(65)}` as Hex;

const TEST_RELEASE: SSOTRelease = {
  chainId: 84532,
  name: "Test Release",
  releaseDigest: "0xdeadbeef",
  isPlaceholder: false,
  contracts: {
    gameHub: "0x99c8c8b55803a566561b58188027fb9e46aca215",
    settlementRouter: "0xa6b00b5a7893045c7ce8443a3ced632e6dae9077",
    poolRegistry: "0x1f232208b4b6068d18b156f2914acfc8092942f3",
    sportsHub: "0x2db4ba326c2c3e5830b0da10f0c52b4097f9fa4b",
    sportsRiskEngine: "0xb9c3647cb5daf23dea8335b7d91c7aa5f6bc2579",
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
  sports: {
    enabled: false,
    riskEngine: "0xb9c3647cb5daf23dea8335b7d91c7aa5f6bc2579",
    sportsHub: "0x2db4ba326c2c3e5830b0da10f0c52b4097f9fa4b",
    oddsSignerSetHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    resultReporterSetHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    resultReporterThreshold: "1",
    maxStake: "1",
    maxPayout: "1",
    maxMarketReserved: "1",
    maxOutcomeReserved: "1",
    maxEventReserved: "1"
  },
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
      decimals: 6,
      sportsRisk: null
    }
  ],
  meta: {
    blockNumber: 100,
    schemaVersion: 2,
    architectureVersion: "v1.6-nft-liquidity",
    releaseLock: { schema: "SSOT_RELEASE_DIGEST_V16" }
  }
};

const SPORTS_TEST_RELEASE: SSOTRelease = {
  ...TEST_RELEASE,
  sports: {
    ...TEST_RELEASE.sports,
    enabled: true,
    maxStake: "10000000",
    maxPayout: "25000000",
    maxMarketReserved: "100000000",
    maxOutcomeReserved: "50000000",
    maxEventReserved: "250000000"
  },
  pools: [
    ...TEST_RELEASE.pools,
    {
      poolId: 2,
      domainId: 2,
      domain: "Sports",
      active: true,
      asset: ASSET,
      bank: BANK,
      vault: VAULT,
      symbol: "USDC",
      decimals: 6,
      sportsRisk: {
        maxStake: "10000000",
        maxPayout: "25000000",
        maxMarketReserved: "100000000",
        maxOutcomeReserved: "50000000",
        maxEventReserved: "250000000",
        riskHash: SPORTS_RISK_HASH
      }
    }
  ]
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
    expect(sdk).toHaveProperty("sportsHub");
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
    pub.getContractEvents
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([]);

    const proof = await sdk.gameHub.getTerminalProof(8n);

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
      3,
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

  it("reads SportsHub market state through the current SportsHub address", async () => {
    pub.readContract.mockResolvedValueOnce({
      marketId: 7n,
      eventId: 99n,
      poolId: 2n,
      outcomeCount: 3,
      startsAt: 1_800_000_000n,
      lockTime: 1_800_003_600n,
      resultFinalitySeconds: 86_400n,
      version: 1n,
      marketKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      state: 2
    });

    const market = await sdk.sportsHub.getMarket(7n);

    expect(market.marketId).toBe(7n);
    expect(market.eventId).toBe(99n);
    expect(market.poolId).toBe(2);
    expect(market.state).toBe("open");
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.sportsHub),
        functionName: "getMarket",
        args: [7n]
      })
    );
  });

  it("reads SportsHub ticket and result records", async () => {
    pub.readContract
      .mockResolvedValueOnce({
        ticketId: 12n,
        positionId: 34n,
        marketId: 7n,
        eventId: 99n,
        poolId: 2n,
        outcomeId: 1,
        player: ACCOUNT,
        stake: 1_000_000n,
        payout: 1_800_000n,
        reserved: 1_800_000n,
        oddsSnapshotHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        acceptedAt: 1_800_000_100n,
        state: 1
      })
      .mockResolvedValueOnce({
        marketId: 7n,
        eventId: 99n,
        poolId: 2n,
        winningOutcomeId: 1,
        marketVersion: 1n,
        resultPayloadHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        resultSourceHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        evidenceHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        reporterSetHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
        reporterThreshold: 1,
        reporterCount: 1,
        proposer: ACCOUNT,
        observedAt: 1_800_010_000n,
        proposedAt: 1_800_010_100n,
        finalizesAt: 1_800_096_500n,
        challenged: false,
        challengeReasonHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        challenger: "0x0000000000000000000000000000000000000000",
        challengedAt: 0n,
        challengeDecision: 0,
        arbitrationDecisionHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        arbitrator: "0x0000000000000000000000000000000000000000",
        arbitratedAt: 0n
      });

    const ticket = await sdk.sportsHub.getTicket(12n);
    const result = await sdk.sportsHub.getResult(7n);

    expect(ticket.state).toBe("held");
    expect(ticket.positionId).toBe(34n);
    expect(result.winningOutcomeId).toBe(1);
    expect(result.challengeDecision).toBe("none");
  });

  it("executes SportsHub market and result writes through the current SportsHub address", async () => {
    const marketKey = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;
    const rulebookHash =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hex;
    const resultSourceHash =
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as Hex;
    const evidenceHash =
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as Hex;

    await sdk.sportsHub.createMarket({
      eventId: 99n,
      poolId: 2,
      outcomeCount: 3,
      startsAt: 1_800_000_000n,
      lockTime: 1_799_996_400n,
      resultFinalitySeconds: 604_800n,
      marketKey,
      rulebookHash
    });
    await sdk.sportsHub.openMarket(7n);
    await sdk.sportsHub.lockMarket(7n);
    await sdk.sportsHub.proposeResult({
      marketId: 7n,
      winningOutcomeId: 1,
      resultSourceHash,
      evidenceHash,
      observedAt: 1_800_010_000n
    });
    await sdk.sportsHub.finalizeResult(7n);
    await sdk.sportsHub.challengeResult(7n, evidenceHash);
    await sdk.sportsHub.resolveResultChallenge({
      marketId: 7n,
      decision: "reopenResult",
      decisionHash: evidenceHash
    });

    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.sportsHub),
        functionName: "createMarket",
        args: [99n, 2n, 3, 1_800_000_000n, 1_799_996_400n, 604_800n, marketKey, rulebookHash]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.sportsHub),
        functionName: "proposeResult",
        args: [7n, 1, resultSourceHash, evidenceHash, 1_800_010_000n]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.sportsHub),
        functionName: "resolveResultChallenge",
        args: [7n, 2, evidenceHash]
      })
    );
    expect(journal.map((entry) => entry.action)).toContain("SPORTS_CREATE_MARKET");
    expect(journal.map((entry) => entry.action)).toContain("SPORTS_PROPOSE_RESULT");
    expect(journal.map((entry) => entry.action)).toContain("SPORTS_RESOLVE_RESULT_CHALLENGE");
  });

  it("executes SportsHub terminal ticket helpers through the SDK", async () => {
    await sdk.sportsHub.settleTicket(12n);
    await sdk.sportsHub.settleTickets([12n, 13n]);
    await sdk.sportsHub.refundTicket(14n);
    await sdk.sportsHub.refundTickets([14n, 15n]);
    await sdk.sportsHub.voidTicket(16n);
    await sdk.sportsHub.voidTickets([16n, 17n]);

    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "settleTickets",
        args: [[12n, 13n]]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "voidTickets",
        args: [[16n, 17n]]
      })
    );
    expect(journal.map((entry) => entry.action)).toContain("SPORTS_SETTLE_TICKETS");
    expect(journal.map((entry) => entry.action)).toContain("SPORTS_VOID_TICKETS");
  });

  it.each([1_000_000n, 10_000n, 9_999n])(
    "checks a sports ticket of %s units against the single-bet minimum",
    async (stake) => {
      const sportsSdk = createSSOTSDK({
        release: SPORTS_TEST_RELEASE,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
        journal: journalSink
      });
      pub.readContract
        .mockResolvedValueOnce({
          marketId: 7n,
          eventId: 99n,
          poolId: 2n,
          outcomeCount: 3,
          startsAt: 1_800_000_000n,
          lockTime: 1_800_003_600n,
          resultFinalitySeconds: 86_400n,
          version: 1n,
          marketKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          rulebookHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          state: 2
        })
        .mockResolvedValueOnce(0n)
        .mockResolvedValueOnce(ODDS_TICKET_HASH)
        .mockResolvedValueOnce(10_000n)
        .mockResolvedValueOnce(0n)
        .mockResolvedValueOnce(128n);

      const input: PlaceSportsTicketInput = {
        chainId: 84532,
        marketId: 7n,
        outcomeId: 1,
        stake,
        odds: {
          marketId: 7n,
          outcomeId: 1,
          marketVersion: 1n,
          oddsWad: 2_100_000_000_000_000_000n,
          maxStake: 2_000_000n,
          maxPayout: 4_200_000n,
          expiresAt: 1_900_000_000n,
          nonce: 33n,
          riskHash: SPORTS_RISK_HASH
        },
        signature: SPORTS_SIGNATURE
      };

      const result = await sportsSdk.sportsHub.planPlaceTicket(input);

      expect(pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "minBetAmount", blockNumber: 130n })
      );
      if (stake < 10_000n) {
        expect(result).toHaveProperty("error.code", "STAKE_BELOW_MINIMUM");
        expect(wal.writeContract).not.toHaveBeenCalled();
        return;
      }
      if ("error" in result) throw new Error(`${result.error.code}: ${result.error.message}`);
      expect(result.payload.poolId).toBe(2);
      expect(result.preview.asset).toBe(getAddress(ASSET));
      expect(result.preview.bank).toBe(getAddress(BANK));
      expect(result.preview.needsApproval).toBe(true);
      expect(result.preview.oddsTicketHash).toBe(ODDS_TICKET_HASH);
      expect(result.steps.map((step) => step.type)).toEqual(["approve", "placeSportsTicket"]);
      expect(result.steps[1]).toEqual(
        expect.objectContaining({
          to: getAddress(TEST_RELEASE.contracts.sportsHub),
          call: expect.objectContaining({ contract: "SportsHub", fn: "placeTicket" })
        })
      );
      expect(pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: getAddress(TEST_RELEASE.contracts.sportsHub),
          functionName: "hashOddsTicket",
          args: [expect.objectContaining({ riskHash: SPORTS_RISK_HASH }), ACCOUNT, stake]
        })
      );
    }
  );

  it.each([0n, 1n, 999_999_999_999_999_999n, 1_000_000_000_000_000_000n])(
    "rejects SportsHub odds %s at or below 1.0 before approval or contract reads",
    async (oddsWad) => {
      const sportsSdk = createSSOTSDK({
        release: SPORTS_TEST_RELEASE,
        publicClient: pub,
        walletClient: wal,
        account: ACCOUNT,
        journal: journalSink
      });
      const result = await sportsSdk.sportsHub.planPlaceTicket({
        chainId: 84532,
        marketId: 7n,
        outcomeId: 1,
        stake: 1_000_000n,
        odds: {
          marketId: 7n,
          outcomeId: 1,
          marketVersion: 1n,
          oddsWad,
          maxStake: 2_000_000n,
          maxPayout: 4_200_000n,
          expiresAt: 1_900_000_000n,
          nonce: 33n,
          riskHash: SPORTS_RISK_HASH
        },
        signature: SPORTS_SIGNATURE
      });

      expect("error" in result ? result.error.code : undefined).toBe("SPORTS_BAD_ODDS_SNAPSHOT");
      expect(pub.readContract).not.toHaveBeenCalled();
      expect(pub.simulateContract).not.toHaveBeenCalled();
      expect(wal.writeContract).not.toHaveBeenCalled();
    }
  );

  it("executes SportsHub placeTicket plans through approval and SportsHub writes", async () => {
    const sportsSdk = createSSOTSDK({
      release: SPORTS_TEST_RELEASE,
      publicClient: pub,
      walletClient: wal,
      account: ACCOUNT,
      journal: journalSink
    });
    const plan: PlaceSportsTicketPlan = {
      chainId: 84532,
      releaseDigest: TEST_RELEASE.releaseDigest,
      warnings: [],
      steps: [
        {
          type: "approve",
          token: ASSET,
          spender: getAddress(TEST_RELEASE.contracts.sportsHub),
          amount: 1_000_000n
        },
        {
          type: "placeSportsTicket",
          to: getAddress(TEST_RELEASE.contracts.sportsHub),
          call: {
            contract: "SportsHub",
            fn: "placeTicket",
            argsSummary: { marketId: 7n, outcomeId: 1, stake: 1_000_000n }
          }
        }
      ],
      payload: {
        marketId: 7n,
        outcomeId: 1,
        stake: 1_000_000n,
        odds: {
          marketId: 7n,
          outcomeId: 1,
          marketVersion: 1n,
          oddsWad: 2_100_000_000_000_000_000n,
          maxStake: 2_000_000n,
          maxPayout: 4_200_000n,
          expiresAt: 1_900_000_000n,
          nonce: 33n,
          riskHash: SPORTS_RISK_HASH
        },
        signature: SPORTS_SIGNATURE,
        poolId: 2
      },
      preview: {
        allowance: 0n,
        needsApproval: true,
        approveAmount: 1_000_000n,
        asset: ASSET,
        bank: BANK,
        marketState: "open",
        oddsTicketHash: ODDS_TICKET_HASH
      }
    };

    pub.readContract.mockResolvedValue(1_000_000n);
    const result = await sportsSdk.sportsHub.executeTicketPlan(plan);

    expect(result.placeTicketTx.ok).toBe(true);
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(ASSET),
        functionName: "approve",
        args: [getAddress(TEST_RELEASE.contracts.sportsHub), 1_000_000n]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.sportsHub),
        functionName: "placeTicket",
        args: [
          7n,
          1,
          expect.objectContaining({ marketVersion: 1n, riskHash: SPORTS_RISK_HASH }),
          1_000_000n,
          SPORTS_SIGNATURE
        ]
      })
    );
    expect(journal.map((entry) => entry.action)).toContain("APPROVE");
    expect(journal.map((entry) => entry.action)).toContain("SPORTS_PLACE_TICKET");
  });

  it("rejects SportsHub placeTicket planning when the release gate is disabled", async () => {
    const result = await sdk.sportsHub.planPlaceTicket({
      chainId: 84532,
      marketId: 7n,
      outcomeId: 1,
      stake: 1_000_000n,
      odds: {
        marketId: 7n,
        outcomeId: 1,
        marketVersion: 1n,
        oddsWad: 2_100_000_000_000_000_000n,
        maxStake: 2_000_000n,
        maxPayout: 4_200_000n,
        expiresAt: 1_900_000_000n,
        nonce: 33n,
        riskHash: SPORTS_RISK_HASH
      },
      signature: SPORTS_SIGNATURE
    });

    expect("error" in result ? result.error.code : undefined).toBe("SPORTSBOOK_DISABLED");
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

  it("returns WALLET_NOT_CONNECTED for SportsHub writes without a wallet", async () => {
    const readOnlySDK = createSSOTSDK({ release: TEST_RELEASE, publicClient: pub });

    const result = await readOnlySDK.sportsHub.openMarket(7n);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("WALLET_NOT_CONNECTED");
  });
});
