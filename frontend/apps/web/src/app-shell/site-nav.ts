// The site's one navigation (docs/design/03-information-architecture.md §4).
// Liquidity and Rewards keep their current routes until those pages move.

export type SiteSection = "casino" | "liquidity" | "rewards" | "help";

export const SITE_NAV: ReadonlyArray<{ section: SiteSection; href: string }> = [
  { section: "casino", href: "/casino" },
  { section: "liquidity", href: "/earn" },
  { section: "rewards", href: "/affiliate" },
  { section: "help", href: "/support" }
];

/** The player's own pages, reached from the wallet menu once a wallet is connected. */
export const WALLET_NAV: ReadonlyArray<{ key: "portfolio" | "bets" | "claims"; href: string }> = [
  { key: "portfolio", href: "/portfolio" },
  { key: "bets", href: "/portfolio/activity" },
  { key: "claims", href: "/portfolio/claims" }
];

function within(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

/** The top-level section a page belongs to, so the header can mark it. */
export function getSiteSection(pathname: string): SiteSection | null {
  if (within(pathname, "/casino")) return "casino";
  if (within(pathname, "/earn")) return "liquidity";
  if (within(pathname, "/affiliate") || pathname === "/portfolio/referral") return "rewards";
  if (within(pathname, "/support")) return "help";
  return null;
}

// Class strings the header and footer share. On carbon, what you can press is paper.
export const FOCUS_ON_CARBON =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-paper";
/** A paper menu row on carbon-deep: plain until the pointer or the keyboard reaches it. */
export const MENU_ROW =
  "flex min-h-11 w-full items-center gap-3 px-4 text-left text-paper hover:bg-carbon focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paper";
/** A menu that opens under a header control: carbon-deep with a structural edge. */
export const MENU_PANEL =
  "absolute right-0 top-full z-[60] mt-2 rounded-sheet border border-rule-carbon bg-carbon-deep py-2 text-note text-paper";
