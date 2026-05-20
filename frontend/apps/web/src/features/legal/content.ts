export type LegalSlug = "terms" | "privacy" | "disclaimer";

export const LEGAL_SLUGS: readonly LegalSlug[] = ["terms", "privacy", "disclaimer"];

export const LEGAL_NAV: ReadonlyArray<{ slug: LegalSlug; href: string }> = [
  { slug: "terms", href: "/legal/terms" },
  { slug: "privacy", href: "/legal/privacy" },
  { slug: "disclaimer", href: "/legal/disclaimer" }
];
