import type { Metadata } from "next";
import "./globals.css";

import { WebProviders } from "./providers/WebProviders";
import { SSOTSDKProvider } from "./providers/SSOTSDKProvider";
import { ReleaseProviderWagmi } from "./providers/ReleaseProviderWagmi";
import { SSOTRuntimeProvider } from "./providers/SSOTRuntimeProvider";
import { AppShell } from "../components/AppShell";
import { AnalyticsProvider } from "./providers/AnalyticsProvider";
import { Toaster } from "@ssot/ui";

export const metadata: Metadata = {
  title: "SSOT v2",
  description: "Single Source of Truth — on-chain gaming protocol",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "SSOT v2",
    description: "Single Source of Truth — on-chain gaming protocol",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SSOT v2",
    description: "Single Source of Truth — on-chain gaming protocol",
    images: ["/og-image.png"],
  },
};

/**
 * Inline script to apply .dark class before first paint, preventing FOUC.
 * Reads `ssot-theme` from localStorage and applies `.dark` to <html> when needed.
 * Must be a raw string — no React, no imports — runs synchronously in <head>.
 */
const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem("ssot-theme");
    var dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme:dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
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
                  <AppShell>{children}</AppShell>
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
