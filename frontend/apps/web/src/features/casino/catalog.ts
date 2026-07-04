import {
  CASINO_MODULES,
  compareCasinoModules,
  getCasinoModule,
  isCasinoModuleSlug
} from "./modules";

export type CatalogRoom = {
  slug: string;
  label: string;
  href: string;
  badge: string;
  summary: string;
  facts: string[];
};

type ReleaseGameMetaLike = {
  slug: string;
  label: string;
};

type CatalogSeed = {
  slug: string;
  label: string;
};

export function getCatalogRooms(rawGamesMeta?: Array<ReleaseGameMetaLike | null | undefined>) {
  const source: CatalogSeed[] =
    rawGamesMeta?.filter((game): game is ReleaseGameMetaLike => {
      if (!game?.slug || !game.label) return false;
      return isCasinoModuleSlug(game.slug);
    }) ?? [];

  const fallback: CatalogSeed[] = CASINO_MODULES.map((casinoModule) => ({
    slug: casinoModule.slug,
    label: casinoModule.label
  }));

  const ordered: CatalogSeed[] = (source.length ? source : fallback)
    .slice()
    .sort(compareCasinoModules);

  return ordered.map<CatalogRoom>((game) => {
    const casinoModule = getCasinoModule(game.slug);
    return {
      slug: game.slug,
      label: game.label,
      href: casinoModule?.canonicalHref ?? `/casino/${game.slug}`,
      badge: casinoModule?.roomLabel ?? game.label,
      summary: "",
      facts: []
    };
  });
}
