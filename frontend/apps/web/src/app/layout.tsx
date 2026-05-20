import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";

import { Toaster } from "@ssot/ui";
import { AppShell } from "../app-shell/AppShell";
import { ProductProviders } from "../app-shell/ProductProviders";
import { ThemeInitScript } from "../app-shell/ThemeProvider";
import { getRequestI18n } from "../i18n/request";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getRequestI18n();
  const { siteTitle, titleTemplate, description } = messages.metadata;

  return {
    metadataBase: new URL("https://arbigamefi.com"),
    title: {
      default: siteTitle,
      template: titleTemplate
    },
    description,
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      apple: "/apple-touch-icon.png"
    },
    manifest: "/manifest.json",
    openGraph: {
      title: siteTitle,
      description,
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }]
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description,
      images: ["/og-image.png"]
    }
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages } = await getRequestI18n();
  const sportsbookEnabledFlag = process.env.NEXT_PUBLIC_SPORTSBOOK_ENABLED;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body className="min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ProductProviders sportsbookEnabledFlag={sportsbookEnabledFlag}>
            <AppShell>{children}</AppShell>
            <Toaster />
          </ProductProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
