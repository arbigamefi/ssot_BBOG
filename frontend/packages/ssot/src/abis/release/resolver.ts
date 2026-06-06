import type { Abi } from "viem";
import * as release from "./index";

export type ReleaseAbis = {
  GameHubAbi: Abi;
  BankAbi: Abi;
  VRFHubAbi: Abi;
  PoolRegistryAbi: Abi;
  SettlementRouterAbi: Abi;
  SportsHubAbi: Abi;
  SportsRiskEngineAbi: Abi;
  ReferralRegistryAbi?: Abi;
  DefaultReferralEngineAbi?: Abi;
};

/**
 * Resolve ABIs from the release-bundle synchronized directory.
 *
 * Final-shape guarantee:
 * - The release bundle ships exact ABIs for the deployed contracts.
 * - The SDK MUST use these ABIs (not hand-written/minimal fragments) to prevent drift.
 */
export function getReleaseAbis(chainId: number): ReleaseAbis {
  const key = `chain_${Number(chainId)}` as keyof typeof release;
  const mod: any = (release as any)[key];
  if (!mod) {
    throw new Error(`No release ABIs for chainId=${chainId}. Did you run pnpm ssot:sync?`);
  }
  if (
    !mod.GameHubAbi ||
    !mod.BankAbi ||
    !mod.VRFHubAbi ||
    !mod.PoolRegistryAbi ||
    !mod.SettlementRouterAbi ||
    !mod.SportsHubAbi ||
    !mod.SportsRiskEngineAbi
  ) {
    throw new Error(
      `Release ABI module for chainId=${chainId} is missing required release contracts (GameHub/Bank/VRFHub/PoolRegistry/SettlementRouter/SportsHub/SportsRiskEngine).`
    );
  }
  return {
    GameHubAbi: mod.GameHubAbi,
    BankAbi: mod.BankAbi,
    VRFHubAbi: mod.VRFHubAbi,
    PoolRegistryAbi: mod.PoolRegistryAbi,
    SettlementRouterAbi: mod.SettlementRouterAbi,
    SportsHubAbi: mod.SportsHubAbi,
    SportsRiskEngineAbi: mod.SportsRiskEngineAbi,
    ReferralRegistryAbi: mod.ReferralRegistryAbi,
    DefaultReferralEngineAbi: mod.DefaultReferralEngineAbi
  };
}
