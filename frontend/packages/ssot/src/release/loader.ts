import { ReleaseSchema, type SSOTRelease } from "./schema";
import { embeddedReleases } from "./embedded";

export type ReleaseLoadResult =
  | { ok: true; release: SSOTRelease; warnings: string[] }
  | { ok: false; error: string };

/**
 * Known module-name-to-slug/label mapping.
 * Used as a fallback when the embedded release has `games` but no `gamesMeta`.
 * This avoids a hard failure when the contract release bundle predates the
 * `gamesMeta` field addition or ssot:sync runs with an older manifest.
 */
const MODULE_SLUG_MAP: Record<string, { slug: string; label: string }> = {
  DiceModule: { slug: "dice", label: "Dice" },
  CoinTossModule: { slug: "coin-toss", label: "Coin Toss" },
  RouletteModule: { slug: "roulette", label: "Roulette" },
  KenoModule: { slug: "keno", label: "Keno" },
};

/**
 * Derive `gamesMeta` from the raw `games` record + `meta.abiIndex.contracts`
 * when the embedded JSON lacks it. Returns undefined if derivation isn't possible.
 */
function deriveGamesMeta(raw: any): Array<{ gameId: string; slug: string; label: string; module: string }> | undefined {
  const games = raw?.games;
  const contracts: any[] = raw?.meta?.abiIndex?.contracts;
  if (!games || typeof games !== "object" || !Array.isArray(contracts)) return undefined;

  // Build address → module name lookup from abiIndex
  const addrToModule: Record<string, string> = {};
  for (const c of contracts) {
    if (c.address && c.name) {
      addrToModule[String(c.address).toLowerCase()] = String(c.name);
    }
  }

  const result: Array<{ gameId: string; slug: string; label: string; module: string }> = [];
  for (const [gameId, moduleAddr] of Object.entries(games)) {
    const addr = String(moduleAddr).toLowerCase();
    const moduleName = addrToModule[addr];
    const mapping = moduleName ? MODULE_SLUG_MAP[moduleName] : undefined;
    if (mapping) {
      result.push({
        gameId: String(gameId).toLowerCase(),
        slug: mapping.slug,
        label: mapping.label,
        module: addr,
      });
    }
  }
  return result.length > 0 ? result : undefined;
}

export function loadEmbeddedRelease(chainId: number): ReleaseLoadResult {
  const raw = embeddedReleases[chainId];
  if (!raw) {
    return { ok: false, error: `No embedded release for chainId=${chainId}` };
  }

  // Defensive: if gamesMeta is absent, try to derive it from games + abiIndex.
  const obj = raw as any;
  if (!obj.gamesMeta && obj.games) {
    const derived = deriveGamesMeta(obj);
    if (derived) {
      obj.gamesMeta = derived;
    }
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
  // A few semantic sanity checks
  if (release.contracts.hub === "0x0000000000000000000000000000000000000000") {
    warnings.push("Hub address is zero; release is not usable for writes");
  }
  if (release.assets.some((a) => a.address === "0x0000000000000000000000000000000000000000")) {
    warnings.push("One or more asset addresses are zero");
  }
  return { ok: true, release, warnings };
}
