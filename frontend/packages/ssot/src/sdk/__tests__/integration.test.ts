import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAddress, type Address, type Hex } from "viem";
import { createSSOTSDK, type SSOTSDK } from "../create";
import type { SSOTRelease } from "../../release/schema";
import type { JournalSink, TxJournalEntry } from "../txPipeline";
import type {
  PlaceBetInput,
  PlaceBetPlan,
  PlaceSportsTicketInput,
  PlaceSportsTicketPlan
} from "../types";
import { encodeStakeSpec } from "../../encoding/stakeSpec";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const TX_HASH = "0xabc123" as Hex;
const GAME_ID = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
const ASSET = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" as Address;
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
    refEngine: "0x0b77c28707a89f3988f9b38b64134b77050c32a5",
    adapter: "0x7648fee565dc42dfdb843e5166518060048e8d73"
  },
  assets: [{ symbol: "USDC", decimals: 6, address: ASSET, bank: BANK }],
  games: { [GAME_ID]: "0x4444444444444444444444444444444444444444" },
  gamesMeta: [
    {
      gameId: GAME_ID,
      slug: "dice",
      label: "Dice",
      module: "0x4444444444444444444444444444444444444444"
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
      symbol: "USDC",
      decimals: 6,
      sportsRisk: null
    }
  ],
  meta: { blockNumber: 100, schemaVersion: 2 }
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

