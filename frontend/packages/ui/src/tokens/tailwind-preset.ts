import type { Config } from "tailwindcss";

const hsl = (token: string) => `hsl(var(${token}) / <alpha-value>)`;
const hsla = (token: string, alpha: number) => `hsl(var(${token}) / ${alpha})`;

const preset: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [],
  theme: {
    extend: {
      colors: {
        surface: {
          0: hsl("--surface-0"),
          1: hsl("--surface-1"),
          2: hsl("--surface-2"),
          3: hsl("--surface-3")
        },
        fg: {
          DEFAULT: hsl("--fg"),
          muted: hsl("--fg-muted"),
          subtle: hsl("--fg-subtle"),
          inverse: hsl("--fg-inverse")
        },
        border: {
          DEFAULT: hsl("--border"),
          soft: hsl("--border-soft")
        },
        brand: {
          DEFAULT: hsl("--brand"),
          hover: hsl("--brand-hover"),
          active: hsl("--brand-active"),
          soft: hsla("--brand", 0.12),
          ring: hsla("--brand", 0.45)
        },
        accent: {
          DEFAULT: hsl("--accent"),
          hover: hsl("--accent-hover"),
          soft: hsla("--accent", 0.12),
          foreground: hsl("--accent-foreground")
        },
        success: {
          DEFAULT: hsl("--success"),
          soft: hsla("--success", 0.12)
        },
        warn: {
          DEFAULT: hsl("--warn"),
          soft: hsla("--warn", 0.14)
        },
        danger: {
          DEFAULT: hsl("--danger"),
          soft: hsla("--danger", 0.12)
        },
        info: {
          DEFAULT: hsl("--info"),
          soft: hsla("--info", 0.12)
        },

        input: hsl("--input"),
        ring: hsl("--ring"),
        background: hsl("--background"),
        foreground: hsl("--foreground"),
        primary: {
          DEFAULT: hsl("--primary"),
          foreground: hsl("--primary-foreground")
        },
        secondary: {
          DEFAULT: hsl("--secondary"),
          foreground: hsl("--secondary-foreground")
        },
        muted: {
          DEFAULT: hsl("--muted"),
          foreground: hsl("--muted-foreground")
        },
        destructive: {
          DEFAULT: hsl("--destructive"),
          foreground: hsl("--destructive-foreground")
        },
        card: {
          DEFAULT: hsl("--card"),
          foreground: hsl("--card-foreground")
        },
        popover: {
          DEFAULT: hsl("--popover"),
          foreground: hsl("--popover-foreground")
        }
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-pill)"
      },
      boxShadow: {
        e1: "var(--elev-1)",
        e2: "var(--elev-2)",
        e3: "var(--elev-3)",
        glow: "var(--elev-glow)",
        "inner-e1": "var(--elev-inner-1)"
      },
      backgroundImage: {
        skeleton:
          "linear-gradient(90deg, hsl(var(--surface-2)), hsl(var(--surface-3)), hsl(var(--surface-2)))"
      },
      backgroundSize: {
        "skeleton-size": "200% 100%"
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        base: "var(--motion-base)",
        slow: "var(--motion-slow)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down var(--motion-base) ease-out",
        "accordion-up": "accordion-up var(--motion-base) ease-out",
        shimmer: "shimmer 1.4s ease-in-out infinite"
      }
    }
  }
};

export default preset;
