import * as React from "react";

import { HomePageClient } from "./pageClient";
import { SITE_URL } from "../../config/site";
import { carbonCopyFontVariables } from "../../features/home/fonts";
import { getRequestI18n } from "../../i18n/request";

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

export default async function HomePage() {
  const { locale } = await getRequestI18n();
  return (
    <div className={carbonCopyFontVariables(locale)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <HomePageClient />
    </div>
  );
}
