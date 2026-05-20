import * as React from "react";
import { cn } from "@ssot/ui";

/**
 * Slot symbol artwork — hand-drawn single-colour SVG icons.
 *
 * Extracted from the stage so the reel component and the paytable can share
 * the exact same glyphs. Each symbol carries an accessible label.
 */

export const SLOT_SYMBOLS = [
  { id: "cherry", tone: "text-danger" },
  { id: "lemon", tone: "text-accent" },
  { id: "bell", tone: "text-brand" },
  { id: "diamond", tone: "text-success" },
  { id: "crown", tone: "text-warn" },
  { id: "star", tone: "text-fg" },
  { id: "bar", tone: "text-fg-muted" },
  { id: "seven", tone: "text-brand" }
] as const;

export function symbolFor(value: number | undefined) {
  return SLOT_SYMBOLS[value ?? -1] ?? null;
}

export function SlotSymbolArt({
  value,
  size = "lg",
  label
}: {
  value: number | undefined;
  size?: "xs" | "sm" | "lg";
  label: string;
}) {
  const meta = symbolFor(value);
  const sizeClass =
    size === "xs"
      ? "h-7 w-7"
      : size === "sm"
        ? "h-10 w-10"
        : "h-16 w-16 md:h-[4.5rem] md:w-[4.5rem]";

  if (!meta) {
    return (
      <span
        className={cn("font-mono font-semibold text-fg", size === "lg" ? "text-5xl" : "text-2xl")}
      >
        —
      </span>
    );
  }

  const iconClass = cn(sizeClass, meta.tone, "drop-shadow-[0_8px_18px_hsl(var(--surface-0)/0.7)]");

  return (
    <span className="relative inline-flex items-center justify-center" aria-label={label}>
      <span className="sr-only">{label}</span>
      {meta.id === "cherry" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M50 35c5-14 13-24 27-27"
            fill="none"
            stroke="hsl(var(--success))"
            strokeLinecap="round"
            strokeWidth="7"
          />
          <path
            d="M39 41c1-14 7-25 21-33"
            fill="none"
            stroke="hsl(var(--success))"
            strokeLinecap="round"
            strokeWidth="7"
          />
          <circle cx="34" cy="62" r="20" fill="currentColor" />
          <circle cx="63" cy="58" r="18" fill="currentColor" opacity="0.82" />
          <circle cx="26" cy="54" r="5" fill="hsl(var(--fg) / 0.72)" />
        </svg>
      )}
      {meta.id === "lemon" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M18 50c10-26 36-38 62-32 8 24-4 51-32 62-19-4-30-14-30-30Z"
            fill="currentColor"
          />
          <path
            d="M28 48c9-14 22-22 41-23"
            fill="none"
            stroke="hsl(var(--surface-0) / 0.55)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M50 80c-14-7-23-17-32-30"
            fill="none"
            stroke="hsl(var(--surface-0) / 0.32)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      )}
      {meta.id === "bell" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M25 70h46c-7-8-8-16-8-30 0-13-7-22-15-22s-15 9-15 22c0 14-1 22-8 30Z"
            fill="currentColor"
          />
          <path d="M38 72c2 8 6 12 10 12s8-4 10-12H38Z" fill="currentColor" opacity="0.7" />
          <path d="M42 15h12l-3 9h-6l-3-9Z" fill="currentColor" opacity="0.75" />
          <path
            d="M36 40c0-8 4-14 11-17"
            fill="none"
            stroke="hsl(var(--fg) / 0.7)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      )}
      {meta.id === "diamond" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path d="M48 8 82 48 48 88 14 48 48 8Z" fill="currentColor" />
          <path d="M48 8 60 48 48 88 36 48 48 8Z" fill="hsl(var(--surface-0) / 0.24)" />
          <path d="M14 48h68" stroke="hsl(var(--fg) / 0.52)" strokeWidth="4" />
          <path
            d="M28 31h40"
            stroke="hsl(var(--fg) / 0.42)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      )}
      {meta.id === "crown" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path d="M16 73h64l6-44-22 18L48 20 32 47 10 29l6 44Z" fill="currentColor" />
          <path d="M20 80h56" stroke="currentColor" strokeLinecap="round" strokeWidth="8" />
          <circle cx="48" cy="20" r="6" fill="currentColor" />
          <path
            d="M28 62h40"
            stroke="hsl(var(--surface-0) / 0.45)"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
      )}
      {meta.id === "star" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="m48 8 11 26 28 2-21 18 7 27-25-15-25 15 7-27L9 36l28-2L48 8Z"
            fill="currentColor"
          />
          <path
            d="M48 25 54 40l16 2"
            fill="none"
            stroke="hsl(var(--brand) / 0.68)"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
      )}
      {meta.id === "bar" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          {[23, 42, 61].map((y) => (
            <rect key={y} x="15" y={y} width="66" height="13" rx="4" fill="currentColor" />
          ))}
          <path
            d="M24 29h48M24 48h48M24 67h48"
            stroke="hsl(var(--surface-0) / 0.52)"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
      )}
      {meta.id === "seven" && (
        <svg className={iconClass} viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M22 18h52L44 82H25l25-49H22V18Z"
            fill="currentColor"
            stroke="hsl(var(--fg) / 0.55)"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path d="M36 47h24" stroke="hsl(var(--fg) / 0.7)" strokeLinecap="round" strokeWidth="5" />
        </svg>
      )}
    </span>
  );
}
