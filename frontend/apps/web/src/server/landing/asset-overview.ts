import { createPublicClient, getAddress, http, type Address } from "viem";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

import { getPoolAssetContext } from "../../features/assets/pool-asset";
import { resolveServerRpcUrl } from "../rpc";

const BANK_SSOT_ABI = [
  {
    inputs: [],
    name: "getSSOT",
    outputs: [
      {
        components: [
          { name: "NAV", type: "uint256" },
          { name: "R", type: "uint256" },
          { name: "minLiquidityBps", type: "uint256" },
          { name: "PF", type: "uint256" },
          { name: "XP", type: "uint256" }
        ],
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getPerformance",
    outputs: [
      { name: "turnover", type: "uint256" },
      { name: "payoutGross", type: "uint256" },
      { name: "payoutNet", type: "uint256" },
      { name: "refunded", type: "uint256" },
      { name: "feeOnPayout", type: "uint256" },
      { name: "protocolFeeAccrued", type: "uint256" },
      { name: "betsHeld", type: "uint256" },
      { name: "betsSettled", type: "uint256" },
      { name: "betsRefunded", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

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
            abi: BANK_SSOT_ABI,
            functionName: "getSSOT",
            args: []
          }),
          publicClient.readContract({
            address: bank,
            abi: BANK_SSOT_ABI,
            functionName: "getPerformance",
            args: []
          })
        ]);

        return {
          address: getAddress(poolAsset.asset.address),
          bank,
          symbol: poolAsset.asset.symbol,
          decimals: poolAsset.asset.decimals,
          totalAssets: BigInt(ssot.NAV).toString(),
          totalReserved: BigInt(ssot.R).toString(),
          turnover: BigInt(perf[0]).toString(),
          protocolFee: BigInt(perf[5]).toString()
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
