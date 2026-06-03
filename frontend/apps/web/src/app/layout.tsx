import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { Inter } from "next/font/google";
import "./globals.css";

import { Toaster } from "@ssot/ui";
import { AppShell } from "../app-shell/AppShell";
import { ProductProviders } from "../app-shell/ProductProviders";
import { getRequestI18n } from "../i18n/request";
import { IS_INDEXABLE, SITE_URL } from "../config/site";

// Self-hosted Inter (no external request, no FOUT). Subsets cover the Latin,
// Latin-Extended (tr/pt) and Cyrillic (ru) locales; CJK (zh-Hans) falls back
// to the system stack since Inter has no CJK coverage.
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap"
});

const OG_LOCALE_BY_APP_LOCALE: Record<string, string> = {
  en: "en_US",
  "zh-Hans": "zh_CN",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
  tr: "tr_TR"
};

export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getRequestI18n();
  const { siteTitle, titleTemplate, description } = messages.metadata;
  const ogLocale = OG_LOCALE_BY_APP_LOCALE[locale] ?? "en_US";

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: siteTitle,
      template: titleTemplate
    },
    description,
    applicationName: siteTitle,
    // Testnet / preview deployments stay out of the index entirely.
    robots: IS_INDEXABLE ? undefined : { index: false, follow: false },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
        : {}
    },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }]
    },
    manifest: "/manifest.json",
    // OG/Twitter images are provided by the file-based `opengraph-image.tsx`
    // convention (dynamic next/og cards), so no explicit `images` here.
    openGraph: {
      siteName: siteTitle,
      title: siteTitle,
      description,
      type: "website",
      locale: ogLocale,
      alternateLocale: Object.values(OG_LOCALE_BY_APP_LOCALE).filter((l) => l !== ogLocale)
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description
    }
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages } = await getRequestI18n();
  const defaultChainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  const sportsbookEnabledFlag = process.env.NEXT_PUBLIC_SPORTSBOOK_ENABLED;

  return (
    // The product is dark-only by design. Pin dark at the root so every page,
    // dialog, and overlay inherits it with zero per-component theme wiring —
    // `arbi-dark.css` keys off `:root[data-theme="dark"]` / `.dark` / bare
    // `:root`, and no `.light` is ever applied.
    <html lang={locale} className={`dark ${inter.variable}`} data-theme="dark">
      <body className="min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ProductProviders
            defaultChainId={defaultChainId}
            sportsbookEnabledFlag={sportsbookEnabledFlag}
          >
            <AppShell>{children}</AppShell>
            <Toaster />
          </ProductProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
