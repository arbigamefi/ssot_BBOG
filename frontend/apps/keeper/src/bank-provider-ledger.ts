import {
  getAddress,
  parseAbiItem,
  parseEventLogs,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import type { BankProviderLedgerRow } from "@ssot/bet-index";

const ZERO_ADDRESS = `0x${"0".repeat(40)}` as Address;
const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 amount)"
);
const ERC20_TRANSFER_ABI = [ERC20_TRANSFER_EVENT] as const;

export type BankProviderLedgerPool = {
  poolId: number;
  bank: Address;
  asset: Address;
  decimals: number;
};

type TransferLogLike = {
  args?: {
    amount?: bigint;
    from?: Address;
    to?: Address;
  };
  blockNumber?: bigint;
  logIndex?: number;
  transactionHash?: Hex;
};

type ReceiptLogLike = { address: Address; data: Hex; topics: Hex[] };

function sameAddress(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function assetPerShare(assets: bigint | undefined, shares: bigint, decimals: number) {
  if (assets == null || shares <= 0n) return undefined;
  const shareUnit = 10n ** BigInt(decimals);
  return (assets * shareUnit) / shares;
}

function ledgerId(chainId: number, txHash: Hex, logIndex: number) {
  return `${chainId}:bank-provider:${txHash.toLowerCase()}:${logIndex}`;
}

function extractAssetAmount({
  action,
  asset,
  bank,
  logs,
  owner
}: {
  action: BankProviderLedgerRow["action"];
  asset: Address;
  bank: Address;
  logs: readonly ReceiptLogLike[];
  owner: Address;
}) {
  const decoded = parseEventLogs({
    abi: ERC20_TRANSFER_ABI,
    eventName: "Transfer",
    logs: logs.filter((log) => sameAddress(log.address, asset)) as never
  }) as Array<{ args: { amount?: bigint; from?: Address; to?: Address } }>;

  const match = decoded.find((log) => {
    if (action === "deposit")
      return sameAddress(log.args.from, owner) && sameAddress(log.args.to, bank);
    return sameAddress(log.args.from, bank) && sameAddress(log.args.to, owner);
  });

  return match?.args.amount;
}

export async function fetchBankProviderLedgerRows({
  chainId,
  pool,
  publicClient,
  range
}: {
  chainId: number;
  pool: BankProviderLedgerPool;
  publicClient: PublicClient;
  range: { fromBlock: bigint; toBlock: bigint };
}): Promise<BankProviderLedgerRow[]> {
  const logs = (await publicClient.getContractEvents({
    address: pool.bank,
    abi: ERC20_TRANSFER_ABI,
    eventName: "Transfer",
    fromBlock: range.fromBlock,
    toBlock: range.toBlock
  })) as TransferLogLike[];
  const shareLogs = logs
    .map((log) => {
      const from = log.args?.from == null ? undefined : getAddress(log.args.from);
      const to = log.args?.to == null ? undefined : getAddress(log.args.to);
      const shares = log.args?.amount;
      if (!from || !to || shares == null || !log.transactionHash || log.blockNumber == null) {
        return null;
      }
      if (sameAddress(from, ZERO_ADDRESS)) {
        return { ...log, action: "deposit" as const, owner: to, shares };
      }
      if (sameAddress(to, ZERO_ADDRESS)) {
        return { ...log, action: "withdraw" as const, owner: from, shares };
      }
      return null;
    })
    .filter((log): log is NonNullable<typeof log> => Boolean(log));

  const blockTimestamps = new Map<string, Promise<number | undefined>>();
  const receipts = new Map<Hex, Promise<ReceiptLogLike[]>>();
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
  const getReceiptLogs = (txHash: Hex) => {
    let existing = receipts.get(txHash);
    if (!existing) {
      existing = publicClient
        .getTransactionReceipt({ hash: txHash })
        .then((receipt) => receipt.logs as ReceiptLogLike[]);
      receipts.set(txHash, existing);
    }
    return existing;
  };

  const rows = await Promise.all(
    shareLogs.map(async (log): Promise<BankProviderLedgerRow> => {
      const txHash = log.transactionHash!.toLowerCase() as Hex;
      const logIndex = log.logIndex ?? 0;
      const [timestamp, receiptLogs] = await Promise.all([
        getTimestamp(log.blockNumber!),
        getReceiptLogs(txHash)
      ]);
      const assets = extractAssetAmount({
        action: log.action,
        asset: pool.asset,
        bank: pool.bank,
        logs: receiptLogs,
        owner: log.owner
      });
      return {
        action: log.action,
        asset: pool.asset,
        assets: assets?.toString(),
        bank: pool.bank,
        blockNumber: Number(log.blockNumber),
        chainId,
        id: ledgerId(chainId, txHash, logIndex),
        logIndex,
        owner: log.owner.toLowerCase() as Address,
        poolId: String(pool.poolId),
        sharePrice: assetPerShare(assets, log.shares, pool.decimals)?.toString(),
        shares: log.shares.toString(),
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
