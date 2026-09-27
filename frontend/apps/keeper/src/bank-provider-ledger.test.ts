import { describe, expect, it, vi } from "vitest";
import type { Address, Hex, PublicClient } from "viem";

import { fetchBankProviderLedgerRows } from "./bank-provider-ledger.js";

const BANK = "0x1111111111111111111111111111111111111111" as Address;
const ASSET = "0x2222222222222222222222222222222222222222" as Address;
const OWNER = "0x3333333333333333333333333333333333333333" as Address;
const OTHER_BANK = "0x4444444444444444444444444444444444444444" as Address;
const OTHER_ASSET = "0x5555555555555555555555555555555555555555" as Address;

const pool = { asset: ASSET, bank: BANK, decimals: 6, poolId: 1 };
const otherPool = { asset: OTHER_ASSET, bank: OTHER_BANK, decimals: 6, poolId: 2 };

describe("fetchBankProviderLedgerRows", () => {
  it("reads every pool's ERC4626 Deposit and Withdraw events with one eth_getLogs", async () => {
    // Providers return lowercase addresses; rows are matched to pools case-insensitively.
    const getLogs = vi.fn().mockResolvedValue([
      {
        address: BANK.toLowerCase(),
        eventName: "Deposit",
        args: { assets: 2_000_000n, owner: OWNER, shares: 1_000_000n },
        blockNumber: 100n,
        logIndex: 3,
        transactionHash: "0xaaa" as Hex
      },
      {
        address: OTHER_BANK.toLowerCase(),
        eventName: "Deposit",
        args: { assets: 900_000n, owner: OWNER, shares: 900_000n },
        blockNumber: 100n,
        logIndex: 5,
        transactionHash: "0xccc" as Hex
      },
      {
        address: BANK.toLowerCase(),
        eventName: "Withdraw",
        args: { assets: 1_500_000n, owner: OWNER, shares: 500_000n },
        blockNumber: 101n,
        logIndex: 4,
        transactionHash: "0xbbb" as Hex
      }
    ]);
    const getBlock = vi.fn(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ timestamp: blockNumber === 100n ? 1_700_000_000n : 1_700_000_030n })
    );
    const publicClient = { getBlock, getLogs } as unknown as PublicClient;

    const result = await fetchBankProviderLedgerRows({
      chainId: 84532,
      pools: [pool, otherPool],
      publicClient,
      range: { fromBlock: 100n, toBlock: 101n }
    });

    expect(getLogs).toHaveBeenCalledTimes(1);
    const [query] = getLogs.mock.calls[0]!;
    expect(query).toMatchObject({ address: [BANK, OTHER_BANK], fromBlock: 100n, toBlock: 101n });
    expect(query.events.map((event: { name: string }) => event.name)).toEqual([
      "Deposit",
      "Withdraw"
    ]);
    // One block lookup per distinct block, shared across pools.
    expect(getBlock).toHaveBeenCalledTimes(2);
    expect(result.map((entry) => entry.pool.poolId)).toEqual([1, 2]);
    expect(result[0]!.rows).toMatchObject([
      {
        action: "withdraw",
        assets: "1500000",
        bank: BANK,
        blockNumber: 101,
        owner: OWNER.toLowerCase(),
        poolId: "1",
        sharePrice: "3000000",
        shares: "500000",
        timestamp: 1_700_000_030_000
      },
      {
        action: "deposit",
        assets: "2000000",
        bank: BANK,
        blockNumber: 100,
        owner: OWNER.toLowerCase(),
        poolId: "1",
        sharePrice: "2000000",
        shares: "1000000",
        timestamp: 1_700_000_000_000
      }
    ]);
    expect(result[1]!.rows).toMatchObject([
      {
        action: "deposit",
        asset: OTHER_ASSET,
        bank: OTHER_BANK,
        poolId: "2",
        sharePrice: "1000000",
        shares: "900000"
      }
    ]);
  });

  it("makes no RPC call without pools", async () => {
    const getLogs = vi.fn();
    const result = await fetchBankProviderLedgerRows({
      chainId: 84532,
      pools: [],
      publicClient: { getBlock: vi.fn(), getLogs } as unknown as PublicClient,
      range: { fromBlock: 100n, toBlock: 101n }
    });

    expect(result).toEqual([]);
    expect(getLogs).not.toHaveBeenCalled();
  });
});
