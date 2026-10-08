import { BaseError, decodeFunctionResult, encodeFunctionResult } from "viem";
import { getContractAbis } from "../../abis/index.mjs";
import { describe, expect, it } from "vitest";
import { encodeStakeSpec } from "../../encoding/stakeSpec";
import { quoteNftWithdrawal, MAX_TREE_CAPITAL } from "../liquidityVault";
import {
  nftFixture,
  OWNER,
  VAULT,
  BANK,
  ASSET,
  OTHER,
  HASH,
  GAME,
  FIRST_ID,
  ONE
} from "./fixtures/nft";

describe("NFT liquidity SDK", () => {
  it("enumerates NFT IDs at one pinned block, keeping NFT count separate from assets", async () => {
    const f = nftFixture();
    const page = await f.sdk.vault.getDeposits(1, OWNER, { limit: 1 });
    expect(page).toMatchObject({ nftCount: 2n, complete: false, updatedAtBlock: 42n });
    expect(page.items[0]).toMatchObject({
      depositId: FIRST_ID,
      assets: 10n,
      withdrawAfter: 86_400n,
      maxPercent: ONE,
      status: "ready"
    });
    const next = await f.sdk.vault.getDeposits(1, OWNER, { limit: 1, cursor: page.nextCursor });
    expect(next.items[0]?.depositId).toBe(FIRST_ID + 1n);
    expect(next.complete).toBe(true);
    expect(next.nextCursor).toBeUndefined();
    expect(f.pub.readContract.mock.calls.every(([request]) => request.blockNumber === 42n)).toBe(
      true
    );
  });
  it("rejects a cursor for another owner and a changed block hash", async () => {
    const f = nftFixture();
    const page = await f.sdk.vault.getDeposits(1, OWNER, { limit: 1 });
    await expect(f.sdk.vault.getDeposits(1, OTHER, { cursor: page.nextCursor })).rejects.toThrow(
      "different owner"
    );
    f.state.hash = `0x${"c".repeat(64)}`;
    await expect(f.sdk.vault.getDeposits(1, OWNER, { cursor: page.nextCursor })).rejects.toThrow(
      "snapshot changed"
    );
  });
  it("does not turn a read failure or burned NFT into a zero balance", async () => {
    const f = nftFixture();
    const read = f.pub.readContract.getMockImplementation()!;
    f.pub.readContract.mockImplementation(async (request) => {
      if (request.functionName === "depositState") throw new Error("ERC721NonexistentToken");
      return read(request);
    });
    await expect(f.sdk.vault.getDeposit(1, FIRST_ID)).rejects.toThrow("NonexistentToken");
  });
  it("refuses mismatched Vault binding before any approval", async () => {
    const f = nftFixture();
    const read = f.pub.readContract.getMockImplementation()!;
    f.pub.readContract.mockImplementation(async (request) =>
      request.functionName === "vault" ? OTHER : read(request)
    );
    expect(await f.sdk.vault.addDeposit(1, 10n)).toMatchObject({ ok: false });
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });
  it("decodes the actual Vault ABI, including uint40 percentages returned as numbers", async () => {
    const f = nftFixture();
    const abi = getContractAbis().LiquidityVaultAbi;
    const encoded = encodeFunctionResult({
      abi,
      functionName: "depositState",
      result: {
        owner: OWNER,
        assets: 10n,
        withdrawAfter: 86_400n,
        maxPercent: Number(ONE),
        maxAssets: 10n,
        status: 0
      }
    });
    const decoded = decodeFunctionResult({ abi, functionName: "depositState", data: encoded });
    const read = f.pub.readContract.getMockImplementation()!;
    f.pub.readContract.mockImplementation(async (request) =>
      request.functionName === "depositState" ? decoded : read(request)
    );
    expect(await f.sdk.vault.quoteWithdrawal(1, FIRST_ID, ONE)).toMatchObject({
      assets: 10n,
      executable: true
    });
  });
  it.each(["owner", "duplicate", "reorg"])(
    "rejects inconsistent NFT pagination (%s)",
    async (fault) => {
      const f = nftFixture();
      const read = f.pub.readContract.getMockImplementation()!;
      f.pub.readContract.mockImplementation(async (request) => {
        if (fault === "duplicate" && request.functionName === "tokenOfOwnerByIndex")
          return FIRST_ID;
        if (request.functionName === "depositState") {
          if (fault === "owner") f.state.owner = OTHER;
          if (fault === "reorg") f.state.hash = `0x${"c".repeat(64)}`;
        }
        return read(request);
      });
      await expect(f.sdk.vault.getDeposits(1, OWNER)).rejects.toThrow();
    }
  );
  it("keeps Vault history scans within RPC range limits", async () => {
    const f = nftFixture();
    f.pub.getBlockNumber.mockResolvedValue(5_000n);
    await f.sdk.vault.getProviderLedger(1, OWNER, { startBlock: 0 });
    expect(f.pub.getLogs).toHaveBeenCalledTimes(3);
    for (const [params] of f.pub.getLogs.mock.calls as unknown as [
      { fromBlock: bigint; toBlock: bigint }
    ][]) {
      expect(params.toBlock - params.fromBlock).toBeLessThanOrEqual(1_900n);
    }
  });
  it("does not sign when shared free capital changes before withdrawal simulation", async () => {
    const f = nftFixture();
    const error = new BaseError("simulation rejected");
    Object.assign(error, {
      name: "ContractFunctionRevertedError",
      data: { errorName: "InsufficientFreeCapital" }
    });
    f.pub.simulateContract.mockRejectedValueOnce(error);
    expect(await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_FREE_CAPITAL" }
    });
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });
  it("quotes percentage granularity, shared free-capital cap, and zero-value closure", async () => {
    const f = nftFixture();
    const position = await f.sdk.vault.getDeposit(1, FIRST_ID);
    const limited = { ...position, assets: 3n, maxAssets: 1n, maxPercent: (2n * ONE - 1n) / 3n };
    expect(quoteNftWithdrawal(limited, limited.maxPercent)).toMatchObject({
      executable: true,
      assets: 1n
    });
    expect(quoteNftWithdrawal(limited, limited.maxPercent + 1n)).toMatchObject({
      executable: false,
      reason: "insufficientFreeCapital"
    });
    expect(quoteNftWithdrawal(limited, 1n)).toMatchObject({
      executable: false,
      reason: "zeroWithdrawal"
    });
    expect(quoteNftWithdrawal({ ...position, assets: 0n, maxAssets: 0n }, ONE)).toMatchObject({
      executable: true,
      closeOnly: true,
      assets: 0n
    });
    expect(
      quoteNftWithdrawal({ ...position, status: "coolingDown", maxPercent: 0n, maxAssets: 0n }, ONE)
        .executable
    ).toBe(false);
  });
  it("approves asset spending by Vault and creates a separate NFT for the chosen owner", async () => {
    const f = nftFixture();
    expect(await f.sdk.vault.addDeposit(1, 10n, OTHER)).toMatchObject({ ok: true });
    expect(
      f.wallet.writeContract.mock.calls.map(([request]) => [
        request.address,
        request.functionName,
        request.args
      ])
    ).toEqual([
      [ASSET, "approve", [VAULT, 10n]],
      [VAULT, "addDepositFor", [OTHER, 10n]]
    ]);
  });
  it("withdraws to the current owner without NFT approvals or receiver redirection", async () => {
    const f = nftFixture();
    expect(await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE / 2n)).toMatchObject({ ok: true });
    expect(f.wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: VAULT,
        functionName: "withdrawDeposit",
        args: [FIRST_ID, ONE / 2n]
      })
    );
    f.state.owner = OTHER;
    expect(await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).toMatchObject({ ok: false });
    expect(f.wallet.writeContract).toHaveBeenCalledTimes(1);
  });
  it("blocks LP writes when a canonical result remains unbooked", async () => {
    const f = nftFixture();
    f.state.status = 3;
    f.state.unbooked = 1n;
    f.state.maxPercent = 0n;
    f.state.maxAssets = 0n;
    expect(await f.sdk.vault.addDeposit(1, 10n)).toMatchObject({ ok: false });
    expect(await f.sdk.vault.withdrawDeposit(1, FIRST_ID, ONE)).toMatchObject({
      ok: false,
      error: { details: { reason: "unbookedResult" } }
    });
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });
  it("reads L/P/R/K/G and debts without treating ERC721 balanceOf as capital", async () => {
    const f = nftFixture();
    expect(await f.sdk.bank.getSnapshot(1)).toMatchObject({
      L: 100n,
      P: 20n,
      R: 50n,
      K: 30n,
      G: 120n,
      bankCash: 29n,
      vaultCash: 100n,
      lpFreeCapital: 70n,
      playerPayableTotal: 2n,
      lpStatus: "ready",
      minBetAmount: 1n,
      totalTurnover: 1n,
      totalPayoutGross: 2n,
      totalPayoutNet: 3n,
      totalRefunded: 4n,
      totalFeeOnPayout: 5n,
      totalProtocolFeeAccrued: 6n,
      totalBetsHeld: 7n,
      totalBetsSettled: 6n,
      totalBetsRefunded: 1n
    });
    expect(
      f.pub.readContract.mock.calls.some(([request]) => request.functionName === "balanceOf")
    ).toBe(false);
    f.state.ssot.accountingValid = false;
    expect((await f.sdk.bank.getSnapshot(1)).lpStatus).toBe("invalidAccounting");
  });
  it("caps deposits by G including unresolved player principal", async () => {
    const f = nftFixture();
    f.state.ssot.G = MAX_TREE_CAPITAL;
    expect(await f.sdk.vault.addDeposit(1, 1n)).toMatchObject({ ok: false });
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });
  it("keeps deposit payer and NFT transfers separate from cash withdrawals", async () => {
    const f = nftFixture();
    f.pub.getLogs.mockResolvedValue([
      {
        eventName: "DepositAdded",
        transactionHash: HASH,
        blockNumber: 41n,
        logIndex: 1,
        args: {
          owner: OWNER,
          payer: OTHER,
          depositId: Number(FIRST_ID),
          assets: 10n,
          withdrawAfter: 86_400n
        }
      },
      {
        eventName: "Transfer",
        transactionHash: HASH,
        blockNumber: 41n,
        logIndex: 2,
        args: { from: OWNER, to: OTHER, tokenId: FIRST_ID }
      }
    ]);
    const rows = await f.sdk.vault.getProviderLedger(1, OWNER, { startBlock: 40 });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      action: "transfer",
      from: OWNER,
      to: OTHER,
      depositId: FIRST_ID
    });
    expect(rows[0]).not.toHaveProperty("assets");
    expect(rows[1]).toMatchObject({ action: "deposit", payer: OTHER, owner: OWNER, assets: 10n });
    expect(f.pub.getLogs).toHaveBeenCalledWith(expect.objectContaining({ address: VAULT }));
  });
});

