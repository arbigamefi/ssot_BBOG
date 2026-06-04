/**
 * Shared renderer palette for dynamic Open Graph / Twitter cards (next/og).
 * Hex literals are intentionally isolated here because ImageResponse runs
 * outside the Tailwind/CSS-variable layer and needs concrete inline colors.
 */
export const OG_COLORS = {
  bg: "#070a0e",
  fg: "#f8fafc",
  muted: "#98a3b4",
  surface: "#111827",
  surface2: "#172032",
  border: "#263246",
  brand: "#8F6CF9",
  cyan: "#6EE7F9",
  green: "#52D4A6",
  red: "#FF5B6C",
  amber: "#F8C76B",
  deep: "#05070a",
  ink: "#0b1120",
  white: "#ffffff",
  diceFaceTop: "#202c44",
  brandDark: "#6d49e0",
  cyanDark: "#2f9fb8",
  coinText: "#06181d",
  felt: "#07110e",
  diceFace: "#eef2f8"
} as const;

export type OgTone = "brand" | "cyan" | "green" | "red" | "amber" | "muted";

export function getOgToneColor(tone: OgTone = "brand") {
  if (tone === "cyan") return OG_COLORS.cyan;
  if (tone === "green") return OG_COLORS.green;
  if (tone === "red") return OG_COLORS.red;
  if (tone === "amber") return OG_COLORS.amber;
  if (tone === "muted") return OG_COLORS.muted;
  return OG_COLORS.brand;
}
