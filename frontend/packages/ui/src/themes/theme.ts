// Central design tokens + helpers
// These tokens map to CSS variables declared in globals.css to allow dynamic theming.

export const themeTokens = {
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
    "2xl": "var(--radius-2xl)",
  },
  shadow: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
  },
  gradient: {
    glass: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
    accent: "linear-gradient(120deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
    success: "linear-gradient(120deg, #10b981, #059669)",
    warn: "linear-gradient(120deg, #f59e0b, #d97706)",
    error: "linear-gradient(120deg, #ef4444, #dc2626)",
  },
} as const;

export type ThemeTokens = typeof themeTokens;

// Utility to compose a status gradient background based on state
export const statusBackground = (state: string) => {
  switch (state) {
    case "live":
      return "linear-gradient(120deg, #22d3ee, #0ea5e9)";
    case "rolling":
      return "linear-gradient(120deg, #f59e0b, #d97706)";
    case "result":
      return "linear-gradient(120deg, #10b981, #059669)";
    case "refunded":
      return "linear-gradient(135deg, #64748b, #475569)";
    default:
      return "linear-gradient(135deg, #6366f1, #3b82f6)";
  }
};
