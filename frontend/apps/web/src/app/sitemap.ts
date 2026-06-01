import type { MetadataRoute } from "next";

import { SITE_URL } from "../config/site";

const CASINO_GAMES = [
  "dice",
  "coin-toss",
  "roulette",
  "keno",
  "plinko",
  "slots",
  "baccarat",
  "sic-bo"
];

/**
 * Public, crawlable routes only. Account, ops, and API surfaces are
 * intentionally excluded (they're noindex / private). Sportsbook is omitted
 * until it ships (currently flag-gated off).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "casino", priority: 0.9, changeFrequency: "daily" as const },
    { path: "earn", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "affiliate", priority: 0.6, changeFrequency: "weekly" as const },
    { path: "support", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "status", priority: 0.3, changeFrequency: "weekly" as const },
    { path: "legal/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "legal/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "legal/disclaimer", priority: 0.3, changeFrequency: "yearly" as const }
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: route.path ? `${SITE_URL}/${route.path}` : SITE_URL,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));

  for (const slug of CASINO_GAMES) {
    entries.push({
      url: `${SITE_URL}/casino/${slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8
    });
  }

  return entries;
}
