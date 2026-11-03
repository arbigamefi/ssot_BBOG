import * as React from "react";

import { HomePageClient } from "./pageClient";
import { SITE_URL } from "../../config/site";

// Organization + WebSite structured data for rich results. Server-rendered
// JSON-LD so crawlers see it without executing the client bundle.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "ArbiGameFi",
      url: SITE_URL,
      logo: `${SITE_URL}/brand/logo-icon.svg`,
      description: "Non-custodial on-chain gaming platform with verifiable settlement."
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "ArbiGameFi",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["en", "zh-Hans", "pt-BR", "ru", "tr"]
    }
  ]
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <HomePageClient />
    </>
  );
}
