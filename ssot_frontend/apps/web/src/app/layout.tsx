import type { Metadata } from "next";
import "./globals.css";

import { WebProviders } from "./providers/WebProviders";
import { SSOTSDKProvider } from "./providers/SSOTSDKProvider";
import { ReleaseProviderWagmi } from "./providers/ReleaseProviderWagmi";
import { SSOTRuntimeProvider } from "./providers/SSOTRuntimeProvider";
import { AppShell } from "../components/AppShell";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <WebProviders>
          <ReleaseProviderWagmi>
            <SSOTRuntimeProvider>
              <SSOTSDKProvider>
                <AppShell>{children}</AppShell>
                <Toaster />
              </SSOTSDKProvider>
            </SSOTRuntimeProvider>
          </ReleaseProviderWagmi>
        </WebProviders>
      </body>
    </html>
  );
}
