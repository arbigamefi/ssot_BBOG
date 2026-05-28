/**
 * Single definition of "wager-bearing routes" — the surfaces where a player
 * can actually place a bet. Both the age/terms entry gate and the
 * self-exclusion gate key off this, so the two stay in lockstep.
 *
 * Deliberately NOT gated: marketing (`/`, `/affiliate`), legal (`/legal/*`),
 * support (`/support`), status (`/status`), and read-only account surfaces
 * (`/portfolio/*`). Gating those would (a) block visitors from reading the
 * very Terms they must accept — a catch-22 — and (b) hurt SEO/conversion on
 * the public landing pages.
 */
const WAGER_EXACT = ["/casino", "/sportsbook"];
const WAGER_PREFIXES = ["/casino/", "/sportsbook/"];

export function isWagerRoute(pathname: string): boolean {
  return (
    WAGER_EXACT.includes(pathname) || WAGER_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
