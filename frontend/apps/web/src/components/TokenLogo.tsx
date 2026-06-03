import * as React from "react";
import { cn } from "@ssot/ui";

/**
 * Curated token marks. Official brand colours live inside the SVG *asset* files
 * (public/tokens/*.svg), never as hex in product UI — so the token system stays
 * the single source for app theming. Keyed by uppercased symbol.
 */
const KNOWN_LOGOS: Record<string, string> = {
  USDC: "/tokens/usdc.svg",
  WETH: "/tokens/weth.svg"
};

/**
 * Renders a token's logo, or a token-system-styled monogram fallback for any
 * asset we don't bundle a mark for — so an amount input / selector never shows
 * a misleading generic icon (e.g. a "$" next to a WETH balance) or a broken
 * image. Decorative by default; pair it with the visible symbol text.
 */
export function TokenLogo({
  symbol,
  size = 20,
  className
}: {
  symbol?: string;
  size?: number;
  className?: string;
}) {
  const key = (symbol ?? "").trim().toUpperCase();
  const src = KNOWN_LOGOS[key];

  if (src) {
    // Tiny static SVG mark — a plain <img> is intentional (next/image is overkill
    // for a 20px inline icon; the project already uses <img> for avatars).
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-2 font-mono font-bold uppercase leading-none text-fg-subtle",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.44)) }}
    >
      {key ? key.slice(0, 1) : "?"}
    </span>
  );
}
