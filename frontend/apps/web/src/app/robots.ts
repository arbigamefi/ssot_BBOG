import type { MetadataRoute } from "next";

import { IS_INDEXABLE, SITE_URL } from "../config/site";

/**
 * Dynamic robots. On non-production (testnet/preview) the whole site is
 * disallowed so it never gets indexed. On production, public surfaces are
 * open but account / ops / API routes are excluded.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/ops", "/ops/", "/portfolio", "/portfolio/", "/api/"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
