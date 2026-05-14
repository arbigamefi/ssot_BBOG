"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "ssot-theme";

/**
 * Read the stored theme preference (light | dark | system).
 * Falls back to "system" when localStorage is unavailable (SSR).
 */
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* localStorage blocked */
  }
  return "system";
}

/**
 * Resolve the effective appearance (light | dark) based on the preference.
 */
function resolveAppearance(theme: Theme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Apply the effective theme marker to `<html>` and persist the preference.
 */
function applyTheme(theme: Theme) {
  const appearance = resolveAppearance(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", appearance === "dark");
  root.classList.toggle("light", appearance === "light");
  root.dataset.theme = appearance;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage blocked */
  }
}

// ——— Icon components ———

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
      />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
      />
    </svg>
  );
}

// ——— Exported component ———

export interface ThemeToggleProps {
  /** Extra class names applied to the wrapper. */
  className?: string;
}

/**
 * Cycles through light → dark → system on each click.
 * Persists preference to localStorage and applies `.dark` class on `<html>`.
 * Respects `prefers-color-scheme` when set to "system".
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = React.useState<Theme>("system");
  const [mounted, setMounted] = React.useState(false);

  // On mount, read stored preference and apply it.
  React.useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  // Listen to OS preference changes when in system mode.
  React.useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const cycleTheme = React.useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    applyTheme(next);
  }, [theme]);

  // Render a placeholder with the same dimensions until hydrated to avoid layout shift.
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";
  const ariaLabel = `Switch theme (current: ${label})`;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2 text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={cycleTheme}
      aria-label={ariaLabel}
      title={label}
      data-testid="theme-toggle"
    >
      {!mounted ? (
        /* Placeholder during SSR / before hydration — same size as icon. */
        <span className="h-5 w-5" />
      ) : theme === "light" ? (
        <SunIcon className="h-5 w-5" />
      ) : theme === "dark" ? (
        <MoonIcon className="h-5 w-5" />
      ) : (
        <MonitorIcon className="h-5 w-5" />
      )}
    </button>
  );
}
