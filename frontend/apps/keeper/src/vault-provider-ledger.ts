import {
  isAddressEqual,
  getAbiItem,
  type AbiEvent,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import { decodeVaultProviderEvent, type VaultProviderLedgerRow } from "@ssot/bet-index";
import { LIQUIDITY_VAULT_KEEPER_ABI } from "./abi.js";

const VAULT_PROVIDER_LEDGER_ABI = ["DepositAdded", "DepositWithdrawn", "Transfer"].map(
  (name) => getAbiItem({ abi: LIQUIDITY_VAULT_KEEPER_ABI, name }) as AbiEvent
);

export type VaultProviderLedgerPool = {
  poolId: number;
  bank: Address;
  vault: Address;
  asset: Address;
  decimals: number;
};

type TransferLogLike = {
  address: Address;
  eventName: string;
  args?: Record<string, unknown>;
  blockNumber?: bigint;
  logIndex?: number;
  transactionHash?: Hex;
};

function ledgerId(chainId: number, txHash: Hex, logIndex: number) {
  return `${chainId}:vault-provider:${txHash.toLowerCase()}:${logIndex}`;
}

/** Scan NFT cash and ownership events in one eth_getLogs across every Vault. */
export async function fetchVaultProviderLedgerRows({
  chainId,
  pools,
  publicClient,
  range
}: {
  chainId: number;
  pools: readonly VaultProviderLedgerPool[];
  publicClient: Pick<PublicClient, "getBlock" | "getLogs">;
  range: { fromBlock: bigint; toBlock: bigint };
}): Promise<Array<{ pool: VaultProviderLedgerPool; rows: VaultProviderLedgerRow[] }>> {
  pools = [...new Map(pools.map((pool) => [pool.vault.toLowerCase(), pool])).values()];
  if (pools.length === 0) return [];
  const logs = (await publicClient.getLogs({
    address: pools.map((pool) => pool.vault),
    events: VAULT_PROVIDER_LEDGER_ABI,
    fromBlock: range.fromBlock,
    toBlock: range.toBlock
  })) as unknown as TransferLogLike[];

  const blockTimestamps = new Map<string, Promise<number | undefined>>();
  const getTimestamp = (blockNumber: bigint) => {
    const key = blockNumber.toString();
    let existing = blockTimestamps.get(key);
    if (!existing) {
      existing = publicClient
        .getBlock({ blockNumber })
        .then((block) => Number(block.timestamp) * 1000)
        .catch(() => undefined);
      blockTimestamps.set(key, existing);
    }
    return existing;
  };

  return Promise.all(
    pools.map(async (pool) => ({
      pool,
      rows: await toLedgerRows(
        chainId,
        pool,
        logs.filter((log) => isAddressEqual(log.address, pool.vault)),
        getTimestamp
      )
    }))
  );
}

async function toLedgerRows(
  chainId: number,
  pool: VaultProviderLedgerPool,
  logs: readonly TransferLogLike[],
  getTimestamp: (blockNumber: bigint) => Promise<number | undefined>
): Promise<VaultProviderLedgerRow[]> {
  const ledgerLogs = logs.flatMap((log) => {
    const cash = decodeVaultProviderEvent(pool.vault, log.eventName, log.args ?? {});
    if (!cash) return [];
    // An incomplete RPC record is not an empty canonical range. Failing here
    // preserves both prior rows and the cursor so this range can be retried.
    if (!log.transactionHash || log.blockNumber == null || log.logIndex == null)
      throw new Error("Vault ledger log is missing its mined identity");
    return [{ ...log, cash }];
  });

  const rows = await Promise.all(
    ledgerLogs.map(async (log): Promise<VaultProviderLedgerRow> => {
      const txHash = log.transactionHash!.toLowerCase() as Hex;
      const logIndex = log.logIndex ?? 0;
      const timestamp = await getTimestamp(log.blockNumber!);
      const { assets, owner, receiver, caller, depositId, percent, withdrawAfter } = log.cash;
      return {
        action: log.cash.action,
        asset: pool.asset,
        assets: assets?.toString(),
        bank: pool.bank,
        vault: pool.vault,
        blockNumber: Number(log.blockNumber),
        chainId,
        id: ledgerId(chainId, txHash, logIndex),
        logIndex,
        owner: owner.toLowerCase() as Address,
        poolId: String(pool.poolId),
        receiver,
        caller,
        depositId: depositId.toString(),
        percent: percent?.toString(),
        withdrawAfter: withdrawAfter?.toString(),
        timestamp,
        txHash,
        updatedAt: Date.now()
      };
    })
  );

  return rows.sort((a, b) => {
    if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
    return b.logIndex - a.logIndex;
  });
}
