import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@ssot/ui";
import { AppShell } from "../app-shell/AppShell";
import { ProductProviders } from "../app-shell/ProductProviders";
import { ThemeInitScript } from "../app-shell/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://arbigamefi.com"),
  title: {
    default: "ArbiGameFi",
    template: "%s | ArbiGameFi"
  },
  description: "Non-custodial on-chain gaming platform with verifiable settlement.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png"
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "ArbiGameFi",
    description: "Non-custodial on-chain gaming platform with verifiable settlement.",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }]
  },
  twitter: {
    card: "summary_large_image",
    title: "ArbiGameFi",
    description: "Non-custodial on-chain gaming platform with verifiable settlement.",
    images: ["/og-image.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body className="min-h-screen">
        <ProductProviders>
          <AppShell>{children}</AppShell>
          <Toaster />
        </ProductProviders>
      </body>
    </html>
  );
}
