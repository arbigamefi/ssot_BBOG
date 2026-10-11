import { describe, expect, it, vi } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";
import { createSSOTSDK, VOID_BET_GAS_LIMIT } from "../create";
import { getContractAbis } from "../../abis/index.mjs";
import type { SSOTRelease } from "../../release/schema";

const { GameHubAbi, BankAbi } = getContractAbis();
const HUB = getAddress("0x99c8c8b55803a566561b58188027fb9e46aca215");
const VRF = getAddress("0x70f4b14e0aba0034685c0c269445c6d4c6aeb314");
const BANK = getAddress("0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff");
const ASSET = getAddress("0x036cbd53842c5426634e7929541ec2318f3dcf7e");
const PLAYER = "0x1111111111111111111111111111111111111111" as Address;
const KEEPER = "0x2222222222222222222222222222222222222222" as Address;
const TX = `0x${"d".repeat(64)}` as Hex;
const PREFIX = `0x08c379a0${"0".repeat(56)}` as Hex;
const DAY = 86_400n;
const REQUESTED_AT = 1_800_000_000n;
const STAKE = 1_000_000n;

const release = {
  chainId: 84532,
  releaseDigest: "void-sdk-test",
  contracts: {
    governanceTimelock: "0x7777777777777777777777777777777777777777",
    gameHub: HUB.toLowerCase(),
    vrfHub: VRF.toLowerCase(),
    settlementRouter: "0xa6b00b5a7893045c7ce8443a3ced632e6dae9077",
    poolRegistry: "0x1f232208b4b6068d18b156f2914acfc8092942f3",
    refRegistry: "0x52e0aac05f039f1be7fa42de7a2ccc5c8c722b15"
  },
  pools: [{ poolId: 1, asset: ASSET, bank: BANK, vault: KEEPER, decimals: 6 }],
  games: {},
  gamesMeta: [],
  meta: { blockNumber: 0 }
} as unknown as SSOTRelease;

function bet(state: number) {
  return {
    betId: 7n,
    gameId: `0x${"b".repeat(64)}`,
    player: PLAYER,
    asset: ASSET,
    bank: BANK,
    stake: STAKE,
    reserved: 2n * STAKE,
    amountPerRoll: STAKE,
    betCount: 1,
    stopGain: 0n,
    stopLoss: 0n,
    houseEdgeBps: 200,
    maxHouseEdgeBps: 200,
    referralConfigId: 1,
    snapshotHash: `0x${"0".repeat(64)}`,
    paramsHash: `0x${"0".repeat(64)}`,
    vrfFeePaid: 10n,
    vrfFeeCharged: 10n,
    vrfCallbackGasLimit: 2_447_746,
    requestId: 77n,
    randomHash: `0x${"0".repeat(64)}`,
    placedAt: REQUESTED_AT,
    refundDeadline: REQUESTED_AT + 3_600n,
    vrfRequestedAt: REQUESTED_AT,
    resolvedAt: state >= 4 ? REQUESTED_AT + DAY : 0n,
    state
  };
}

function gameHubLog(eventName: "BetVoided" | "BetFinalized", positionId: bigint, address = HUB) {
  return eventName === "BetVoided"
    ? {
        address,
        topics: encodeEventTopics({
          abi: GameHubAbi,
          eventName,
          args: { positionId, caller: KEEPER }
        }),
        data: encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [STAKE, PREFIX])
      }
    : {
        address,
        topics: encodeEventTopics({ abi: GameHubAbi, eventName, args: { positionId } }),
        data: encodeAbiParameters(
          [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
          [2n * STAKE, 2n * STAKE, 0n, 0n]
        )
      };
}

function fixture(options: { wallet?: boolean } = {}) {
  const state = {
    betState: 3,
    requestState: 2,
    requestBetId: 7n,
    cohortEnd: 0n,
    now: REQUESTED_AT + 7n * DAY,
    receiptLogs: [] as unknown[]
  };
  const pub = {
    getBlockNumber: vi.fn().mockResolvedValue(500n),
    getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
      number: blockNumber,
      timestamp: state.now
    })),
    readContract: vi.fn(
      async ({ functionName }: { functionName: string; args?: readonly unknown[] }) => {
        switch (functionName) {
          case "VOID_DELAY":
            return DAY;
          case "PUBLIC_VOID_DELAY":
            return 7n * DAY;
          case "getBet":
            return bet(state.betState);
          case "voidCohortEnd":
            return state.cohortEnd;
          case "getRequest":
            return {
              bank: BANK,
              hub: HUB,
              betId: state.requestBetId,
              payer: PLAYER,
              feePaid: 10n,
              feeCharged: 10n,
              seed: 5n,
              state: state.requestState
            };
          case "getBetTerminal":
            return {
              state: state.betState,
              payoutGross: 0n,
              payoutNet: 0n,
              feeOnPayout: 0n,
              protocolFeeAccrual: 0n,
              refundAmount: STAKE
            };
          default:
            throw new Error(`Unexpected read ${functionName}`);
        }
      }
    ),
    getContractEvents: vi.fn().mockResolvedValue([]),
    simulateContract: vi.fn(async (request: Record<string, unknown>) => ({
      request,
      result: true
    })),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      status: "success",
      blockNumber: 501n,
      logs: []
    }),
    getTransactionReceipt: vi.fn(async () => ({
      status: "success",
      blockNumber: 501n,
      logs: state.receiptLogs
    }))
  };
  const wallet = { writeContract: vi.fn().mockResolvedValue(TX) };
  const sdk = createSSOTSDK({
    release,
    publicClient: pub as unknown as PublicClient,
    ...(options.wallet === false
      ? {}
      : { walletClient: wallet as unknown as WalletClient, account: KEEPER })
  });
  return { sdk, pub, wallet, state };
}

