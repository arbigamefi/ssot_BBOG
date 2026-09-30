import { describe, expect, it, vi } from "vitest";
import {
  ContractFunctionRevertedError,
  encodeErrorResult,
  type PublicClient,
  type WalletClient
} from "viem";
import { getContractAbis } from "../../abis/index.mjs";
const { BankAbi } = getContractAbis();
import { createSSOTSDK } from "../create";
import { quoteAsyncRedeem, quoteAsyncWithdraw } from "../bankRedemption";
import type { SSOTRelease } from "../../release/schema";

const ACCOUNT = "0x0000000000000000000000000000000000000011" as const;
const BANK = "0x0000000000000000000000000000000000000022" as const;
const ASSET = "0x0000000000000000000000000000000000000033" as const;
const OTHER = "0x0000000000000000000000000000000000000044" as const;
const HASH = `0x${"a".repeat(64)}` as const;
const release = {
  chainId: 84532,
  releaseDigest: "local-sdk-test",
  pools: [
    {
      poolId: 1,
      domainId: 0,
      domain: "casino",
      active: true,
      asset: ASSET,
      bank: BANK,
      symbol: "TEST",
      decimals: 6
    }
  ],
  contracts: { gameHub: BANK, vrfHub: BANK, sportsHub: BANK, refRegistry: BANK },
  games: {},
  gamesMeta: []
} as unknown as SSOTRelease;

function batch(id: bigint) {
  return {
    cutoff: 80n,
    priced: id < 3n,
    shares: 20n,
    assets: id < 3n ? 15n : 0n,
    assignedShares: 0n,
    assignedAssets: 0n,
    activatedAt: id < 3n ? 90n : 0n,
    fullExit: false
  };
}

function fixture(overrides: Record<string, unknown> = {}, timestamp = 100n) {
  const values: Record<string, unknown> = {
    asset: ASSET,
    balanceOf: 10n,
    totalAssets: 100n,
    totalSupply: 100n,
    getSSOT: {
      NAV: 100n,
      R: 3n,
      riskReserveBps: 0n,
      riskReserve: 0n,
      riskFree: 97n,
      withdrawalBufferBps: 0n,
      withdrawalBuffer: 0n,
      withdrawable: 100n,
      PF: 4n,
      XP: 5n,
      riskInPaused: false
    },
    getPerformance: [0n, 0n, 0n, 0n, 0n, 0n, 2n, 1n, 0n],
    totalReserved: 13n,
    recoveryBacking: 32n,
    activeOpenHolds: 1n,
    currentEpoch: 3n,
    openHolds: 4n,
    exitPayable: 17n,
    playerPayableTotal: 9n,
    batchPeriod: 100n,
    redeemRequestOf: [7n, 6n, 17n],
    pendingRedeemBatch: [3n, 7n],
    quoteQueuedRedeem: [4n, 3n],
    getRecovery: {
      shares: 5n,
      claimableAssets: 2n,
      claimedAssets: 1n,
      pendingAssets: 6n,
      finalSynced: false
    },
    recoveryEpoch: { remainingHolds: 2n, remainingReserve: 10n },
    playerPayable: 9n,
    maxWithdraw: 17n,
    maxRedeem: 6n,
    ...overrides
  };
  const readContract = vi.fn(
    async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      if (functionName in overrides && overrides[functionName] instanceof Error)
        throw overrides[functionName];
      if (typeof overrides[functionName] === "function")
        return (overrides[functionName] as (args: readonly unknown[]) => unknown)(args ?? []);
      if (functionName === "convertToAssets") return args?.[0];
      if (functionName === "redeemBatch") return batch(args?.[0] as bigint);
      if (!(functionName in values)) throw new Error(`Unexpected read ${functionName}`);
      return values[functionName];
    }
  );
  const pub = {
    getBlockNumber: vi.fn().mockResolvedValue(42n),
    getBlock: vi.fn().mockImplementation(async ({ blockNumber }) => ({
      timestamp,
      number: blockNumber,
      hash: HASH
    })),
    readContract,
    getLogs: vi.fn().mockResolvedValue([]),
    getTransactionReceipt: vi.fn(),
    simulateContract: vi.fn().mockImplementation(async (request) => ({ request })),
    waitForTransactionReceipt: vi
      .fn()
      .mockResolvedValue({ status: "success", blockNumber: 43n, logs: [] })
  };
  const wallet = { writeContract: vi.fn().mockResolvedValue(HASH) };
  const sdk = createSSOTSDK({
    release,
    publicClient: pub as unknown as PublicClient,
    walletClient: wallet as unknown as WalletClient,
    account: ACCOUNT
  });
  return { sdk, pub, wallet, values };
}

