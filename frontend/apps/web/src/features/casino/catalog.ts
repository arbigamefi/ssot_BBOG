import { getGamePresentation } from "./presentation";
import { getPrimaryGameHref } from "./routes";
import { CASINO_MODULES, compareCasinoModules, getCasinoModule } from "./modules";

export type CatalogRoom = {
  slug: string;
  label: string;
  href: string;
  badge: string;
  icon: string;
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
    rawGamesMeta?.filter((game): game is ReleaseGameMetaLike =>
      Boolean(game?.slug && game?.label)
    ) ?? [];

  const fallback: CatalogSeed[] = CASINO_MODULES.map((module) => ({
    slug: module.slug,
    label: module.label
  }));

  const ordered: CatalogSeed[] = (source.length ? source : fallback)
    .slice()
    .sort(compareCasinoModules);

  return ordered.map<CatalogRoom>((game) => {
    const module = getCasinoModule(game.slug);
    const presentation = getGamePresentation(game.slug, game.label);
    return {
      slug: game.slug,
      label: game.label,
      href: getPrimaryGameHref(game.slug),
      badge: module?.roomLabel ?? presentation.roomLabel,
      icon: presentation.icon,
      summary: presentation.listDescription,
      facts: presentation.cardFacts
    };
  });
}
