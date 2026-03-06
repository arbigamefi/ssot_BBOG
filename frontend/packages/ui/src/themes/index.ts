/**
 * Theme Registry
 *
 * Each theme is a CSS file that defines the same set of CSS custom properties.
 * Switching themes = importing a different CSS file in globals.css.
 *
 * Available themes:
 *   - default.css  — "Slate"          (neutral light/dark)
 *   - brand-example.css — "Emerald Casino" (green + gold accent)
 *
 * All themes MUST define the following tokens (HSL components, no wrapper):
 *   --background, --foreground,
 *   --card, --card-foreground,
 *   --popover, --popover-foreground,
 *   --primary, --primary-foreground,
 *   --secondary, --secondary-foreground,
 *   --muted, --muted-foreground,
 *   --accent, --accent-foreground,
 *   --destructive, --destructive-foreground,
 *   --border, --input, --ring, --radius
 *
 * Both :root (light) and .dark selectors must be present.
 */

export const THEME_TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "radius",
] as const;

export type ThemeToken = (typeof THEME_TOKEN_NAMES)[number];

// Provide default values here for injection, using the premium palette
export const DEFAULT_THEME_VALUES: Record<ThemeToken, string> = {
  background: "222 47% 7%",     // Extremely dark navy/slate
  foreground: "0 0% 98%",
  card: "222 47% 9%",           // Slightly lighter dark navy
  "card-foreground": "0 0% 98%",
  popover: "222 47% 9%",
  "popover-foreground": "0 0% 98%",
  primary: "152 76% 51%",       // Neon Emerald Green
  "primary-foreground": "0 0% 100%",
  secondary: "271 81% 56%",     // Deep Neon Purple
  "secondary-foreground": "0 0% 100%",
  muted: "215 28% 17%",         // Muted dark bluish-grey
  "muted-foreground": "215 20% 65%",
  accent: "152 76% 51%",        // Same Emerald for highlights
  "accent-foreground": "0 0% 100%",
  destructive: "0 91% 60%",     // Bright red
  "destructive-foreground": "0 0% 98%",
  border: "216 34% 17%",
  input: "216 34% 17%",
  ring: "152 76% 51%",          // Emerald ring
  radius: "0.75rem",            // Rounded-xl by default
};