describe("void of an unbookable result (ADR-0037 §7)", () => {
  it("maps every on-chain bet state, Voided included", async () => {
    const f = fixture();
    const states = [];
    for (const state of [0, 1, 2, 3, 4, 5, 6]) {
      f.state.betState = state;
      states.push((await f.sdk.gameHub.getBet(7n)).state);
    }
    expect(states).toEqual([
      "placed",
      "placed",
      "placed",
      "randomReady",
      "finalized",
      "refunded",
      "voided"
    ]);
  });

  it.each([
    {
      name: "a received result outside any window, one second before 7 days",
      state: { now: REQUESTED_AT + 7n * DAY - 1n },
      expected: { voidable: false, inWindow: false, resultReceived: true, days: 7n }
    },
    {
      name: "a received result outside any window at 7 days",
      state: {},
      expected: { voidable: true, inWindow: false, resultReceived: true, days: 7n }
    },
    {
      name: "a PendingVRF bet with a received request inside a window at 24 hours",
      state: { betState: 2, cohortEnd: REQUESTED_AT, now: REQUESTED_AT + DAY },
      expected: { voidable: true, inWindow: true, resultReceived: true, days: 1n }
    },
    {
      name: "a window that closed before the request",
      state: { cohortEnd: REQUESTED_AT - 1n, now: REQUESTED_AT + DAY },
      expected: { voidable: false, inWindow: false, resultReceived: true, days: 7n }
    },
    {
      name: "a result not yet received (the timeout refund path applies)",
      state: { betState: 2, requestState: 1, now: REQUESTED_AT + 8n * DAY },
      expected: { voidable: false, inWindow: false, resultReceived: false, days: 7n }
    },
    {
      name: "a settled bet",
      state: { betState: 4, requestState: 3, now: REQUESTED_AT + 8n * DAY },
      expected: { voidable: false, inWindow: false, resultReceived: false, days: 7n }
    },
    {
      name: "a voided bet",
      state: { betState: 6, requestState: 5, cohortEnd: REQUESTED_AT, now: REQUESTED_AT + DAY },
      expected: { voidable: false, inWindow: true, resultReceived: false, days: 1n }
    }
  ])("reports $name", async ({ state, expected }) => {
    const f = fixture();
    Object.assign(f.state, state);
    const status = await f.sdk.gameHub.getVoidStatus(7n);
    expect(status).toEqual({
      betId: 7n,
      voidable: expected.voidable,
      eligibleAt: Number(REQUESTED_AT + expected.days * DAY),
      inWindow: expected.inWindow,
      resultReceived: expected.resultReceived,
      blockNumber: 500n,
      blockTimestamp: Number(f.state.now)
    });
    const pinned = f.pub.readContract.mock.calls
      .map(([call]) => call as { functionName: string; blockNumber?: bigint; args?: unknown[] })
      .filter((call) => !call.functionName.endsWith("VOID_DELAY"));
    expect(pinned.map((call) => [call.functionName, call.blockNumber])).toEqual([
      ["getBet", 500n],
      ["voidCohortEnd", 500n],
      ["getRequest", 500n]
    ]);
    expect(f.pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: VRF, functionName: "getRequest", args: [77n] })
    );
    expect(f.pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: HUB, functionName: "voidCohortEnd", args: [BANK] })
    );
  });

  it("reads the void delays once per client and again after a failed read", async () => {
    const f = fixture();
    const read = f.pub.readContract.getMockImplementation()!;
    let failed = false;
    f.pub.readContract.mockImplementation(async (call) => {
      if (call.functionName === "VOID_DELAY" && !failed) {
        failed = true;
        throw new Error("RPC unavailable");
      }
      return read(call);
    });
    await expect(f.sdk.gameHub.getVoidStatus(7n)).rejects.toThrow("RPC unavailable");
    await f.sdk.gameHub.getVoidStatus(7n);
    await f.sdk.gameHub.getVoidStatus(7n);
    const constantReads = f.pub.readContract.mock.calls.filter(([call]) =>
      ["VOID_DELAY", "PUBLIC_VOID_DELAY"].includes(call.functionName)
    );
    expect(constantReads).toHaveLength(4); // two failed-batch reads, two cached reads
  });

  it("fails closed when the received request is bound to another bet", async () => {
    const f = fixture();
    f.state.requestBetId = 8n;
    await expect(f.sdk.gameHub.getVoidStatus(7n)).rejects.toThrow("differs from the bet");
  });

  it("sends voidBet with the fixed gas limit and reports the void from the receipt", async () => {
    expect(VOID_BET_GAS_LIMIT).toBe(11_000_000n);
    expect(VOID_BET_GAS_LIMIT).toBeLessThan(16_777_216n); // EIP-7825 cap on Base
    const f = fixture();
    // The Bank's own BetVoided shares the bet ID but not the address; only GameHub's counts.
    f.state.receiptLogs = [
      { ...gameHubLog("BetVoided", 7n), address: BANK },
      gameHubLog("BetVoided", 7n)
    ];
    expect(await f.sdk.gameHub.voidBet(7n)).toEqual({ txHash: TX, ok: true, outcome: "voided" });
    expect(f.pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HUB,
        functionName: "voidBet",
        args: [7n],
        gas: VOID_BET_GAS_LIMIT,
        account: KEEPER
      })
    );
    expect(f.wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "voidBet", gas: VOID_BET_GAS_LIMIT })
    );
  });

  it.each([
    { logs: [gameHubLog("BetFinalized", 7n)], outcome: "settled" },
    { logs: [gameHubLog("BetVoided", 8n), gameHubLog("BetFinalized", 8n)], outcome: undefined },
    { logs: [{ ...gameHubLog("BetVoided", 7n), address: BANK }], outcome: undefined }
  ])("reports outcome $outcome from GameHub logs of this bet only", async ({ logs, outcome }) => {
    const f = fixture();
    f.state.receiptLogs = logs;
    const result = await f.sdk.gameHub.voidBet(7n);
    expect(result).toMatchObject({ ok: true, txHash: TX });
    expect(result.outcome).toBe(outcome);
  });

  it("keeps a mined void without an outcome when its receipt cannot be read", async () => {
    const f = fixture();
    f.pub.getTransactionReceipt.mockRejectedValueOnce(new Error("RPC unavailable"));
    expect(await f.sdk.gameHub.voidBet(7n)).toEqual({ txHash: TX, ok: true });
  });

  it("stops before the wallet when the simulation reverts VoidNotEligible", async () => {
    const f = fixture();
    const abi = [...GameHubAbi, ...BankAbi.filter((entry) => entry.type === "error")];
    const data = encodeErrorResult({
      abi: GameHubAbi,
      errorName: "VoidNotEligible",
      args: [7n, REQUESTED_AT + DAY, REQUESTED_AT + 7n * DAY]
    });
    f.pub.simulateContract.mockRejectedValueOnce(
      new BaseError("wrapped", {
        cause: new ContractFunctionRevertedError({ abi, data, functionName: "voidBet" })
      })
    );
    expect(await f.sdk.gameHub.voidBet(7n)).toMatchObject({
      ok: false,
      error: {
        code: "VOID_NOT_ELIGIBLE",
        retryable: true,
        details: { eligibleAt: REQUESTED_AT + 7n * DAY, transactionSubmitted: false }
      }
    });
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });

  it("requires a connected wallet to void", async () => {
    const f = fixture({ wallet: false });
    expect(await f.sdk.gameHub.voidBet(7n)).toMatchObject({
      ok: false,
      error: { code: "WALLET_NOT_CONNECTED" }
    });
    expect(f.pub.simulateContract).not.toHaveBeenCalled();
  });

  it("proves a voided terminal: stake as refundAmount, zero payouts, BetVoided location", async () => {
    const f = fixture();
    f.state.betState = 6;
    f.pub.getContractEvents.mockResolvedValue([
      {
        args: { positionId: 7n, caller: KEEPER, stake: STAKE, settlementErrorPrefix: PREFIX },
        transactionHash: TX,
        blockNumber: 501n,
        logIndex: 3
      }
    ]);
    const proof = await f.sdk.gameHub.getTerminalProof(7n);
    expect(proof).toMatchObject({
      kind: "voided",
      refund: {
        refundAmount: STAKE,
        txHash: TX,
        blockNumber: 501n,
        settlementErrorPrefix: PREFIX,
        payment: { amount: STAKE.toString() }
      }
    });
    expect(
      f.pub.getContractEvents.mock.calls.every(([call]) => call.eventName === "BetVoided")
    ).toBe(true);
    // Historical payment evidence comes from the void transaction's receipt and block.
    expect(f.pub.getTransactionReceipt).toHaveBeenCalledWith({ hash: TX });
    expect(f.pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getBet", args: [7n], blockNumber: 501n })
    );
  });

  it("keeps the stored void economics when its event is outside the scanned range", async () => {
    const f = fixture();
    f.state.betState = 6;
    expect(await f.sdk.gameHub.getTerminalProof(7n)).toEqual({
      kind: "voided",
      refund: { refundAmount: STAKE, payment: { status: "unknown", amount: STAKE.toString() } }
    });
  });
});
