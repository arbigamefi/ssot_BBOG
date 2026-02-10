import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Games — SSOT v2",
  description: "Browse available on-chain games",
};

/**
 * Games route layout — no extra wrapping needed.
 * The root app/layout.tsx already provides <html>, <body>, providers, and AppShell.
 */
export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
