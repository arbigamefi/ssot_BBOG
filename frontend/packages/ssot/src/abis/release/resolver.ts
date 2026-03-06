import type { Abi } from "viem";
import * as release from "./index";

export type ReleaseAbis = {
  HubAbi: Abi;
  BankAbi: Abi;
  VRFHubAbi: Abi;
  BankRegistryAbi?: Abi;
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
  if (!mod.HubAbi || !mod.BankAbi || !mod.VRFHubAbi) {
    throw new Error(`Release ABI module for chainId=${chainId} is missing required contracts (Hub/Bank/VRFHub).`);
  }
  return {
    HubAbi: mod.HubAbi,
    BankAbi: mod.BankAbi,
    VRFHubAbi: mod.VRFHubAbi,
    BankRegistryAbi: mod.BankRegistryAbi,
    ReferralRegistryAbi: mod.ReferralRegistryAbi,
    DefaultReferralEngineAbi: mod.DefaultReferralEngineAbi
  };
}
