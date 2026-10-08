import { describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";
import { fetchVaultProviderLedgerRows } from "./vault-provider-ledger.js";
const bank = "0x1111111111111111111111111111111111111111" as Address;
const vault = "0x2222222222222222222222222222222222222222" as Address;
const owner = "0x3333333333333333333333333333333333333333" as Address;
const receiver = "0x4444444444444444444444444444444444444444" as Address;
const asset = "0x5555555555555555555555555555555555555555" as Address;
const zero = "0x0000000000000000000000000000000000000000";
const pool = { bank, vault, asset, poolId: 1, decimals: 6 };
const log = (eventName: string, logIndex: number, args: Record<string, unknown>) => ({
  address: vault,
  eventName,
  args,
  blockNumber: 100n,
  logIndex,
  transactionHash: "0xaaa"
});
describe("Vault provider ledger", () => {
  it("indexes NFT cash and transfers without double counting mint/burn or inventing transfer cash", async () => {
    const getLogs = vi.fn(async () => [
      log("DepositAdded", 1, {
        payer: receiver,
        owner,
        depositId: 10n,
        assets: 100n,
        withdrawAfter: 500n
      }),
      log("Transfer", 2, { from: zero, to: owner, tokenId: 10n }),
      log("Transfer", 3, { from: owner, to: receiver, tokenId: 10n }),
      log("DepositWithdrawn", 4, {
        owner: receiver,
        depositId: 10n,
        assets: 40n,
        percent: 400_000_000_000n,
        withdrawAfter: 700n
      }),
      log("Transfer", 5, { from: receiver, to: zero, tokenId: 10n })
    ]);
    const getBlock = vi.fn(async () => ({ timestamp: 123n }));
    const result = await fetchVaultProviderLedgerRows({
      chainId: 84532,
      pools: [pool, { ...pool, poolId: 2 }],
      publicClient: { getLogs, getBlock } as unknown as PublicClient,
      range: { fromBlock: 100n, toBlock: 100n }
    });
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ address: [vault] }));
    expect(getBlock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.rows).toMatchObject([
      {
        action: "withdraw",
        bank,
        vault,
        owner: receiver,
        depositId: "10",
        assets: "40",
        percent: "400000000000",
        withdrawAfter: "700"
      },
      {
        action: "transfer",
        owner,
        receiver,
        depositId: "10",
        assets: undefined,
        caller: undefined
      },
      {
        action: "deposit",
        owner,
        caller: receiver,
        assets: "100",
        depositId: "10",
        withdrawAfter: "500"
      }
    ]);
  });
  it.each(["transactionHash", "blockNumber", "logIndex"] as const)(
    "rejects a recognized cash event missing %s instead of returning an empty range",
    async (field) => {
      const event = {
        ...log("DepositAdded", 1, {
          payer: owner,
          owner,
          depositId: 10n,
          assets: 100n,
          withdrawAfter: 500n
        }),
        [field]: null
      };
      const getLogs = vi.fn(async () => [event]);
      const getBlock = vi.fn();
      await expect(
        fetchVaultProviderLedgerRows({
          chainId: 84532,
          pools: [pool],
          publicClient: { getLogs, getBlock } as unknown as PublicClient,
          range: { fromBlock: 100n, toBlock: 100n }
        })
      ).rejects.toThrow("missing its mined identity");
      expect(getBlock).not.toHaveBeenCalled();
    }
  );
  it("does not call RPC for an empty pool set", async () => {
    const getLogs = vi.fn();
    expect(
      await fetchVaultProviderLedgerRows({
        chainId: 84532,
        pools: [],
        publicClient: { getLogs, getBlock: vi.fn() } as unknown as PublicClient,
        range: { fromBlock: 0n, toBlock: 2n }
      })
    ).toEqual([]);
    expect(getLogs).not.toHaveBeenCalled();
  });
  it("isolates Vault addresses and does not turn a Bank event into an NFT cash flow", async () => {
    const getLogs = vi.fn(async () => [
      {
        ...log("DepositAdded", 1, {
          payer: owner,
          owner,
          depositId: 10n,
          assets: 50n,
          withdrawAfter: 50n
        }),
        address: bank
      }
    ]);
    const result = await fetchVaultProviderLedgerRows({
      chainId: 84532,
      pools: [pool],
      publicClient: { getLogs, getBlock: vi.fn() } as unknown as PublicClient,
      range: { fromBlock: 100n, toBlock: 100n }
    });
    expect(result[0]!.rows).toEqual([]);
  });
});
