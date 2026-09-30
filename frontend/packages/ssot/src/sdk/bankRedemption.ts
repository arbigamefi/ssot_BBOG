import { type Abi, type Address, type PublicClient } from "viem";
import { getContractAbis } from "../abis/index.mjs";
import type { DomainBankPosition, DomainBankSnapshot, DomainRedeemBatch } from "../domain";
const { BankAbi } = getContractAbis();

export function bankReader(client: PublicClient, bank: Address, blockNumber: bigint) {
  return (functionName: string, args: readonly unknown[] = []): Promise<unknown> =>
    client.readContract({ address: bank, abi: BankAbi as Abi, functionName, args, blockNumber });
}

export async function readRedeemBatch(
  read: ReturnType<typeof bankReader>,
  batchId: bigint
): Promise<DomainRedeemBatch> {
  const batch = (await read("redeemBatch", [batchId])) as Omit<DomainRedeemBatch, "batchId">;
  return {
    ...batch,
    batchId,
    cutoff: BigInt(batch.cutoff),
    activatedAt: BigInt(batch.activatedAt)
  };
}

export async function readAsyncBankState(
  client: PublicClient,
  bank: Address,
  blockNumber: bigint
): Promise<
  Pick<
    DomainBankSnapshot,
    | "totalReserved"
    | "recoveryBacking"
    | "activeOpenHolds"
    | "currentEpoch"
    | "openHolds"
    | "exitPayable"
    | "playerPayableTotal"
    | "batchPeriod"
    | "queuedBatch"
  >
> {
  const read = bankReader(client, bank, blockNumber);
  const [
    totalReserved,
    recoveryBacking,
    activeOpenHolds,
    currentEpoch,
    openHolds,
    exitPayable,
    playerPayableTotal,
    batchPeriod
  ] = (await Promise.all([
    read("totalReserved"),
    read("recoveryBacking"),
    read("activeOpenHolds"),
    read("currentEpoch"),
    read("openHolds"),
    read("exitPayable"),
    read("playerPayableTotal"),
    read("batchPeriod")
  ])) as bigint[];
  const batch = await readRedeemBatch(read, currentEpoch!);
  if (batch.priced || batch.activatedAt !== 0n)
    throw new Error("Invalid current Bank redemption epoch.");
  return {
    totalReserved: totalReserved!,
    recoveryBacking: recoveryBacking!,
    activeOpenHolds: activeOpenHolds!,
    currentEpoch: currentEpoch!,
    openHolds: openHolds!,
    exitPayable: exitPayable!,
    playerPayableTotal: playerPayableTotal!,
    batchPeriod: batchPeriod!,
    queuedBatch: batch.shares > 0n ? batch : null
  };
}

export async function readAsyncBankPosition(
  client: PublicClient,
  bank: Address,
  user: Address,
  blockNumber: bigint,
  walletShares: bigint,
  walletQuote: bigint
): Promise<
  Pick<
    DomainBankPosition,
    | "assetsEquivalent"
    | "queuedShares"
    | "queuedLiquidAssets"
    | "queuedRecoveryAssets"
    | "queuedBatch"
    | "claimableShares"
    | "claimableAssets"
    | "playerPayable"
    | "cancellableShares"
    | "activeAndClaimableAssets"
  >
> {
  const read = bankReader(client, bank, blockNumber);
  const [request, pending, quote, playerPayable, nav, supply] = (await Promise.all([
    read("redeemRequestOf", [user]),
    read("pendingRedeemBatch", [user]),
    read("quoteQueuedRedeem", [user]),
    read("playerPayable", [user]),
    read("totalAssets"),
    read("totalSupply")
  ])) as [
    readonly [bigint, bigint, bigint],
    readonly [bigint, bigint],
    readonly [bigint, bigint],
    bigint,
    bigint,
    bigint
  ];
  const [queuedShares, claimableShares, claimableAssets] = request;
  if (queuedShares !== pending[1] || (queuedShares > 0n && pending[0] === 0n))
    throw new Error("Bank pending shares do not match its controller batch.");
  const [queuedLiquidAssets, queuedRecoveryAssets] = quote;
  let queuedBatch: DomainBankPosition["queuedBatch"] = null;
  if (queuedShares > 0n) {
    const batch = await readRedeemBatch(read, pending[0]);
    if (batch.priced || batch.activatedAt !== 0n || batch.shares < queuedShares)
      throw new Error("Invalid queued Bank redemption batch.");
    queuedBatch = {
      ...batch,
      controllerShares: queuedShares,
      cancellableShares: queuedShares,
      liquidAssets: queuedLiquidAssets,
      recoveryAssets: queuedRecoveryAssets
    };
  }
  const realEquity = supply === 0n ? 0n : (walletShares * nav) / supply;
  const assetsEquivalent = walletQuote < realEquity ? walletQuote : realEquity;
  return {
    assetsEquivalent,
    queuedShares,
    queuedLiquidAssets,
    queuedRecoveryAssets,
    queuedBatch,
    claimableShares,
    claimableAssets,
    playerPayable,
    cancellableShares: queuedShares,
    activeAndClaimableAssets: assetsEquivalent + queuedLiquidAssets + claimableAssets
  };
}

/** Indicative quote from one snapshot; execution always re-simulates against current contract state. */
export function quoteAsyncWithdraw(
  assets: bigint,
  claimableShares: bigint,
  claimableAssets: bigint
): bigint {
  if (assets <= 0n || assets > claimableAssets || claimableShares <= 0n) {
    throw new RangeError("Amount exceeds the claimable assets or is zero.");
  }
  const shares = (assets * claimableShares + claimableAssets - 1n) / claimableAssets;
  if (shares === claimableShares && assets !== claimableAssets) {
    throw new RangeError("ClaimWouldStrandAssets: claim all assets or redeem shares instead.");
  }
  return shares;
}

/** A full zero-asset share claim is valid and retires the claim units. */
export function quoteAsyncRedeem(
  shares: bigint,
  claimableShares: bigint,
  claimableAssets: bigint
): bigint {
  if (shares <= 0n || shares > claimableShares)
    throw new RangeError("Amount exceeds the claimable shares or is zero.");
  return (shares * claimableAssets) / claimableShares;
}