describe("asynchronous Bank SDK", () => {
  it("refreshes the head after a mined action instead of permanently pinning the previous cached height", async () => {
    const { sdk, pub } = fixture();
    pub.getBlockNumber.mockImplementation(async (options?: { cacheTime?: number }) =>
      options?.cacheTime === 0 ? 43n : 42n
    );
    expect((await sdk.bank.getSnapshot(1)).updatedAtBlock).toBe(43n);
    expect((await sdk.bank.getPosition(1, ACCOUNT)).updatedAtBlock).toBe(43n);
  });
  it("pins active, queued liquid quote and fixed cash to one block without folding in recovery bounds", async () => {
    const { sdk, pub } = fixture();
    expect(await sdk.bank.getPosition(1, ACCOUNT, { blockNumber: 39n })).toMatchObject({
      shares: 10n,
      assetsEquivalent: 10n,
      queuedShares: 7n,
      queuedLiquidAssets: 4n,
      queuedRecoveryAssets: 3n,
      claimableShares: 6n,
      claimableAssets: 17n,
      cancellableShares: 7n,
      activeAndClaimableAssets: 31n,
      playerPayable: 9n,
      updatedAtBlock: 39n,
      queuedBatch: { batchId: 3n, liquidAssets: 4n, recoveryAssets: 3n }
    });
    for (const [call] of pub.readContract.mock.calls)
      expect(call).toHaveProperty("blockNumber", 39n);
    expect(
      pub.readContract.mock.calls
        .filter(([c]) => c.functionName === "convertToAssets")
        .map(([c]) => c.args?.[0])
    ).toEqual([10n]);
    expect(pub.getBlockNumber).not.toHaveBeenCalled();
  });

  it("keeps queued shares cancellable after eligibility; activation immediately creates liquid claim units", async () => {
    expect((await fixture({}, 2_000n).sdk.bank.getPosition(1, ACCOUNT)).cancellableShares).toBe(7n);
    const position = await fixture({
      redeemRequestOf: [0n, 13n, 21n],
      pendingRedeemBatch: [0n, 0n],
      quoteQueuedRedeem: [0n, 0n]
    }).sdk.bank.getPosition(1, ACCOUNT);
    expect(position).toMatchObject({
      queuedBatch: null,
      queuedShares: 0n,
      cancellableShares: 0n,
      claimableShares: 13n,
      claimableAssets: 21n
    });
  });

  it("keeps zero-liquid claim units visible without erasing historical rights", async () => {
    const { sdk } = fixture({
      balanceOf: 0n,
      totalSupply: 0n,
      totalAssets: 0n,
      redeemRequestOf: [0n, 5n, 0n],
      pendingRedeemBatch: [0n, 0n],
      quoteQueuedRedeem: [0n, 0n],
      maxWithdraw: 0n,
      maxRedeem: 5n
    });
    expect(await sdk.bank.getPosition(1, ACCOUNT)).toMatchObject({
      activeAndClaimableAssets: 0n,
      claimableShares: 5n,
      claimableAssets: 0n,
      queuedBatch: null
    });
    expect(await sdk.bank.getRecovery(1, 1n, ACCOUNT)).toMatchObject({
      shares: 5n,
      claimableAssets: 2n,
      pendingAssets: 6n
    });
    expect(await sdk.bank.maxRedeem(1, ACCOUNT)).toBe(5n);
    expect(quoteAsyncRedeem(5n, 5n, 0n)).toBe(0n);
  });

  it("caps loss-state wallet equity but takes queued quotes from Bank and never reprices cash", async () => {
    expect(await fixture({ totalAssets: 10n }).sdk.bank.getPosition(1, ACCOUNT)).toMatchObject({
      assetsEquivalent: 1n,
      queuedLiquidAssets: 4n,
      claimableAssets: 17n,
      activeAndClaimableAssets: 22n
    });
  });

  it("keeps global reserve and recovery backing separate from active NAV without double subtraction", async () => {
    const { sdk, pub } = fixture();
    expect(await sdk.bank.getSnapshot(1, { blockNumber: 38n })).toMatchObject({
      totalAssets: 100n,
      activeReserved: 3n,
      totalReserved: 13n,
      recoveryBacking: 32n,
      activeOpenHolds: 1n,
      openHolds: 4n,
      currentEpoch: 3n,
      queuedBatch: { batchId: 3n },
      exitPayable: 17n,
      playerPayableTotal: 9n
    });
    for (const [call] of pub.readContract.mock.calls)
      expect(call).toHaveProperty("blockNumber", 38n);
  });

  it("discovers all sealed epochs for a wallet with zero shares, with bounded pages and independent future rights", async () => {
    const { sdk, pub } = fixture({ balanceOf: 0n });
    const event = (id: bigint, index: number) => ({
      address: BANK,
      transactionHash: HASH,
      blockNumber: 40n,
      logIndex: index,
      args: { batchId: id }
    });
    pub.getLogs.mockResolvedValue([event(1n, 1), event(2n, 2)]);
    const first = await sdk.bank.getRecoveryPage(1, ACCOUNT, { limit: 1 });
    expect(first).toMatchObject({
      complete: false,
      items: [{ epochId: 2n, claimableAssets: 2n, claimedAssets: 1n, pendingAssets: 6n }],
      nextCursor: { beforeEpoch: 2n }
    });
    const second = await sdk.bank.getRecoveryPage(1, ACCOUNT, {
      limit: 1,
      cursor: first.nextCursor
    });
    expect(second).toMatchObject({ complete: true, items: [{ epochId: 1n }] });
    for (const [call] of pub.readContract.mock.calls)
      expect(call).toHaveProperty("blockNumber", 42n);
    expect(pub.getLogs).not.toHaveBeenCalled();
  });

  it("returns incomplete empty owner pages without scanning past the bounded epoch limit", async () => {
    const { sdk, pub } = fixture({
      currentEpoch: 101n,
      getRecovery: {
        shares: 0n,
        claimableAssets: 0n,
        claimedAssets: 0n,
        pendingAssets: 0n,
        finalSynced: false
      },
      redeemBatch: () => ({ ...batch(1n), activatedAt: 90n })
    });
    const first = await sdk.bank.getRecoveryPage(1, ACCOUNT, { blockNumber: 5_000n, limit: 2 });
    expect(first).toMatchObject({ items: [], complete: false, nextCursor: { beforeEpoch: 99n } });
    expect(
      pub.readContract.mock.calls.filter(([call]) => call.functionName === "getRecovery")
    ).toHaveLength(2);
    expect(pub.getLogs).not.toHaveBeenCalled();
  });

  it("rejects changed snapshot, wrong controller and failed recovery reads instead of zero rights", async () => {
    const { sdk, pub } = fixture();
    const page = await sdk.bank.getRecoveryPage(1, ACCOUNT, { blockNumber: 5000n, limit: 1 });
    await expect(sdk.bank.getRecoveryPage(1, OTHER, { cursor: page.nextCursor })).rejects.toThrow(
      "different snapshot or account"
    );
    pub.getBlock.mockResolvedValue({ timestamp: 100n, number: 5000n, hash: `0x${"b".repeat(64)}` });
    await expect(sdk.bank.getRecoveryPage(1, ACCOUNT, { cursor: page.nextCursor })).rejects.toThrow(
      "restart pagination"
    );
    await expect(
      fixture({ getRecovery: new Error("RPC unavailable") }).sdk.bank.getRecovery(1, 1n, ACCOUNT)
    ).rejects.toThrow("RPC unavailable");
  });

  it("defaults recovery claims and permissionless sync to this wallet without operator approval", async () => {
    const { sdk, pub } = fixture();
    expect((await sdk.bank.syncRecovery(1, 1n)).ok).toBe(true);
    expect((await sdk.bank.claimRecovery(1, 1n)).ok).toBe(true);
    expect(pub.simulateContract.mock.calls.map(([call]) => [call.functionName, call.args])).toEqual(
      [
        ["syncRecovery", [1n, ACCOUNT]],
        ["claimRecovery", [1n, ACCOUNT, ACCOUNT]]
      ]
    );
  });

  it("reads actual claimable assets without convertToAssets", async () => {
    const { sdk, pub } = fixture();
    expect(await sdk.bank.maxWithdraw(1, ACCOUNT)).toBe(17n);
    expect(pub.readContract.mock.calls.map(([call]) => call.functionName)).toEqual(["maxWithdraw"]);
  });

  it("keeps book equity visible when paused claim limits are zero", async () => {
    const { sdk } = fixture({ maxWithdraw: 0n, maxRedeem: 0n });
    expect(await sdk.bank.maxWithdraw(1, ACCOUNT)).toBe(0n);
    expect(await sdk.bank.maxRedeem(1, ACCOUNT)).toBe(0n);
    expect(await sdk.bank.getPosition(1, ACCOUNT)).toMatchObject({
      claimableAssets: 17n,
      activeAndClaimableAssets: 31n
    });
  });

  it("uses ceil previewMint at the snapshot block for exact approval", async () => {
    const { sdk, pub } = fixture({ previewMint: 2n });
    const read = pub.readContract.getMockImplementation()!;
    let allowanceReads = 0;
    pub.readContract.mockImplementation(async (params) =>
      params.functionName === "allowance" ? (allowanceReads++ === 0 ? 0n : 2n) : read(params)
    );
    expect((await sdk.bank.mint(1, 1n, ACCOUNT)).ok).toBe(true);
    expect(pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "previewMint", args: [1n], blockNumber: 42n })
    );
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "approve", args: [BANK, 2n] })
    );
    expect(
      pub.readContract.mock.calls.some(([call]) =>
        ["convertToAssets", "previewWithdraw", "previewRedeem"].includes(call.functionName)
      )
    ).toBe(false);
  });

  it("propagates failed current Bank reads without inventing an empty position", async () => {
    const error = new Error("RPC unavailable");
    await expect(fixture({ getSSOT: error }).sdk.bank.getSnapshot(1)).rejects.toThrow(
      "RPC unavailable"
    );
    await expect(
      fixture({ redeemRequestOf: error }).sdk.bank.getPosition(1, ACCOUNT)
    ).rejects.toThrow("RPC unavailable");
    await expect(
      fixture({ quoteQueuedRedeem: error }).sdk.bank.getPosition(1, ACCOUNT)
    ).rejects.toThrow("RPC unavailable");
    await expect(
      fixture({ redeemRequestOf: [13n, 6n, 17n] }).sdk.bank.getPosition(1, ACCOUNT)
    ).rejects.toThrow("pending shares do not match");
  });

  it.each([
    ["requestRedeem", [2n, ACCOUNT, ACCOUNT]],
    ["cancelRedeemRequest", [ACCOUNT]],
    ["syncRedeem", [ACCOUNT]],
    ["claimPlayerPayable", [ACCOUNT]],
    ["redeem", [2n, ACCOUNT, ACCOUNT]]
  ] as const)(
    "simulates %s with self custody defaults and no operator approval",
    async (name, args) => {
      const { sdk, pub } = fixture();
      const result =
        name === "requestRedeem" || name === "redeem"
          ? await sdk.bank[name](1, 2n)
          : await sdk.bank[name](1);
      expect(result.ok).toBe(true);
      expect(pub.simulateContract).toHaveBeenCalledTimes(1);
      expect(pub.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: name, args })
      );
    }
  );

  it("sends a player claim only to the fixed player argument", async () => {
    const { sdk, pub } = fixture();
    await sdk.bank.claimPlayerPayable(1, OTHER);
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "claimPlayerPayable",
        args: [OTHER],
        account: ACCOUNT
      })
    );
  });

  it("quotes ceil partial withdrawal and refuses a stranded asset remainder", () => {
    expect(quoteAsyncWithdraw(2n, 3n, 5n)).toBe(2n);
    expect(() => quoteAsyncWithdraw(4n, 3n, 5n)).toThrow("ClaimWouldStrandAssets");
    expect(quoteAsyncWithdraw(5n, 3n, 5n)).toBe(3n);
    expect(quoteAsyncRedeem(1n, 3n, 5n)).toBe(1n);
  });

  it("re-simulates a stale partial claim and sends nothing when current rounding rejects it", async () => {
    const { sdk, pub, wallet } = fixture();
    expect(quoteAsyncWithdraw(2n, 3n, 5n)).toBe(2n);
    // Another partial claim leaves 1 claim share and 3 assets; withdrawing 2 would now strand 1.
    pub.simulateContract.mockRejectedValue(
      new ContractFunctionRevertedError({
        abi: BankAbi,
        functionName: "withdraw",
        data: encodeErrorResult({ abi: BankAbi, errorName: "ClaimWouldStrandAssets" })
      })
    );
    expect(await sdk.bank.withdraw(1, 2n)).toMatchObject({
      ok: false,
      error: { code: "CLAIM_WOULD_STRAND_ASSETS" }
    });
    expect(pub.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "withdraw", args: [2n, ACCOUNT, ACCOUNT] })
    );
    expect(pub.simulateContract.mock.calls[0]?.[0]).not.toHaveProperty("blockNumber");
    expect(wallet.writeContract).not.toHaveBeenCalled();
  });

  it("records actual beneficiary cash, receiver donations and zero claims without availability duplicates", async () => {
    const { sdk, pub } = fixture();
    const event = (eventName: string, logIndex: number, args: Record<string, unknown>) => ({
      eventName,
      transactionHash: HASH,
      blockNumber: 40n,
      logIndex,
      args
    });
    pub.getLogs.mockResolvedValue([
      event("Withdraw", 1, {
        owner: ACCOUNT,
        sender: OTHER,
        receiver: ACCOUNT,
        assets: 0n,
        shares: 5n
      }),
      event("RecoveryClaimed", 2, {
        controller: ACCOUNT,
        caller: OTHER,
        receiver: OTHER,
        epochId: 1n,
        assets: 8n
      }),
      event("RecoveryClaimed", 3, {
        controller: ACCOUNT,
        caller: ACCOUNT,
        receiver: BANK,
        epochId: 1n,
        assets: 2n
      }),
      event("RecoverySynced", 4, { controller: ACCOUNT, epochId: 1n, assets: 10n, shares: 5n }),
      event("Withdraw", 5, {
        owner: OTHER,
        sender: OTHER,
        receiver: ACCOUNT,
        assets: 80n,
        shares: 5n
      })
    ]);
    expect(await sdk.bank.getProviderLedger(1, ACCOUNT, { startBlock: 40 })).toMatchObject([
      { action: "donation", assets: 2n, shares: 0n, epochId: 1n, receiver: BANK, caller: ACCOUNT },
      { action: "recovery", assets: 8n, shares: 0n, epochId: 1n, receiver: OTHER, caller: OTHER },
      { action: "withdraw", assets: 0n, shares: 5n, receiver: ACCOUNT, caller: OTHER }
    ]);
    expect(pub.getTransactionReceipt).not.toHaveBeenCalled();
  });

  it("allows debt-out operations for an inactive pool", async () => {
    const { pub, wallet } = fixture();
    const inactive = {
      ...release,
      pools: release.pools.map((pool) => ({ ...pool, active: false }))
    };
    const sdk = createSSOTSDK({
      release: inactive,
      publicClient: pub as unknown as PublicClient,
      walletClient: wallet as unknown as WalletClient,
      account: ACCOUNT
    });
    expect((await sdk.bank.getPosition(1, ACCOUNT)).claimableAssets).toBe(17n);
    expect((await sdk.bank.redeem(1, 6n)).ok).toBe(true);
  });
});
