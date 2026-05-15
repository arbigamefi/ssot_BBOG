import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

/**
 * Flat ESLint config.
 *
 * This repo uses ESLint primarily for **architecture enforcement** ("SDK-only", "no deep imports").
 * TypeScript semantic rules can be tightened later without changing repo boundaries.
 */
export default [
  js.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/storybook-static/**"]
  },

  // Minimal TS parsing so that rules apply consistently on TS/TSX files.
  // Disable no-undef and no-unused-vars for TS — TypeScript's own checks are
  // strictly more capable and these ESLint rules produce false positives on
  // type annotations, DOM globals, and destructuring patterns in TS files.
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off"
    }
  },

  // apps/web: prevent deep imports and enforce "SDK-only".
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "../../packages/*/src/*",
            "../..//packages/*/src/*",
            "packages/*/src/*",
            "@ssot/ui/src/*",
            "@ssot/ssot/src/*"
          ],
          paths: [
            { name: "viem", message: "Use @ssot/ssot SDK instead of importing viem in apps/web." },
            {
              name: "wagmi",
              message:
                "wagmi is allowed only in app provider wiring; do not import it in pages/features."
            },
            {
              name: "@wagmi/core",
              message: "Use @ssot/ssot SDK instead of @wagmi/core in apps/web."
            },
            {
              name: "@rainbow-me/rainbowkit",
              message: "RainbowKit is allowed only in app provider wiring (ADR-028)."
            },
            { name: "ethers", message: "Do not introduce ethers; use @ssot/ssot SDK." }
          ]
        }
      ]
    }
  },

  // apps/web provider wiring: allow wagmi/RainbowKit, but keep other restrictions.
  {
    files: ["apps/web/src/app-shell/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "../../packages/*/src/*",
            "../..//packages/*/src/*",
            "packages/*/src/*",
            "@ssot/ui/src/*",
            "@ssot/ssot/src/*"
          ],
          paths: [
            { name: "viem", message: "Use @ssot/ssot SDK instead of importing viem in apps/web." },
            { name: "@wagmi/core", message: "Avoid @wagmi/core; prefer wagmi hooks/config." },
            { name: "ethers", message: "Do not introduce ethers; use @ssot/ssot SDK." }
          ]
        }
      ]
    }
  },

  // apps/web workers: allow viem for direct chain I/O (off-thread indexers).
  // Workers cannot use SDK factories — they need direct viem RPC access.
  {
    files: ["apps/web/src/workers/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "../../packages/*/src/*",
            "../..//packages/*/src/*",
            "packages/*/src/*",
            "@ssot/ui/src/*",
            "@ssot/ssot/src/*"
          ],
          paths: [
            { name: "wagmi", message: "wagmi is not available in web workers." },
            { name: "@wagmi/core", message: "Use viem client directly in workers." },
            { name: "@rainbow-me/rainbowkit", message: "RainbowKit is not available in workers." },
            { name: "ethers", message: "Do not introduce ethers; use viem." }
          ]
        }
      ]
    }
  },

  // UI package must remain pure UI.
  {
    files: ["packages/ui/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@ssot/ssot", message: "@ssot/ui must not depend on protocol packages." },
            { name: "viem", message: "@ssot/ui must not import chain clients." },
            { name: "wagmi", message: "@ssot/ui must not import wallet tooling." }
          ]
        }
      ]
    }
  }
];
