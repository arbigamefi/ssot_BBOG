import type { Metadata } from "next";
import "./globals.css";

import { WebProviders } from "./providers/WebProviders";
import { SSOTSDKProvider } from "./providers/SSOTSDKProvider";
import { ReleaseProviderWagmi } from "./providers/ReleaseProviderWagmi";
import { SSOTRuntimeProvider } from "./providers/SSOTRuntimeProvider";
import { AnalyticsProvider } from "./providers/AnalyticsProvider";
import { Toaster } from "@ssot/ui";
import { SiteChrome } from "../components/SiteChrome";

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

/**
 * Inline script to apply theme markers before first paint, preventing FOUC.
 * Reads `ssot-theme` from localStorage and applies `.dark` / `.light` plus
 * `data-theme` to <html> when needed.
 * Must be a raw string — no React, no imports — runs synchronously in <head>.
 */
const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem("ssot-theme");
    var dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme:dark)").matches);
    var theme = dark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <WebProviders>
          <AnalyticsProvider>
            <ReleaseProviderWagmi>
              <SSOTRuntimeProvider>
                <SSOTSDKProvider>
                  <SiteChrome>{children}</SiteChrome>
                  <Toaster />
                </SSOTSDKProvider>
              </SSOTRuntimeProvider>
            </ReleaseProviderWagmi>
          </AnalyticsProvider>
        </WebProviders>
      </body>
    </html>
  );
}