function mockPublicClient(overrides?: Record<string, any>) {
  return {
    getContractEvents: vi.fn().mockResolvedValue([]),
    getBlockNumber: vi.fn().mockResolvedValue(130n),
    getTransactionReceipt: vi.fn().mockResolvedValue(RECEIPT),
    readContract: vi.fn().mockResolvedValue(0n),
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

  it("returns v1.3 namespaces without the old hub namespace", () => {
    expect(sdk).toHaveProperty("gameHub");
    expect(sdk).not.toHaveProperty("hub");
    expect(sdk).toHaveProperty("bank");
    expect(sdk).toHaveProperty("vrfHub");
    expect(sdk).toHaveProperty("sportsHub");
  });

  it("confirms Bank allowance after approval before depositing", async () => {
    const allowanceReads = [0n, 1_000_000n];
    pub.readContract.mockImplementation(async ({ functionName }: any) => {
      if (functionName === "allowance") return allowanceReads.shift() ?? 1_000_000n;
      return 0n;
    });

    const result = await sdk.bank.deposit(1, 1_000_000n, ACCOUNT);

    expect(result.ok).toBe(true);
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(ASSET),
        functionName: "approve",
        args: [getAddress(BANK), 1_000_000n]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(BANK),
        functionName: "deposit",
        args: [1_000_000n, ACCOUNT]
      })
    );
    expect(journal.map((entry) => entry.action)).toContain("APPROVE_DEPOSIT");
    expect(journal.map((entry) => entry.action)).toContain("DEPOSIT");
  });

  it("confirms Bank allowance after approval before placing casino bets", async () => {
    pub.readContract.mockResolvedValue(1_000_000n);
    const plan: PlaceBetPlan = {
      chainId: 84532,
      releaseDigest: TEST_RELEASE.releaseDigest,
      warnings: [],
      steps: [
        { type: "approve", token: ASSET, spender: BANK, amount: 1_000_000n },
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
        stake: 1_000_000n,
        allowance: 0n,
        needsApproval: true,
        approveAmount: 1_000_000n,
        asset: ASSET,
        bank: BANK
      }
    };

    const result = await sdk.gameHub.executePlan(plan);

    expect(result.placeBetTx.ok).toBe(true);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(ASSET),
        functionName: "allowance",
        args: [ACCOUNT, getAddress(BANK)]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(ASSET),
        functionName: "approve",
        args: [getAddress(BANK), 1_000_000n]
      })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.gameHub),
        functionName: "placeBet"
      })
    );
  });

  it("stops casino bet execution when approval allowance is not yet visible", async () => {
    pub.readContract.mockResolvedValue(0n);
    const plan: PlaceBetPlan = {
      chainId: 84532,
      releaseDigest: TEST_RELEASE.releaseDigest,
      warnings: [],
      steps: [
        { type: "approve", token: ASSET, spender: BANK, amount: 1_000_000n },
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
    expect(pub.simulateContract).not.toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.gameHub),
        functionName: "placeBet"
      })
    );
  });

  it("reads GameHub terminal proof directly from BetFinalized logs", async () => {
    const settlementTx =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hex;
    pub.getContractEvents
      .mockResolvedValueOnce([
        {
          args: {
            positionId: 7n,
            payoutGross: 2_000_000n,
            payoutNet: 1_960_000n,
            feeOnPayout: 40_000n,
            protocolFeeAccrual: 20_000n
          },
          transactionHash: settlementTx,
          blockNumber: 123n,
          logIndex: 4
        }
      ])
      .mockResolvedValueOnce([]);

    const proof = await sdk.gameHub.getTerminalProof(7n);

    expect(pub.getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.gameHub),
        eventName: "BetFinalized",
        args: { positionId: 7n },
        fromBlock: 121n,
        toBlock: 130n
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
        protocolFeeAccrual: 20_000n
      }
    });
  });

  it("reads GameHub terminal results from getBetTerminal before scanning event logs", async () => {
    pub.readContract.mockResolvedValueOnce({
      state: 4,
      payoutGross: 2_000_000n,
      payoutNet: 1_960_000n,
      feeOnPayout: 40_000n,
      protocolFeeAccrual: 20_000n,
      refundAmount: 0n
    });

    const proof = await sdk.gameHub.getTerminalProof(7n);

    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.gameHub),
        functionName: "getBetTerminal",
        args: [7n]
      })
    );
    expect(pub.getContractEvents).not.toHaveBeenCalled();
    expect(proof).toEqual({
      kind: "settled",
      settlement: {
        payoutGross: 2_000_000n,
        payoutNet: 1_960_000n,
        feeOnPayout: 40_000n,
        protocolFeeAccrual: 20_000n
      }
    });
  });

  it("scans recent GameHub terminal proof ranges backwards in RPC-safe chunks", async () => {
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
        protocolFeeAccrual: 10_000n
      }
    });
  });

  it("reads SportsHub market state through the v1.3 SportsHub address", async () => {
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

  it("executes SportsHub market and result writes through the v1.3 SportsHub address", async () => {
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

  it("builds SportsHub placeTicket plans with explicit release and odds gates", async () => {
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
      .mockResolvedValueOnce(ODDS_TICKET_HASH);

    const input: PlaceSportsTicketInput = {
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
    };

    const result = await sportsSdk.sportsHub.planPlaceTicket(input);

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
        args: [expect.objectContaining({ riskHash: SPORTS_RISK_HASH }), ACCOUNT, 1_000_000n]
      })
    );
  });

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
        { type: "approve", token: ASSET, spender: BANK, amount: 1_000_000n },
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
        args: [getAddress(BANK), 1_000_000n]
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

  it("executes GameHub refund through the v1.3 GameHub address", async () => {
    const result = await sdk.gameHub.refund(42n);

    expect(result.ok).toBe(true);
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(TEST_RELEASE.contracts.gameHub),
        functionName: "refund"
      })
    );
  });

  it("uses pool bank and asset for bank reads", async () => {
    pub.readContract.mockResolvedValueOnce(123n);

    const result = await sdk.bank.getAllowance(1, ACCOUNT);

    expect(result).toBe(123n);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(ASSET),
        functionName: "allowance",
        args: [ACCOUNT, getAddress(BANK)]
      })
    );
  });

  it("includes ERC4626-like share accounting in bank snapshots", async () => {
    pub.readContract
      .mockResolvedValueOnce({
        NAV: 1_250_000n,
        R: 250_000n,
        minLiquidityBps: 1000n,
        PF: 10_000n,
        XP: 20_000n
      })
      .mockResolvedValueOnce(1_000_000n)
      .mockResolvedValueOnce(1_250_000n);

    const result = await sdk.bank.getSnapshot(1);

    expect(result.totalAssets).toBe(1_250_000n);
    expect(result.totalSupply).toBe(1_000_000n);
    expect(result.assetsPerShare).toBe(1_250_000n);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(BANK),
        functionName: "totalSupply",
        args: []
      })
    );
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getAddress(BANK),
        functionName: "convertToAssets",
        args: [1_000_000n]
      })
    );
  });

  it("builds pool-aware placeBet plans", async () => {
    pub.readContract
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce([100000n, 200000])
      .mockResolvedValueOnce(999999999n)
      .mockResolvedValueOnce(1000000n)
      .mockResolvedValueOnce(10000000n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

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
