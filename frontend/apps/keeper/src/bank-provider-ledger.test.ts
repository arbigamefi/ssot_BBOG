import { describe, expect, it, vi } from "vitest";
import type { Address, Hex, PublicClient } from "viem";

import { fetchBankProviderLedgerRows } from "./bank-provider-ledger.js";

const BANK = "0x1111111111111111111111111111111111111111" as Address;
const ASSET = "0x2222222222222222222222222222222222222222" as Address;
const OWNER = "0x3333333333333333333333333333333333333333" as Address;

describe("fetchBankProviderLedgerRows", () => {
  it("indexes ERC4626 Deposit and Withdraw events directly", async () => {
    const getContractEvents = vi
      .fn()
      .mockResolvedValueOnce([
        {
          args: { assets: 2_000_000n, owner: OWNER, shares: 1_000_000n },
          blockNumber: 100n,
          logIndex: 3,
          transactionHash: "0xaaa" as Hex
        }
      ])
      .mockResolvedValueOnce([
        {
          args: { assets: 1_500_000n, owner: OWNER, shares: 500_000n },
          blockNumber: 101n,
          logIndex: 4,
          transactionHash: "0xbbb" as Hex
        }
      ]);
    const getBlock = vi.fn(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ timestamp: blockNumber === 100n ? 1_700_000_000n : 1_700_000_030n })
    );
    const publicClient = { getBlock, getContractEvents } as unknown as PublicClient;

    const rows = await fetchBankProviderLedgerRows({
      chainId: 84532,
      pool: { asset: ASSET, bank: BANK, decimals: 6, poolId: 1 },
      publicClient,
      range: { fromBlock: 100n, toBlock: 101n }
    });

    expect(getContractEvents).toHaveBeenCalledTimes(2);
    expect(getContractEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ address: BANK, eventName: "Deposit" })
    );
    expect(getContractEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ address: BANK, eventName: "Withdraw" })
    );
    expect(rows).toMatchObject([
      {
        action: "withdraw",
        assets: "1500000",
        blockNumber: 101,
        owner: OWNER.toLowerCase(),
        sharePrice: "3000000",
        shares: "500000"
      },
      {
        action: "deposit",
        assets: "2000000",
        blockNumber: 100,
        owner: OWNER.toLowerCase(),
        sharePrice: "2000000",
        shares: "1000000"
      }
    ]);
  });
});
