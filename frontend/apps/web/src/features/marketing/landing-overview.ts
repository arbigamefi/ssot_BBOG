import type { LandingAssetOverviewResponse } from "../../server/landing/asset-overview";
import type { Address } from "@ssot/ssot/sdk";

/** One asset's house pool, read from its Banks on chain. */
export type AssetOverview = {
  address: Address;
  symbol: string;
  decimals: number;
  lpCapital: bigint;
  lockedCapital: bigint;
  /** Lifetime turnover (Bank.getPerformance.turnover). */
  turnover: bigint;
  /** Accrued protocol fee payable (Bank getSSOT.PF). */
  protocolFee: bigint;
};

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
      lpCapital: BigInt(row.lpCapital),
      lockedCapital: BigInt(row.lockedCapital),
      turnover: BigInt(row.turnover),
      protocolFee: BigInt(row.protocolFee)
    }))
  };
}
