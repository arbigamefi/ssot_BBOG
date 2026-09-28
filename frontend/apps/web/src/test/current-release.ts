import fixture from "../../../../packages/ssot/src/fixtures/release-v16.fixture.json";
import type { ReleaseLoadResult, SSOTRelease } from "@ssot/ssot/release";

/** Synthetic current releases for tests; never registered in the application build. */
export function createCurrentRelease(chainId: number): SSOTRelease {
  const release = structuredClone(fixture) as SSOTRelease;
  return {
    ...release,
    chainId,
    name: `Test release ${chainId}`,
    isPlaceholder: false,
    assets: release.assets.map((asset) => ({ ...asset, symbol: "USDC" })),
    pools: release.pools.map((pool) => ({ ...pool, symbol: "USDC" }))
  };
}

export function createReleaseModuleMock(chainIds: number[] = [8453, 84532]) {
  const releases = new Map(chainIds.map((chainId) => [chainId, createCurrentRelease(chainId)]));
  return {
    embeddedChainIds: [...chainIds],
    loadEmbeddedRelease(chainId: number): ReleaseLoadResult {
      const release = releases.get(chainId);
      return release
        ? { ok: true, release, warnings: [] }
        : { ok: false, error: `No embedded release for chainId=${chainId}` };
    }
  };
}
