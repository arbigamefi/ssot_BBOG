import { getAddress, type Address } from "viem";
import { loadEmbeddedRelease } from "@ssot/ssot/release";

const activeGameHubs = new Map<number, Address | null>();

/**
 * The GameHub of the chain's active release, or null for a chain without one.
 *
 * Bet ids restart at 1 in every GameHub deployment and the bet index keeps every
 * deployment it has seen, so the site reads it through this hub. Only a receipt
 * link that names another hub reads an earlier deployment.
 */
export function getActiveGameHub(chainId: number): Address | null {
  if (!activeGameHubs.has(chainId)) {
    const result = loadEmbeddedRelease(chainId);
    activeGameHubs.set(chainId, result.ok ? getAddress(result.release.contracts.gameHub) : null);
  }
  return activeGameHubs.get(chainId) ?? null;
}

export function isSameGameHub(a: Address, b: Address) {
  return a.toLowerCase() === b.toLowerCase();
}
