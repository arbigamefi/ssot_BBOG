import type { LandingAssetOverviewResponse } from "../../server/landing/asset-overview";
import type { AssetOverview } from "./home-types";

/** A missing read is not an empty bank. Never present another release's balances. */
export async function fetchLandingOverview(
  chainId: number,
  releaseDigest: string
): Promise<{ assets: AssetOverview[] }> {
  const response = await fetch(`/api/landing/asset-overview?chainId=${chainId}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("Bank overview request failed");
  const body = (await response.json()) as LandingAssetOverviewResponse;
  if (
    body.source !== "rpc" ||
    body.chainId !== chainId ||
    body.releaseDigest !== releaseDigest ||
    !Array.isArray(body.rows)
  )
    throw new Error("Bank overview is unavailable for this release");
  return {
    assets: body.rows.map((row) => ({
      address: row.address,
      symbol: row.symbol,
      decimals: row.decimals,
      totalAssets: BigInt(row.totalAssets),
      totalReserved: BigInt(row.totalReserved),
      turnover: BigInt(row.turnover),
      protocolFee: BigInt(row.protocolFee)
    }))
  };
}
