import { createPublicClient, getAddress, http, type Address } from "viem";
import { getContractAbis } from "@ssot/ssot/abis";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

import { getPoolAssetContext } from "../../features/assets/pool-asset";
import { resolveServerRpcUrl } from "../rpc";

const { BankAbi } = getContractAbis();

export type LandingAssetOverviewResponse = {
  schemaVersion: 1;
  chainId: number;
  generatedAt: number;
  releaseDigest?: string;
  source: "rpc" | "unavailable";
  rows: Array<{
    address: Address;
    bank: Address;
    symbol: string;
    decimals: number;
    totalAssets: string;
    totalReserved: string;
    /** Lifetime turnover (Bank.getPerformance) — chain-read, verifiable. */
    turnover: string;
    /** Lifetime protocol fee accrued (Bank.getPerformance) — chain-read, verifiable. */
    protocolFee: string;
  }>;
};

function createChain(chainId: number, rpcUrl: string) {
  return {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  } as const;
}

function unavailableResponse(
  chainId: number,
  releaseDigest?: string
): LandingAssetOverviewResponse {
  return {
    schemaVersion: 1,
    chainId,
    generatedAt: Date.now(),
    releaseDigest,
    source: "unavailable",
    rows: []
  };
}

export async function queryLandingAssetOverview(
  chainId: number
): Promise<LandingAssetOverviewResponse> {
  const releaseResult = loadEmbeddedRelease(chainId);
  if (!releaseResult.ok) {
    return unavailableResponse(chainId);
  }

  const release = releaseResult.release;
  const rpcUrl = resolveServerRpcUrl(chainId);
  if (!rpcUrl) {
    return unavailableResponse(chainId, release.releaseDigest);
  }

  try {
    const publicClient = createPublicClient({
      chain: createChain(chainId, rpcUrl),
      transport: http(rpcUrl)
    });
    const rows = await Promise.all(
      release.pools.map(async (pool) => {
        const poolAsset = getPoolAssetContext(release, pool);
        if (!poolAsset?.bank) return null;
        const bank = getAddress(poolAsset.bank);
        const [ssot, perf] = await Promise.all([
          publicClient.readContract({
            address: bank,
            abi: BankAbi,
            functionName: "getSSOT",
            args: []
          }),
          publicClient.readContract({
            address: bank,
            abi: BankAbi,
            functionName: "getPerformance",
            args: []
          })
        ]);

        return {
          address: getAddress(poolAsset.asset.address),
          bank,
          symbol: poolAsset.asset.symbol,
          decimals: poolAsset.asset.decimals,
          totalAssets: BigInt((ssot as { NAV: bigint }).NAV).toString(),
          totalReserved: BigInt((ssot as { R: bigint }).R).toString(),
          turnover: BigInt(
            (perf as readonly [bigint, bigint, bigint, bigint, bigint, bigint])[0]
          ).toString(),
          protocolFee: BigInt(
            (perf as readonly [bigint, bigint, bigint, bigint, bigint, bigint])[5]
          ).toString()
        };
      })
    );

    return {
      schemaVersion: 1,
      chainId,
      generatedAt: Date.now(),
      releaseDigest: release.releaseDigest,
      source: "rpc",
      rows: rows.filter((row): row is NonNullable<(typeof rows)[number]> => Boolean(row))
    };
  } catch {
    return unavailableResponse(chainId, release.releaseDigest);
  }
}
