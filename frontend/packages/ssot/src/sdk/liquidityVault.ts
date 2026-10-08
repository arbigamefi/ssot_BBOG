import { getAddress, type Address, type PublicClient } from "viem";
import type {
  DepositCursor,
  DomainDepositPage,
  DomainDepositPosition,
  DomainDepositWithdrawalQuote,
  LPStatus
} from "../domain";
import { getContractAbis } from "../abis/index.mjs";

export const NFT_WITHDRAWAL_ONE = 1_000_000_000_000n;
export const MAX_TREE_CAPITAL = (1n << 108n) - 1n;
const { BankAbi, LiquidityVaultAbi } = getContractAbis();
const statuses: LPStatus[] = [
  "ready",
  "paused",
  "busy",
  "unbookedResult",
  "invalidAccounting",
  "unavailable",
  "coolingDown",
  "noLiquidity"
];

export function decodeLPStatus(value: unknown): LPStatus {
  const index = Number(value);
  if (
    (typeof value !== "number" && typeof value !== "bigint") ||
    !Number.isInteger(index) ||
    !statuses[index]
  )
    throw new Error("Unknown authoritative LP status.");
  return statuses[index]!;
}

export interface VaultPool {
  poolId: number;
  bank: Address;
  vault: Address;
  asset: Address;
}

export async function verifyVaultBinding(
  client: PublicClient,
  pool: VaultPool,
  blockNumber: bigint
) {
  const [bankVault, bankAsset, vaultBank, vaultAsset] = await Promise.all([
    client.readContract({ address: pool.bank, abi: BankAbi, functionName: "vault", blockNumber }),
    client.readContract({ address: pool.bank, abi: BankAbi, functionName: "asset", blockNumber }),
    client.readContract({
      address: pool.vault,
      abi: LiquidityVaultAbi,
      functionName: "bank",
      blockNumber
    }),
    client.readContract({
      address: pool.vault,
      abi: LiquidityVaultAbi,
      functionName: "asset",
      blockNumber
    })
  ]);
  if (
    getAddress(bankVault as Address) !== getAddress(pool.vault) ||
    getAddress(vaultBank as Address) !== getAddress(pool.bank) ||
    getAddress(bankAsset as Address) !== getAddress(pool.asset) ||
    getAddress(vaultAsset as Address) !== getAddress(pool.asset)
  ) {
    throw new Error("Vault/Bank/asset binding differs from the authenticated release.");
  }
}

export async function readDepositPosition(
  client: PublicClient,
  pool: VaultPool,
  depositId: bigint,
  blockNumber: bigint,
  timestamp: bigint
): Promise<DomainDepositPosition> {
  if (depositId < 0n || depositId >= 1n << 48n) throw new RangeError("Invalid NFT deposit ID.");
  const state = (await client.readContract({
    address: pool.vault,
    abi: LiquidityVaultAbi,
    functionName: "depositState",
    args: [depositId],
    blockNumber
  })) as {
    owner: Address;
    assets: bigint;
    withdrawAfter: bigint;
    maxPercent: bigint;
    maxAssets: bigint;
    status: number;
  };
  const position: DomainDepositPosition = {
    ...pool,
    depositId,
    owner: getAddress(state.owner),
    assets: BigInt(state.assets),
    withdrawAfter: BigInt(state.withdrawAfter),
    maxPercent: BigInt(state.maxPercent),
    maxAssets: BigInt(state.maxAssets),
    status: decodeLPStatus(state.status),
    updatedAtBlock: blockNumber,
    snapshotTimestamp: timestamp
  };
  if (
    position.maxPercent < 0n ||
    position.maxPercent > NFT_WITHDRAWAL_ONE ||
    position.maxAssets !== (position.assets * position.maxPercent) / NFT_WITHDRAWAL_ONE
  ) {
    throw new Error("Inconsistent authoritative NFT withdrawal quote.");
  }
  return position;
}

