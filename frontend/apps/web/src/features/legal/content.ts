export type LegalSlug = "terms" | "privacy" | "disclaimer";

export const LEGAL_SLUGS: readonly LegalSlug[] = ["terms", "privacy", "disclaimer"];

export const LEGAL_NAV: ReadonlyArray<{ slug: LegalSlug; href: string }> = [
  { slug: "terms", href: "/legal/terms" },
  { slug: "privacy", href: "/legal/privacy" },
  { slug: "disclaimer", href: "/legal/disclaimer" }
];

/** Number of key points and sections each page renders from `legal.pages.<slug>` in every locale. */
export const LEGAL_LAYOUT: Readonly<Record<LegalSlug, { highlights: number; sections: number }>> = {
  terms: { highlights: 5, sections: 10 },
  privacy: { highlights: 3, sections: 4 },
  disclaimer: { highlights: 4, sections: 10 }
};
