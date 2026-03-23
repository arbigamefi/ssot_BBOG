import { getGamePresentation } from "./presentation";
import { getPrimaryGameHref } from "./routes";

const CANONICAL_ORDER = ["roulette", "dice", "coin-toss", "keno"] as const;

const FALLBACK_LABELS: Record<string, string> = {
  roulette: "Roulette",
  dice: "Dice",
  "coin-toss": "Coin Toss",
  keno: "Keno"
};

const ACCENTS: Record<string, "blue" | "emerald" | "amber" | "fuchsia" | "slate"> = {
  roulette: "emerald",
  dice: "blue",
  "coin-toss": "amber",
  keno: "fuchsia"
};

const BADGES: Record<string, string> = {
  roulette: "European table",
  dice: "Precision room",
  "coin-toss": "Binary room",
  keno: "Matrix room"
};

export type CatalogRoom = {
  slug: string;
  label: string;
  href: string;
  accent: "blue" | "emerald" | "amber" | "fuchsia" | "slate";
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

function canonicalSort(a: CatalogSeed, b: CatalogSeed) {
  const aIndex = CANONICAL_ORDER.indexOf(a.slug as (typeof CANONICAL_ORDER)[number]);
  const bIndex = CANONICAL_ORDER.indexOf(b.slug as (typeof CANONICAL_ORDER)[number]);

  if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

export function getCatalogRooms(rawGamesMeta?: Array<ReleaseGameMetaLike | null | undefined>) {
  const source: CatalogSeed[] =
    rawGamesMeta?.filter((game): game is ReleaseGameMetaLike =>
      Boolean(game?.slug && game?.label)
    ) ?? [];

  const fallback: CatalogSeed[] = CANONICAL_ORDER.map((slug) => {
    const label = FALLBACK_LABELS[slug] ?? slug;
    return {
      slug,
      label
    };
  });

  const ordered: CatalogSeed[] = (source.length ? source : fallback).slice().sort(canonicalSort);

  return ordered.map<CatalogRoom>((game) => {
    const presentation = getGamePresentation(game.slug, game.label);
    return {
      slug: game.slug,
      label: game.label,
      href: getPrimaryGameHref(game.slug),
      accent: ACCENTS[game.slug] ?? "slate",
      badge: BADGES[game.slug] ?? presentation.roomLabel,
      icon: presentation.icon,
      summary: presentation.listDescription,
      facts: presentation.cardFacts
    };
  });
}