export function quoteNftWithdrawal(
  position: DomainDepositPosition,
  percent: bigint
): DomainDepositWithdrawalQuote {
  const validPercent = percent > 0n && percent <= NFT_WITHDRAWAL_ONE;
  const assets = validPercent ? (position.assets * percent) / NFT_WITHDRAWAL_ONE : 0n;
  const closeOnly = validPercent && percent === NFT_WITHDRAWAL_ONE && position.assets === 0n;
  const reason = !validPercent
    ? "invalidPercent"
    : position.status !== "ready"
      ? position.status
      : assets === 0n && !closeOnly
        ? "zeroWithdrawal"
        : percent > position.maxPercent
          ? "insufficientFreeCapital"
          : undefined;
  return {
    position,
    percent,
    assets,
    executable: reason === undefined,
    closeOnly,
    ...(reason ? { reason } : {})
  };
}

export async function readDepositsPage(
  client: PublicClient,
  pool: VaultPool,
  owner: Address,
  chainId: number,
  opts: { cursor?: DepositCursor; limit?: number; blockNumber?: bigint } = {}
): Promise<DomainDepositPage> {
  const limit = opts.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new RangeError("NFT page limit must be between 1 and 50.");
  const cursor = opts.cursor;
  const normalizedOwner = getAddress(owner);
  if (
    cursor &&
    (cursor.chainId !== chainId ||
      cursor.poolId !== pool.poolId ||
      getAddress(cursor.vault) !== getAddress(pool.vault) ||
      getAddress(cursor.owner) !== normalizedOwner ||
      (opts.blockNumber !== undefined && opts.blockNumber !== cursor.blockNumber))
  ) {
    throw new Error("NFT cursor belongs to a different owner, pool or snapshot.");
  }
  const blockNumber =
    cursor?.blockNumber ?? opts.blockNumber ?? (await client.getBlockNumber({ cacheTime: 0 }));
  const block = await client.getBlock({ blockNumber });
  if (!block.hash || block.number !== blockNumber || (cursor && cursor.blockHash !== block.hash)) {
    throw new Error("NFT snapshot changed; restart pagination.");
  }
  await verifyVaultBinding(client, pool, blockNumber);
  const nftCount = (await client.readContract({
    address: pool.vault,
    abi: LiquidityVaultAbi,
    functionName: "balanceOf",
    args: [normalizedOwner],
    blockNumber
  })) as bigint;
  const index = cursor?.nextIndex ?? 0n;
  if (index < 0n || index > nftCount || (cursor && cursor.nftCount !== nftCount))
    throw new Error("Invalid NFT enumeration cursor.");
  const length = Number(nftCount - index > BigInt(limit) ? BigInt(limit) : nftCount - index);
  const ids = await Promise.all(
    Array.from(
      { length },
      (_, i) =>
        client.readContract({
          address: pool.vault,
          abi: LiquidityVaultAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [normalizedOwner, index + BigInt(i)],
          blockNumber
        }) as Promise<bigint>
    )
  );
  const items = await Promise.all(
    ids.map((id) => readDepositPosition(client, pool, id, blockNumber, block.timestamp))
  );
  if (
    new Set(ids.map(String)).size !== ids.length ||
    items.some((item) => item.owner !== normalizedOwner)
  ) {
    throw new Error("NFT enumeration ownership mismatch.");
  }
  const after = await client.getBlock({ blockNumber });
  if (after.hash !== block.hash) throw new Error("NFT snapshot changed; restart pagination.");
  const nextIndex = index + BigInt(items.length);
  const complete = nextIndex === nftCount;
  return {
    items,
    nftCount,
    complete,
    updatedAtBlock: blockNumber,
    snapshotTimestamp: block.timestamp,
    ...(!complete
      ? {
          nextCursor: {
            chainId,
            poolId: pool.poolId,
            vault: pool.vault,
            owner: normalizedOwner,
            blockNumber,
            blockHash: block.hash,
            nextIndex,
            nftCount
          }
        }
      : {})
  };
}