describe("game-specific admission", () => {
  it("quotes with gameId and explicit gas price and rejects rounds above admitted limit", async () => {
    const f = nftFixture();
    expect(await f.sdk.gameHub.quoteVRFFee(GAME, 25, 5n)).toBe(100n);
    expect(f.pub.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "quoteVRFFee",
        args: [GAME, 25, 5n],
        blockNumber: 42n
      })
    );
    await expect(f.sdk.gameHub.quoteVRFFee(GAME, 26)).rejects.toThrow("admitted limit");
  });
  it("rejects on-chain admission limits that differ from the authenticated release", async () => {
    const f = nftFixture();
    f.state.maxBetCount = 11;
    await expect(f.sdk.gameHub.getGameConfig(GAME)).rejects.toThrow("authenticated release");
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });
  it.each([
    { count: 1, amount: 10_000n, accepted: true },
    { count: 25, amount: 10_000n, accepted: true },
    { count: 1, amount: 9_999n, accepted: false },
    { count: 25, amount: 9_999n, accepted: false }
  ])(
    "applies the chain minimum to each round ($count rounds at $amount units)",
    async ({ count, amount, accepted }) => {
      const f = nftFixture();
      f.state.minBetAmount = 10_000n;
      f.state.ssot.L = 100_000_000n;
      f.state.ssot.G = 100_000_000n;
      const stake = amount * BigInt(count);
      f.state.requiredReserve = stake * 2n;
      const result = await f.sdk.gameHub.planPlaceBet({
        chainId: 84532,
        gameId: GAME,
        poolId: 1,
        betCount: count,
        stake,
        params: "0x",
        stakeSpec: encodeStakeSpec({
          amountPerRoll: amount,
          betCount: count,
          stopGain: 0n,
          stopLoss: 0n
        }),
        maxHouseEdgeBps: 500
      });
      if (accepted) {
        expect(result).not.toHaveProperty("error");
        expect(stake).toBe(count === 1 ? 10_000n : 250_000n);
      } else {
        expect(result).toHaveProperty("error.code", "STAKE_BELOW_MINIMUM");
      }
      expect(f.pub.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "minBetAmount", blockNumber: 42n })
      );
      expect(f.wallet.writeContract).not.toHaveBeenCalled();
    }
  );
  it("rejects 26 rounds and fails closed when the per-round minimum cannot be read", async () => {
    const f = nftFixture();
    const input = (count: number) => ({
      chainId: 84532,
      gameId: GAME,
      poolId: 1,
      betCount: count,
      stake: 10_000n * BigInt(count),
      params: "0x" as const,
      stakeSpec: encodeStakeSpec({
        amountPerRoll: 10_000n,
        betCount: count,
        stopGain: 0n,
        stopLoss: 0n
      }),
      maxHouseEdgeBps: 500
    });
    expect(await f.sdk.gameHub.planPlaceBet(input(26))).toHaveProperty("error.code", "BAD_INPUT");
    expect(f.pub.readContract.mock.calls.some(([q]) => q.functionName === "quoteVRFFee")).toBe(
      false
    );
    const read = f.pub.readContract.getMockImplementation()!;
    f.pub.readContract.mockImplementation(async (q) => {
      if (q.functionName === "minBetAmount") throw new Error("RPC unavailable");
      return read(q);
    });
    expect(await f.sdk.gameHub.planPlaceBet(input(1))).toHaveProperty("error");
    expect(f.wallet.writeContract).not.toHaveBeenCalled();
  });
  it("uses G and gross R after accepting this stake; rejects L=0 and capital overflow", async () => {
    const f = nftFixture();
    const input = {
      chainId: 84532,
      gameId: GAME,
      poolId: 1,
      betCount: 1,
      stake: 10n,
      params: "0x" as const,
      stakeSpec: encodeStakeSpec({ amountPerRoll: 10n, betCount: 1, stopGain: 0n, stopLoss: 0n }),
      maxHouseEdgeBps: 500
    };
    expect(await f.sdk.gameHub.planPlaceBet(input)).not.toHaveProperty("error");
    f.state.ssot.L = 0n;
    expect(await f.sdk.gameHub.planPlaceBet(input)).toHaveProperty(
      "error.code",
      "INSUFFICIENT_LIQUIDITY"
    );
    f.state.ssot.L = 100n;
    f.state.ssot.G = MAX_TREE_CAPITAL;
    expect(await f.sdk.gameHub.planPlaceBet(input)).toHaveProperty(
      "error.code",
      "INSUFFICIENT_LIQUIDITY"
    );
  });
});
