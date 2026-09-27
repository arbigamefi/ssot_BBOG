import {
  getAddress,
  isAddressEqual,
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import type { BankProviderLedgerRow } from "@ssot/bet-index";

const BANK_DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"
);
const BANK_WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
);
const BANK_PROVIDER_LEDGER_ABI = [BANK_DEPOSIT_EVENT, BANK_WITHDRAW_EVENT] as const;

export type BankProviderLedgerPool = {
  poolId: number;
  bank: Address;
  asset: Address;
  decimals: number;
};

type TransferLogLike = {
  address: Address;
  eventName: string;
  args?: {
    assets?: bigint;
    owner?: Address;
    shares?: bigint;
  };
  blockNumber?: bigint;
  logIndex?: number;
  transactionHash?: Hex;
};

function assetPerShare(assets: bigint | undefined, shares: bigint, decimals: number) {
  if (assets == null || shares <= 0n) return undefined;
  const shareUnit = 10n ** BigInt(decimals);
  return (assets * shareUnit) / shares;
}

function ledgerId(chainId: number, txHash: Hex, logIndex: number) {
  return `${chainId}:bank-provider:${txHash.toLowerCase()}:${logIndex}`;
}

/**
 * Deposit and Withdraw rows for every pool over one block range, from a single
 * eth_getLogs across all pool addresses. Providers bill eth_getLogs per call, so
 * two events for each of two pools used to cost four calls per range.
 *
 * Returns one entry per pool, in the order given, each sorted newest first.
 */
export async function fetchBankProviderLedgerRows({
  chainId,
  pools,
  publicClient,
  range
}: {
  chainId: number;
  pools: readonly BankProviderLedgerPool[];
  publicClient: Pick<PublicClient, "getBlock" | "getLogs">;
  range: { fromBlock: bigint; toBlock: bigint };
}): Promise<Array<{ pool: BankProviderLedgerPool; rows: BankProviderLedgerRow[] }>> {
  if (pools.length === 0) return [];
  const logs = (await publicClient.getLogs({
    address: pools.map((pool) => pool.bank),
    events: BANK_PROVIDER_LEDGER_ABI,
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
        logs.filter((log) => isAddressEqual(log.address, pool.bank)),
        getTimestamp
      )
    }))
  );
}

async function toLedgerRows(
  chainId: number,
  pool: BankProviderLedgerPool,
  logs: readonly TransferLogLike[],
  getTimestamp: (blockNumber: bigint) => Promise<number | undefined>
): Promise<BankProviderLedgerRow[]> {
  const ledgerLogs = logs
    .map((log) => ({
      ...log,
      action: log.eventName === "Deposit" ? ("deposit" as const) : ("withdraw" as const)
    }))
    .filter((log): log is TransferLogLike & { action: BankProviderLedgerRow["action"] } =>
      Boolean(
        log.args?.owner &&
        log.args?.assets != null &&
        log.args?.shares != null &&
        log.transactionHash &&
        log.blockNumber != null
      )
    );

  const rows = await Promise.all(
    ledgerLogs.map(async (log): Promise<BankProviderLedgerRow> => {
      const txHash = log.transactionHash!.toLowerCase() as Hex;
      const logIndex = log.logIndex ?? 0;
      const timestamp = await getTimestamp(log.blockNumber!);
      const assets = log.args!.assets!;
      const shares = log.args!.shares!;
      const owner = getAddress(log.args!.owner!);
      return {
        action: log.action,
        asset: pool.asset,
        assets: assets?.toString(),
        bank: pool.bank,
        blockNumber: Number(log.blockNumber),
        chainId,
        id: ledgerId(chainId, txHash, logIndex),
        logIndex,
        owner: owner.toLowerCase() as Address,
        poolId: String(pool.poolId),
        sharePrice: assetPerShare(assets, shares, pool.decimals)?.toString(),
        shares: shares.toString(),
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
