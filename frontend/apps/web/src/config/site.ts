/**
 * Canonical site origin + indexing posture, env-driven.
 *
 * - `SITE_URL`: used for metadataBase, canonicals, sitemap, robots, OG URLs.
 *   Set NEXT_PUBLIC_SITE_URL per environment so preview/staging never emit
 *   production canonicals.
 * - `IS_INDEXABLE`: only the production mainnet deployment should be crawlable.
 *   Testnet / preview deployments return a site-wide noindex so they never
 *   compete with production in search results.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://arbigamefi.com").replace(
  /\/$/,
  ""
);

export const IS_INDEXABLE =
  (process.env.NEXT_PUBLIC_ENV ?? "development") === "production" &&
  !/sepolia|testnet|preview|localhost|vercel\.app/i.test(SITE_URL);
