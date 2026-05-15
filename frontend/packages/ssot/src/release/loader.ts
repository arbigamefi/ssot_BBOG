import { ReleaseSchema, type SSOTRelease } from "./schema";
import { embeddedReleases } from "./embedded";

export type ReleaseLoadResult =
  | { ok: true; release: SSOTRelease; warnings: string[] }
  | { ok: false; error: string };

export function loadEmbeddedRelease(chainId: number): ReleaseLoadResult {
  const raw = embeddedReleases[chainId];
  if (!raw) {
    return { ok: false, error: `No embedded release for chainId=${chainId}` };
  }

  const parsed = ReleaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }

  const release = parsed.data;
  const warnings: string[] = [];
  if (release.isPlaceholder) {
    warnings.push("Release snapshot is marked as placeholder");
  }
  if (release.meta?.schemaVersion !== 2) {
    warnings.push("Release schemaVersion is not v1.3 schemaVersion=2");
  }
  if (release.contracts.gameHub === "0x0000000000000000000000000000000000000000") {
    warnings.push("GameHub address is zero; release is not usable for writes");
  }
  if (release.assets.some((a) => a.address === "0x0000000000000000000000000000000000000000")) {
    warnings.push("One or more asset addresses are zero");
  }
  return { ok: true, release, warnings };
}
