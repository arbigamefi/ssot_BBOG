export const CASINO_MODULE_SLUGS = [
  "roulette",
  "baccarat",
  "sic-bo",
  "dice",
  "coin-toss",
  "keno",
  "plinko",
  "slots"
] as const;

export type CasinoModuleSlug = (typeof CASINO_MODULE_SLUGS)[number];

export type CasinoModuleCategory = "table" | "dice" | "binary" | "lottery" | "arcade";

export type CasinoModuleRegistration = {
  slug: CasinoModuleSlug;
  label: string;
  category: CasinoModuleCategory;
  canonicalHref: `/casino/${CasinoModuleSlug}`;
  roomLabel: string;
  contractParams:
    | "roulette"
    | "dice-threshold"
    | "coin-side"
    | "keno-mask"
    | "plinko-risk"
    | "slots-profile"
    | "baccarat-side"
    | "sic-bo";
};

export const CASINO_MODULES: readonly CasinoModuleRegistration[] = [
  {
    slug: "roulette",
    label: "Roulette",
    category: "table",
    canonicalHref: "/casino/roulette",
    roomLabel: "European table",
    contractParams: "roulette"
  },
  {
    slug: "baccarat",
    label: "Baccarat",
    category: "table",
    canonicalHref: "/casino/baccarat",
    roomLabel: "Player vs banker",
    contractParams: "baccarat-side"
  },
  {
    slug: "sic-bo",
    label: "Sic Bo",
    category: "dice",
    canonicalHref: "/casino/sic-bo",
    roomLabel: "Three dice table",
    contractParams: "sic-bo"
  },
  {
    slug: "dice",
    label: "Dice",
    category: "dice",
    canonicalHref: "/casino/dice",
    roomLabel: "Precision room",
    contractParams: "dice-threshold"
  },
  {
    slug: "coin-toss",
    label: "Coin Toss",
    category: "binary",
    canonicalHref: "/casino/coin-toss",
    roomLabel: "Binary room",
    contractParams: "coin-side"
  },
  {
    slug: "keno",
    label: "Keno",
    category: "lottery",
    canonicalHref: "/casino/keno",
    roomLabel: "Matrix room",
    contractParams: "keno-mask"
  },
  {
    slug: "plinko",
    label: "Plinko",
    category: "arcade",
    canonicalHref: "/casino/plinko",
    roomLabel: "Peg board",
    contractParams: "plinko-risk"
  },
  {
    slug: "slots",
    label: "Slots",
    category: "arcade",
    canonicalHref: "/casino/slots",
    roomLabel: "Classic reels",
    contractParams: "slots-profile"
  }
] as const;

const CASINO_MODULE_BY_SLUG = new Map<string, CasinoModuleRegistration>(
  CASINO_MODULES.map((module) => [module.slug, module])
);

export function isCasinoModuleSlug(slug: string): slug is CasinoModuleSlug {
  return CASINO_MODULE_BY_SLUG.has(slug);
}

export function getCasinoModule(slug: string): CasinoModuleRegistration | undefined {
  return CASINO_MODULE_BY_SLUG.get(slug);
}

export function compareCasinoModules(
  a: { slug: string; label: string },
  b: { slug: string; label: string }
) {
  const aIndex = CASINO_MODULE_SLUGS.indexOf(a.slug as CasinoModuleSlug);
  const bIndex = CASINO_MODULE_SLUGS.indexOf(b.slug as CasinoModuleSlug);

  if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}
