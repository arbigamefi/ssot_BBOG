import { getAddress, parseAbiItem, type Address, type Hex, type PublicClient } from "viem";
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
  const [depositLogs, withdrawLogs] = (await Promise.all([
    publicClient.getContractEvents({
      address: pool.bank,
      abi: BANK_PROVIDER_LEDGER_ABI,
      eventName: "Deposit",
      fromBlock: range.fromBlock,
      toBlock: range.toBlock
    }),
    publicClient.getContractEvents({
      address: pool.bank,
      abi: BANK_PROVIDER_LEDGER_ABI,
      eventName: "Withdraw",
      fromBlock: range.fromBlock,
      toBlock: range.toBlock
    })
  ])) as [TransferLogLike[], TransferLogLike[]];

  const ledgerLogs = [
    ...depositLogs.map((log) => ({ ...log, action: "deposit" as const })),
    ...withdrawLogs.map((log) => ({ ...log, action: "withdraw" as const }))
  ].filter((log): log is TransferLogLike & { action: BankProviderLedgerRow["action"] } =>
    Boolean(
      log.args?.owner &&
      log.args?.assets != null &&
      log.args?.shares != null &&
      log.transactionHash &&
      log.blockNumber != null
    )
  );

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
