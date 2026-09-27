import type { SSOTRelease } from "./schema";

/** Release lines the site serves. Each chain runs one; mainnet can stay on v1.5 while a testnet runs v1.6. */
export type ReleaseLine = "v1.5" | "v1.6";

const LINES: Record<string, ReleaseLine> = {
  SSOT_RELEASE_DIGEST_V15: "v1.5",
  SSOT_RELEASE_DIGEST_V16: "v1.6"
};

/** The line named by the release's signed lock; undefined for a retired or unsigned release. */
export function getReleaseLine(
  release: Pick<SSOTRelease, "meta"> | null | undefined
): ReleaseLine | undefined {
  const schema = release?.meta?.releaseLock?.schema;
  return schema ? LINES[schema] : undefined;
}

/**
 * From v1.6, LPs keep half of every settled casino bet's house edge and only the other half pays
 * referral rewards and protocol fees. Under v1.5 the whole edge paid them.
 */
export function lpsKeepHouseEdgeShare(release: Pick<SSOTRelease, "meta"> | null | undefined) {
  return getReleaseLine(release) === "v1.6";
}
